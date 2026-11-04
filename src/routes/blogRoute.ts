// src/routes/blogRoute.ts
import { Router } from "express";
import {
  // Category Controllers
  getAllCategoriesController,
  getCategoryByIdController,
  createCategoryController,
  updateCategoryController,
  deleteCategoryController,
  // Article Controllers  
  getAllArticlesController,
  getArticleByIdController,
  getArticleBySlugController,
  createArticleController,
  updateArticleController,
  deleteArticleController,
  publishArticleController,
  unpublishArticleController,
  searchArticlesController,
  // Featured Article Controllers
  getFeaturedArticlesCountController,
  addArticleToFeaturedController,
  removeArticleFromFeaturedController,
} from "../controllers/blogController";
import { 
  blogActivityLogger,
  setRequestStartTime,
  skipActivityLogging 
} from "../middlewares/activityLogger";

const router = Router();

// Add request timing middleware untuk semua routes
router.use(setRequestStartTime);

// ==========================================
// PUBLIC ROUTES (No Authentication Required)
// ==========================================

/**
 * GET /api/categories
 * Get all active categories (public)
 */
router.get("/categories",
  skipActivityLogging, // Skip logging untuk public GET
  getAllCategoriesController
);

/**
 * GET /api/categories/:id  
 * Get single category (public)
 */
router.get("/categories/:id",
  skipActivityLogging,
  getCategoryByIdController
);


router.get("/articles", 
  skipActivityLogging,
  getAllArticlesController
);

/**
 * GET /api/articles/search
 * Search articles (public)
 * Query params: q (search term), limit
 */
router.get("/articles/search",
  skipActivityLogging,
  searchArticlesController
);

/**
 * GET /api/articles/slug/:slug
 * Get article by slug (public - untuk frontend URLs)
 */
router.get("/articles/slug/:slug",
  skipActivityLogging,
  getArticleBySlugController
);

/**
 * GET /api/articles/:id
 * Get single article by ID (public)
 */
router.get("/articles/:id",
  skipActivityLogging,
  getArticleByIdController
);

/**
 * GET /api/articles/featured/count
 * Get count of featured articles (public)
 */
router.get("/articles/featured/count",
  skipActivityLogging,
  getFeaturedArticlesCountController
);

// ==========================================
// ADMIN CATEGORY ROUTES (Authentication + Activity Logging)
// ==========================================

/**
 * POST /api/admin/categories
 * Create new category
 */
router.post("/admin/categories",
  blogActivityLogger.createCategory,
  createCategoryController
);

/**
 * PUT /api/admin/categories/:id
 * Update category
 */
router.put("/admin/categories/:id",
  blogActivityLogger.updateCategory,
  updateCategoryController
);

/**
 * DELETE /api/admin/categories/:id
 * Delete category (soft delete)
 */
router.delete("/admin/categories/:id",
  blogActivityLogger.deleteCategory,
  deleteCategoryController
);

// ==========================================
// ADMIN ARTICLE ROUTES (Authentication + Activity Logging)  
// ==========================================

/**
 * POST /api/admin/articles
 * Create new article
 */
router.post("/admin/articles",
  blogActivityLogger.createArticle,
  createArticleController
);

/**
 * PUT /api/admin/articles/:id
 * Update article
 */
router.put("/admin/articles/:id",
  blogActivityLogger.updateArticle,
  updateArticleController
);

/**
 * DELETE /api/admin/articles/:id
 * Delete article
 */
router.delete("/admin/articles/:id",
  blogActivityLogger.deleteArticle,
  deleteArticleController
);

/**
 * PATCH /api/admin/articles/:id/publish
 * Publish article
 */
router.patch("/admin/articles/:id/publish",
  blogActivityLogger.publishArticle,
  publishArticleController
);

/**
 * PATCH /api/admin/articles/:id/unpublish
 * Unpublish article
 */
router.patch("/admin/articles/:id/unpublish",
  blogActivityLogger.unpublishArticle,
  unpublishArticleController
);

/**
 * PATCH /api/admin/articles/:id/feature
 * Add article to featured (max 5)
 */
router.patch("/admin/articles/:id/feature",
  blogActivityLogger.featureArticle,
  addArticleToFeaturedController
);

/**
 * PATCH /api/admin/articles/:id/unfeature
 * Remove article from featured
 */
router.patch("/admin/articles/:id/unfeature",
  blogActivityLogger.unfeatureArticle,
  removeArticleFromFeaturedController
);

export default router;