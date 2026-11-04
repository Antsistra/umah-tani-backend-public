// src/controllers/cartController.ts
import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import {
  getCartByUserIdService,
  addToCartService,
  updateCartItemService,
  removeCartItemService,
  clearCartService,
} from "../services/cartService";

// ==========================================
// CART CONTROLLERS (Authenticated)
// ==========================================

/**
 * GET /api/ecommerce/cart
 * Get keranjang user yang sedang login
 */
export const getCartController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId!;
    const cart = await getCartByUserIdService(userId);

    return res.status(200).json({
      success: true,
      data: cart,
      message: "Keranjang berhasil diambil",
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Gagal mengambil keranjang",
    });
  }
};

/**
 * POST /api/ecommerce/cart
 * Tambah item ke keranjang
 * Body: { product_id, quantity }
 */
export const addToCartController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId!;
    const { product_id, quantity = 1 } = req.body;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: "product_id wajib diisi",
      });
    }

    const cartItem = await addToCartService(userId, product_id, Number(quantity));

    return res.status(201).json({
      success: true,
      data: cartItem,
      message: "Produk berhasil ditambahkan ke keranjang",
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Gagal menambahkan ke keranjang",
    });
  }
};

/**
 * PUT /api/ecommerce/cart/:id
 * Update quantity item di keranjang
 * Body: { quantity }
 */
export const updateCartItemController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId!;
    const cartItemId = req.params.id as string;
    const { quantity } = req.body;

    if (quantity === undefined || quantity === null) {
      return res.status(400).json({
        success: false,
        message: "quantity wajib diisi",
      });
    }

    const cartItem = await updateCartItemService(
      cartItemId,
      userId,
      Number(quantity)
    );

    return res.status(200).json({
      success: true,
      data: cartItem,
      message: "Keranjang berhasil diupdate",
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Gagal mengupdate keranjang",
    });
  }
};

/**
 * DELETE /api/ecommerce/cart/:id
 * Hapus satu item dari keranjang
 */
export const removeCartItemController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId!;
    const cartItemId = req.params.id as string;

    await removeCartItemService(cartItemId, userId);

    return res.status(200).json({
      success: true,
      message: "Item berhasil dihapus dari keranjang",
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Gagal menghapus item keranjang",
    });
  }
};

/**
 * DELETE /api/ecommerce/cart
 * Kosongkan seluruh keranjang user
 */
export const clearCartController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId!;

    await clearCartService(userId);

    return res.status(200).json({
      success: true,
      message: "Keranjang berhasil dikosongkan",
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Gagal mengosongkan keranjang",
    });
  }
};
