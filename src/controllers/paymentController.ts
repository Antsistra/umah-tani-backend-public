import { Request, Response } from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../config/supabase';
import { NotificationService } from '../services/notificationService';
import {
  generateDynamicQRIS,
  getBankAccounts,
  uploadProofOfPayment,
} from '../services/manualPaymentService';
import { checkAndCancelExpiredOrders } from './orderController';

// ─── Multer config — memory storage (stream to Supabase, not disk) ──────────
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/octet-stream'];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, GIF are allowed.'));
    }
  },
}).single('proofImage');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getExpiresAt = (): string => {
  const hours = parseInt(process.env.PAYMENT_EXPIRY_HOURS ?? '24', 10);
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
};

/**
 * Safely find an order by either UUID id or order_number without Postgres UUID casting errors
 */
export const findOrderByAnyId = async (identifier: string) => {
  if (!identifier) return { data: null, error: null };
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier.trim());
  let query = supabaseAdmin.from('orders').select('*');
  if (isUuid) {
    query = query.eq('id', identifier.trim());
  } else {
    query = query.eq('order_number', identifier.trim());
  }
  return await query.maybeSingle();
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * Initiate Manual Payment (QRIS or Bank Transfer)
 * POST /api/payments/initiate
 * Body: { orderId, paymentMethod: 'qris' | 'bank_transfer', bankAccountId? }
 */
