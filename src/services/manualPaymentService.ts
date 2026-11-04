import { supabaseAdmin } from '../config/supabase';
import { NotificationService } from './notificationService';

// ─── QRIS EMV Dynamic Generator ──────────────────────────────────────────────

/**
 * Parse QRIS EMV string into a Map of tag -> value entries.
 * Format: TTLL...VALUE (Tag 2 chars, Length 2 chars, Value LL chars)
 */
const parseQrisEMV = (qrisString: string): Map<string, string> => {
  const fields = new Map<string, string>();
  let i = 0;
  while (i < qrisString.length - 4) { // -4 to exclude trailing CRC field
    const tag = qrisString.substring(i, i + 2);
    const len = parseInt(qrisString.substring(i + 2, i + 4), 10);
    if (isNaN(len) || i + 4 + len > qrisString.length) break;
    const value = qrisString.substring(i + 4, i + 4 + len);
    fields.set(tag, value);
    i += 4 + len;
  }
  return fields;
};

/**
 * Serialize a Map of tag -> value back into an EMV QRIS string (without CRC).
 */
const buildQrisEMV = (fields: Map<string, string>): string => {
  let result = '';
  for (const [tag, value] of fields.entries()) {
    const len = value.length.toString().padStart(2, '0');
    result += `${tag}${len}${value}`;
  }
  return result;
};

/**
 * Calculate CRC-16/CCITT-FALSE checksum for QRIS.
 * Polynomial: 0x1021, Initial value: 0xFFFF, No input/output reflection.
 */
const calculateCRC16 = (data: string): string => {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

/**
 * Generate a dynamic QRIS string from the static QRIS string stored in env.
 * Modifies field 54 (Transaction Amount) and recalculates CRC-16.
 *
 * @param amount - Payment amount in IDR (integer, e.g. 150000)
 * @returns Dynamic QRIS EMV string ready for QR code rendering
 */
export const generateDynamicQRIS = (amount: number): string => {
  const staticQris = process.env.QRIS_STATIC_STRING;
  if (!staticQris) {
    throw new Error('QRIS_STATIC_STRING env variable is not set');
  }

  // Strip the trailing 4-char CRC field (tag 63 + length 04 + 4-char checksum = 8 chars)
  const qrisWithoutCRC = staticQris.slice(0, -4);
  const fields = parseQrisEMV(qrisWithoutCRC);

  // Set point of initiation to "12" (dynamic QR)
  fields.set('01', '12');

  // Set transaction amount in field 54
  const amountStr = Math.round(amount).toString();
  fields.set('54', amountStr);

  // Ensure country code is set
  if (!fields.has('58')) {
    fields.set('58', 'ID');
  }

  // Rebuild string without CRC, then append CRC tag + length + new checksum
  const rebuilt = buildQrisEMV(fields);
  const withCrcTag = `${rebuilt}6304`; // 63=CRC tag, 04=length
  const crc = calculateCRC16(withCrcTag);

  return `${withCrcTag}${crc}`;
};

// ─── Bank Account Queries ────────────────────────────────────────────────────

export interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  bank_code?: string;
  logo_url?: string;
}

/**
 * Fetch all active bank accounts for manual bank transfer payments.
 */
export const getBankAccounts = async (): Promise<BankAccount[]> => {
  const { data, error } = await supabaseAdmin
    .from('bank_accounts')
    .select('id, bank_name, account_number, account_name, bank_code, logo_url')
    .eq('is_active', true)
    .order('bank_name');

  if (error) {
    throw new Error(`Failed to fetch bank accounts: ${error.message}`);
  }
  return data ?? [];
};

// ─── Proof of Payment Upload ─────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Upload proof of payment image to Supabase Storage.
 * Path format: {userId}/{orderId}/{timestamp}.{ext}
 *
 * @returns Public signed URL valid for 24 hours
 */
export const uploadProofOfPayment = async (
  fileBuffer: Buffer,
  mimeType: string,
  userId: string,
  orderId: string
): Promise<string> => {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error('File too large. Maximum size is 5MB');
  }

  const ext = (mimeType.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg');
  const timestamp = Date.now();
  const filePath = `${userId}/${orderId}/${timestamp}.${ext}`;
  const bucket = process.env.PAYMENT_PROOF_BUCKET ?? 'payment-proofs';

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload proof: ${uploadError.message}`);
  }

  // Generate signed URL valid for 24 hours
  const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(filePath, 60 * 60 * 24);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${signedUrlError?.message}`);
  }

  // Store the storage path (not the signed URL) in DB for future re-generation
  return filePath;
};

/**
 * Generate a signed URL for a stored proof file path.
 * Valid for 1 hour (for admin viewing).
 */
