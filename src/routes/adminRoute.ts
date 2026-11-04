import { Router } from 'express';
import {
  getAllOrders,
  getOrderDetail,
  createShipment,
  updateShipment,
  updateOrderStatus,
  getActivityLogs,
  isAdmin,
  getAllRefunds,
  resolveRefund
} from '../controllers/adminController';
import {
  createOfflineTransactionController,
  getOfflineTransactionReceiptController,
  getRecentOfflineTransactionsController
} from '../controllers/offlineTransactionController';
import {
  getLocalConfig,
  updateLocalConfig,
  getLocalOrders,
  updateLocalOrderStatus,
  bulkUpdateLocalOrderStatus,
} from '../controllers/localDeliveryController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// All admin routes require authentication + admin role
router.use(authMiddleware);
router.use(isAdmin);

// Orders management
router.get('/orders', getAllOrders);
router.get('/orders/:id', getOrderDetail);

// Shipment management
router.post('/orders/:id/shipment', createShipment);
router.put('/orders/:id/shipment', updateShipment);

// Order status management
router.put('/orders/:id/status', updateOrderStatus);

// Refund management
router.get('/refunds', getAllRefunds);
router.post('/orders/:id/refund/resolve', resolveRefund);

// Activity logs (admin audit trail)
router.get('/activity-logs', getActivityLogs);

// Offline transactions (POS checkout)
router.post('/offline-transactions', createOfflineTransactionController);
router.get('/offline-transactions', getRecentOfflineTransactionsController);
router.get('/offline-transactions/:id/receipt', getOfflineTransactionReceiptController);

// Kurir Lokal Umah Tani Agriculture
router.get('/local-delivery/config', getLocalConfig);
router.put('/local-delivery/config', updateLocalConfig);
router.get('/local-delivery/orders', getLocalOrders);
router.put('/local-delivery/orders/:id/status', updateLocalOrderStatus);
router.post('/local-delivery/orders/bulk-status', bulkUpdateLocalOrderStatus);

export default router;
