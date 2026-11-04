// src/services/productCategoryService.ts
import { supabaseAdmin } from "../config/supabase";
import { AppError } from "../utils/appError";

// Types
export interface ProductCategory {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  is_active?: boolean;
  icon?: string;
}

// ==========================================
// PRODUCT CATEGORY SERVICES
// ==========================================

/**
 * Get all categories (admin view - includes inactive)
 */
export const getAllProductCategoriesService = async (filters: {
  is_active?: boolean;
  has_active_products?: boolean;
} = {}) => {
  try {
    let selectQuery = "*";
    if (filters.has_active_products) {
      selectQuery = "*, products!inner(id, is_available)";
    }

    let query = supabaseAdmin
      .from("product_categories")
      .select(selectQuery)
      .order("name");

    if (filters.is_active !== undefined) {
      query = query.eq("is_active", filters.is_active);
    }

    if (filters.has_active_products) {
      query = query.eq("products.is_available", true);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Clean up the joined products data from the returned objects to keep the payload clean
    const categories = (data || []).map((cat: any) => {
      const { products, ...categoryData } = cat;
      return categoryData;
    });

    return categories;
  } catch (error: any) {
    throw new AppError(`Failed to fetch product categories: ${error.message}`, 500);
  }
};

/**
 * Get single category by ID
 */
export const getProductCategoryByIdService = async (id: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("product_categories")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new AppError("Product category not found", 404);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to fetch product category: ${error.message}`, 500);
  }
};

/**
 * Create new product category
 */
export const createProductCategoryService = async (categoryData: ProductCategory) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("product_categories")
      .insert([categoryData])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError("Product category slug already exists", 409);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to create product category: ${error.message}`, 500);
  }
};

/**
 * Update product category
 */
export const updateProductCategoryService = async (
  id: string,
  categoryData: Partial<ProductCategory>
) => {
  try {
    const updatePayload = {
      ...categoryData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("product_categories")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new AppError("Product category not found", 404);
      }
      if (error.code === "23505") {
        throw new AppError("Product category slug already exists", 409);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to update product category: ${error.message}`, 500);
  }
};

/**
 * Delete product category (soft delete - set is_active = false)
 */
export const deleteProductCategoryService = async (id: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("product_categories")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new AppError("Product category not found", 404);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to delete product category: ${error.message}`, 500);
  }
};
