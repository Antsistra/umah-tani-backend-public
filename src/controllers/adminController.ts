import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import BiteshipService from '../services/biteshipService';
import { NotificationService } from '../services/notificationService';
import { getLocalDeliveryConfig, formatSlotLabel } from '../services/localDeliveryService';

const biteshipService = new BiteshipService();


/**
 * Middleware to check if user is admin
 */
export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;

    // Check if user has admin role
    const { data: user, error } = await supabaseAdmin
      .from('profiles') // or auth.users with role field
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    next();
  } catch (error: any) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Middleware to check if user is owner
 */
export const isOwner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;

    // Check if user has owner role
    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !user || user.role !== 'owner') {
      return res.status(403).json({ error: 'Forbidden: Owner access required' });
    }

    next();
  } catch (error: any) {
    console.error('Owner check error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Helper function to log admin activity (INTERNAL AUDIT ONLY)
 */
const logActivity = async (
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details: any,
  req: Request
) => {
  try {
    let description = '';
    if (action === 'order_shipped') {
      description = `Menginput Resi Pengiriman: ${details.courier} (${details.tracking_number}) untuk Pesanan #${details.order_number || ''}`;
    } else if (action === 'order_status_updated') {
      const statusLabels: Record<string, string> = {
        awaiting_payment_method: 'Menunggu Metode Pembayaran',
        awaiting_payment: 'Menunggu Pembayaran',
        processing: 'Diproses',
        shipped: 'Dikirim',
        delivered: 'Selesai',
        cancelled: 'Dibatalkan',
        expired: 'Kedaluwarsa'
      };
      const newStatusLabel = statusLabels[details.new_status] || details.new_status;
      description = `Mengubah status Pesanan #${details.order_number || ''} menjadi ${newStatusLabel}`;
    } else {
      description = `${action} ${resourceType} #${resourceId}`;
    }

    await supabaseAdmin.from('activity_logs').insert({
      user_id: userId,
      action: action.toUpperCase(),
      module: 'ecommerce',
      entity_type: resourceType,
      entity_id: resourceId,
      entity_name: details?.order_number || '',
      description: description,
      metadata: details,
      ip_address: req.ip || req.connection?.remoteAddress,
      user_agent: req.headers['user-agent'] as string || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw error - logging failure shouldn't break the main operation
  }
};

/**
 * Get all orders with filters
 * GET /api/admin/orders
 */
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin
      .from('orders')
      .select(`
        *,
        transactions(id, transaction_id, payment_type, transaction_status, proof_of_payment_url, payment_gateway_response),
        order_items(quantity)
      `, { count: 'exact' })
      .neq('shipping_address', 'POS Offline Transaction'); // Exclude offline POS orders from online orders list

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`order_number.ilike.%${search}%,shipping_recipient_name.ilike.%${search}%`);
    }

    // Pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    // Fetch user profiles manually since direct join with auth.users is invalid
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(order => order.user_id).filter(Boolean))];
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, email, name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      data.forEach(order => {
        const profile = profileMap.get(order.user_id);
        if (profile) {
          order.user = {
            ...profile,
            name: profile.name || order.shipping_recipient_name || null
          };
        } else {
          order.user = {
            id: order.user_id,
            email: "Unknown",
            name: order.shipping_recipient_name || null
          };
        }
      });
    }

    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error: any) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

/**
 * Get order detail
 * GET /api/admin/orders/:id
 */
export const getOrderDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orderId = String(id || '').trim();
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    let query = supabaseAdmin
      .from('orders')
      .select(`
        *,
        transactions(id, transaction_id, payment_type, transaction_status, proof_of_payment_url, rejection_reason, payment_info, payment_gateway_response, created_at, updated_at, verified_at, verified_by),
        order_items(id, product_id, product_name, product_price, quantity, subtotal),
        shipment:order_shipments(id, order_id, courier, service_type, tracking_number, estimated_delivery, proof_of_delivery_url, shipped_at, delivered_at, biteship_order_id, biteship_label_url, tracking_history),
        refund:order_refunds(*),
        local_delivery:local_delivery_orders(*)
      `);

    if (isUuid) {
      query = query.eq('id', orderId);
    } else {
      query = query.eq('order_number', orderId);
    }

    const { data: order, error } = await query.maybeSingle();

    if (error || !order) {
      console.error('getOrderDetail error:', { id, error });
      return res.status(404).json({ error: 'Order not found', details: error?.message });
    }

    // Fetch user profile
    if (order.user_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, email, name')
        .eq('id', order.user_id)
        .single();
      
      if (profile) {
        order.user = {
          ...profile,
          name: profile.name || order.shipping_recipient_name || null
        };
      } else {
        order.user = {
          id: order.user_id,
          email: "Unknown",
          name: order.shipping_recipient_name || null
        };
      }
    }

    if (order.shipment) {
      const isArray = Array.isArray(order.shipment);
      const rawShipment = isArray ? order.shipment[0] : order.shipment;
      if (rawShipment) {
        const synced = await syncShipmentWithBiteship(rawShipment);
        if (isArray) {
          order.shipment[0] = synced;
        } else {
          order.shipment = synced;
        }

        const isDelivered = synced.delivered_at || 
          (Array.isArray(synced.tracking_history) && 
           synced.tracking_history.some((h: any) => (h.status || '').toLowerCase() === 'delivered'));

        if (isDelivered && !['delivered', 'completed', 'refund_process', 'refunded'].includes(order.status)) {
          order.status = 'delivered';
        }
      }
    }

    if (order.local_delivery && Array.isArray(order.local_delivery)) {
      const config = await getLocalDeliveryConfig();
      order.local_delivery = order.local_delivery.map((ld: any) => ({
        ...ld,
        delivery_slot_label: formatSlotLabel(ld.delivery_slot_id, config),
      }));
    }

    res.json({ success: true, data: order });
  } catch (error: any) {
    console.error('Get order detail error:', error);
    res.status(500).json({ error: 'Failed to fetch order detail' });
  }
};

