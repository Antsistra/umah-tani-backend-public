import { Request, Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { NotificationService } from "../services/notificationService";

/**
 * POST /api/shipping/biteship/webhook
 * Public endpoint to handle Biteship shipping status updates
 */
export const biteshipWebhookHandler = async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    console.log("[Biteship Webhook] Received update payload:", JSON.stringify(payload, null, 2));

    const biteshipOrderId = payload.order_id || payload.id;
    const waybillNumber = payload.courier?.waybill_number || payload.waybill_number;
    const biteshipStatus = (payload.status || "").toLowerCase();
    const history = payload.history || [];

    if (!biteshipOrderId && !waybillNumber) {
      console.warn("[Biteship Webhook] Ignored payload: missing order_id and waybill_number");
      return res.status(400).json({
        success: false,
        message: "biteship_order_id or waybill_number is required"
      });
    }

    // Find the shipment record in the database
    let query = supabaseAdmin.from("order_shipments").select("*");

    if (biteshipOrderId) {
      query = query.eq("biteship_order_id", biteshipOrderId);
    } else {
      query = query.eq("tracking_number", waybillNumber);
    }

    const { data: shipment, error: findError } = await query.maybeSingle();

    if (findError || !shipment) {
      console.warn(`[Biteship Webhook] Shipment not found for BiteshipOrderID: ${biteshipOrderId}, Waybill: ${waybillNumber}`);
      return res.status(404).json({
        success: false,
        message: "Shipment record not found"
      });
    }

    const orderId = shipment.order_id;
    console.log(`[Biteship Webhook] Matching shipment found. Order ID: ${orderId}, Shipment ID: ${shipment.id}`);

    // Update tracking history in database
    const updatePayload: any = {
      tracking_history: history,
      updated_at: new Date().toISOString()
    };

    const isDeliveredNow = biteshipStatus === "delivered" ||
                           history.some((h: any) => (h.status || "").toLowerCase() === "delivered");

    if (waybillNumber) {
      updatePayload.tracking_number = waybillNumber;
    }

    // If Biteship reports it is delivered
    if (isDeliveredNow) {
      updatePayload.delivered_at = new Date().toISOString();
    }

    const { error: updateShipmentError } = await supabaseAdmin
      .from("order_shipments")
      .update(updatePayload)
      .eq("id", shipment.id);

    if (updateShipmentError) {
      console.error("[Biteship Webhook] Failed to update shipment history:", updateShipmentError);
      throw updateShipmentError;
    }

    // Map shipping status to orders table status
    let targetOrderStatus = isDeliveredNow ? "delivered" : "shipped";

    // Fetch current order status/info to see if it changed
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("user_id, order_number, courier, status")
      .eq("id", orderId)
      .single();

    // Guard: do not overwrite finalized or post-delivery states (completed, refund_process, refunded)
    const isFinalOrRefundState = order && ['completed', 'refund_process', 'refunded'].includes(order.status);

    if (order && !isFinalOrRefundState && order.status !== targetOrderStatus) {
      if (order.user_id) {
        const courierName = order.courier || shipment.courier || "kurir";
        if (targetOrderStatus === "shipped") {
          await NotificationService.sendPersonalNotification(
            order.user_id,
            "Pesanan Sedang Dikirim 🚚",
            `Pesanan #${order.order_number} telah diserahkan ke kurir ${courierName}. Silakan lacak pengiriman Anda.`,
            "system"
          );
        } else if (targetOrderStatus === "delivered") {
          await NotificationService.sendPersonalNotification(
            order.user_id,
            "Pesanan Sampai Tujuan 🏠",
            `Pesanan #${order.order_number} telah sampai di tujuan. Silakan konfirmasi penerimaan.`,
            "system"
          );
        }
      }

      // Update orders table
      const { error: updateOrderError } = await supabaseAdmin
        .from("orders")
        .update({
          status: targetOrderStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", orderId);

      if (updateOrderError) {
        console.error("[Biteship Webhook] Failed to update order status:", updateOrderError);
        throw updateOrderError;
      }

      console.log(`[Biteship Webhook] Successfully updated order ${orderId} status to ${targetOrderStatus}`);
    } else {
      console.log(`[Biteship Webhook] Skipped updating order status for ${orderId}. Current status: ${order?.status}, Target status: ${targetOrderStatus}`);
    }

    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully"
    });

  } catch (error: any) {
    console.error("[Biteship Webhook] Error processing webhook:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error"
    });
  }
};
