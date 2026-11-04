// src/controllers/orderController.ts
import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { supabaseAdmin } from "../config/supabase";
import { ORDER_EXPIRY_MINUTES } from "../config/orderConfig";
import { syncShipmentWithBiteship } from "./adminController";
import { NotificationService } from "../services/notificationService";
import {
  getLocalDeliveryConfig,
  haversineDistance,
  getTodayWIB,
  formatSlotLabel,
} from "../services/localDeliveryService";

/**
 * Helper to record local delivery order
 */
async function recordLocalDeliveryOrder(orderId: string, addressId: string, deliverySlotId?: string) {
  try {
    const { data: address } = await supabaseAdmin
      .from("user_addresses")
      .select("*")
      .eq("id", addressId)
      .single();

    if (!address || address.latitude == null || address.longitude == null) {
      console.warn("Cannot record local delivery: missing address coordinates", addressId);
      return;
    }

    const config = await getLocalDeliveryConfig();
    const originLat = config?.origin_latitude ?? -6.194032;
    const originLng = config?.origin_longitude ?? 106.208621;
    const distance = haversineDistance(originLat, originLng, address.latitude, address.longitude);

    const fullAddress = [
      address.address_line1,
      address.address_line2,
      address.village,
      address.subdistrict,
      address.city,
      address.province,
      address.postal_code,
    ]
      .filter(Boolean)
      .join(", ");

    await supabaseAdmin.from("local_delivery_orders").insert({
      order_id: orderId,
      delivery_slot_id: deliverySlotId || "pagi",
      delivery_date: getTodayWIB(),
      destination_latitude: address.latitude,
      destination_longitude: address.longitude,
      distance_km: distance,
      recipient_name: address.recipient_name,
      recipient_phone: address.phone,
      recipient_address: fullAddress,
      status: "pending",
    });
  } catch (err) {
    console.error("Failed to record local delivery order:", err);
  }
}

/**
 * POST /api/ecommerce/checkout
 * Create order from cart (atomic – race-condition safe)
 * Body: { address_id, shipping_cost, courier, service_type, delivery_slot_id }
 */
