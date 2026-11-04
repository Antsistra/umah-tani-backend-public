import { AppError } from "../utils/appError";

type BiteshipRatesItem = {
  name: string;
  value: number;
  weight: number;
  quantity: number;
};

type BiteshipRatesRequest = {
  origin_postal_code?: string;
  destination_postal_code?: string;
  origin_area_id?: string;
  destination_area_id?: string;
  couriers: string;
  items: BiteshipRatesItem[];
};

type BiteshipOrderRequest = {
  shipper_contact_name: string;
  shipper_contact_phone: string;
  shipper_contact_email?: string;
  origin_contact_name: string;
  origin_contact_phone: string;
  origin_address: string;
  origin_note?: string;
  origin_postal_code?: number;
  origin_area_id?: string;
  
  destination_contact_name: string;
  destination_contact_phone: string;
  destination_contact_email?: string;
  destination_address: string;
  destination_note?: string;
  destination_postal_code?: number;
  destination_area_id?: string;
  
  courier_company: string;
  courier_type: string;
  delivery_type: "now" | "scheduled";
  delivery_date?: string;
  delivery_time?: string;
  
  items: Array<{
    name: string;
    description?: string;
    value: number;
    weight: number;
    quantity: number;
  }>;
};


class BiteshipService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.BITESHIP_BASE_URL || "https://api.biteship.com";
    this.apiKey = process.env.BITESHIP_API_KEY || "";
  }

  private getHeaders() {
    if (!this.apiKey) {
      throw new AppError("BITESHIP_API_KEY is not configured", 500);
    }

    return {
      Authorization: this.apiKey,
      "Content-Type": "application/json",
    };
  }

  private async request(method: string, path: string, body?: any) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const parsed = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message = parsed?.message || parsed?.error || response.statusText;
      throw new AppError(`Biteship error: ${message}`, response.status);
    }

    return parsed;
  }

  async searchAreas(input: string) {
    const params = new URLSearchParams({
      countries: "ID",
      input,
      type: "single",
    });

    return this.request("GET", `/v1/maps/areas?${params.toString()}`);
  }

  async getRates(payload: BiteshipRatesRequest) {
    return this.request("POST", "/v1/rates/couriers", payload);
  }

  async createOrder(payload: BiteshipOrderRequest) {
    return this.request("POST", "/v1/orders", payload);
  }

  async getOrder(orderId: string) {
    return this.request("GET", `/v1/orders/${orderId}`);
  }

  async getTrackingStatus(waybillNumber: string, courierCode: string) {
    return this.request("GET", `/v1/trackings/${waybillNumber}/couriers/${courierCode}`);
  }
}

export default BiteshipService;
export type { BiteshipRatesRequest, BiteshipRatesItem, BiteshipOrderRequest };