/**
 * Create shipment & set status to shipped
 * POST /api/admin/orders/:id/shipment
 */
export const createShipment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tracking_number, courier, service_type, estimated_delivery, proof_of_delivery_url } = req.body;

    if (!courier) {
      return res.status(400).json({ error: 'courier is required' });
    }
    if (!tracking_number) {
      return res.status(400).json({ error: 'tracking_number (nomor resi) is required' });
    }
    if (!proof_of_delivery_url) {
      return res.status(400).json({ error: 'proof_of_delivery_url (foto bukti paket) is required' });
    }

    // Check if order exists
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('status, order_number, user_id, courier, service_type')
      .eq('id', id)
      .single();

    if (orderErr || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if shipment already exists
    const { data: existingShipment } = await supabaseAdmin
      .from('order_shipments')
      .select('id')
      .eq('order_id', id)
      .single();

    let shipmentData;
    
    if (existingShipment) {
      // Update shipment record
      const { data, error: shipmentError } = await supabaseAdmin
        .from('order_shipments')
        .update({
          courier,
          service_type,
          tracking_number,
          estimated_delivery,
          proof_of_delivery_url,
          shipped_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('order_id', id)
        .select()
        .single();
        
      if (shipmentError) throw shipmentError;
      shipmentData = data;
    } else {
      // Create shipment record
      const { data, error: shipmentError } = await supabaseAdmin
        .from('order_shipments')
        .insert({
          order_id: id,
          courier,
          service_type,
          tracking_number,
          estimated_delivery,
          proof_of_delivery_url,
          shipped_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (shipmentError) throw shipmentError;
      shipmentData = data;
    }

    // Update order status
    const { error: orderError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'shipped',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (orderError) throw orderError;

    // Send "Pesanan Sedang Dikirim" notification
    if (order && order.user_id) {
      const courierName = courier || order.courier || "kurir";
      await NotificationService.sendPersonalNotification(
        order.user_id,
        "Pesanan Sedang Dikirim 🚚",
        `Pesanan #${order.order_number} telah diserahkan ke kurir ${courierName}. Silakan lacak pengiriman Anda.`,
        "system"
      );
    }

    // Log admin activity
    await logActivity(
      req.userId || 'unknown_admin',
      'order_shipped',
      'order',
      String(id),
      {
        tracking_number,
        courier,
        service_type,
        order_number: order?.order_number
      },
      req
    );

    res.json({
      success: true,
      message: 'Shipment created successfully',
      data: shipmentData
    });
  } catch (error: any) {
    console.error('Create shipment error:', error);
    res.status(500).json({ error: error.message || 'Failed to create shipment' });
  }
};


/**
 * Update shipment details
 * PUT /api/admin/orders/:id/shipment
 */
export const updateShipment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data: shipment, error } = await supabaseAdmin
      .from('order_shipments')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('order_id', id)
      .select()
      .single();

    if (error) throw error;

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    // Log admin activity
    await logActivity(
      req.userId || 'unknown_admin',
      'shipment_updated',
      'shipment',
      shipment.id,
      updates,
      req
    );

    res.json({
      success: true,
      message: 'Shipment updated successfully',
      data: shipment
    });
  } catch (error: any) {
    console.error('Update shipment error:', error);
    res.status(500).json({ error: 'Failed to update shipment' });
  }
};

/**
 * Update order status
 * PUT /api/admin/orders/:id/status
 */
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    // Validate status
    const validStatuses = [
      'awaiting_payment_method',
      'awaiting_payment',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'expired'
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Get current order status
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('status, order_number, user_id, courier')
      .eq('id', id)
      .single();

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update order status
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Send status change notifications if user is logged in
    if (order && order.status !== status && order.user_id) {
      if (status === 'shipped') {
        const courierName = order.courier || "kurir";
        await NotificationService.sendPersonalNotification(
          order.user_id,
          "Pesanan Sedang Dikirim 🚚",
          `Pesanan #${order.order_number} telah diserahkan ke kurir ${courierName}. Silakan lacak pengiriman Anda.`,
          "system"
        );
      } else if (status === 'delivered') {
        await NotificationService.sendPersonalNotification(
          order.user_id,
          "Pesanan Sampai Tujuan 🏠",
          `Pesanan #${order.order_number} telah sampai di tujuan. Silakan konfirmasi penerimaan.`,
          "system"
        );
      } else if (status === 'cancelled') {
        await NotificationService.sendPersonalNotification(
          order.user_id,
          "Pesanan Dibatalkan ❌",
          `Pesanan #${order.order_number} telah dibatalkan.`,
          "system"
        );
      }
    }

    // If status is delivered, update shipment
    if (status === 'delivered') {
      await supabaseAdmin
        .from('order_shipments')
        .update({ delivered_at: new Date().toISOString() })
        .eq('order_id', id);
    }

    // Log admin activity (for internal audit trail)
    await logActivity(
      req.userId || 'unknown_admin',
      'order_status_updated',
      'order',
      String(id),
      {
        old_status: order.status,
        new_status: status,
        notes,
        order_number: order.order_number
      },
      req
    );

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data
    });
  } catch (error: any) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

