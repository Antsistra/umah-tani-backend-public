import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import {
  approvePayment,
  rejectPayment,
  getProofSignedUrl,
} from '../services/manualPaymentService';

// ─── Helper: log admin activity ───────────────────────────────────────────────

const logPaymentActivity = async (
  adminId: string,
  action: string,
  transactionId: string,
  orderNumber: string,
  details: any,
  req: Request
) => {
  try {
    await supabaseAdmin.from('activity_logs').insert({
      user_id: adminId,
      action: action.toUpperCase(),
      module: 'payment',
      entity_type: 'transaction',
      entity_id: transactionId,
      entity_name: orderNumber,
      description: details.description ?? `${action} transaction ${transactionId}`,
      metadata: details,
      ip_address: req.ip ?? (req as any).connection?.remoteAddress,
      user_agent: (req.headers['user-agent'] as string | undefined) ?? undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to log payment activity:', err);
  }
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * List Pending Payment Verifications
 * GET /api/admin/payments/pending
 * Query params: page (default 1), limit (default 20)
 */
export const getPendingPayments = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
    const limit = Math.min(100, parseInt((req.query.limit as string) ?? '20', 10));
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from('transactions')
      .select(
        `
        id,
        order_id,
        gross_amount,
        payment_type,
        transaction_status,
        proof_of_payment_url,
        payment_info,
        created_at,
        updated_at,
        orders (
          id,
          order_number,
          user_id,
          status,
          payment_status,
          shipping_recipient_name,
          shipping_phone
        )
      `,
        { count: 'exact' }
      )
      .eq('transaction_status', 'awaiting_verification')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch pending payments: ${error.message}`);
    }

    return res.json({
      success: true,
      data: data ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Get pending payments error:', error);
    return res.status(500).json({ error: 'Failed to fetch pending payments' });
  }
};

/**
 * Get Signed URL for Proof of Payment Image
 * GET /api/admin/payments/:id/proof
 */
export const getPaymentProof = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: transaction, error } = await supabaseAdmin
      .from('transactions')
      .select('id, proof_of_payment_url, transaction_status')
      .eq('id', id)
      .single();

    if (error || !transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    if (!transaction.proof_of_payment_url) {
      return res.status(404).json({ error: 'No proof of payment uploaded yet' });
    }

    const signedUrl = await getProofSignedUrl(transaction.proof_of_payment_url);

    return res.json({ success: true, data: { proofUrl: signedUrl } });
  } catch (error: any) {
    console.error('Get payment proof error:', error);
    return res.status(500).json({ error: 'Failed to generate proof URL' });
  }
};

/**
 * Approve Payment
 * POST /api/admin/payments/:id/approve
 */
export const approvePaymentHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = req.userId!;

    // Fetch transaction before approval for logging
    const { data: transaction } = await supabaseAdmin
      .from('transactions')
      .select('id, order_id, transaction_status, orders(order_number)')
      .eq('id', id)
      .single();

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    if (transaction.transaction_status !== 'awaiting_verification') {
      return res.status(400).json({
        error: `Cannot approve transaction in status: ${transaction.transaction_status}`,
      });
    }

    const order = Array.isArray(transaction.orders) ? transaction.orders[0] : transaction.orders;
    const orderNumber = (order as any)?.order_number ?? 'unknown';

    await approvePayment(String(id), adminId);

    await logPaymentActivity(adminId, 'payment_approved', String(id), String(orderNumber), {
      description: `Mengkonfirmasi pembayaran untuk Pesanan #${orderNumber}`,
      order_number: orderNumber,
      transaction_id: id,
    }, req);

    return res.json({ success: true, message: `Pembayaran untuk pesanan #${orderNumber} berhasil dikonfirmasi` });
  } catch (error: any) {
    console.error('Approve payment error:', error);
    return res.status(500).json({ error: 'Failed to approve payment', message: error.message });
  }
};

/**
 * Reject Payment
 * POST /api/admin/payments/:id/reject
 * Body: { reason: string }
 */
export const rejectPaymentHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.userId!;

    if (!reason || String(reason).trim().length === 0) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const { data: transaction } = await supabaseAdmin
      .from('transactions')
      .select('id, order_id, transaction_status, orders(order_number)')
      .eq('id', id)
      .single();

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    if (transaction.transaction_status !== 'awaiting_verification') {
      return res.status(400).json({
        error: `Cannot reject transaction in status: ${transaction.transaction_status}`,
      });
    }

    const order = Array.isArray(transaction.orders) ? transaction.orders[0] : transaction.orders;
    const orderNumber = (order as any)?.order_number ?? 'unknown';

    await rejectPayment(String(id), adminId, String(reason).trim());

    await logPaymentActivity(adminId, 'payment_rejected', String(id), String(orderNumber), {
      description: `Menolak pembayaran untuk Pesanan #${orderNumber}. Alasan: ${reason}`,
      order_number: orderNumber,
      transaction_id: id,
      rejection_reason: reason,
    }, req);

    return res.json({ success: true, message: `Pembayaran untuk pesanan #${orderNumber} ditolak` });
  } catch (error: any) {
    console.error('Reject payment error:', error);
    return res.status(500).json({ error: 'Failed to reject payment', message: error.message });
  }
};
