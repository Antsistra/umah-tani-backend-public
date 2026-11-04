// src/controllers/blogController.ts
import { Request, Response } from "express";
import {
  getAllCategoriesService,
  getCategoryByIdService,
  createCategoryService,
  updateCategoryService,
  deleteCategoryService,
  getAllArticlesService,
  getArticleByIdService,
  getArticleBySlugService,
  createArticleService,
  updateArticleService,
  deleteArticleService,
  togglePublishArticleService,
  searchArticlesService,
  getFeaturedArticlesCountService,
  addArticleToFeaturedService,
  removeArticleFromFeaturedService,
} from "../services/blogService";


export const getAllCategoriesController = async (req: Request, res: Response) => {
  try {
    const categories = await getAllCategoriesService();
    
    return res.status(200).json({
      success: true,
      data: categories,
      message: "Categories retrieved successfully"
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message
    });
  }
};

export const getCategoryByIdController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const category = await getCategoryByIdService(id as any);
    
    return res.status(200).json({
      success: true,
      data: category,
      message: "Category retrieved successfully"
    });
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * POST /api/admin/categories
 * Create new category
 */
export const createCategoryController = async (req: Request, res: Response) => {
  try {
    const { name, slug, description, icon_url } = req.body;
    
    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: "Name and slug are required"
      });
    }

    const categoryData = { name, slug, description, icon_url };
    const newCategory = await createCategoryService(categoryData);
    
    return res.status(201).json({
      success: true,
      data: newCategory,
      message: "Category created successfully"
    });
  } catch (error: any) {
    const statusCode = error.message.includes("already exists") ? 409 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

export const updateCategoryController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, slug, description, icon_url, is_active } = req.body;
    
    const updateData: Record<string, any> = { name, slug, description, icon_url, is_active };
    // Remove undefined fields
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update"
      });
    }

    const updatedCategory = await updateCategoryService(id as any, updateData);
    
    return res.status(200).json({
      success: true,
      data: updatedCategory,
      message: "Category updated successfully"
    });
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 
                      error.message.includes("already exists") ? 409 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};


export const deleteCategoryController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deletedCategory = await deleteCategoryService(id as any);
    
    return res.status(200).json({
      success: true,
      data: deletedCategory,
      message: "Category deleted successfully"
    });
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

export const getAllArticlesController = async (req: Request, res: Response) => {
  try {
    const { 
      published = "true",
      featured,
      category_id,
      page = 1,
      limit = 10 
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    
    const filters = {
      published: published === "true",
      featured: featured === "true" ? true : undefined,
      category_id: category_id as string,
      limit: Number(limit),
      offset
    };

    const articles = await getAllArticlesService(filters);
    
    return res.status(200).json({
      success: true,
      data: articles,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: articles.length
      },
      message: "Articles retrieved successfully"
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch articles",
      error: error.message
    });
  }
};

export const getArticleByIdController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const article = await getArticleByIdService(id as any);
    
    return res.status(200).json({
      success: true,
      data: article,
      message: "Article retrieved successfully"
    });
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

export const getArticleBySlugController = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const article = await getArticleBySlugService(slug as any);
    
    return res.status(200).json({
      success: true,
      data: article,
      message: "Article retrieved successfully"
    });
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

export const createArticleController = async (req: Request, res: Response) => {
  try {
    const {
      title,
      slug,
      excerpt,
      content,
      featured_image_url,
      category_id,
      author_name = "Admin",
      is_published = false,
      is_featured = false
    } = req.body;
    
    if (!title || !slug || !content) {
      return res.status(400).json({
        success: false,
        message: "Title, slug, and content are required"
      });
    }

    const articleData = {
      title,
      slug,
      excerpt,
      content,
      featured_image_url,
      category_id,
      author_name,
      is_published,
      is_featured
    };

    const newArticle = await createArticleService(articleData);
    
    return res.status(201).json({
      success: true,
      data: newArticle,
      message: "Article created successfully"
    });
  } catch (error: any) {
    const statusCode = error.message.includes("already exists") ? 409 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

export const updateArticleController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      slug,
      excerpt,
      content,
      featured_image_url,
      category_id,
      author_name,
      is_published,
      is_featured
    } = req.body;
    
    const updateData: Record<string, any> = {
      title,
      slug,
      excerpt,
      content,
      featured_image_url,
      category_id,
      author_name,
      is_published,
      is_featured
    };

    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update"
      });
    }

    const updatedArticle = await updateArticleService(id as any, updateData);
    
    return res.status(200).json({
      success: true,
      data: updatedArticle,
      message: "Article updated successfully"
    });
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 
                      error.message.includes("already exists") ? 409 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteArticleController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deletedArticle = await deleteArticleService(id as any);
    
    return res.status(200).json({
      success: true,
      data: deletedArticle,
      message: "Article deleted successfully"
    });
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * PATCH /api/admin/articles/:id/publish
 * Publish article
 */
export const publishArticleController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedArticle = await togglePublishArticleService(id as any, true);
    
    return res.status(200).json({
      success: true,
      data: updatedArticle,
      message: "Article published successfully"
    });
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * PATCH /api/admin/articles/:id/unpublish
 * Unpublish article
 */
export const unpublishArticleController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedArticle = await togglePublishArticleService(id as any, false);
    
    return res.status(200).json({
      success: true,
      data: updatedArticle,
      message: "Article unpublished successfully"
    });
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * GET /api/articles/search
 * Search articles
 */
export const searchArticlesController = async (req: Request, res: Response) => {
  try {
    const { q: searchTerm, limit = 10 } = req.query;
    
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: "Search term (q) is required"
      });
    }

    const articles = await searchArticlesService(searchTerm as string, Number(limit));
    
    return res.status(200).json({
      success: true,
      data: articles,
      message: `Found ${articles.length} articles`,
      searchTerm
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Search failed",
      error: error.message
    });
  }
};

// ==========================================
// FEATURED ARTICLE CONTROLLERS
// ==========================================

/**
 * GET /api/articles/featured/count
 * Get count of featured articles
 */
export const getFeaturedArticlesCountController = async (req: Request, res: Response) => {
  try {
    const count = await getFeaturedArticlesCountService();
    
    return res.status(200).json({
      success: true,
      data: { count, max: 5 },
      message: "Featured articles count retrieved successfully"
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to get featured articles count",
      error: error.message
    });
  }
};

/**
 * PATCH /api/admin/articles/:id/feature
 * Add article to featured
 */
export const addArticleToFeaturedController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const article = await addArticleToFeaturedService(id as string);
    
    return res.status(200).json({
      success: true,
      data: article,
      message: "Article added to featured successfully"
    });
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 
                      error.message.includes("already featured") ? 400 :
                      error.message.includes("Maximum featured") ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * PATCH /api/admin/articles/:id/unfeature
 * Remove article from featured
 */
export const removeArticleFromFeaturedController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const article = await removeArticleFromFeaturedService(id as string);
    
    return res.status(200).json({
      success: true,
      data: article,
      message: "Article removed from featured successfully"
    });
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 
                      error.message.includes("not featured") ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};