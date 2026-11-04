// src/services/activityLogService.ts
import { supabaseAdmin } from "../config/supabase";
import { AppError } from "../utils/appError";

// Types untuk Activity Log
export interface ActivityLogData {
  user_id: string;
  action: string;
  module: string;
  entity_type?: string;
  entity_id?: string;
  entity_name?: string;
  description?: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export interface ActivityLogFilters {
  userId?: string;
  module?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ActivityLogWithUser {
  id: string;
  user_id: string;
  action: string;
  module: string;
  entity_type?: string;
  entity_id?: string;
  entity_name?: string;
  description?: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  updated_at: string;
  user_email: string;
  user_name: string | null;
  user_role: string;
}

/**
 * Create activity log entry
 * Fire-and-forget pattern untuk performance
 */
export const createActivityLog = async (logData: ActivityLogData): Promise<void> => {
  try {
    // Add timestamp explicitly
    const logEntry = {
      ...logData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Insert to Supabase (non-blocking untuk performance)
    const { error } = await supabaseAdmin
      .from("activity_logs")
      .insert(logEntry);

    if (error) {
      // Log error tapi jangan throw - logging failure tidak boleh break main functionality
      console.error("Activity log insert failed:", {
        error: error.message,
        data: logEntry,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    // Comprehensive error logging for debugging
    console.error("Activity logging service error:", {
      error: err.message,
      stack: err.stack,
      data: logData,
      timestamp: new Date().toISOString(),
    });
    // Never throw - logging harus fail-safe
  }
};

/**
 * Get activity logs with user information (normalized join)
 */
export const getActivityLogs = async (
  filters: ActivityLogFilters = {}
): Promise<ActivityLogWithUser[]> => {
  try {
    let query = supabaseAdmin
      .from("activity_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // Apply filters conditionally
    if (filters.userId) {
      query = query.eq("user_id", filters.userId);
    }
    if (filters.module) {
      query = query.eq("module", filters.module);
    }
    if (filters.action) {
      query = query.eq("action", filters.action);
    }
    if (filters.startDate) {
      query = query.gte("created_at", filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte("created_at", filters.endDate);
    }
    
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new AppError(`Failed to fetch activity logs: ${error.message}`, 500);
    }

    // Fetch user info for each unique user_id
    const logs = data || [];
    const uniqueUserIds = [...new Set(logs.map((log: any) => log.user_id).filter(Boolean))];

    const userMap = new Map<string, { email: string; name: string | null; role: string }>();

    // Set fallback for development/system user ID
    userMap.set('00000000-0000-4000-8000-000000000000', {
      email: 'system@umahtani.com',
      name: 'System User',
      role: 'system',
    });

    // 1. Try to fetch from profiles table
    try {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, role')
        .in('id', uniqueUserIds);
      
      if (!profilesError && profiles) {
        profiles.forEach((profile: any) => {
          userMap.set(profile.id, {
            email: profile.email || 'unknown@system.local',
            name: profile.name || null,
            role: profile.role || 'unknown',
          });
        });
      }
    } catch (err) {
      console.error("Error fetching profiles for activity logs:", err);
    }

    // 2. For any user_ids not found in profiles (excluding system user), fallback to auth.admin
    const missingUserIds = uniqueUserIds.filter(id => id !== '00000000-0000-4000-8000-000000000000' && !userMap.has(id));
    if (missingUserIds.length > 0) {
      await Promise.all(
        missingUserIds.map(async (userId) => {
          try {
            const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
            if (userData?.user) {
              userMap.set(userId, {
                email: userData.user.email || 'unknown@system.local',
                name: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || null,
                role: userData.user.user_metadata?.role || 'unknown',
              });
            }
          } catch {
            // Silently skip if user lookup fails
          }
        })
      );
    }

    // Transform data untuk UI dengan fallback values
    const logsList: any = logs.map((log: any) => {
      const user = userMap.get(log.user_id);
      return {
        ...log,
        user_email: user?.email || 'unknown@system.local',
        user_name: user?.name || 'System User',
        user_role: user?.role || 'unknown',
      };
    });

    logsList.total = count || 0;
    return logsList;
  } catch (error: any) {
    console.error("Error fetching activity logs:", error);
    throw new AppError(`Failed to fetch activity logs: ${error.message}`, 500);
  }
};

/**
 * Get activity logs stats untuk dashboard
 */
export const getActivityLogStats = async (): Promise<{
  totalLogs: number;
  todayLogs: number;
  topModules: Array<{ module: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
  activeUsers: number;
}> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Total logs count
    const { count: totalLogs, error: totalError } = await supabaseAdmin
      .from("activity_logs")
      .select("*", { count: "exact", head: true });

    if (totalError) throw totalError;

    // Today's logs
    const { count: todayLogs, error: todayError } = await supabaseAdmin
      .from("activity_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lte("created_at", `${today}T23:59:59.999Z`);

    if (todayError) throw todayError;

    // Top modules (last 30 days)
    const { data: moduleData, error: moduleError } = await supabaseAdmin
      .from("v_daily_activity_summary")
      .select("module, total_activities")
      .gte("activity_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order("total_activities", { ascending: false })
      .limit(5);

    if (moduleError) throw moduleError;

    // Aggregate top modules
    const moduleMap = new Map<string, number>();
    moduleData?.forEach(item => {
      const current = moduleMap.get(item.module) || 0;
      moduleMap.set(item.module, current + item.total_activities);
    });
    
    const topModules = Array.from(moduleMap.entries())
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top actions (last 30 days)
    const { data: actionData, error: actionError } = await supabaseAdmin
      .from("v_daily_activity_summary")
      .select("action, total_activities")
      .gte("activity_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order("total_activities", { ascending: false })
      .limit(10);

    if (actionError) throw actionError;

    // Aggregate top actions
    const actionMap = new Map<string, number>();
    actionData?.forEach(item => {
      const current = actionMap.get(item.action) || 0;
      actionMap.set(item.action, current + item.total_activities);
    });
    
    const topActions = Array.from(actionMap.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Active users (last 30 days)
    const { data: uniqueUsersData, error: usersError } = await supabaseAdmin
      .from("activity_logs")
      .select("user_id")
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (usersError) throw usersError;

    const activeUsers = new Set(uniqueUsersData?.map(log => log.user_id)).size;

    return {
      totalLogs: totalLogs || 0,
      todayLogs: todayLogs || 0,
      topModules,
      topActions,
      activeUsers,
    };
  } catch (error: any) {
    console.error("Error fetching activity log stats:", error);
    throw new AppError(`Failed to fetch activity log stats: ${error.message}`, 500);
  }
};

/**
 * Delete old activity logs (cleanup utility)
 */
export const cleanupOldLogs = async (daysToKeep: number = 90): Promise<number> => {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const { data, error } = await supabaseAdmin
      .from("activity_logs")
      .delete()
      .lt("created_at", cutoffDate.toISOString())
      .select("id");

    if (error) {
      throw new AppError(`Failed to cleanup old logs: ${error.message}`, 500);
    }

    const deletedCount = data?.length || 0;
    console.log(`Cleaned up ${deletedCount} old activity logs (older than ${daysToKeep} days)`);
    
    return deletedCount;
  } catch (error: any) {
    console.error("Error cleaning up old logs:", error);
    throw new AppError(`Failed to cleanup old logs: ${error.message}`, 500);
  }
};

/**
 * Helper function untuk generate human-readable descriptions
 */
export const generateActivityDescription = (
  action: string,
  entityType: string,
  entityName?: string,
  metadata?: Record<string, any>
): string => {
  const actionMap: Record<string, string> = {
    // Blog Module
    CREATE_ARTICLE: `Menambahkan Konten Edukasi: ${entityName || ""}`,
    UPDATE_ARTICLE: `Memperbarui Konten Edukasi: ${entityName || ""}`,
    DELETE_ARTICLE: `Menghapus Konten Edukasi: ${entityName || ""}`,
    PUBLISH_ARTICLE: `Mempublikasikan Konten Edukasi: ${entityName || ""}`,
    UNPUBLISH_ARTICLE: `Menyembunyikan Konten Edukasi: ${entityName || ""}`,
    FEATURE_ARTICLE: `Menampilkan Artikel di Featured: ${entityName || ""}`,
    UNFEATURE_ARTICLE: `Menghapus Artikel dari Featured: ${entityName || ""}`,
    
    CREATE_CATEGORY: `Menambahkan Kategori Blog: ${entityName || ""}`,
    UPDATE_CATEGORY: `Memperbarui Kategori Blog: ${entityName || ""}`,
    DELETE_CATEGORY: `Menghapus Kategori Blog: ${entityName || ""}`,
    
    // Staff Management Module
    CREATE_PEGAWAI: `Menambahkan Pegawai Baru: ${entityName || ""}`,
    UPDATE_PEGAWAI: `Memperbarui Data Pegawai: ${entityName || ""}`,
    DELETE_PEGAWAI: `Menghapus Pegawai: ${entityName || ""}`,
    RESET_PASSWORD_PEGAWAI: `Mereset Password Pegawai: ${entityName || ""}`,
    
    // E-commerce Module - Product Categories
    CREATE_PRODUCT_CATEGORY: `Menambahkan Kategori Produk: ${entityName || ""}`,
    UPDATE_PRODUCT_CATEGORY: `Memperbarui Kategori Produk: ${entityName || ""}`,
    DELETE_PRODUCT_CATEGORY: `Menghapus Kategori Produk: ${entityName || ""}`,
    
    // E-commerce Module - Products
    CREATE_PRODUCT: `Menambahkan Produk Baru: ${entityName || ""}`,
    UPDATE_PRODUCT: `Memperbarui Produk: ${entityName || ""}`,
    DELETE_PRODUCT: `Menghapus Produk: ${entityName || ""}`,
    UPDATE_STOCK: `Update Stok Barang: ${entityName || ""}`,
    PROCESS_ORDER: `Memproses Pesanan #${entityName || ""}`,
    CANCEL_ORDER: `Membatalkan Pesanan #${entityName || ""}`,
    
    // Fertilizer Module (Future)
    CREATE_FERTILIZER: `Menambahkan Data Pupuk: ${entityName || ""}`,
    UPDATE_RECOMMENDATION: `Memperbarui Rekomendasi Pupuk: ${entityName || ""}`,
    DELETE_FERTILIZER: `Menghapus Data Pupuk: ${entityName || ""}`,

    // Rekomendasi Module
    CREATE_TANAMAN: `Menambahkan Tanaman: ${entityName || ""}`,
    UPDATE_TANAMAN: `Memperbarui Tanaman: ${entityName || ""}`,
    DELETE_TANAMAN: `Menghapus Tanaman: ${entityName || ""}`,

    CREATE_VARIETAS: `Menambahkan Varietas: ${entityName || ""}`,
    UPDATE_VARIETAS: `Memperbarui Varietas: ${entityName || ""}`,
    DELETE_VARIETAS: `Menghapus Varietas: ${entityName || ""}`,

    CREATE_PUPUK: `Menambahkan Pupuk: ${entityName || ""}`,
    UPDATE_PUPUK: `Memperbarui Pupuk: ${entityName || ""}`,
    DELETE_PUPUK: `Menghapus Pupuk: ${entityName || ""}`,

    CREATE_ATURAN_REKOMENDASI: `Menambahkan Aturan Rekomendasi: ${entityName || ""}`,
    UPDATE_ATURAN_REKOMENDASI: `Memperbarui Aturan Rekomendasi: ${entityName || ""}`,
    DELETE_ATURAN_REKOMENDASI: `Menghapus Aturan Rekomendasi: ${entityName || ""}`,
  };

  let description = actionMap[action] || `${action} ${entityType}`;
  
  // Add metadata context if available
  if (metadata?.previousCount && metadata?.newCount) {
    description += ` (${metadata.previousCount} → ${metadata.newCount})`;
  }
  
  return description;
};

/**
 * Bulk insert activity logs (untuk batch operations)
 */
export const createBulkActivityLogs = async (
  logsData: ActivityLogData[]
): Promise<void> => {
  try {
    if (logsData.length === 0) return;

    const timestamp = new Date().toISOString();
    const logEntries = logsData.map(log => ({
      ...log,
      created_at: timestamp,
      updated_at: timestamp,
    }));

    const { error } = await supabaseAdmin
      .from("activity_logs")
      .insert(logEntries);

    if (error) {
      console.error("Bulk activity log insert failed:", {
        error: error.message,
        count: logsData.length,
        timestamp,
      });
    }
  } catch (err: any) {
    console.error("Bulk activity logging service error:", {
      error: err.message,
      count: logsData.length,
      timestamp: new Date().toISOString(),
    });
  }
};