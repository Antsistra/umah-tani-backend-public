import { Request, Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import {
  getLocalDeliveryConfig,
  updateLocalDeliveryConfig,
  getTodayWIB,
  formatSlotLabel,
} from "../services/localDeliveryService";
import { NotificationService } from "../services/notificationService";

/**
 * GET /api/admin/local-delivery/config
 * Get local delivery configuration
 */
export const getLocalConfig = async (req: Request, res: Response) => {
  try {
    const config = await getLocalDeliveryConfig();
    if (!config) {
      return res.status(404).json({
        success: false,
        message: "Konfigurasi kurir lokal belum tersedia",
      });
    }

    return res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    console.error("Get local delivery config error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil konfigurasi kurir lokal",
    });
  }
};

/**
 * PUT /api/admin/local-delivery/config
 * Update local delivery configuration
 */
export const updateLocalConfig = async (req: Request, res: Response) => {
  try {
    const {
      is_active,
      delivery_fee,
      max_radius_km,
      origin_latitude,
      origin_longitude,
      origin_label,
      delivery_slots,
      cutoff_minutes,
    } = req.body;

    const updates: any = {};
    if (typeof is_active === "boolean") updates.is_active = is_active;
    if (typeof delivery_fee === "number") updates.delivery_fee = delivery_fee;
    if (typeof max_radius_km === "number") updates.max_radius_km = max_radius_km;
    if (typeof origin_latitude === "number") updates.origin_latitude = origin_latitude;
    if (typeof origin_longitude === "number") updates.origin_longitude = origin_longitude;
    if (typeof origin_label === "string") updates.origin_label = origin_label;
    if (Array.isArray(delivery_slots)) updates.delivery_slots = delivery_slots;
    if (typeof cutoff_minutes === "number") updates.cutoff_minutes = cutoff_minutes;

    const updated = await updateLocalDeliveryConfig(updates);

    return res.status(200).json({
      success: true,
      message: "Konfigurasi kurir lokal berhasil diperbarui",
      data: updated,
    });
  } catch (error: any) {
    console.error("Update local delivery config error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal memperbarui konfigurasi kurir lokal",
    });
  }
};

/**
 * GET /api/admin/local-delivery/orders
 * Get list of local delivery orders with filters
 * Query params: date (YYYY-MM-DD or 'all'), status, slot_id
 */
export const getLocalOrders = async (req: Request, res: Response) => {
  try {
    const { date, status, slot_id } = req.query;

    let query = supabaseAdmin
      .from("local_delivery_orders")
      .select(
        `
        *,
        order:orders (
          id,
          order_number,
          status,
          total_amount,
          shipping_cost,
          courier,
          service_type,
          payment_status,
          created_at,
          order_items (
            id,
            product_name,
            product_price,
            quantity,
            subtotal
          )
        )
      `
      )
      .order("created_at", { ascending: false });

    // Date filtering (default to today WIB if not specified or not 'all')
    if (date && date !== "all") {
      query = query.eq("delivery_date", date as string);
    } else if (!date) {
      query = query.eq("delivery_date", getTodayWIB());
    }

    if (status && status !== "all") {
      query = query.eq("status", status as string);
    }

    if (slot_id && slot_id !== "all") {
      query = query.eq("delivery_slot_id", slot_id as string);
    }

    const { data, error } = await query;

    if (error) throw error;

    const config = await getLocalDeliveryConfig();
    const formattedData = (data || []).map((item: any) => ({
      ...item,
      delivery_slot_label: formatSlotLabel(item.delivery_slot_id, config),
    }));

    return res.status(200).json({
      success: true,
      data: formattedData,
    });
  } catch (error: any) {
    console.error("Get local orders error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil daftar pesanan kurir lokal",
    });
  }
};

/**
 * PUT /api/admin/local-delivery/orders/:id/status
 * Update local delivery order status
 * Body: { status: 'pending' | 'picked_up' | 'on_the_way' | 'delivered' | 'failed', notes?: string }
 */
export const updateLocalOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ["pending", "picked_up", "on_the_way", "delivered", "failed"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status tidak valid. Pilihan: ${validStatuses.join(", ")}`,
      });
    }

    // Get current record
    const { data: currentOrder, error: fetchErr } = await supabaseAdmin
      .from("local_delivery_orders")
      .select("*, order:orders(*)")
      .eq("id", id)
      .single();

    if (fetchErr || !currentOrder) {
      return res.status(404).json({
        success: false,
        message: "Pesanan kurir lokal tidak ditemukan",
      });
    }

    const orderData = currentOrder.order;
    const isPaid =
      orderData &&
      (orderData.payment_status === "paid" ||
        ["processing", "shipped", "delivered", "completed"].includes(orderData.status));

    if (!isPaid) {
      return res.status(400).json({
        success: false,
        message:
          "Tidak dapat memperbarui status pengiriman karena pembayaran pesanan belum terverifikasi / lunas.",
      });
    }

    const updates: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (notes !== undefined) {
      updates.notes = notes;
    }

    const now = new Date().toISOString();

    if (status === "picked_up" || status === "on_the_way") {
      if (!currentOrder.picked_up_at) {
        updates.picked_up_at = now;
      }
      // Update orders table status to shipped if it was processing
      if (currentOrder.order && currentOrder.order.status === "processing") {
        await supabaseAdmin
          .from("orders")
          .update({ status: "shipped", updated_at: now })
          .eq("id", currentOrder.order_id);

        if (currentOrder.order.user_id) {
          await NotificationService.sendPersonalNotification(
            currentOrder.order.user_id,
            "Kurir Sedang Mengantar Pesanan 🛵",
            `Pesanan #${currentOrder.order.order_number} sedang dalam perjalanan diantar oleh kurir Umah Tani Agriculture.`
          );
        }
      }
    } else if (status === "delivered") {
      updates.delivered_at = now;
      // Update orders table to delivered
      await supabaseAdmin
        .from("orders")
        .update({ status: "delivered", updated_at: now })
        .eq("id", currentOrder.order_id);

      if (currentOrder.order && currentOrder.order.user_id) {
        await NotificationService.sendPersonalNotification(
          currentOrder.order.user_id,
          "Pesanan Telah Sampai! 🎉",
          `Pesanan #${currentOrder.order.order_number} telah berhasil diantar oleh kurir Umah Tani Agriculture ke lokasi Anda.`
        );
      }
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("local_delivery_orders")
      .update(updates)
      .eq("id", id)
      .select("*, order:orders(*)")
      .single();

    if (updateErr) throw updateErr;

    return res.status(200).json({
      success: true,
      message: "Status pesanan kurir lokal berhasil diperbarui",
      data: updated,
    });
  } catch (error: any) {
    console.error("Update local order status error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal memperbarui status pengiriman kurir lokal",
    });
  }
};