/**
 * Get activity logs (for admin audit)
 * GET /api/admin/activity-logs
 */
export const getActivityLogs = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, action, resource_type } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin
      .from('activity_logs')
      .select('*', { count: 'exact' });

    if (action) {
      query = query.eq('action', action);
    }

    if (resource_type) {
      query = query.eq('resource_type', resource_type);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error: any) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
};

/**
 * Helper function to synchronize shipment tracking info with Biteship API.
 * Pulls current waybill_id (tracking_number) and tracking history milestones and persists them in DB.
 */
export const syncShipmentWithBiteship = async (shipment: any): Promise<any> => {
  if (!shipment || !shipment.biteship_order_id) {
    return shipment;
  }

  // Check if already delivered
  const isDelivered = shipment.delivered_at || 
    (Array.isArray(shipment.tracking_history) && 
     shipment.tracking_history.some((h: any) => h.status === 'delivered'));

  if (isDelivered) {
    // Auto-heal: Make sure the order status is also set to 'delivered' if it's currently shipped/processing/pending
    try {
      let orderId = shipment.order_id;
      if (!orderId && shipment.id) {
        const { data: shipData } = await supabaseAdmin
          .from("order_shipments")
          .select("order_id")
          .eq("id", shipment.id)
          .single();
        if (shipData) {
          orderId = shipData.order_id;
        }
      }

      if (orderId) {
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("status")
          .eq("id", orderId)
          .single();
        
        if (order && !['delivered', 'completed', 'refund_process', 'refunded'].includes(order.status)) {
          console.log(`[Biteship Sync] Auto-fixing order status to delivered for order ${orderId} (shipment was already marked delivered)`);
          await supabaseAdmin
            .from("orders")
            .update({
              status: "delivered",
              updated_at: new Date().toISOString()
            })
            .eq("id", orderId);
        }
      }
    } catch (dbErr) {
      console.error(`[Biteship Sync] Failed to auto-fix order status:`, dbErr);
    }
  }

  // Sync if tracking_number or history is missing/empty, or status is not delivered
  const needsSync = !shipment.tracking_number || 
                    !shipment.tracking_history || 
                    shipment.tracking_history.length === 0 || 
                    !isDelivered;

  if (!needsSync) {
    return shipment;
  }

  try {
    console.log(`[Biteship Sync] Fetching current status for Biteship Order: ${shipment.biteship_order_id}...`);
    const biteshipOrder = await biteshipService.getOrder(shipment.biteship_order_id);
    
    if (biteshipOrder) {
      const waybillNumber = biteshipOrder.courier?.waybill_id || 
                            biteshipOrder.courier?.waybill_number || 
                            biteshipOrder.waybill_id;
      const labelUrl = biteshipOrder.delivery?.label_url;
      const status = (biteshipOrder.status || "").toLowerCase();

      let history = biteshipOrder.history || [];

      // If history is empty but we have waybill, query Trackings API (standard for regular couriers)
      if ((!history || history.length === 0) && waybillNumber && shipment.courier) {
        try {
          console.log(`[Biteship Sync] History is empty. Querying Trackings API for waybill: ${waybillNumber}...`);
          const trackingResult = await biteshipService.getTrackingStatus(waybillNumber, shipment.courier);
          const rawHistory = trackingResult?.history || trackingResult?.data?.history;
          if (Array.isArray(rawHistory)) {
            history = rawHistory;
          }
        } catch (trackError) {
          console.warn(`[Biteship Sync] Trackings API query failed:`, trackError);
        }
      }

      // Format milestones to have consistent 'time' key
      const mappedHistory = history.map((item: any) => ({
        time: item.time || item.updated_at || new Date().toISOString(),
        note: item.note || "",
        status: item.status || ""
      }));

      // Check if delivered via status or tracking history milestones
      const isDeliveredNow = status === "delivered" || 
                             mappedHistory.some((h: any) => (h.status || "").toLowerCase() === "delivered");

      const updatePayload: any = {
        tracking_history: mappedHistory,
        updated_at: new Date().toISOString()
      };

      if (waybillNumber) {
        updatePayload.tracking_number = waybillNumber;
      }
      if (labelUrl) {
        updatePayload.biteship_label_url = labelUrl;
      }
      if (isDeliveredNow && !shipment.delivered_at) {
        updatePayload.delivered_at = new Date().toISOString();
      }

      console.log(`[Biteship Sync] Persisting status to DB for shipment ${shipment.id} (Waybill: ${waybillNumber})`);
      const { data: updatedShipment, error: updateError } = await supabaseAdmin
        .from("order_shipments")
        .update(updatePayload)
        .eq("id", shipment.id)
        .select()
        .single();

      if (updateError) {
        console.error(`[Biteship Sync] Failed to update shipment record:`, updateError);
        return shipment;
      }

      // Also update orders table status if status changed to delivered
      if (isDeliveredNow) {
        console.log(`[Biteship Sync] Setting order status to delivered for order ${shipment.order_id}`);
        await supabaseAdmin
          .from("orders")
          .update({
            status: "delivered",
            updated_at: new Date().toISOString()
          })
          .eq("id", shipment.order_id);
      }

      return updatedShipment;
    }
  } catch (error) {
    console.error(`[Biteship Sync] Error syncing with Biteship API:`, error);
  }

  return shipment;
};

