// src/middlewares/activityLogger.ts
import { Request, Response, NextFunction } from "express";
import { 
  createActivityLog, 
  generateActivityDescription, 
  ActivityLogData 
} from "../services/activityLogService";

// Extended Request interface untuk menambah activity log context
export interface ActivityLogRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name?: string;
  };
  activityLog?: {
    action: string;
    module: string;
    entityType: string;
    skipLogging?: boolean;
  };
  startTime?: number;
}

/**
 * Main activity logging middleware
 * Menangkap response setelah operasi berhasil dan log secara async
 */
export const logActivity = (
  action: string,
  module: string,
  entityType: string,
  options: {
    skipOnError?: boolean;
    includeRequestBody?: boolean;
    includeMetadata?: boolean;
  } = {}
) => {
  return (req: ActivityLogRequest, res: Response, next: NextFunction) => {
    // Set activity context di request untuk digunakan controller jika perlu
    req.activityLog = {
      action,
      module,
      entityType,
    };

    // Store original response methods untuk intercept
    const originalJson = res.json;
    const originalSend = res.send;

    // Flag to prevent double logging (res.json internally calls res.send)
    let logged = false;

    // Override res.json untuk capture response
    // Harus set logged=true SEBELUM call originalJson, karena originalJson
    // internal memanggil res.send dengan data yang sudah di-stringify (string).
    // Kita mau log dari sini karena 'data' masih berupa object asli.
    res.json = function (data: any) {
      if (!logged) {
        logged = true;
        setImmediate(async () => {
          await processActivityLog(req, res, data, action, module, entityType, options);
        });
      }

      // Call original res.json (yang akan call res.send internally)
      const result = originalJson.call(this, data);
      return result;
    };

    // Override res.send untuk capture non-JSON responses (fallback)
    res.send = function (data: any) {
      // Log hanya jika belum di-log oleh res.json
      if (!logged) {
        logged = true;
        setImmediate(async () => {
          await processActivityLog(req, res, data, action, module, entityType, options);
        });
      }

      const result = originalSend.call(this, data);
      return result;
    };

    next();
  };
};

/**
 * Process activity log secara async
 */
