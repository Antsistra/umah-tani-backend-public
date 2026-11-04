// src/services/productService.ts
import { supabaseAdmin } from "../config/supabase";
import { AppError } from "../utils/appError";

// Types
export interface Product {
  id?: string;
  category_id?: string;
  name: string;
  slug: string;
  description?: string;
  description_html?: string;
  gallery_images?: string[];
  specifications?: Record<string, any>;
  planting_guide?: string;
  discount_percentage?: number;
  price: number;
  cost_price?: number;
  sold_count?: number;
  stock_quantity?: number;
  weight_gram?: number;
  unit?: string;
  image_url?: string;
  is_available?: boolean;
}

// ==========================================
// PRODUCT SERVICES
// ==========================================

/**
 * Get all products with filters and pagination (admin view)
 */
export const getAllProductsService = async (filters: {
  is_available?: boolean;
  category_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}) => {
  try {
    let query = supabaseAdmin
      .from("products")
      .select(`
        *,
        category:product_categories(id, name, slug)
      `)
      .order("created_at", { ascending: false });

    if (filters.is_available !== undefined) {
      query = query.eq("is_available", filters.is_available);
    }
    if (filters.category_id) {
      query = query.eq("category_id", filters.category_id);
    }
    if (filters.search) {
      query = query.ilike("name", `%${filters.search}%`);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset !== undefined && filters.limit) {
      query = query.range(filters.offset, filters.offset + filters.limit - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    throw new AppError(`Failed to fetch products: ${error.message}`, 500);
  }
};

/**
 * Get single product by ID
 */
export const getProductByIdService = async (id: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select(`
        *,
        category:product_categories(id, name, slug)
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new AppError("Product not found", 404);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to fetch product: ${error.message}`, 500);
  }
};

/**
 * Create new product
 */
export const createProductService = async (productData: Product) => {
  try {
    // Validate category exists if provided
    if (productData.category_id) {
      const { data: category, error: catError } = await supabaseAdmin
        .from("product_categories")
        .select("id")
        .eq("id", productData.category_id)
        .eq("is_active", true)
        .single();

      if (catError || !category) {
        throw new AppError("Product category not found or inactive", 404);
      }
    }

    const { data, error } = await supabaseAdmin
      .from("products")
      .insert([productData])
      .select(`
        *,
        category:product_categories(id, name, slug)
      `)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError("Product slug already exists", 409);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to create product: ${error.message}`, 500);
  }
};

/**
 * Update product
 */
export const updateProductService = async (
  id: string,
  productData: Partial<Product>
) => {
  try {
    // Validate category exists if updating category_id
    if (productData.category_id) {
      const { data: category, error: catError } = await supabaseAdmin
        .from("product_categories")
        .select("id")
        .eq("id", productData.category_id)
        .eq("is_active", true)
        .single();

      if (catError || !category) {
        throw new AppError("Product category not found or inactive", 404);
      }
    }

    const updatePayload = {
      ...productData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("products")
      .update(updatePayload)
      .eq("id", id)
      .select(`
        *,
        category:product_categories(id, name, slug)
      `)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new AppError("Product not found", 404);
      }
      if (error.code === "23505") {
        throw new AppError("Product slug already exists", 409);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to update product: ${error.message}`, 500);
  }
};

/**
 * Delete product (soft delete - set is_available = false)
 */
export const deleteProductService = async (id: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("products")
      .update({ is_available: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new AppError("Product not found", 404);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to delete product: ${error.message}`, 500);
  }
};

/**
 * Update product stock quantity
 */
export const updateProductStockService = async (
  id: string,
  stockData: { stock_quantity: number }
) => {
  try {
    if (stockData.stock_quantity < 0) {
      throw new AppError("Stock quantity cannot be negative", 400);
    }

    const { data, error } = await supabaseAdmin
      .from("products")
      .update({
        stock_quantity: stockData.stock_quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        *,
        category:product_categories(id, name, slug)
      `)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new AppError("Product not found", 404);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to update product stock: ${error.message}`, 500);
  }
};