export const getProofSignedUrl = async (filePath: string): Promise<string> => {
  const bucket = process.env.PAYMENT_PROOF_BUCKET ?? 'payment-proofs';

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(filePath, 60 * 60); // 1 hour

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate proof URL: ${error?.message}`);
  }
  return data.signedUrl;
};

// ─── Restore Order Stock (helper) ────────────────────────────────────────────

export const restoreOrderStock = async (orderId: string): Promise<void> => {
  const { data: orderItems, error: orderItemsError } = await supabaseAdmin
    .from('order_items')
    .select('product_id, quantity')
    .eq('order_id', orderId);

  if (orderItemsError) {
    throw new Error(`Failed to fetch order items for restock: ${orderItemsError.message}`);
  }

  for (const item of orderItems ?? []) {
    if (!item.product_id || !item.quantity) continue;

    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, stock_quantity')
      .eq('id', item.product_id)
      .single();

    if (productError || !product) {
      console.warn('Product not found when restoring stock', { product_id: item.product_id });
      continue;
    }

    await supabaseAdmin
      .from('products')
      .update({ stock_quantity: Number(product.stock_quantity || 0) + Number(item.quantity || 0) })
      .eq('id', item.product_id);
  }
};

// ─── Approve & Reject Payment ────────────────────────────────────────────────

/**
 * Approve a manual payment:
 * - Marks transaction as approved
 * - Updates order to processing/paid
 * - Creates shipment record
 * - Sends notification to user
 */
export const approvePayment = async (transactionId: string, adminId: string): Promise<void> => {
  // Fetch transaction with order info
  const { data: transaction, error: txError } = await supabaseAdmin
    .from('transactions')
    .select('id, order_id, transaction_status')
    .eq('id', transactionId)
    .single();

  if (txError || !transaction) {
    throw new Error(`Transaction not found: ${txError?.message}`);
  }
  if (transaction.transaction_status !== 'awaiting_verification') {
    throw new Error(`Transaction is not awaiting verification (status: ${transaction.transaction_status})`);
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, order_number, courier, service_type, shipping_address')
    .eq('id', transaction.order_id)
    .single();

  if (orderError || !order) {
    throw new Error(`Order not found: ${orderError?.message}`);
  }

  // 1. Update transaction status
  const { error: txUpdateError } = await supabaseAdmin
    .from('transactions')
    .update({
      transaction_status: 'approved',
      verified_by: adminId,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', transactionId);

  if (txUpdateError) throw new Error(`Failed to update transaction: ${txUpdateError.message}`);

  // 2. Update order status
  const isOfflineOrder = order.shipping_address === 'POS Offline Transaction';
  const finalOrderStatus = isOfflineOrder ? 'completed' : 'processing';

  const { error: orderUpdateError } = await supabaseAdmin
    .from('orders')
    .update({
      status: finalOrderStatus,
      payment_status: 'paid',
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  if (orderUpdateError) throw new Error(`Failed to update order: ${orderUpdateError.message}`);

  // 3. Create shipment record for online orders
  if (!isOfflineOrder) {
    const { data: existingShipment } = await supabaseAdmin
      .from('order_shipments')
      .select('id')
      .eq('order_id', order.id)
      .single();

    if (!existingShipment) {
      await supabaseAdmin.from('order_shipments').insert({
        order_id: order.id,
        courier: order.courier ?? null,
        service_type: order.service_type ?? null,
        tracking_number: null,
        estimated_delivery: null,
        shipped_at: null,
        delivered_at: null,
        notes: null,
      });
    }
  }

  // 4. Send notification to user
  await NotificationService.sendPersonalNotification(
    order.user_id,
    'Pembayaran Dikonfirmasi 🎉',
    `Pembayaran untuk pesanan #${order.order_number} telah dikonfirmasi. Kami sedang memproses pesanan Anda.`,
    adminId
  );
};

/**
 * Reject a manual payment:
 * - Marks transaction as rejected with reason
 * - Cancels order and restores stock
 * - Sends notification to user
 */
export const rejectPayment = async (
  transactionId: string,
  adminId: string,
  reason: string
): Promise<void> => {
  const { data: transaction, error: txError } = await supabaseAdmin
    .from('transactions')
    .select('id, order_id, transaction_status')
    .eq('id', transactionId)
    .single();

  if (txError || !transaction) {
    throw new Error(`Transaction not found: ${txError?.message}`);
  }
  if (transaction.transaction_status !== 'awaiting_verification') {
    throw new Error(`Transaction is not awaiting verification (status: ${transaction.transaction_status})`);
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, order_number, status, payment_status')
    .eq('id', transaction.order_id)
    .single();

  if (orderError || !order) {
    throw new Error(`Order not found: ${orderError?.message}`);
  }

  // 1. Update transaction status
  const { error: txUpdateError } = await supabaseAdmin
    .from('transactions')
    .update({
      transaction_status: 'rejected',
      verified_by: adminId,
      verified_at: new Date().toISOString(),
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transactionId);

  if (txUpdateError) throw new Error(`Failed to update transaction: ${txUpdateError.message}`);

  // 2. Cancel order
  const { error: orderUpdateError } = await supabaseAdmin
    .from('orders')
    .update({
      status: 'cancelled',
      payment_status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  if (orderUpdateError) throw new Error(`Failed to cancel order: ${orderUpdateError.message}`);

  // 3. Restore stock
  await restoreOrderStock(order.id);

  // 4. Send notification to user
  await NotificationService.sendPersonalNotification(
    order.user_id,
    'Pembayaran Ditolak ❌',
    `Bukti pembayaran untuk pesanan #${order.order_number} ditolak. Alasan: ${reason}. Silakan hubungi kami jika ada pertanyaan.`,
    adminId
  );
};