export const initiatePayment = async (req: Request, res: Response) => {
  try {
    const { orderId, paymentMethod, bankAccountId } = req.body;
    const userId = req.userId;

    if (!orderId || !paymentMethod) {
      return res.status(400).json({ error: 'orderId and paymentMethod are required' });
    }
    if (!['qris', 'bank_transfer'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'paymentMethod must be qris or bank_transfer' });
    }
    if (paymentMethod === 'bank_transfer' && !bankAccountId) {
      return res.status(400).json({ error: 'bankAccountId is required for bank_transfer' });
    }

    // Fetch order safely by order_number or UUID id
    const { data: order, error: orderError } = await findOrderByAnyId(orderId);

    if (orderError || !order) {
      console.error('Order not found during initiatePayment:', { orderId, orderError });
      return res.status(404).json({ error: 'Order not found', details: orderError?.message });
    }
    if (order.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to order' });
    }

    // Check if already paid
    if (order.payment_status === 'paid' || ['processing', 'shipped', 'delivered'].includes(order.status)) {
      return res.status(400).json({ error: 'Order is already paid' });
    }
    const validForPayment =
      ['awaiting_payment_method', 'awaiting_payment'].includes(order.status) &&
      order.payment_status === 'unpaid';
    if (!validForPayment) {
      return res.status(400).json({ error: 'Order is not eligible for payment' });
    }

    // Check expiry
    if (order.expires_at && new Date(order.expires_at) <= new Date()) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled', payment_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', order.id)
        .eq('status', 'awaiting_payment_method');

      await NotificationService.sendPersonalNotification(
        order.user_id,
        'Pesanan Dibatalkan ⏳',
        `Batas waktu pemilihan metode pembayaran untuk pesanan #${order.order_number} telah habis.`,
        'system'
      );
      return res.status(400).json({ error: 'Order has expired. Please create a new order.', code: 'ORDER_EXPIRED' });
    }

    // Check for existing pending_verification transaction
    const { data: existingTxs } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('order_id', order.id)
      .eq('transaction_status', 'pending_verification')
      .order('created_at', { ascending: false })
      .limit(1);

    const existingTx = existingTxs?.[0];
    const isSameMethod = existingTx && existingTx.payment_type === paymentMethod;
    const isSameBank =
      paymentMethod !== 'bank_transfer' ||
      existingTx?.payment_info?.bankAccountId === bankAccountId;

    if (existingTx && isSameMethod && isSameBank) {
      const paymentInfo = existingTx.payment_info ?? {};
      return res.json({
        success: true,
        message: 'Active payment already exists',
        data: {
          transactionId: existingTx.id,
          paymentMethod: existingTx.payment_type,
          ...(existingTx.payment_type === 'qris'
            ? { qrisString: paymentInfo.qrisString }
            : {
                bankName: paymentInfo.bankName,
                accountNumber: paymentInfo.accountNumber,
                accountName: paymentInfo.accountName,
              }),
          amount: Number(existingTx.gross_amount),
          expiresAt: paymentInfo.expiresAt || order.expires_at,
        },
      });
    }

    // Jika user ganti metode pembayaran atau ganti bank, batalkan transaksi sebelumnya
    if (existingTx) {
      await supabaseAdmin
        .from('transactions')
        .update({
          transaction_status: 'cancel',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTx.id);
    }

    let paymentInfo: Record<string, any> = {};
    const expiresAt =
      order.expires_at && new Date(order.expires_at) > new Date()
        ? order.expires_at
        : getExpiresAt();

    if (paymentMethod === 'qris') {
      const qrisString = generateDynamicQRIS(order.total_amount);
      paymentInfo = { qrisString, amount: order.total_amount, expiresAt };
    } else {
      // bank_transfer
      const { data: bankAccount, error: bankError } = await supabaseAdmin
        .from('bank_accounts')
        .select('id, bank_name, account_number, account_name')
        .eq('id', bankAccountId)
        .eq('is_active', true)
        .single();

      if (bankError || !bankAccount) {
        return res.status(404).json({ error: 'Bank account not found or inactive' });
      }
      paymentInfo = {
        bankAccountId: bankAccount.id,
        bankName: bankAccount.bank_name,
        accountNumber: bankAccount.account_number,
        accountName: bankAccount.account_name,
        amount: order.total_amount,
        expiresAt,
      };
    }

    // Insert transaction record
    const { data: newTx, error: insertError } = await supabaseAdmin
      .from('transactions')
      .insert({
        order_id: order.id,
        gross_amount: order.total_amount,
        payment_type: paymentMethod,
        transaction_status: 'pending_verification',
        payment_info: paymentInfo,
      })
      .select()
      .single();

    if (insertError || !newTx) {
      throw new Error(`Failed to create transaction: ${insertError?.message}`);
    }

    // Update order status & expiry
    await supabaseAdmin
      .from('orders')
      .update({
        payment_method: paymentMethod,
        status: 'awaiting_payment',
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    // Notify user
    if (userId) {
      const displayMethod = paymentMethod === 'qris' ? 'QRIS' : 'Transfer Bank';
      await NotificationService.sendPersonalNotification(
        userId,
        'Menunggu Pembayaran ⏳',
        `Pesanan #${order.order_number} berhasil dibuat. Silakan lakukan pembayaran menggunakan ${displayMethod}.`,
        'system'
      );
    }

    const responseData: Record<string, any> = {
      transactionId: newTx.id,
      paymentMethod,
      amount: Number(order.total_amount),
      expiresAt,
    };
    if (paymentMethod === 'qris') {
      responseData.qrisString = paymentInfo.qrisString;
    } else {
      responseData.bankName = paymentInfo.bankName;
      responseData.accountNumber = paymentInfo.accountNumber;
      responseData.accountName = paymentInfo.accountName;
    }

    res.json({ success: true, data: responseData });
  } catch (error: any) {
    console.error('Initiate payment error:', error);
    res.status(500).json({ error: 'Payment initiation failed', message: error.message });
  }
};

/**
 * Submit Proof of Payment
 * POST /api/payments/submit-proof
 * Body (multipart/form-data): { orderId, transactionId, proofImage: File }
 */
export const submitProof = async (req: Request, res: Response) => {
  try {
    const { orderId, transactionId } = req.body;
    const userId = req.userId;
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!orderId || !transactionId) {
      return res.status(400).json({ error: 'orderId and transactionId are required' });
    }
    if (!file) {
      return res.status(400).json({ error: 'proofImage file is required' });
    }

    // Validate order ownership safely by order_number or UUID id
    const { data: order, error: orderError } = await findOrderByAnyId(orderId);

    if (orderError || !order) {
      console.error('Order not found during submitProof:', { orderId, orderError });
      return res.status(404).json({ error: 'Order not found', details: orderError?.message });
    }
    if (order.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to order' });
    }

    // Validate transaction (support transaction UUID or match by order.id)
    let transaction: any = null;
    if (transactionId && transactionId !== order.order_number && transactionId !== order.id) {
      const { data: tx } = await supabaseAdmin
        .from('transactions')
        .select('id, order_id, transaction_status')
        .eq('id', transactionId)
        .maybeSingle();
      transaction = tx;
    }

    if (!transaction) {
      const { data: tx } = await supabaseAdmin
        .from('transactions')
        .select('id, order_id, transaction_status')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      transaction = tx;
    }

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found for this order' });
    }
    if (
      transaction.transaction_status !== 'pending_verification' &&
      transaction.transaction_status !== 'awaiting_verification'
    ) {
      return res.status(400).json({
        error: `Cannot submit proof for transaction in status: ${transaction.transaction_status}`,
      });
    }

    // Upload proof to Supabase Storage
    const mimeType = file.mimetype === 'application/octet-stream' ? 'image/jpeg' : file.mimetype;
    const filePath = await uploadProofOfPayment(
      file.buffer,
      mimeType,
      userId!,
      order.id
    );

    // Update transaction
    await supabaseAdmin
      .from('transactions')
      .update({
        proof_of_payment_url: filePath,
        transaction_status: 'awaiting_verification',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    // Touch orders updated_at so list triggers update
    await supabaseAdmin
      .from('orders')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    // Notify admins (broadcast to all admin users)
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    const adminNotifPromises = (admins ?? []).map((admin) =>
      NotificationService.sendPersonalNotification(
        admin.id,
        'Bukti Pembayaran Masuk 📄',
        `Pesanan #${order.order_number} telah mengirimkan bukti pembayaran. Silakan verifikasi.`,
        userId!
      )
    );
    await Promise.allSettled(adminNotifPromises);

    res.json({
      success: true,
      message: 'Bukti pembayaran berhasil dikirim, menunggu verifikasi admin',
    });
  } catch (error: any) {
    console.error('Submit proof error:', error);
    res.status(500).json({ error: 'Failed to submit proof', message: error.message });
  }
};

/**
 * Get Active Bank Accounts
 * GET /api/payments/bank-accounts
 */
export const listBankAccounts = async (_req: Request, res: Response) => {
  try {
    const accounts = await getBankAccounts();
    res.json({ success: true, data: accounts });
  } catch (error: any) {
    console.error('Get bank accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch bank accounts' });
  }
};