export const createOrderController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId!;
    const { address_id, shipping_cost = 0, courier, service_type, delivery_slot_id } = req.body;

    // Validate required fields
    if (!address_id) {
      return res.status(400).json({
        success: false,
        message: "Address ID is required"
      });
    }

    // Hitung waktu expiry order
    const expiresAt = new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Panggil RPC atomic – seluruh proses (lock stok, validasi, buat order,
    // kurangi stok, kosongkan cart) dijalankan dalam SATU transaksi PostgreSQL
    // sehingga tidak ada race condition antar concurrent checkout requests.
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'place_order_atomic',
      {
        p_user_id:       userId,
        p_address_id:    address_id,
        p_shipping_cost: shipping_cost,
        p_courier:       courier    || null,
        p_service_type:  service_type || null,
        p_expires_at:    expiresAt,
      }
    );

    if (rpcError) {
      // Map PostgreSQL custom error codes to user-friendly messages
      const msg: string = rpcError.message ?? '';
      if (msg.includes('Insufficient stock')) {
        return res.status(409).json({ success: false, message: msg });
      }
      if (msg.includes('Cart is empty')) {
        return res.status(400).json({ success: false, message: 'Cart is empty' });
      }
      if (msg.includes('Address not found')) {
        return res.status(404).json({ success: false, message: "Address not found or doesn't belong to you" });
      }
      if (msg.includes('not available')) {
        return res.status(400).json({ success: false, message: msg });
      }
      throw new Error(msg || 'Failed to place order');
    }

    const result = rpcResult as {
      success: boolean;
      order: Record<string, unknown>;
      order_id: string;
      order_number: string;
    };

    if (courier === 'umah_tani') {
      await recordLocalDeliveryOrder(result.order_id, address_id, delivery_slot_id);
    }

    // Fetch complete order with items for the response
    const { data: completeOrder } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_id,
          product_name,
          product_price,
          quantity,
          subtotal,
          products (
            image_url,
            weight_gram
          )
        )
      `)
      .eq('id', result.order_id)
      .single();

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: completeOrder
    });

  } catch (error: any) {
    console.error('Create order error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create order"
    });
  }
};

/**
 * POST /api/ecommerce/checkout/direct
 * Create order directly from items (Beli Sekarang – bypass cart)
 * Body: { address_id, items: [{product_id, quantity}], shipping_cost?, courier?, service_type? }
 */
export const createDirectOrderController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId!;
    const { address_id, items, shipping_cost = 0, courier, service_type, delivery_slot_id } = req.body;

    if (!address_id) {
      return res.status(400).json({
        success: false,
        message: "Address ID is required"
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Items wajib diisi dan tidak boleh kosong"
      });
    }

    // Validate each item has required fields
    for (const item of items) {
      if (!item.product_id || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Setiap item harus punya product_id dan quantity > 0"
        });
      }
    }

    const expiresAt = new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'place_order_direct',
      {
        p_user_id:       userId,
        p_address_id:    address_id,
        p_items:         items,
        p_shipping_cost: shipping_cost,
        p_courier:       courier || null,
        p_service_type:  service_type || null,
        p_expires_at:    expiresAt,
      }
    );

    if (rpcError) {
      const msg: string = rpcError.message ?? '';
      if (msg.includes('Insufficient stock')) {
        return res.status(409).json({ success: false, message: msg });
      }
      if (msg.includes('Address not found')) {
        return res.status(404).json({ success: false, message: "Address not found or doesn't belong to you" });
      }
      if (msg.includes('not available')) {
        return res.status(400).json({ success: false, message: msg });
      }
      if (msg.includes('Items cannot be empty')) {
        return res.status(400).json({ success: false, message: 'Items tidak boleh kosong' });
      }
      throw new Error(msg || 'Failed to place order');
    }

    const result = rpcResult as {
      success: boolean;
      order: Record<string, unknown>;
      order_id: string;
      order_number: string;
    };

    if (courier === 'umah_tani') {
      await recordLocalDeliveryOrder(result.order_id, address_id, delivery_slot_id);
    }

    const { data: completeOrder } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_id,
          product_name,
          product_price,
          quantity,
          subtotal,
          products (
            image_url,
            weight_gram
          )
        )
      `)
      .eq('id', result.order_id)
      .single();

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: completeOrder
    });

  } catch (error: any) {
    console.error('Create direct order error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create order"
    });
  }
};


/**
 * GET /api/ecommerce/orders
 * Get user's orders
 */
