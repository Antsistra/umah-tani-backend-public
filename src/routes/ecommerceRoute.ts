// src/routes/ecommerceRoute.ts
import { Router } from "express";
import {
  // Public controllers
  getActiveProductCategoriesController,
  getProductCategoryByIdController,
  // Admin controllers
  getAllProductCategoriesController,
  createProductCategoryController,
  updateProductCategoryController,
  deleteProductCategoryController,
} from "../controllers/productCategoryController";
import {
  // Public controllers
  getAvailableProductsController,
  getProductByIdController,
  getProductsByCategoryController,
  // Admin controllers
  getAllProductsController,
  createProductController,
  updateProductController,
  deleteProductController,
  updateProductStockController,
} from "../controllers/productController";
import {
  getCartController,
  addToCartController,
  updateCartItemController,
  removeCartItemController,
  clearCartController,
} from "../controllers/cartController";
import {
  createOrderController,
  createDirectOrderController,
  getUserOrdersController,
  getOrderDetailController,
  createRefundController,
  completeOrderController,
} from "../controllers/orderController";
import { getShippingRates } from "../controllers/biteshipController";
import { biteshipWebhookHandler } from "../controllers/biteshipWebhookController";
import {
  ecommerceActivityLogger,
  setRequestStartTime,
  skipActivityLogging,
} from "../middlewares/activityLogger";
import { requireAuth } from "../middlewares/authMiddleware";


const router = Router();

// Add request timing middleware for all routes
router.use(setRequestStartTime);

// ==========================================
// PUBLIC ROUTES (No Authentication Required)
// ==========================================

// --- Product Categories (Public) ---

/**
 * GET /api/ecommerce/categories
 * Get all active product categories
 */
router.get("/categories", skipActivityLogging, getActiveProductCategoriesController);

/**
 * GET /api/ecommerce/categories/:id
 * Get single product category
 */
router.get("/categories/:id", skipActivityLogging, getProductCategoryByIdController);

// --- Products (Public) ---

/**
 * GET /api/ecommerce/products
 * Get all available products with pagination
 * Query: ?category_id=uuid&search=keyword&page=1&limit=10
 */
router.get("/products", skipActivityLogging, getAvailableProductsController);

/**
 * GET /api/ecommerce/products/category/:categoryId
 * Get products by category
 */
router.get(
  "/products/category/:categoryId",
  skipActivityLogging,
  getProductsByCategoryController
);

/**
 * GET /api/ecommerce/products/:id
 * Get single product detail
 */
router.get("/products/:id", skipActivityLogging, getProductByIdController);

// ==========================================
// ADMIN ROUTES (Activity Logging Enabled)
// ==========================================

// --- Product Categories (Admin) ---

/**
 * GET /api/ecommerce/admin/categories
 * Get all categories including inactive
 * Query: ?is_active=true|false
 */
router.get("/admin/categories", skipActivityLogging, getAllProductCategoriesController);

/**
 * POST /api/ecommerce/admin/categories
 * Create new product category
 * Body: { name, slug, description?, icon?, user_id }
 */
router.post(
  "/admin/categories",
  ecommerceActivityLogger.createProductCategory,
  createProductCategoryController
);

/**
 * PUT /api/ecommerce/admin/categories/:id
 * Update product category
 * Body: { name?, slug?, description?, icon?, is_active?, user_id }
 */
router.put(
  "/admin/categories/:id",
  ecommerceActivityLogger.updateProductCategory,
  updateProductCategoryController
);

/**
 * DELETE /api/ecommerce/admin/categories/:id
 * Delete product category (soft delete)
 * Body: { user_id }
 */
router.delete(
  "/admin/categories/:id",
  ecommerceActivityLogger.deleteProductCategory,
  deleteProductCategoryController
);

// --- Products (Admin) ---

/**
 * GET /api/ecommerce/admin/products
 * Get all products including unavailable
 * Query: ?is_available=true|false&category_id=uuid&search=keyword&page=1&limit=10
 */
router.get("/admin/products", skipActivityLogging, getAllProductsController);

/**
 * POST /api/ecommerce/admin/products
 * Create new product
 * Body: { category_id?, name, slug, description?, price, stock_quantity?, unit?, image_url?, user_id }
 */