/**
 * Get Active Payment by Order Number
 * GET /api/payments/active/:orderNumber
 */
export const getActivePayment = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const userId = req.userId;

    if (!orderNumber) {
      return res.status(400).json({ error: 'Order number is required' });
    }

    if (userId) {
      await checkAndCancelExpiredOrders(userId);
    }

    const { data: order, error: orderError } = await findOrderByAnyId(orderNumber as string);

    if (orderError || !order) {
      console.error('Order not found during getActivePayment:', { orderNumber, orderError });
      return res.status(404).json({ error: 'Order not found', details: orderError?.message });
    }
    if (order.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to order' });
    }

    let { data: latestTxs, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('order_id', order.id)
      .neq('transaction_status', 'cancel')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!latestTxs || latestTxs.length === 0) {
      const { data: fallbackTxs, error: fallbackError } = await supabaseAdmin
        .from('transactions')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })
        .limit(1);
      latestTxs = fallbackTxs;
      txError = fallbackError;
    }

    if (txError) {
      return res.status(500).json({ error: 'Failed to fetch payment data' });
    }

    const tx = latestTxs?.[0];
    if (!tx) {
      return res.status(404).json({ error: 'Active payment not found for this order' });
    }

    const paymentInfo = tx.payment_info ?? {};

    // Jika pesanan sudah dibatalkan atau waktu pembayaran sudah lewat
    const isExpiredTime =
      (paymentInfo.expiresAt && new Date(paymentInfo.expiresAt) <= new Date()) ||
      (order.expires_at && new Date(order.expires_at) <= new Date());

    if (order.status === 'cancelled') {
      return res.json({
        success: true,
        data: {
          transactionId: tx.id,
          orderId: orderNumber,
          paymentMethod: tx.payment_type,
          transactionStatus: 'expire',
          orderStatus: 'cancelled',
          amount: Number(order.total_amount || tx.gross_amount),
          message: 'Batas waktu pembayaran telah habis. Pesanan telah dibatalkan.',
        },
      });
    }

    if (tx.transaction_status === 'pending_verification' && isExpiredTime) {
      await supabaseAdmin
        .from('orders')
        .update({
          status: 'cancelled',
          payment_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      await supabaseAdmin
        .from('transactions')
        .update({
          transaction_status: 'expire',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tx.id);

      return res.json({
        success: true,
        data: {
          transactionId: tx.id,
          orderId: orderNumber,
          paymentMethod: tx.payment_type,
          transactionStatus: 'expire',
          orderStatus: 'cancelled',
          amount: Number(tx.gross_amount),
          message: 'Batas waktu pembayaran telah habis. Pesanan telah dibatalkan.',
        },
      });
    }

    const isActionable = ['pending_verification', 'awaiting_verification'].includes(tx.transaction_status);

    const responseData: Record<string, any> = {
      transactionId: tx.id,
      orderId: orderNumber,
      paymentMethod: tx.payment_type,
      transactionStatus: tx.transaction_status,
      orderStatus: order.status,
      amount: Number(tx.gross_amount),
    };

    if (isActionable) {
      if (tx.payment_type === 'qris') {
        responseData.qrisString = paymentInfo.qrisString;
      } else {
        responseData.bankName = paymentInfo.bankName;
        responseData.accountNumber = paymentInfo.accountNumber;
        responseData.accountName = paymentInfo.accountName;
      }
      responseData.expiresAt = paymentInfo.expiresAt || order.expires_at;
    }

    return res.json({ success: true, data: responseData });
  } catch (error: any) {
    console.error('Get active payment error:', error);
    return res.status(500).json({ error: 'Failed to get active payment' });
  }
};
