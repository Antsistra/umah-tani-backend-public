import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { supabaseAdmin } from "../config/supabase";
import BiteshipService from "../services/biteshipService";
import { getCartByUserIdService } from "../services/cartService";
import {
  getLocalDeliveryConfig,
  isEligibleForLocalDelivery,
  getAvailableSlots,
  getAllSlotsWithAvailability,
} from "../services/localDeliveryService";

const biteshipService = new BiteshipService();

export const searchAreas = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const input = req.query.input as string | undefined;

    if (!input || input.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "input minimal 3 karakter",
      });
    }

    const result = await biteshipService.searchAreas(input.trim());

    return res.status(200).json({
      success: true,
      data: result?.areas || [],
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Gagal mencari area",
    });
  }
};

export const getShippingRates = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId!;
    const { address_id, couriers, items: bodyItems } = req.body;

    if (!address_id) {
      return res.status(400).json({
        success: false,
        message: "address_id wajib diisi",
      });
    }

    const { data: address, error: addressError } = await supabaseAdmin
      .from("user_addresses")
      .select("*")
      .eq("id", address_id)
      .eq("user_id", userId)
      .single();

    if (addressError || !address) {
      return res.status(404).json({
        success: false,
        message: "Alamat tidak ditemukan",
      });
    }

    if (!address.biteship_area_id && !address.postal_code) {
      return res.status(400).json({
        success: false,
        message: "Alamat harus punya biteship_area_id atau postal_code",
      });
    }

    // --- Resolve items: gunakan body.items (Beli Sekarang) atau cart DB ---
    let items: { name: string; value: number; weight: number; quantity: number }[];

    if (bodyItems && Array.isArray(bodyItems) && bodyItems.length > 0) {
      // "Beli Sekarang" path: items dikirim langsung dari client
      const missingWeights = bodyItems.filter(
        (item: any) => !item.weight_gram || item.weight_gram <= 0
      );

      if (missingWeights.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Semua produk wajib punya weight_gram untuk hitung ongkir",
        });
      }

      items = bodyItems.map((item: any) => ({
        name: item.name,
        value: Math.round(item.price * item.quantity),
        weight: Math.round(item.weight_gram),
        quantity: item.quantity,
      }));
    } else {
      // Cart path: baca dari database
      const cart = await getCartByUserIdService(userId);

      if (!cart.items || cart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Keranjang kosong",
        });
      }

      const missingWeights = cart.items
        .filter((item: any) => !item.product?.weight_gram || item.product.weight_gram <= 0)
        .map((item: any) => item.product?.name || "unknown");

      if (missingWeights.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Produk wajib punya weight_gram untuk hitung ongkir",
          data: { missing_weights: missingWeights },
        });
      }

      items = cart.items.map((item: any) => ({
        name: item.product.name,
        value: Math.round(item.product.price * item.quantity),
        weight: Math.round(item.product.weight_gram),
        quantity: item.quantity,
      }));
    }

    const originAreaId = process.env.BITESHIP_ORIGIN_AREA_ID || "IDNP3IDNC396IDND4754IDZ42171";
    const originPostalCode = process.env.BITESHIP_ORIGIN_POSTAL_CODE || "42171";

    const payload: any = {
      couriers: couriers || process.env.BITESHIP_DEFAULT_COURIERS || "jne,sicepat,anteraja",
      items,
    };

    if (originAreaId) {
      payload.origin_area_id = originAreaId;
    } else {
      payload.origin_postal_code = originPostalCode;
    }

    if (address.biteship_area_id) {
      payload.destination_area_id = address.biteship_area_id;
    } else {
      payload.destination_postal_code = address.postal_code;
    }

    // 1. Fetch Biteship courier rates
    let pricingList: any[] = [];
    let biteshipResponse: any = null;

    try {
      biteshipResponse = await biteshipService.getRates(payload);
      if (biteshipResponse && Array.isArray(biteshipResponse.pricing)) {
        pricingList = [...biteshipResponse.pricing];
      } else if (Array.isArray(biteshipResponse)) {
        pricingList = [...biteshipResponse];
      }
    } catch (biteshipErr: any) {
      console.error("Biteship getRates error:", biteshipErr?.message || biteshipErr);
      // Keep going so local delivery can still work if eligible
    }

    // 2. Check Kurir Lokal Umah Tani Agriculture eligibility
    try {
      const localConfig = await getLocalDeliveryConfig();
      if (
        localConfig?.is_active &&
        address.latitude !== null &&
        address.longitude !== null &&
        address.latitude !== undefined &&
        address.longitude !== undefined
      ) {
        const eligibility = await isEligibleForLocalDelivery(
          Number(address.latitude),
          Number(address.longitude),
          localConfig
        );
        if (eligibility.eligible) {
          const allSlots = getAllSlotsWithAvailability(localConfig);
          const hasAvailableSlots = allSlots.some((s) => s.is_available);

          const localRate = {
            courier_code: "umah_tani",
            courier_name: "Kurir Umah Tani",
            courier_service_code: "same_day",
            courier_service_name: "Same Day Delivery",
            price: Number(localConfig.delivery_fee) || 0,
            duration: 0,
            duration_text: "Hari ini (Same Day)",
            shipment_duration_range: "Hari ini",
            shipment_duration_unit: "",
            description: `Dikirim hari ini oleh kurir Umah Tani (${eligibility.distance_km?.toFixed(1)} km)`,
            is_local_courier: true,
            is_available: hasAvailableSlots,
            unavailable_reason: hasAvailableSlots
              ? undefined
              : "Semua slot pengiriman hari ini telah lewat batas jam pemesanan",
            delivery_slots: allSlots,
            distance_km: eligibility.distance_km,
          };
          pricingList.unshift(localRate);
        }
      }
    } catch (localErr) {
      console.error("Local delivery rate calculation error:", localErr);
    }

    return res.status(200).json({
      success: true,
      data: {
        ...(typeof biteshipResponse === "object" && biteshipResponse !== null ? biteshipResponse : {}),
        pricing: pricingList,
      },
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Gagal menghitung ongkir",
    });
  }
};