/**
 * POST /api/admin/local-delivery/orders/bulk-status
 * Bulk update local delivery order statuses (by order_ids or slot_id & date)
 * Body: { order_ids?: string[], slot_id?: string, date?: string, status: string, notes?: string }
 */
export const bulkUpdateLocalOrderStatus = async (req: Request, res: Response) => {
  try {
    const { order_ids, slot_id, date, status, notes } = req.body;

    const validStatuses = ["pending", "picked_up", "on_the_way", "delivered", "failed"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status tidak valid. Pilihan: ${validStatuses.join(", ")}`,
      });
    }

    let query = supabaseAdmin
      .from("local_delivery_orders")
      .select("*, order:orders(*)");

    if (Array.isArray(order_ids) && order_ids.length > 0) {
      query = query.in("id", order_ids);
    } else if (slot_id || date) {
      if (slot_id && slot_id !== "all") {
        query = query.eq("delivery_slot_id", slot_id);
      }
      if (date && date !== "all") {
        query = query.eq("delivery_date", date);
      } else if (!date) {
        query = query.eq("delivery_date", getTodayWIB());
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Harap berikan order_ids atau slot_id / date untuk bulk update",
      });
    }

    const { data: targetOrders, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    if (!targetOrders || targetOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tidak ada pesanan kurir lokal yang ditemukan untuk diperbarui",
      });
    }

    const eligibleOrders: any[] = [];
    const skippedOrders: any[] = [];

    for (const item of targetOrders) {
      const orderData = item.order;
      const isPaid =
        orderData &&
        (orderData.payment_status === "paid" ||
          ["processing", "shipped", "delivered", "completed"].includes(orderData.status));

      if (isPaid) {
        eligibleOrders.push(item);
      } else {
        skippedOrders.push({
          id: item.id,
          order_number: orderData?.order_number || item.order_id,
          reason: "Pembayaran belum lunas / belum terverifikasi",
        });
      }
    }

    if (eligibleOrders.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Semua pesanan yang dipilih (${skippedOrders.length} pesanan) belum lunas / belum terverifikasi pembayaran. Tidak ada status yang diubah.`,
        data: {
          updated_count: 0,
          skipped_count: skippedOrders.length,
          skipped_orders: skippedOrders,
        },
      });
    }

    const now = new Date().toISOString();
    const updatedIds: string[] = [];

    for (const item of eligibleOrders) {
      const localUpdates: any = {
        status,
        updated_at: now,
      };
      if (notes !== undefined) {
        localUpdates.notes = notes;
      }

      if (status === "picked_up" || status === "on_the_way") {
        if (!item.picked_up_at) {
          localUpdates.picked_up_at = now;
        }
        if (item.order && item.order.status === "processing") {
          await supabaseAdmin
            .from("orders")
            .update({ status: "shipped", updated_at: now })
            .eq("id", item.order_id);

          if (item.order.user_id) {
            NotificationService.sendPersonalNotification(
              item.order.user_id,
              "Kurir Sedang Mengantar Pesanan 🛵",
              `Pesanan #${item.order.order_number} sedang dalam perjalanan diantar oleh kurir Umah Tani Agriculture.`
            ).catch((e) => console.error("Notification error:", e));
          }
        }
      } else if (status === "delivered") {
        localUpdates.delivered_at = now;
        await supabaseAdmin
          .from("orders")
          .update({ status: "delivered", updated_at: now })
          .eq("id", item.order_id);

        if (item.order && item.order.user_id) {
          NotificationService.sendPersonalNotification(
            item.order.user_id,
            "Pesanan Telah Sampai! 🎉",
            `Pesanan #${item.order.order_number} telah berhasil diantar oleh kurir Umah Tani Agriculture ke lokasi Anda.`
          ).catch((e) => console.error("Notification error:", e));
        }
      }

      const { error: updateErr } = await supabaseAdmin
        .from("local_delivery_orders")
        .update(localUpdates)
        .eq("id", item.id);

      if (!updateErr) {
        updatedIds.push(item.id);
      }
    }

    const updatedCount = updatedIds.length;
    const skippedCount = skippedOrders.length;

    let msg = `Berhasil memperbarui ${updatedCount} pesanan menjadi "${status}".`;
    if (skippedCount > 0) {
      msg += ` (${skippedCount} pesanan dilewati karena belum lunas).`;
    }

    return res.status(200).json({
      success: true,
      message: msg,
      data: {
        updated_count: updatedCount,
        skipped_count: skippedCount,
        updated_ids: updatedIds,
        skipped_orders: skippedOrders,
      },
    });
  } catch (error: any) {
    console.error("Bulk update local orders error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal memperbarui status pengiriman massal",
    });
  }
};

