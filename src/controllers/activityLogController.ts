// src/controllers/activityLogController.ts
import { Request, Response } from "express";
import { 
  getActivityLogs, 
  getActivityLogStats, 
  cleanupOldLogs,
  ActivityLogFilters 
} from "../services/activityLogService";

// Extended Request interface untuk authentication
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name?: string;
  };
}

/**
 * Get paginated activity logs dengan filtering
 * GET /api/admin/activity-logs
 */
export const getAllActivityLogsController = async (
  req: AuthenticatedRequest, 
  res: Response
) => {
  try {
    const {
      userId,
      module,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    // Calculate offset untuk pagination
    const offset = (Number(page) - 1) * Number(limit);

    // Build filters object
    const filters: ActivityLogFilters = {
      userId: userId as string,
      module: module as string,
      action: action as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: Number(limit),
      offset,
    };

    // // Role-based access control
    // if (req.user?.role === 'penyuluh') {
    //   // Penyuluh hanya bisa lihat logs di module blog
    //   filters.module = 'blog';
    // } else if (req.user?.role !== 'owner' && req.user?.role !== 'admin') {
    //   // Regular users hanya bisa lihat logs milik sendiri
    //   filters.userId = req.user?.id;
    // }

    const logs = await getActivityLogs(filters);

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: (logs as any).total ?? logs.length,
        hasNext: (logs as any).total ? (offset + logs.length < (logs as any).total) : logs.length === Number(limit),
      },
      filters: {
        userId,
        module,
        action,
        startDate,
        endDate,
      }
    });

  } catch (error: any) {
    console.error("Get activity logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data activity logs",
      error: error.message
    });
  }
};

/**
 * Get activity logs statistics untuk dashboard
 * GET /api/admin/activity-logs/stats
 */
export const getActivityLogStatsController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {

    const stats = await getActivityLogStats();

    return res.status(200).json({
      success: true,
      data: stats,
      message: "Statistik activity logs berhasil diambil"
    });

  } catch (error: any) {
    console.error("Get activity log stats error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil statistik activity logs",
      error: error.message
    });
  }
};

/**
 * Get activity logs untuk specific user
 * GET /api/admin/activity-logs/user/:userId
 */


/**
 * Get activity logs untuk specific module
 * GET /api/admin/activity-logs/module/:module
 */
export const getModuleActivityLogsController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { module } = req.params;
    const { limit = 20, page = 1, action, startDate, endDate } = req.query;

    // Role-based access control
    if (req.user?.role === 'penyuluh' && module !== 'blog') {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Penyuluh hanya dapat melihat logs module blog."
      });
    }

    const offset = (Number(page) - 1) * Number(limit);

    const filters: ActivityLogFilters = {
      module: module as any,
      action: action as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: Number(limit),
      offset,
    };

    const logs = await getActivityLogs(filters);

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: logs.length,
      }
    });

  } catch (error: any) {
    console.error("Get module activity logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil activity logs module",
      error: error.message
    });
  }
};

/**
 * Get my activity logs (untuk user melihat aktivitasnya sendiri)
 * GET /api/activity-logs/my-activities
 */
export const getMyActivityLogsController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "User tidak terautentikasi"
      });
    }

    const { limit = 10, page = 1 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const filters: ActivityLogFilters = {
      userId: req.user.id,
      limit: Number(limit),
      offset,
    };

    const logs = await getActivityLogs(filters);

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: logs.length,
      }
    });

  } catch (error: any) {
    console.error("Get my activity logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil activity logs pribadi",
      error: error.message
    });
  }
};

/**
 * Cleanup old activity logs (maintenance endpoint)
 * DELETE /api/admin/activity-logs/cleanup
 */
export const cleanupOldLogsController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    // Hanya owner yang bisa cleanup logs
    if (req.user?.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Hanya owner yang dapat menjalankan cleanup logs."
      });
    }

    const { daysToKeep = 90 } = req.body;
    const deletedCount = await cleanupOldLogs(Number(daysToKeep));

    return res.status(200).json({
      success: true,
      data: {
        deletedCount,
        daysToKeep: Number(daysToKeep),
      },
      message: `Berhasil menghapus ${deletedCount} activity logs lama (lebih dari ${daysToKeep} hari)`
    });

  } catch (error: any) {
    console.error("Cleanup old logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal menjalankan cleanup activity logs",
      error: error.message
    });
  }
};

/**
 * Export activity logs ke CSV (untuk reporting)
 * GET /api/admin/activity-logs/export
 */
export const exportActivityLogsController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    // Check authorization
    if (req.user?.role !== 'owner' && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Hanya owner dan admin yang dapat export logs."
      });
    }

    const {
      startDate,
      endDate,
      module,
      action,
      format = 'csv'
    } = req.query;

    // Get logs dengan filter
    const filters: ActivityLogFilters = {
      startDate: startDate as string,
      endDate: endDate as string,
      module: module as string,
      action: action as string,
      limit: 5000, // Limit untuk export
    };

    const logs = await getActivityLogs(filters);

    if (format === 'csv') {
      // Generate CSV content
      const csvHeader = 'Timestamp,User,Role,Action,Module,Entity,Description,IP Address\n';
      const csvRows = logs.map(log => {
        return [
          log.created_at,
          log.user_name || 'Unknown',
          log.user_role || 'unknown',
          log.action,
          log.module,
          log.entity_name || '',
          `"${(log.description || '').replace(/"/g, '""')}"`, // Escape quotes
          log.ip_address || ''
        ].join(',');
      }).join('\n');

      const csvContent = csvHeader + csvRows;

      // Set response headers untuk download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=activity-logs-${new Date().toISOString().split('T')[0]}.csv`);
      
      return res.send(csvContent);
    }

    // Default: return JSON
    return res.status(200).json({
      success: true,
      data: logs,
      exportInfo: {
        totalRecords: logs.length,
        exportDate: new Date().toISOString(),
        filters,
      }
    });

  } catch (error: any) {
    console.error("Export activity logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal export activity logs",
      error: error.message
    });
  }
};