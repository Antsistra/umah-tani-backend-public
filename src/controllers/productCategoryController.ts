// src/controllers/productCategoryController.ts
import { Request, Response } from "express";
import {
  getAllProductCategoriesService,
  getProductCategoryByIdService,
  createProductCategoryService,
  updateProductCategoryService,
  deleteProductCategoryService,
} from "../services/productCategoryService";

// ==========================================
// PUBLIC CONTROLLERS
// ==========================================

/**
 * GET /api/ecommerce/categories
 * Get all active product categories (public)
 */
export const getActiveProductCategoriesController = async (
  req: Request,
  res: Response
) => {
  try {
    const categories = await getAllProductCategoriesService({
      is_active: true,
      has_active_products: true,
    });

    return res.status(200).json({
      success: true,
      data: categories,
      message: "Product categories retrieved successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch product categories",
      error: error.message,
    });
  }
};

/**
 * GET /api/ecommerce/categories/:id
 * Get single product category (public)
 */
export const getProductCategoryByIdController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;
    const category = await getProductCategoryByIdService(id);

    return res.status(200).json({
      success: true,
      data: category,
      message: "Product category retrieved successfully",
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// ADMIN CONTROLLERS
// ==========================================

/**
 * GET /api/ecommerce/admin/categories
 * Get all product categories including inactive (admin)
 */
export const getAllProductCategoriesController = async (
  req: Request,
  res: Response
) => {
  try {
    const { is_active } = req.query;

    const filters: { is_active?: boolean } = {};
    if (is_active !== undefined) {
      filters.is_active = is_active === "true";
    }

    const categories = await getAllProductCategoriesService(filters);

    return res.status(200).json({
      success: true,
      data: categories,
      message: "Product categories retrieved successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch product categories",
      error: error.message,
    });
  }
};

/**
 * POST /api/ecommerce/admin/categories
 * Create new product category
 */
export const createProductCategoryController = async (
  req: Request,
  res: Response
) => {
  try {
    const { name, slug, description, icon } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: "Name and slug are required",
      });
    }

    const categoryData = { name, slug, description, icon };
    const newCategory = await createProductCategoryService(categoryData);

    return res.status(201).json({
      success: true,
      data: newCategory,
      message: "Product category created successfully",
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * PUT /api/ecommerce/admin/categories/:id
 * Update product category
 */
export const updateProductCategoryController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;
    const { name, slug, description, is_active, icon } = req.body;

    const updateData: Record<string, any> = {
      name,
      slug,
      description,
      is_active,
      icon,
    };
    // Remove undefined fields
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key]
    );

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    const updatedCategory = await updateProductCategoryService(id, updateData);

    return res.status(200).json({
      success: true,
      data: updatedCategory,
      message: "Product category updated successfully",
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * DELETE /api/ecommerce/admin/categories/:id
 * Delete product category (soft delete)
 */
export const deleteProductCategoryController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;
    const deletedCategory = await deleteProductCategoryService(id);

    return res.status(200).json({
      success: true,
      data: deletedCategory,
      message: "Product category deleted successfully",
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};