async function processActivityLog(
  req: ActivityLogRequest,
  res: Response,
  responseData: any,
  action: string,
  module: string,
  entityType: string,
  options: any
) {
  try {
    // Skip logging jika tidak memenuhi condition
    if (!shouldLogActivity(req, res, responseData, options)) {
      return;
    }

    // Extract entity information dari response atau request
    const entityInfo = extractEntityInfo(req, responseData, entityType);
    
    // Get user_id priority: req.body.user_id -> req.user.id -> development UUID
    const getUserId = (): string => {
      // Priority 1: dari request body (untuk development tanpa auth)
      if (req.body?.user_id) {
        return req.body.user_id;
      }
      
      // Priority 2: dari authenticated user
      if (req.user?.id) {
        return req.user.id;
      }
      
      // Priority 3: development fallback dengan valid UUID
      return '00000000-0000-4000-8000-000000000000'; // Valid UUID v4 untuk development
    };
    
    // Build activity log data
    const logData: ActivityLogData = {
      user_id: getUserId(),
      action,
      module,
      entity_type: entityType,
      entity_id: entityInfo.id,
      entity_name: entityInfo.name,
      description: generateActivityDescription(action, entityType, entityInfo.name),
      metadata: buildMetadata(req, res, responseData, options),
      ip_address: getClientIP(req),
      user_agent: req.get('User-Agent') || undefined,
    };

    // Insert log (fire-and-forget)
    await createActivityLog(logData);
    
  } catch (error: any) {
    // Log error tapi jangan ganggu main flow
    console.error("Activity logging middleware error:", {
      error: error.message,
      action,
      module,
      entityType,
      userId: req.body?.user_id || req.user?.id || 'development-fallback',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Determine apakah activity harus dilog
 */
function shouldLogActivity(
  req: ActivityLogRequest,
  res: Response,
  responseData: any,
  options: any
): boolean {
  // DEVELOPMENT MODE: Skip user check untuk no-auth development
  // Dalam production, uncomment line berikut:
  // if (!req.user?.id) {
  //   return false;
  // }

  // Skip jika explicitly disabled
  if (req.activityLog?.skipLogging) {
    return false;
  }

  // Skip jika response status error dan skipOnError enabled
  if (options.skipOnError && (!res.statusCode || res.statusCode >= 400)) {
    return false;
  }

  // Log hanya jika response success dan data.success = true
  const isSuccessResponse = 
    res.statusCode >= 200 && 
    res.statusCode < 300 && 
    (responseData?.success !== false);

  return isSuccessResponse;
}

/**
 * Extract entity information dari request/response
 */
function extractEntityInfo(
  req: ActivityLogRequest,
  responseData: any,
  entityType: string
): { id?: string; name?: string } {
  const resolveEntityName = (source: any): string | undefined => {
    if (!source || typeof source !== 'object') return undefined;

    const directName =
      source.title ||
      source.name ||
      source.nama ||
      source.full_name ||
      source.email;

    if (directName) {
      return directName;
    }

    if (entityType === 'aturan_rekomendasi') {
      const tanamanNama = source.tanaman?.nama;
      const varietasNama = source.varietas?.nama || 'Semua varietas';
      const labelOpsi = source.label_opsi;

      if (tanamanNama && labelOpsi) {
        return `${tanamanNama} - ${varietasNama} (${labelOpsi})`;
      }
    }

    return undefined;
  };

  // Priority 1: dari response data
  if (responseData?.data) {
    return {
      id: responseData.data.id || req.params.id,
      name: resolveEntityName(responseData.data)
    };
  }

  // Priority 2: dari URL params
  if (req.params.id) {
    return {
      id: typeof req.params.id === 'string' ? req.params.id : undefined,
      name: resolveEntityName(req.body) || (typeof req.params.id === 'string' ? req.params.id : undefined)
    };
  }

  // Priority 3: dari request body
  return {
    id: req.body?.id,
    name: resolveEntityName(req.body)
  };
}

/**
 * Build metadata object dari request/response
 */
function buildMetadata(
  req: ActivityLogRequest,
  res: Response,
  responseData: any,
  options: any
): Record<string, any> | undefined {
  const metadata: Record<string, any> = {};

  // Include request method dan endpoint
  metadata.method = req.method;
  metadata.endpoint = req.path;

  // Include request body jika enabled
  if (options.includeRequestBody && req.body) {
    // Filter sensitive data
    const safeBody = { ...req.body };
    delete safeBody.password;
    delete safeBody.token;
    delete safeBody.secret;
    
    metadata.requestBody = safeBody;
  }

  // Include additional metadata jika enabled
  if (options.includeMetadata) {
    metadata.responseTime = Date.now() - (req.startTime || Date.now());
    metadata.timestamp = new Date().toISOString();
    
    // Safely get content length
    const contentLength = res.get('Content-Length');
    if (contentLength) {
      metadata.contentLength = contentLength;
    }
  }

  // Include counts untuk tracking perubahan
  if (responseData?.total || responseData?.count) {
    metadata.totalRecords = responseData.total || responseData.count;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Get client IP address
 */
function getClientIP(req: Request): string | undefined {
  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    (req.connection as any)?.socket?.remoteAddress ||
    req.get('X-Forwarded-For') ||
    req.get('X-Real-IP')
  );
}

/**
 * Middleware untuk set request start time (untuk calculate response time)
 */
export const setRequestStartTime = (
  req: Request & { startTime?: number },
  res: Response,
  next: NextFunction
) => {
  req.startTime = Date.now();
  next();
};

/**
 * Middleware untuk skip activity logging pada specific routes
 */
export const skipActivityLogging = (
  req: ActivityLogRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.activityLog) {
    req.activityLog = {
      action: '',
      module: '',
      entityType: '',
      skipLogging: true
    };
  } else {
    req.activityLog.skipLogging = true;
  }
  next();
};

/**
 * Helper untuk create custom activity log di controller
 */
export const createCustomActivityLog = async (
  req: ActivityLogRequest,
  customData: Partial<ActivityLogData>
): Promise<void> => {
  if (!req.user?.id) return;

  const logData: ActivityLogData = {
    user_id: req.user.id,
    action: customData.action || 'CUSTOM_ACTION',
    module: customData.module || 'system',
    entity_type: customData.entity_type,
    entity_id: customData.entity_id,
    entity_name: customData.entity_name,
    description: customData.description || 
                 generateActivityDescription(
                   customData.action || 'CUSTOM_ACTION',
                   customData.entity_type || 'unknown',
                   customData.entity_name
                 ),
    metadata: customData.metadata,
    ip_address: customData.ip_address || getClientIP(req),
    user_agent: customData.user_agent || req.get('User-Agent'),
  };

  await createActivityLog(logData);
};

/**
 * Prebuilt middlewares untuk common actions
 */
export const blogActivityLogger = {
  createArticle: logActivity("CREATE_ARTICLE", "blog", "articles", { 
    includeRequestBody: true,
    includeMetadata: true 
  }),
  
  updateArticle: logActivity("UPDATE_ARTICLE", "blog", "articles", {
    includeRequestBody: true,
    includeMetadata: true
  }),
  
  deleteArticle: logActivity("DELETE_ARTICLE", "blog", "articles"),
  
  publishArticle: logActivity("PUBLISH_ARTICLE", "blog", "articles"),
  
  unpublishArticle: logActivity("UNPUBLISH_ARTICLE", "blog", "articles"),
  
  featureArticle: logActivity("FEATURE_ARTICLE", "blog", "articles"),
  
  unfeatureArticle: logActivity("UNFEATURE_ARTICLE", "blog", "articles"),
  
  createCategory: logActivity("CREATE_CATEGORY", "blog", "categories", {
    includeRequestBody: true
  }),
  
  updateCategory: logActivity("UPDATE_CATEGORY", "blog", "categories", {
    includeRequestBody: true
  }),
  
  deleteCategory: logActivity("DELETE_CATEGORY", "blog", "categories"),
};

export const staffActivityLogger = {
  createPegawai: logActivity("CREATE_PEGAWAI", "staff", "pegawai", {
    includeMetadata: true
  }),
  
  updatePegawai: logActivity("UPDATE_PEGAWAI", "staff", "pegawai", {
    includeMetadata: true  
  }),
  
  deletePegawai: logActivity("DELETE_PEGAWAI", "staff", "pegawai"),

  resetPasswordPegawai: logActivity("RESET_PASSWORD_PEGAWAI", "staff", "pegawai", {
    includeMetadata: true
  }),
};

// Rekomendasi loggers
export const rekomendasiActivityLogger = {
  // Tanaman loggers
  createTanaman: logActivity("CREATE_TANAMAN", "rekomendasi", "tanaman", {
    includeRequestBody: true,
    includeMetadata: true
  }),

  updateTanaman: logActivity("UPDATE_TANAMAN", "rekomendasi", "tanaman", {
    includeRequestBody: true,
    includeMetadata: true
  }),

  deleteTanaman: logActivity("DELETE_TANAMAN", "rekomendasi", "tanaman"),

  // Varietas loggers
  createVarietas: logActivity("CREATE_VARIETAS", "rekomendasi", "varietas", {
    includeRequestBody: true,
    includeMetadata: true
  }),

  updateVarietas: logActivity("UPDATE_VARIETAS", "rekomendasi", "varietas", {
    includeRequestBody: true,
    includeMetadata: true
  }),

  deleteVarietas: logActivity("DELETE_VARIETAS", "rekomendasi", "varietas"),

  // Pupuk loggers
  createPupuk: logActivity("CREATE_PUPUK", "rekomendasi", "pupuk", {
    includeRequestBody: true,
    includeMetadata: true
  }),

  updatePupuk: logActivity("UPDATE_PUPUK", "rekomendasi", "pupuk", {
    includeRequestBody: true,
    includeMetadata: true
  }),

  deletePupuk: logActivity("DELETE_PUPUK", "rekomendasi", "pupuk"),

  // Aturan rekomendasi loggers
  createAturan: logActivity("CREATE_ATURAN_REKOMENDASI", "rekomendasi", "aturan_rekomendasi", {
    includeRequestBody: true,
    includeMetadata: true
  }),

  updateAturan: logActivity("UPDATE_ATURAN_REKOMENDASI", "rekomendasi", "aturan_rekomendasi", {
    includeRequestBody: true,
    includeMetadata: true
  }),

  deleteAturan: logActivity("DELETE_ATURAN_REKOMENDASI", "rekomendasi", "aturan_rekomendasi"),
};

// E-commerce loggers
export const ecommerceActivityLogger = {
  // Product Category loggers
  createProductCategory: logActivity("CREATE_PRODUCT_CATEGORY", "ecommerce", "product_categories", {
    includeRequestBody: true,
    includeMetadata: true
  }),

  updateProductCategory: logActivity("UPDATE_PRODUCT_CATEGORY", "ecommerce", "product_categories", {
    includeRequestBody: true,
    includeMetadata: true
  }),

  deleteProductCategory: logActivity("DELETE_PRODUCT_CATEGORY", "ecommerce", "product_categories"),

  // Product loggers
  createProduct: logActivity("CREATE_PRODUCT", "ecommerce", "products", {
    includeRequestBody: true,
    includeMetadata: true
  }),
  
  updateProduct: logActivity("UPDATE_PRODUCT", "ecommerce", "products", {
    includeRequestBody: true,
    includeMetadata: true
  }),
  
  deleteProduct: logActivity("DELETE_PRODUCT", "ecommerce", "products"),
  
  updateStock: logActivity("UPDATE_STOCK", "ecommerce", "products", {
    includeRequestBody: true,
    includeMetadata: true
  }),
  
  // Future order loggers
  processOrder: logActivity("PROCESS_ORDER", "ecommerce", "orders"),
  
  cancelOrder: logActivity("CANCEL_ORDER", "ecommerce", "orders"),
};