router.post(
  "/admin/products",
  ecommerceActivityLogger.createProduct,
  createProductController
);

/**
 * PUT /api/ecommerce/admin/products/:id
 * Update product
 * Body: { category_id?, name?, slug?, description?, price?, stock_quantity?, unit?, image_url?, is_available?, user_id }
 */
router.put(
  "/admin/products/:id",
  ecommerceActivityLogger.updateProduct,
  updateProductController
);

/**
 * DELETE /api/ecommerce/admin/products/:id
 * Delete product (soft delete)
 * Body: { user_id }
 */
router.delete(
  "/admin/products/:id",
  ecommerceActivityLogger.deleteProduct,
  deleteProductController
);

/**
 * PATCH /api/ecommerce/admin/products/:id/stock
 * Update product stock quantity
 * Body: { stock_quantity, user_id }
 */
router.patch(
  "/admin/products/:id/stock",
  ecommerceActivityLogger.updateStock,
  updateProductStockController
);

// ==========================================
// CART ROUTES (Authenticated - Supabase Auth)
// ==========================================

/**
 * GET /api/ecommerce/cart
 * Get keranjang user yang sedang login
 * Header: Authorization: Bearer <supabase_access_token>
 */
router.get("/cart", requireAuth, getCartController);

/**
 * POST /api/ecommerce/cart
 * Tambah item ke keranjang
 * Header: Authorization: Bearer <supabase_access_token>
 * Body: { product_id, quantity? }
 */
router.post("/cart", requireAuth, addToCartController);

/**
 * PUT /api/ecommerce/cart/:id
 * Update quantity item di keranjang
 * Header: Authorization: Bearer <supabase_access_token>
 * Body: { quantity }
 */
router.put("/cart/:id", requireAuth, updateCartItemController);

/**
 * DELETE /api/ecommerce/cart/clear
 * Kosongkan seluruh keranjang user
 * Header: Authorization: Bearer <supabase_access_token>
 * Note: Route ini harus di atas DELETE /cart/:id agar tidak ke-catch sebagai :id
 */
router.delete("/cart/clear", requireAuth, clearCartController);

/**
 * DELETE /api/ecommerce/cart/:id
 * Hapus satu item dari keranjang
 * Header: Authorization: Bearer <supabase_access_token>
 */
router.delete("/cart/:id", requireAuth, removeCartItemController);

// ==========================================
// ORDER ROUTES (Authenticated - Supabase Auth)
// ==========================================

/**
 * POST /api/ecommerce/shipping/rates
 * Get shipping rates based on cart and address
 * Header: Authorization: Bearer <supabase_access_token>
 * Body: { address_id, couriers? }
 */
router.post("/shipping/rates", requireAuth, getShippingRates);

/**
 * POST /api/ecommerce/shipping/biteship/webhook
 * Webhook for Biteship shipping updates (Public)
 */
router.post("/shipping/biteship/webhook", biteshipWebhookHandler);


/**
 * POST /api/ecommerce/checkout
 * Create order from cart
 * Header: Authorization: Bearer <supabase_access_token>
 * Body: { address_id, shipping_cost? }
 */
router.post("/checkout", requireAuth, createOrderController);

/**
 * POST /api/ecommerce/checkout/direct
 * Create order directly from items (Beli Sekarang – bypass cart)
 * Header: Authorization: Bearer <supabase_access_token>
 * Body: { address_id, items: [{product_id, quantity}], shipping_cost?, courier?, service_type? }
 */
router.post("/checkout/direct", requireAuth, createDirectOrderController);

/**
 * GET /api/ecommerce/orders
 * Get user's orders
 * Header: Authorization: Bearer <supabase_access_token>
 */
router.get("/orders", requireAuth, getUserOrdersController);

/**
 * GET /api/ecommerce/orders/:id
 * Get order detail by ID
 * Header: Authorization: Bearer <supabase_access_token>
 */
router.get("/orders/:id", requireAuth, getOrderDetailController);

/**
 * POST /api/ecommerce/orders/:id/refund
 * Submit refund request
 */
router.post("/orders/:id/refund", requireAuth, createRefundController);

/**
 * POST /api/ecommerce/orders/:id/complete
 * Complete order manually
 */
router.post("/orders/:id/complete", requireAuth, completeOrderController);

export default router;
