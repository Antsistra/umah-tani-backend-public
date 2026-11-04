// src/services/offlineTransactionService.ts
import { supabaseAdmin } from '../config/supabase';
import { generateDynamicQRIS } from './manualPaymentService';

interface OfflineTransactionItem {
  product_id: string;
  quantity: number;
}

interface CustomerInfo {
  name?: string;
  phone?: string;
  email?: string;
}

interface CreateOfflineTransactionInput {
  items: OfflineTransactionItem[];
  paymentMethod: 'cash' | 'card' | 'qris' | 'bank_transfer';
  bank?: string;
  amountPaid: number;
  customerInfo: CustomerInfo;
  adminId: string;
}

interface OfflineTransactionResult {
  success: boolean;
  order_id: string;
  order_number: string;
  total_amount: number;
  subtotal: number;
  payment_method: string;
  payment_status: string;
  status: string;
  amount_paid: number;
  change: number;
  payment?: {
    type: string;
    qrString?: string | null;
    bank?: string | null;
  };
}

/**
 * Create an offline transaction (POS checkout)
 * Calls the place_order_offline RPC which handles atomic order creation,
 * stock validation, and deduction.
 */
export async function createOfflineTransaction(
  input: CreateOfflineTransactionInput
): Promise<OfflineTransactionResult> {
  try {
    const {
      items,
      paymentMethod,
      bank,
      amountPaid,
      customerInfo,
      adminId
    } = input;

    // Call the place_order_direct RPC function with p_is_offline set to true
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'place_order_direct',
      {
        p_user_id: adminId,
        p_address_id: null,
        p_items: items,
        p_payment_method: paymentMethod,
        p_amount_paid: amountPaid,
        p_customer_info: customerInfo,
        p_is_offline: true
      }
    );

    if (rpcError) {
      const msg = rpcError.message ?? '';
      if (msg.includes('Insufficient stock')) {
        throw new Error(msg);
      }
      if (msg.includes('not found')) {
        throw new Error(`Product not found: ${msg}`);
      }
      if (msg.includes('not available')) {
        throw new Error(msg);
      }
      throw new Error(msg || 'Failed to create offline transaction');
    }

    const result = rpcResult as OfflineTransactionResult;

    // For offline QRIS: generate a dynamic QRIS string for the cashier to display
    if (paymentMethod === 'qris' && result.order_number) {
      try {
        const qrisString = generateDynamicQRIS(result.total_amount);

        // Store transaction record
        await supabaseAdmin.from('transactions').insert({
          order_id: result.order_id,
          gross_amount: result.total_amount,
          payment_type: 'qris',
          transaction_status: 'approved', // offline = immediately approved
          payment_info: { qrisString, amount: result.total_amount },
        });

        // Mark order as completed immediately (cashier confirms payment on spot)
        await supabaseAdmin
          .from('orders')
          .update({ status: 'completed', payment_status: 'paid', updated_at: new Date().toISOString() })
          .eq('id', result.order_id);

        return { ...result, status: 'completed', payment: { type: 'qris', qrString: qrisString } };
      } catch (qrisError) {
        console.error('QRIS generation failed for offline order:', qrisError);
        return result;
      }
    }

    // For offline bank_transfer: record immediately approved (cashier confirms)
    if (paymentMethod === 'bank_transfer' && result.order_number) {
      await supabaseAdmin.from('transactions').insert({
        order_id: result.order_id,
        gross_amount: result.total_amount,
        payment_type: 'bank_transfer',
        transaction_status: 'approved',
        payment_info: { bank: bank ?? 'unknown', amount: result.total_amount },
      });
      await supabaseAdmin
        .from('orders')
        .update({ status: 'completed', payment_status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', result.order_id);
      return { ...result, status: 'completed', payment: { type: 'bank_transfer', bank: bank ?? null } };
    }

    // For cash payment: order is completed immediately (paid on the spot)
    // RPC sets status='processing' by default, we update it to 'completed'
    if (paymentMethod === 'cash' && result.order_id) {
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', result.order_id);

      if (updateError) {
        console.warn('Failed to update cash order status to completed:', updateError);
      } else {
        result.status = 'completed';
      }
    }

    return result;
  } catch (error: any) {
    console.error('Create offline transaction error:', error);
    throw error;
  }
}

// Midtrans-specific helpers removed — offline payments now use manual/QRIS flow

/**
 * Fetch receipt data for offline transaction
 */
export async function getOfflineTransactionReceipt(orderId: string) {
  try {
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(
        `
        id,
        order_number,
        status,
        payment_status,
        payment_method,
        total_amount,
        subtotal,
        shipping_cost,
        shipping_recipient_name,
        shipping_phone,
        created_at,
        order_items(
          id,
          product_id,
          product_name,
          product_price,
          quantity,
          subtotal
        )
      `
      )
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`);
    }

    // For offline manual payments: status is already set correctly by createOfflineTransaction
    // No external sync needed

    return {
      success: true,
      order
    };
  } catch (error: any) {
    console.error('Get receipt data error:', error);
    throw error;
  }
}

/**
 * Get recent offline transactions for admin dashboard
 */
export async function getRecentOfflineTransactions(limit: number = 10) {
  try {
    const { data: transactions, error } = await supabaseAdmin
      .from('orders')
      .select(
        `
        id,
        order_number,
        status,
        payment_status,
        payment_method,
        total_amount,
        shipping_recipient_name,
        created_at
      `
      )
      .eq('payment_method', 'cash')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    return {
      success: true,
      data: transactions || []
    };
  } catch (error: any) {
    console.error('Get recent transactions error:', error);
    throw error;
  }
}
