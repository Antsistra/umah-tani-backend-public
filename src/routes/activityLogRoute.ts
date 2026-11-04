// src/routes/activityLogRoute.ts
import { Router } from "express";
import {
  getAllActivityLogsController,
  getActivityLogStatsController,
  getModuleActivityLogsController,
  getMyActivityLogsController,
  cleanupOldLogsController,
  exportActivityLogsController,
} from "../controllers/activityLogController";

const router = Router();

// ==========================================
// PUBLIC ROUTES (User dapat lihat aktivitasnya sendiri)
// ==========================================

/**
 * GET /api/activity-logs/my-activities
 * User melihat activity logs milik sendiri
 */
router.get('/my-activities', getMyActivityLogsController);

// ==========================================
// ADMIN ROUTES (Perlu authentication dan role-based access)
// ==========================================

/**
 * GET /api/admin/activity-logs
 * Get all activity logs dengan filtering dan pagination
 * Query params:
 * - userId: string (optional)
 * - module: string (optional) 
 * - action: string (optional)
 * - startDate: string (optional) - ISO date string
 * - endDate: string (optional) - ISO date string
 * - page: number (default: 1)
 * - limit: number (default: 50)
 */
router.get('/admin/activity-logs', getAllActivityLogsController);

/**
 * GET /api/admin/activity-logs/stats
 * Get activity logs statistics untuk dashboard
 * Returns: totalLogs, todayLogs, topModules, topActions, activeUsers
 */
router.get('/admin/activity-logs/stats', getActivityLogStatsController);

/**
 * GET /api/admin/activity-logs/user/:userId
 * Get activity logs untuk specific user
 * Params: userId (UUID)
 * Query params: limit, page
 */
/**
 * GET /api/admin/activity-logs/module/:module
 * Get activity logs untuk specific module
 * Params: module (blog, ecommerce, fertilizer, etc.)
 * Query params: limit, page, action, startDate, endDate
 */
router.get('/admin/activity-logs/module/:module', getModuleActivityLogsController);

/**
 * GET /api/admin/activity-logs/export
 * Export activity logs ke CSV atau JSON
 * Query params:
 * - startDate: string (optional)
 * - endDate: string (optional)
 * - module: string (optional)
 * - action: string (optional)
 * - format: 'csv' | 'json' (default: csv)
 */
router.get('/admin/activity-logs/export', exportActivityLogsController);

/**
 * DELETE /api/admin/activity-logs/cleanup
 * Cleanup old activity logs (maintenance)
 * Body: { daysToKeep: number } (default: 90)
 * Hanya owner yang bisa akses
 */
router.delete('/admin/activity-logs/cleanup', cleanupOldLogsController);

export default router;