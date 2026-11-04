// src/controllers/offlineTransactionController.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import {
  createOfflineTransaction,
  getOfflineTransactionReceipt,
  getRecentOfflineTransactions
} from '../services/offlineTransactionService';
import { createActivityLog } from '../services/activityLogService';

/**
 * POST /api/admin/offline-transactions
 * Create an offline transaction (POS checkout)
 * 
 * Request body:
 * {
 *   items: [{product_id: string, quantity: number}],
 *   payment_method: 'cash' | 'card',
 *   amount_paid: number,
 *   customer_info: {name?: string, phone?: string, email?: string}
 * }
 */
export const createOfflineTransactionController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const adminId = req.userId!;
    const { items, paymentMethod, amountPaid, customerInfo, bank } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required and must not be empty'
      });
    }

    if (!paymentMethod || !['cash', 'card', 'qris', 'bank_transfer'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Payment method must be "cash", "card", "qris", or "bank_transfer"'
      });
    }

    if (paymentMethod === 'bank_transfer' && !bank) {
      return res.status(400).json({
        success: false,
        message: 'Bank is required for bank_transfer payment method'
      });
    }

    if (typeof amountPaid !== 'number' || amountPaid < 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount paid must be a positive number'
      });
    }

    // Validate items structure
    for (const item of items) {
      if (!item.product_id || typeof item.quantity !== 'number' || item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Each item must have product_id and positive quantity'
        });
      }
    }

    // Call service to create transaction
    const result = await createOfflineTransaction({
      items,
      paymentMethod: paymentMethod as 'cash' | 'card' | 'qris' | 'bank_transfer',
      bank,
      amountPaid,
      customerInfo: customerInfo || {},
      adminId
    });

    // Log admin activity
    const totalQty = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    createActivityLog({
      user_id: adminId,
      action: 'CREATE_OFFLINE_TRANSACTION',
      module: 'ecommerce',
      entity_type: 'offline_transaction',
      entity_id: result.order_id,
      entity_name: result.order_number,
      description: `Membuat Transaksi Offline (POS) #${result.order_number} dengan total ${totalQty} barang`,
      metadata: {
        payment_method: paymentMethod,
        amount_paid: amountPaid,
        total_amount: result.total_amount,
        items_count: items.length
      },
      ip_address: req.ip || req.connection?.remoteAddress,
      user_agent: req.headers['user-agent'] as string || undefined
    });

    return res.status(201).json({
      success: true,
      message: 'Offline transaction created successfully',
      data: result
    });

  } catch (error: any) {
    console.error('Create offline transaction error:', error);

    // Map error messages to appropriate HTTP status codes
    const errorMsg = error.message || 'Failed to create offline transaction';

    if (errorMsg.includes('Insufficient stock')) {
      return res.status(409).json({
        success: false,
        message: errorMsg
      });
    }

    if (errorMsg.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: errorMsg
      });
    }

    if (errorMsg.includes('not available')) {
      return res.status(400).json({
        success: false,
        message: errorMsg
      });
    }

    return res.status(500).json({
      success: false,
      message: errorMsg
    });
  }
};

/**
 * GET /api/admin/offline-transactions/:id/receipt
 * Get receipt data for an offline transaction
 */
export const getOfflineTransactionReceiptController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required'
      });
    }

    const result = await getOfflineTransactionReceipt(id as string);

    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Get receipt error:', error);

    const errorMsg = error.message || 'Failed to fetch receipt';

    if (errorMsg.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: errorMsg
      });
    }

    return res.status(500).json({
      success: false,
      message: errorMsg
    });
  }
};

/**
 * GET /api/admin/offline-transactions
 * Get recent offline transactions
 */
export const getRecentOfflineTransactionsController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    }

    const result = await getRecentOfflineTransactions(limit);

    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Get recent transactions error:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch transactions'
    });
  }
};
