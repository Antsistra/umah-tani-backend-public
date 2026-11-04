// src/services/blogService.ts
import { supabaseAdmin } from "../config/supabase";
import { AppError } from "../utils/appError";

// Types
export interface BlogCategory {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  icon_url?: string;
  is_active?: boolean;
}

export interface BlogArticle {
  id?: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  featured_image_url?: string;
  category_id?: string;
  author_name?: string;
  is_published?: boolean;
  is_featured?: boolean;
  published_at?: string;
}

// ==========================================
// CATEGORY SERVICES
// ==========================================

/**
 * Get all active categories
 */
export const getAllCategoriesService = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from("blog_categories")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    throw new AppError(`Failed to fetch categories: ${error.message}`, 500);
  }
};

/**
 * Get single category by ID
 */
export const getCategoryByIdService = async (id: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("blog_categories")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError("Category not found", 404);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to fetch category: ${error.message}`, 500);
  }
};

/**
 * Create new category
 */
export const createCategoryService = async (categoryData: BlogCategory) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("blog_categories")
      .insert([categoryData])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError("Category slug already exists", 409);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to create category: ${error.message}`, 500);
  }
};

/**
 * Update category
 */
export const updateCategoryService = async (id: string, categoryData: Partial<BlogCategory>) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("blog_categories")
      .update(categoryData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError("Category not found", 404);
      }
      if (error.code === '23505') {
        throw new AppError("Category slug already exists", 409);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to update category: ${error.message}`, 500);
  }
};

/**
 * Delete category (soft delete - set is_active = false)
 */
export const deleteCategoryService = async (id: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("blog_categories").delete()
      .eq("id", id)
      .select()
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError("Category not found", 404);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to delete category: ${error.message}`, 500);
  }
};

// ==========================================
// ARTICLE SERVICES  
// ==========================================

/**
 * Get all articles dengan filtering simple
 */
export const getAllArticlesService = async (filters: {
  published?: boolean;
  featured?: boolean;
  category_id?: string;
  limit?: number;
  offset?: number;
} = {}) => {
  try {
    let query = supabaseAdmin
      .from("blog_articles")
      .select(`
        *,
        category:blog_categories(id, name, slug)
      `)
      .order("created_at", { ascending: false });

    // Apply filters
    if (filters.published !== undefined) {
      query = query.eq("is_published", filters.published);
    }
    if (filters.featured !== undefined) {
      query = query.eq("is_featured", filters.featured);
    }
    if (filters.category_id) {
      query = query.eq("category_id", filters.category_id);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, (filters.offset + (filters.limit || 10)) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    throw new AppError(`Failed to fetch articles: ${error.message}`, 500);
  }
};

/**
 * Get single article by ID
 */
export const getArticleByIdService = async (id: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("blog_articles")
      .select(`
        *,
        category:blog_categories(id, name, slug)
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError("Article not found", 404);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to fetch article: ${error.message}`, 500);
  }
};

/**
 * Get article by slug (for frontend)
 */
export const getArticleBySlugService = async (slug: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("blog_articles")
      .select(`
        *,
        category:blog_categories(id, name, slug)
      `)
      .eq("slug", slug)
      .eq("is_published", true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError("Article not found", 404);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to fetch article: ${error.message}`, 500);
  }
};

/**
 * Create new article
 */
export const createArticleService = async (articleData: BlogArticle) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("blog_articles")
      .insert([articleData])
      .select(`
        *,
        category:blog_categories(id, name, slug)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError("Article slug already exists", 409);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to create article: ${error.message}`, 500);
  }
};

/**
 * Update article
 */
export const updateArticleService = async (id: string, articleData: Partial<BlogArticle>) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("blog_articles")
      .update(articleData)
      .eq("id", id)
      .select(`
        *,
        category:blog_categories(id, name, slug)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError("Article not found", 404);
      }
      if (error.code === '23505') {
        throw new AppError("Article slug already exists", 409);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to update article: ${error.message}`, 500);
  }
};

/**
 * Delete article (hard delete)
 */
export const deleteArticleService = async (id: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("blog_articles")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError("Article not found", 404);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to delete article: ${error.message}`, 500);
  }
};

/**
 * Publish/Unpublish article
 */
export const togglePublishArticleService = async (id: string, isPublished: boolean) => {
  try {
    const updateData: Partial<BlogArticle> = {
      is_published: isPublished,
    };

    // Set published_at jika publish
    if (isPublished) {
      updateData.published_at = new Date().toISOString();
    } else {
      updateData.published_at = undefined;
    }

    const { data, error } = await supabaseAdmin
      .from("blog_articles")
      .update(updateData)
      .eq("id", id)
      .select(`
        *,
        category:blog_categories(id, name, slug)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError("Article not found", 404);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to ${isPublished ? 'publish' : 'unpublish'} article: ${error.message}`, 500);
  }
};

/**
 * Search articles (simple text search)
 */
export const searchArticlesService = async (searchTerm: string, limit: number = 10) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("blog_articles")
      .select(`
        *,
        category:blog_categories(id, name, slug)
      `)
      .eq("is_published", true)
      .or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,excerpt.ilike.%${searchTerm}%`)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    throw new AppError(`Failed to search articles: ${error.message}`, 500);
  }
};

// ==========================================
// FEATURED ARTICLE SERVICES
// ==========================================

/**
 * Get count of featured articles
 */
export const getFeaturedArticlesCountService = async () => {
  try {
    const { count, error } = await supabaseAdmin
      .from("blog_articles")
      .select("*", { count: 'exact', head: true })
      .eq("is_featured", true);

    if (error) throw error;
    return count || 0;
  } catch (error: any) {
    throw new AppError(`Failed to get featured articles count: ${error.message}`, 500);
  }
};

/**
 * Add article to featured (max 5 featured articles)
 */
export const addArticleToFeaturedService = async (id: string) => {
  try {
    // First check if article exists
    const { data: article, error: checkError } = await supabaseAdmin
      .from("blog_articles")
      .select("id, is_featured")
      .eq("id", id)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        throw new AppError("Article not found", 404);
      }
      throw checkError;
    }

    // Check if already featured
    if (article.is_featured) {
      throw new AppError("Article is already featured", 400);
    }

    // Check current featured count
    const featuredCount = await getFeaturedArticlesCountService();
    if (featuredCount >= 5) {
      throw new AppError("Maximum featured articles limit reached (5). Please remove one featured article first.", 400);
    }

    // Update article to featured
    const { data, error } = await supabaseAdmin
      .from("blog_articles")
      .update({ is_featured: true })
      .eq("id", id)
      .select(`
        *,
        category:blog_categories(id, name, slug)
      `)
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to add article to featured: ${error.message}`, 500);
  }
};

/**
 * Remove article from featured
 */
export const removeArticleFromFeaturedService = async (id: string) => {
  try {
    // First check if article exists
    const { data: article, error: checkError } = await supabaseAdmin
      .from("blog_articles")
      .select("id, is_featured")
      .eq("id", id)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        throw new AppError("Article not found", 404);
      }
      throw checkError;
    }

    // Check if not featured
    if (!article.is_featured) {
      throw new AppError("Article is not featured", 400);
    }

    // Update article to not featured
    const { data, error } = await supabaseAdmin
      .from("blog_articles")
      .update({ is_featured: false })
      .eq("id", id)
      .select(`
        *,
        category:blog_categories(id, name, slug)
      `)
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to remove article from featured: ${error.message}`, 500);
  }
};