/**
 * GET /api/admin/refunds
 * Get list of all refund requests (Admin)
 */
export const getAllRefunds = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('order_refunds')
      .select(`
        *,
        order:orders(order_number, total_amount, status, shipping_recipient_name),
        profile:profiles(name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (data && data.length > 0) {
      data.forEach((refund: any) => {
        if (refund.profile) {
          refund.profile.name = refund.profile.name || refund.order?.shipping_recipient_name || null;
        }
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Get all refunds error:', error);
    res.status(500).json({ error: 'Failed to fetch refunds list' });
  }
};

/**
 * POST /api/admin/orders/:id/refund/resolve
 * Approve or reject a refund request (Admin)
 */
export const resolveRefund = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action, admin_notes } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: "Invalid action. Must be 'approve' or 'reject'" });
    }

    // 1. Fetch the refund request for this order
    const { data: refund, error: refundErr } = await supabaseAdmin
      .from('order_refunds')
      .select('*')
      .eq('order_id', id)
      .eq('status', 'pending')
      .single();

    if (refundErr || !refund) {
      return res.status(404).json({ error: 'No pending refund request found for this order' });
    }

    const targetStatus = action === 'approve' ? 'approved' : 'rejected';
    const targetOrderStatus = action === 'approve' ? 'refunded' : 'completed';

    // 2. Update the refund record
    const { error: updateRefundErr } = await supabaseAdmin
      .from('order_refunds')
      .update({
        status: targetStatus,
        admin_notes: admin_notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', refund.id);

    if (updateRefundErr) throw updateRefundErr;

    // 3. Update the order status
    const { error: updateOrderErr } = await supabaseAdmin
      .from('orders')
      .update({
        status: targetOrderStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateOrderErr) throw updateOrderErr;

    // 4. Send notification to the user
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('user_id, order_number')
      .eq('id', id)
      .single();

    if (order && order.user_id) {
      if (action === 'approve') {
        await NotificationService.sendPersonalNotification(
          order.user_id,
          'Pengembalian Dana Disetujui 💰',
          `Pengajuan pengembalian dana untuk pesanan #${order.order_number} telah disetujui.`,
          req.userId || 'admin'
        );
      } else {
        await NotificationService.sendPersonalNotification(
          order.user_id,
          'Pengembalian Dana Ditolak ❌',
          `Pengajuan pengembalian dana untuk pesanan #${order.order_number} ditolak.`,
          req.userId || 'admin'
        );
      }
    }

    console.log(`[Admin Refund] Resolved refund for order ${id} to status: ${targetOrderStatus} (Action: ${action})`);

    res.json({
      success: true,
      message: `Refund successfully ${action}d`
    });

  } catch (error: any) {
    console.error('Resolve refund error:', error);
    res.status(500).json({ error: 'Failed to resolve refund request' });
  }
};