export const getUserOrdersController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId!;

    // Auto-cancel expired awaiting_payment_method orders first (passive check)
    await checkAndCancelExpiredOrders(userId);

    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_id,
          product_name,
          product_price,
          quantity,
          subtotal,
          products (
            image_url,
            weight_gram
          )
        ),
        transactions (
          id,
          transaction_id,
          payment_type,
          transaction_status,
          gross_amount,
          proof_of_payment_url,
          created_at
        ),
        local_delivery_orders (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch orders: ${error.message}`);
    }

    const localDeliveryConfig = await getLocalDeliveryConfig();
    const formattedOrders = (orders || []).map((ord: any) => {
      if (ord.local_delivery_orders && Array.isArray(ord.local_delivery_orders)) {
        ord.local_delivery_orders = ord.local_delivery_orders.map((ld: any) => ({
          ...ld,
          delivery_slot_label: formatSlotLabel(ld.delivery_slot_id, localDeliveryConfig),
        }));
      }
      return ord;
    });

    return res.status(200).json({
      success: true,
      data: formattedOrders
    });

  } catch (error: any) {
    console.error('Get orders error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch orders"
    });
  }
};

/**
 * GET /api/ecommerce/orders/:id
 * Get order detail by ID
 */
export const getOrderDetailController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Auto-cancel expired awaiting_payment_method orders first (passive check)
    await checkAndCancelExpiredOrders(userId);

    console.log(`[getOrderDetailController] Requested id: ${id}, userId: ${userId}`);

    if (!id || Array.isArray(id)) {
      return res.status(400).json({
        success: false,
        message: "Order ID is requireds"
      });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

    const baseSelect = `
        *,
        order_items (
          id,
          product_id,
          product_name,
          product_price,
          quantity,
          subtotal,
          products (
            image_url,
            weight_gram
          )
        ),
        order_shipments (
          id,
          order_id,
          courier,
          tracking_number,
          estimated_delivery,
          shipped_at,
          delivered_at,
          notes,
          biteship_order_id,
          biteship_label_url,
          tracking_history,
          proof_of_delivery_url
        ),

        transactions (
          id,
          transaction_id,
          payment_type,
          transaction_status,
          gross_amount,
          proof_of_payment_url,
          payment_info,
          payment_gateway_response,
          created_at
        ),
        order_refunds (*),
        local_delivery_orders (*)
      `;

    const fetchOrder = async (column: "id" | "order_number") => {
      return supabaseAdmin
        .from('orders')
        .select(baseSelect)
        .eq(column, id)
        .eq('user_id', userId)
        .single();
    };

    const { data: orderById, error: idError } = await fetchOrder(
      isUuid ? 'id' : 'order_number'
    );

    let order = orderById;
    let error = idError;

    if (!order && isUuid) {
      const fallback = await fetchOrder('order_number');
      order = fallback.data;
      error = fallback.error;
    }

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch order detail: ${error.message}`);
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with id: ${id}`
      });
    }

    if (Array.isArray(order.order_shipments) && order.order_shipments.length > 0) {
      const synced = await syncShipmentWithBiteship(order.order_shipments[0]);
      order.order_shipments[0] = synced;

      const isDelivered = synced.delivered_at || 
        (Array.isArray(synced.tracking_history) && 
         synced.tracking_history.some((h: any) => (h.status || '').toLowerCase() === 'delivered'));

      if (isDelivered && !['delivered', 'completed', 'refund_process', 'refunded'].includes(order.status)) {
        order.status = 'delivered';
      }
    }

    const items = Array.isArray(order.order_items)
      ? order.order_items.map((item: any) => ({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          price: item.product_price,
          quantity: item.quantity,
          subtotal: item.subtotal,
          image: item.products?.image_url ?? null,
          weight_gram: item.products?.weight_gram ?? 0
        }))
      : [];

    const trackingNumber = Array.isArray(order.order_shipments) && order.order_shipments.length > 0
      ? order.order_shipments[0].tracking_number
      : null;

    let localDeliveryOrder = Array.isArray(order.local_delivery_orders) && order.local_delivery_orders.length > 0
      ? order.local_delivery_orders[0]
      : null;

    const isLocalDelivery = order.courier === 'umah_tani' || !!localDeliveryOrder;
    const localDeliveryConfig = isLocalDelivery ? await getLocalDeliveryConfig() : null;

    if (localDeliveryOrder) {
      const slotLabel = formatSlotLabel(localDeliveryOrder.delivery_slot_id, localDeliveryConfig);
      localDeliveryOrder = {
        ...localDeliveryOrder,
        delivery_slot_label: slotLabel,
      };
    }

    // If local delivery and no biteship tracking history, build tracking history from local delivery order
    let localTrackingHistory: any[] = [];
    if (isLocalDelivery) {
      if (order.created_at) {
        localTrackingHistory.push({
          time: order.created_at,
          note: "Pesanan berhasil dibuat",
          status: "created"
        });
      }
      if (order.payment_status === 'paid') {
        localTrackingHistory.push({
          time: order.updated_at || order.created_at,
          note: "Pembayaran telah diverifikasi, pesanan disiapkan oleh toko",
          status: "confirmed"
        });
      }
      if (localDeliveryOrder) {
        const slotDesc = localDeliveryOrder.delivery_slot_label ||
          formatSlotLabel(localDeliveryOrder.delivery_slot_id, localDeliveryConfig);

        if (['picked_up', 'on_the_way', 'delivered'].includes(localDeliveryOrder.status)) {
          localTrackingHistory.push({
            time: localDeliveryOrder.picked_up_at || localDeliveryOrder.updated_at,
            note: `Paket pesanan telah diambil oleh kurir internal Umah Tani (${slotDesc})`,
            status: "picked_up"
          });
        }
        if (['on_the_way', 'delivered'].includes(localDeliveryOrder.status)) {
          localTrackingHistory.push({
            time: localDeliveryOrder.updated_at,
            note: "Kurir sedang dalam perjalanan mengantar pesanan ke alamat Anda 🛵",
            status: "on_the_way"
          });
        }
        if (localDeliveryOrder.status === 'delivered') {
          localTrackingHistory.push({
            time: localDeliveryOrder.delivered_at || localDeliveryOrder.updated_at,
            note: "Pesanan telah sampai dan berhasil diterima di alamat tujuan ✓",
            status: "delivered"
          });
        } else if (localDeliveryOrder.status === 'failed') {
          localTrackingHistory.push({
            time: localDeliveryOrder.updated_at,
            note: localDeliveryOrder.notes ? `Pengiriman tertunda/gagal: ${localDeliveryOrder.notes}` : "Pengiriman terkendala, kurir akan menghubungi Anda",
            status: "failed"
          });
        }
      }
      // Urutkan step terbaru di atas
      localTrackingHistory.reverse();
    }

    const effectiveTrackingHistory = (Array.isArray(order.order_shipments) && order.order_shipments[0]?.tracking_history?.length > 0)
      ? order.order_shipments[0].tracking_history
      : localTrackingHistory;

    console.log('ORDER DETAIL:', { ...order, items, trackingNumber, isLocalDelivery });

    return res.status(200).json({
      success: true,
      data: {
        ...order,
        items,
        trackingNumber: trackingNumber,
        tracking_number: trackingNumber,
        tracking_history: effectiveTrackingHistory,
        local_delivery_order: localDeliveryOrder,
      },
      detail: {
        id: order.id,
        status: order.status,
        createdAt: order.created_at,
        totalPrice: order.total_amount,
        items,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        trackingNumber: trackingNumber,
        courier: order.courier,
        serviceType: order.service_type,
        localDeliveryOrder: localDeliveryOrder
      }
    });

  } catch (error: any) {
    console.error('Get order detail error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch order detail"
    });
  }
};

/**
 * POST /api/ecommerce/orders/:id/refund
 * Submit refund request (Customer)
 */
export const createRefundController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { category, details, proof_images = [] } = req.body;

    if (!category || !details) {
      return res.status(400).json({
        success: false,
        message: "Category and details are required"
      });
    }

    // 1. Fetch order and its shipment info
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("*, order_shipments(*)")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (orderErr || !order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // 2. Validate order status is delivered
    if (order.status !== "delivered") {
      return res.status(400).json({
        success: false,
        message: `Order cannot be refunded. Status is: ${order.status}`
      });
    }

    // 3. Validate 3-day guarantee window
    const firstShipment = Array.isArray(order.order_shipments) && order.order_shipments.length > 0
      ? order.order_shipments[0]
      : null;
    const deliveredAtStr = firstShipment?.delivered_at;

    if (!deliveredAtStr) {
      return res.status(400).json({
        success: false,
        message: "Deliver time not found for this order"
      });
    }

    const deliveredAt = new Date(deliveredAtStr);
    const threeDays = 3 * 24 * 60 * 60 * 1000; // 3 days in ms
    const elapsed = Date.now() - deliveredAt.getTime();

    if (elapsed > threeDays) {
      return res.status(400).json({
        success: false,
        message: "Claim period has expired (maximum 3 days after delivery)"
      });
    }

    // 4. Create refund record
    const { error: refundErr } = await supabaseAdmin
      .from("order_refunds")
      .insert({
        order_id: id,
        user_id: userId,
        category,
        details,
        proof_images
      });

    if (refundErr) {
      throw refundErr;
    }

    // 5. Update order status to refund_process
    const { error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "refund_process",
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (updateErr) {
      throw updateErr;
    }

    return res.status(200).json({
      success: true,
      message: "Refund request submitted successfully"
    });

  } catch (error: any) {
    console.error("Create refund error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit refund request"
    });
  }
};

/**
 * POST /api/ecommerce/orders/:id/complete
 * Mark order as completed (Customer)
 */
export const completeOrderController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // 1. Fetch order
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (orderErr || !order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const isOwner = order.user_id === userId;
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to complete this order"
      });
    }

    // 2. Validate order status is delivered
    if (order.status !== "delivered") {
      return res.status(400).json({
        success: false,
        message: `Only delivered orders can be completed. Status is: ${order.status}`
      });
    }

    // 3. Update order status to completed
    const { error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "completed",
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (updateErr) {
      throw updateErr;
    }

    return res.status(200).json({
      success: true,
      message: "Order completed successfully"
    });

  } catch (error: any) {
    console.error("Complete order error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to complete order"
    });
  }
};

const restoreOrderStockHelper = async (orderId: string) => {
  try {
    const { data: orderItems, error: orderItemsError } = await supabaseAdmin
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', orderId);

    if (orderItemsError) {
      console.error(`Failed to fetch order items for restock: ${orderItemsError.message}`);
      return;
    }

    for (const item of orderItems || []) {
      if (!item.product_id || !item.quantity) {
        continue;
      }

      const { data: product, error: productError } = await supabaseAdmin
        .from('products')
        .select('id, stock_quantity')
        .eq('id', item.product_id)
        .single();

      if (productError || !product) {
        continue;
      }

      const newStock = (product.stock_quantity || 0) + item.quantity;
      await supabaseAdmin
        .from('products')
        .update({ stock_quantity: newStock })
        .eq('id', item.product_id);
    }
  } catch (err) {
    console.error('Error in restoreOrderStockHelper:', err);
  }
};

export const checkAndCancelExpiredOrders = async (userId: string) => {
  try {
    const { data: expiredOrders, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, user_id, status, expires_at')
      .eq('user_id', userId)
      .in('status', ['awaiting_payment_method', 'awaiting_payment'])
      .not('expires_at', 'is', null)
      .lte('expires_at', new Date().toISOString());

    if (fetchError || !expiredOrders || expiredOrders.length === 0) {
      return;
    }

    for (const order of expiredOrders) {
      if (order.status === 'awaiting_payment') {
        // Cek apakah transaksi sudah upload bukti (awaiting_verification) atau sudah sukses
        const { data: activeTx } = await supabaseAdmin
          .from('transactions')
          .select('id, transaction_status')
          .eq('order_id', order.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Jika user sudah upload bukti pembayaran, jangan dibatalkan otomatis
        if (
          activeTx &&
          (activeTx.transaction_status === 'awaiting_verification' ||
           activeTx.transaction_status === 'settlement' ||
           activeTx.transaction_status === 'approved' ||
           activeTx.transaction_status === 'paid')
        ) {
          continue;
        }

        // Batalkan order
        const { data: updatedOrder, error: updateError } = await supabaseAdmin
          .from('orders')
          .update({
            status: 'cancelled',
            payment_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id)
          .eq('status', 'awaiting_payment')
          .select('status')
          .single();

        if (updateError) continue;

        if (updatedOrder?.status === 'cancelled') {
          // Update status transaksi terkait menjadi expire
          if (activeTx) {
            await supabaseAdmin
              .from('transactions')
              .update({
                transaction_status: 'expire',
                updated_at: new Date().toISOString()
              })
              .eq('id', activeTx.id);
          }

          // Kembalikan stok produk
          await restoreOrderStockHelper(order.id);

          // Kirim notifikasi personal
          await NotificationService.sendPersonalNotification(
            order.user_id,
            'Pesanan Dibatalkan ⏳',
            `Batas waktu pembayaran untuk pesanan #${order.order_number} telah habis. Pesanan dibatalkan otomatis.`,
            'system'
          );
        }
      } else if (order.status === 'awaiting_payment_method') {
        // 1. Cancel order
        const { data: updatedOrder, error: updateError } = await supabaseAdmin
          .from('orders')
          .update({
            status: 'cancelled',
            payment_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id)
          .eq('status', 'awaiting_payment_method')
          .select('status')
          .single();

        if (updateError) continue;

        // 2. Restore stock and notify if successfully cancelled
        if (updatedOrder?.status === 'cancelled') {
          await restoreOrderStockHelper(order.id);

          await NotificationService.sendPersonalNotification(
            order.user_id,
            'Pesanan Dibatalkan ⏳',
            `Batas waktu pemilihan metode pembayaran untuk pesanan #${order.order_number} telah habis. Pesanan dibatalkan otomatis.`,
            'system'
          );
        }
      }
    }
  } catch (err) {
    console.error('[checkAndCancelExpiredOrders] Error:', err);
  }
};

