import { supabaseAdmin } from "../config/supabase";

export interface DeliverySlot {
  id: string;
  label: string;
  start: string; // e.g. "09:00"
  end: string;   // e.g. "10:00"
}

export interface LocalDeliveryConfig {
  id: string;
  is_active: boolean;
  delivery_fee: number;
  max_radius_km: number;
  origin_latitude: number;
  origin_longitude: number;
  origin_label: string;
  delivery_slots: DeliverySlot[];
  cutoff_minutes: number;
  created_at?: string;
  updated_at?: string;
}

export interface LocalDeliveryOrder {
  id: string;
  order_id: string;
  delivery_slot_id: string;
  delivery_date: string;
  destination_latitude: number;
  destination_longitude: number;
  distance_km?: number;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_address?: string;
  status: "pending" | "picked_up" | "on_the_way" | "delivered" | "failed";
  notes?: string;
  picked_up_at?: string;
  delivered_at?: string;
  created_at?: string;
  updated_at?: string;
  order?: any;
}

/**
 * Haversine formula to compute great-circle distance between two coordinates in kilometers.
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // 1 decimal place
}

/**
 * Fetch local delivery configuration from DB
 */
export async function getLocalDeliveryConfig(): Promise<LocalDeliveryConfig | null> {
  const { data, error } = await supabaseAdmin
    .from("local_delivery_config")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) {
    console.error("Error fetching local_delivery_config:", error);
    return null;
  }

  return data as LocalDeliveryConfig;
}

/**
 * Update local delivery configuration
 */
export async function updateLocalDeliveryConfig(
  updates: Partial<LocalDeliveryConfig>
): Promise<LocalDeliveryConfig> {
  const existing = await getLocalDeliveryConfig();
  if (!existing) {
    throw new Error("Local delivery configuration not found");
  }

  const payload: any = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("local_delivery_config")
    .update(payload)
    .eq("id", existing.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as LocalDeliveryConfig;
}

/**
 * Check if coordinate is eligible for local delivery
 */
export async function isEligibleForLocalDelivery(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  config?: LocalDeliveryConfig | null
): Promise<{ eligible: boolean; distance_km?: number; reason?: string }> {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return {
      eligible: false,
      reason: "Alamat tidak memiliki titik koordinat GPS",
    };
  }

  const localConfig = config ?? (await getLocalDeliveryConfig());
  if (!localConfig || !localConfig.is_active) {
    return {
      eligible: false,
      reason: "Layanan kurir lokal sedang tidak aktif",
    };
  }

  const distance = haversineDistance(
    localConfig.origin_latitude,
    localConfig.origin_longitude,
    latitude,
    longitude
  );

  if (distance > localConfig.max_radius_km) {
    return {
      eligible: false,
      distance_km: distance,
      reason: `Jarak pengiriman (${distance} km) melebihi batas maksimal (${localConfig.max_radius_km} km)`,
    };
  }

  return {
    eligible: true,
    distance_km: distance,
  };
}

export interface DeliverySlotInfo extends DeliverySlot {
  is_available: boolean;
  unavailable_reason?: string;
}

/**
 * Get available slots for same-day delivery considering current WIB time & cutoff
 */
export function getAvailableSlots(config: LocalDeliveryConfig): DeliverySlot[] {
  const allSlots = getAllSlotsWithAvailability(config);
  return allSlots.filter((slot) => slot.is_available);
}

/**
 * Get all configured slots with their availability status for today
 */
export function getAllSlotsWithAvailability(config: LocalDeliveryConfig): DeliverySlotInfo[] {
  if (!config.delivery_slots || !Array.isArray(config.delivery_slots)) {
    return [];
  }

  // Get current time in WIB (UTC+7)
  const now = new Date();
  const wibTimeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = wibTimeFormatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  const currentMinutesFromMidnight = hour * 60 + minute;

  const cutoff = config.cutoff_minutes || 0;

  return config.delivery_slots.map((slot) => {
    if (!slot.start) {
      return {
        ...slot,
        is_available: false,
        unavailable_reason: "Format jam tidak valid",
      };
    }
    const [slotHourStr, slotMinStr] = slot.start.split(":");
    const slotHour = parseInt(slotHourStr || "0", 10);
    const slotMin = parseInt(slotMinStr || "0", 10);
    const slotStartMinutes = slotHour * 60 + slotMin;

    const isAvailable = currentMinutesFromMidnight <= slotStartMinutes - cutoff;
    return {
      ...slot,
      is_available: isAvailable,
      unavailable_reason: isAvailable
        ? undefined
        : "Batas waktu pemesanan telah lewat",
    };
  });
}

/**
 * Get current date string formatted as YYYY-MM-DD in WIB
 */
export function getTodayWIB(): string {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
}

/**
 * Format slot ID into human-readable label
 */
export function formatSlotLabel(slotId?: string | null, config?: LocalDeliveryConfig | null): string {
  if (!slotId) return "Same Day";
  if (config?.delivery_slots && Array.isArray(config.delivery_slots)) {
    const found = config.delivery_slots.find((s) => s.id === slotId);
    if (found?.label) return found.label;
  }
  const lower = slotId.toLowerCase();
  if (lower === 'pagi') return 'Pagi (09:00 - 10:00 WIB)';
  if (lower === 'siang') return 'Siang (13:00 - 15:00 WIB)';
  if (lower === 'sore') return 'Sore (16:00 - 18:00 WIB)';
  if (lower === 'malam') return 'Malam (19:00 - 21:00 WIB)';
  if (slotId.startsWith('slot_')) return 'Same Day Delivery';
  return slotId;
}
