// src/services/cartService.ts
import { supabaseAdmin } from "../config/supabase";
import { AppError } from "../utils/appError";

// Types
export interface CartItem {
  id?: string;
  user_id: string;
  product_id: string;
  quantity: number;
}

// ==========================================
// CART SERVICES
// ==========================================

/**
 * Get semua item di keranjang user (dengan detail produk)
 */
export const getCartByUserIdService = async (userId: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("shopping_carts")
      .select(`
        id,
        quantity,
        created_at,
        updated_at,
        product:products(
          id,
          name,
          slug,
          price,
          stock_quantity,
          unit,
          image_url,
          is_available,
          weight_gram,
          category:product_categories(id, name)
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new AppError(error.message, 400);

    // Hitung total
    let totalItems = 0;
    let totalPrice = 0;

    const cartItems = (data || []).map((item: any) => {
      const subtotal = item.product
        ? item.quantity * item.product.price
        : 0;
      totalItems += item.quantity;
      totalPrice += subtotal;

      return {
        ...item,
        subtotal,
      };
    });

    return {
      items: cartItems,
      summary: {
        total_items: totalItems,
        total_price: totalPrice,
        total_weight: cartItems.reduce((sum, item) => {
          const weight = item.product ? item.product.weight_gram || 0 : 0;
          return sum + weight * item.quantity;
        }, 0),
      },
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal mengambil keranjang: ${error.message}`, 500);
  }
};

/**
 * Tambah item ke keranjang.
 * Jika produk sudah ada di keranjang, tambahkan quantity-nya (upsert).
 */
export const addToCartService = async (
  userId: string,
  productId: string,
  quantity: number
) => {
  try {
    if (quantity <= 0) {
      throw new AppError("Quantity harus lebih dari 0", 400);
    }

    // Validasi produk exists & available
    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("id, name, stock_quantity, is_available")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      throw new AppError("Produk tidak ditemukan", 404);
    }

    if (!product.is_available) {
      throw new AppError("Produk tidak tersedia saat ini", 400);
    }

    // Cek apakah produk sudah ada di keranjang
    const { data: existingItem } = await supabaseAdmin
      .from("shopping_carts")
      .select("id, quantity")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .single();

    let newQuantity = quantity;

    if (existingItem) {
      // Update quantity (tambahkan)
      newQuantity = existingItem.quantity + quantity;

      // Cek stok
      if (newQuantity > product.stock_quantity) {
        throw new AppError(
          `Stok tidak mencukupi. Stok tersedia: ${product.stock_quantity}, di keranjang: ${existingItem.quantity}`,
          400
        );
      }

      const { data, error } = await supabaseAdmin
        .from("shopping_carts")
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingItem.id)
        .select()
        .single();

      if (error) throw new AppError(error.message, 400);
      return data;
    } else {
      // Cek stok
      if (quantity > product.stock_quantity) {
        throw new AppError(
          `Stok tidak mencukupi. Stok tersedia: ${product.stock_quantity}`,
          400
        );
      }

      // Insert baru
      const { data, error } = await supabaseAdmin
        .from("shopping_carts")
        .insert({
          user_id: userId,
          product_id: productId,
          quantity,
        })
        .select()
        .single();

      if (error) throw new AppError(error.message, 400);
      return data;
    }
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal menambahkan ke keranjang: ${error.message}`, 500);
  }
};

/**
 * Update quantity item di keranjang (set langsung, bukan tambah)
 */
export const updateCartItemService = async (
  cartItemId: string,
  userId: string,
  quantity: number
) => {
  try {
    if (quantity <= 0) {
      throw new AppError("Quantity harus lebih dari 0. Gunakan delete untuk menghapus item.", 400);
    }

    // Cek cart item milik user ini
    const { data: cartItem, error: cartError } = await supabaseAdmin
      .from("shopping_carts")
      .select("id, product_id")
      .eq("id", cartItemId)
      .eq("user_id", userId)
      .single();

    if (cartError || !cartItem) {
      throw new AppError("Item keranjang tidak ditemukan", 404);
    }

    // Validasi stok
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("stock_quantity, is_available")
      .eq("id", cartItem.product_id)
      .single();

    if (product && !product.is_available) {
      throw new AppError("Produk tidak tersedia saat ini", 400);
    }

    if (product && quantity > product.stock_quantity) {
      throw new AppError(
        `Stok tidak mencukupi. Stok tersedia: ${product.stock_quantity}`,
        400
      );
    }

    const { data, error } = await supabaseAdmin
      .from("shopping_carts")
      .update({
        quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cartItemId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new AppError(error.message, 400);
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal mengupdate keranjang: ${error.message}`, 500);
  }
};

/**
 * Hapus satu item dari keranjang
 */
export const removeCartItemService = async (
  cartItemId: string,
  userId: string
) => {
  try {
    // Pastikan item milik user ini
    const { data: cartItem } = await supabaseAdmin
      .from("shopping_carts")
      .select("id")
      .eq("id", cartItemId)
      .eq("user_id", userId)
      .single();

    if (!cartItem) {
      throw new AppError("Item keranjang tidak ditemukan", 404);
    }

    const { error } = await supabaseAdmin
      .from("shopping_carts")
      .delete()
      .eq("id", cartItemId)
      .eq("user_id", userId);

    if (error) throw new AppError(error.message, 400);
    return { deleted: true };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal menghapus item keranjang: ${error.message}`, 500);
  }
};

/**
 * Kosongkan seluruh keranjang user
 */
export const clearCartService = async (userId: string) => {
  try {
    const { error } = await supabaseAdmin
      .from("shopping_carts")
      .delete()
      .eq("user_id", userId);

    if (error) throw new AppError(error.message, 400);
    return { cleared: true };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal mengosongkan keranjang: ${error.message}`, 500);
  }
};
