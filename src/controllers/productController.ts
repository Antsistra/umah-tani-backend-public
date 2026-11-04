// src/controllers/productController.ts
import { Request, Response } from "express";
import {
  getAllProductsService,
  getProductByIdService,
  createProductService,
  updateProductService,
  deleteProductService,
  updateProductStockService,
} from "../services/productService";

// ==========================================
// PUBLIC CONTROLLERS
// ==========================================

/**
 * GET /api/ecommerce/products
 * Get all available products (public)
 */
export const getAvailableProductsController = async (
  req: Request,
  res: Response
) => {
  try {
    const { category_id, search, page = 1, limit = 10 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const filters = {
      is_available: true,
      category_id: category_id as string,
      search: search as string,
      limit: Number(limit),
      offset,
    };

    const products = await getAllProductsService(filters);

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: products.length,
      },
      message: "Products retrieved successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};

/**
 * GET /api/ecommerce/products/:id
 * Get single product detail (public)
 */
export const getProductByIdController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;
    const product = await getProductByIdService(id);

    return res.status(200).json({
      success: true,
      data: product,
      message: "Product retrieved successfully",
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
 * GET /api/ecommerce/products/category/:categoryId
 * Get products by category (public)
 */
export const getProductsByCategoryController = async (
  req: Request,
  res: Response
) => {
  try {
    const categoryId = req.params.categoryId as string;
    const { page = 1, limit = 10 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const products = await getAllProductsService({
      is_available: true,
      category_id: categoryId,
      limit: Number(limit),
      offset,
    });

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: products.length,
      },
      message: "Products retrieved successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};

// ==========================================
// ADMIN CONTROLLERS
// ==========================================

/**
 * GET /api/ecommerce/admin/products
 * Get all products including unavailable (admin)
 */
export const getAllProductsController = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      is_available,
      category_id,
      search,
      page,
      limit,
    } = req.query;

    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedPage = page ? Number(page) : undefined;
    const offset = parsedLimit && parsedPage ? (parsedPage - 1) * parsedLimit : undefined;

    const filters: any = {
      category_id: category_id as string,
      search: search as string,
      limit: parsedLimit,
      offset,
    };

    if (is_available !== undefined) {
      filters.is_available = is_available === "true";
    }

    const products = await getAllProductsService(filters);

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        page: parsedPage || 1,
        limit: parsedLimit || products.length,
        total: products.length,
      },
      message: "Products retrieved successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};

/**
 * POST /api/ecommerce/admin/products
 * Create new product
 */
export const createProductController = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      category_id,
      name,
      slug,
      description,
      description_html,
      gallery_images,
      specifications,
      planting_guide,
      discount_percentage,
      price,
      cost_price,
      stock_quantity,
      unit,
      image_url,
      weight_gram
    } = req.body;

    if (!name || !slug || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "Name, slug, and price are required",
      });
    }

    if (typeof price !== "number" || price < 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be a non-negative number",
      });
    }

    if (stock_quantity !== undefined && (typeof stock_quantity !== "number" || stock_quantity < 0)) {
      return res.status(400).json({
        success: false,
        message: "Stock quantity must be a non-negative number",
      });
    }

    const productData = {
      category_id,
      name,
      slug,
      description,
      description_html,
      gallery_images,
      specifications,
      planting_guide,
      discount_percentage,
      price,
      cost_price: cost_price || 0,
      weight_gram: weight_gram || 0,
      stock_quantity: stock_quantity || 0,
      unit: unit || "pcs",
      image_url,
    };

    const newProduct = await createProductService(productData);

    return res.status(201).json({
      success: true,
      data: newProduct,
      message: "Product created successfully",
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
 * PUT /api/ecommerce/admin/products/:id
 * Update product
 */
export const updateProductController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;
    const {
      category_id,
      name,
      slug,
      description,
      description_html,
      gallery_images,
      specifications,
      planting_guide,
      discount_percentage,
      price,
      cost_price,
      stock_quantity,
      unit,
      image_url,
      is_available,
      weight_gram,
    } = req.body;

    const updateData: Record<string, any> = {
      category_id,
      name,
      slug,
      description,
      description_html,
      gallery_images,
      specifications,
      planting_guide,
      discount_percentage,
      price,
      cost_price,
      stock_quantity,
      unit,
      image_url,
      is_available,
      weight_gram,
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

    // Validate price if provided
    if (updateData.price !== undefined && (typeof updateData.price !== "number" || updateData.price < 0)) {
      return res.status(400).json({
        success: false,
        message: "Price must be a non-negative number",
      });
    }

    // Validate stock_quantity if provided
    if (updateData.stock_quantity !== undefined && (typeof updateData.stock_quantity !== "number" || updateData.stock_quantity < 0)) {
      return res.status(400).json({
        success: false,
        message: "Stock quantity must be a non-negative number",
      });
    }

    // Validate weight_gram if provided
    if (updateData.weight_gram !== undefined && (typeof updateData.weight_gram !== "number" || updateData.weight_gram < 0)) {
      return res.status(400).json({
        success: false,
        message: "Weight must be a non-negative number",
      });
    }

    const updatedProduct = await updateProductService(id, updateData);

    return res.status(200).json({
      success: true,
      data: updatedProduct,
      message: "Product updated successfully",
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
 * DELETE /api/ecommerce/admin/products/:id
 * Delete product (soft delete)
 */
export const deleteProductController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;
    const deletedProduct = await deleteProductService(id);

    return res.status(200).json({
      success: true,
      data: deletedProduct,
      message: "Product deleted successfully",
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
 * PATCH /api/ecommerce/admin/products/:id/stock
 * Update product stock quantity
 */
export const updateProductStockController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;
    const { stock_quantity } = req.body;

    if (stock_quantity === undefined || typeof stock_quantity !== "number") {
      return res.status(400).json({
        success: false,
        message: "stock_quantity is required and must be a number",
      });
    }

    if (stock_quantity < 0) {
      return res.status(400).json({
        success: false,
        message: "Stock quantity cannot be negative",
      });
    }

    const updatedProduct = await updateProductStockService(id, {
      stock_quantity,
    });

    return res.status(200).json({
      success: true,
      data: updatedProduct,
      message: "Product stock updated successfully",
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};
