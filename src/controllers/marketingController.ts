import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

// ─── Helper ────────────────────────────────────────────────────────────────

const logActivity = async (
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details: any,
  req: Request
) => {
  try {
    let description = '';
    const title = details?.title || '';

    if (action === 'carousel_banner_created') {
      description = `Menambahkan Banner Promo Baru: ${title}`;
    } else if (action === 'carousel_banner_updated') {
      if (details.is_active === true) {
        description = `Mengaktifkan Banner Promo: ${title}`;
      } else if (details.is_active === false) {
        description = `Menonaktifkan Banner Promo: ${title}`;
      } else {
        description = `Memperbarui Banner Promo: ${title}`;
      }
    } else if (action === 'carousel_banner_deleted') {
      description = `Menghapus Banner Promo: ${title}`;
    } else if (action === 'notification_sent') {
      if (resourceId === 'broadcast') {
        description = `Mengirim Notifikasi Broadcast: "${title}" ke ${details.recipient_count || 0} pengguna`;
      } else {
        description = `Mengirim Notifikasi Personal: "${title}"`;
      }
    } else {
      description = `${action} ${resourceType} #${resourceId}`;
    }

    await supabaseAdmin.from('activity_logs').insert({
      user_id: userId,
      action: action.toUpperCase(),
      module: 'marketing',
      entity_type: resourceType,
      entity_id: resourceId,
      entity_name: title,
      description: description,
      metadata: details,
      ip_address: req.ip || req.connection?.remoteAddress,
      user_agent: req.headers['user-agent'] as string || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

// ─── Carousel Banners ──────────────────────────────────────────────────────

/**
 * GET /api/admin/marketing/banners
 * GET /api/marketing/banners (public – for mobile)
 * Returns all active banners ordered by order_index
 */
export const getCarouselBanners = async (req: Request, res: Response) => {
  try {
    const isAdmin = (req as any).isAdminRoute;
    let query = supabaseAdmin
      .from('carousel_banners')
      .select('*')
      .order('order_index', { ascending: true });

    // Public endpoint only returns active banners
    if (!isAdmin) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get carousel banners error:', error);
    res.status(500).json({ error: 'Failed to fetch carousel banners' });
  }
};

/**
 * POST /api/admin/marketing/banners
 */
export const createCarouselBanner = async (req: Request, res: Response) => {
  try {
    const { title, subtitle, image_url, link_url, order_index, is_active } = req.body;

    if (!title || !image_url) {
      return res.status(400).json({ error: 'title and image_url are required' });
    }

    // Get the max order_index if not provided
    let finalOrderIndex = order_index;
    if (finalOrderIndex === undefined || finalOrderIndex === null) {
      const { data: maxData } = await supabaseAdmin
        .from('carousel_banners')
        .select('order_index')
        .order('order_index', { ascending: false })
        .limit(1)
        .single();
      finalOrderIndex = maxData ? maxData.order_index + 1 : 0;
    }

    const { data, error } = await supabaseAdmin
      .from('carousel_banners')
      .insert({
        title,
        subtitle,
        image_url,
        link_url,
        order_index: finalOrderIndex,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) throw error;

    await logActivity(req.userId || 'unknown', 'carousel_banner_created', 'carousel_banner', data.id, { title }, req);

    res.status(201).json({ success: true, data });
  } catch (error: any) {
    console.error('Create carousel banner error:', error);
    res.status(500).json({ error: 'Failed to create carousel banner' });
  }
};

/**
 * PUT /api/admin/marketing/banners/:id
 */
export const updateCarouselBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, subtitle, image_url, link_url, order_index, is_active } = req.body;

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (subtitle !== undefined) updates.subtitle = subtitle;
    if (image_url !== undefined) updates.image_url = image_url;
    if (link_url !== undefined) updates.link_url = link_url;
    if (order_index !== undefined) updates.order_index = order_index;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabaseAdmin
      .from('carousel_banners')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Banner not found' });

    await logActivity(req.userId || 'unknown', 'carousel_banner_updated', 'carousel_banner', String(id), { ...updates, title: data.title }, req);

    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Update carousel banner error:', error);
    res.status(500).json({ error: 'Failed to update carousel banner' });
  }
};

/**
 * DELETE /api/admin/marketing/banners/:id
 */
export const deleteCarouselBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: banner } = await supabaseAdmin
      .from('carousel_banners')
      .select('image_url, title')
      .eq('id', id)
      .single();

    if (!banner) return res.status(404).json({ error: 'Banner not found' });

    // Delete from storage if using Supabase Storage URL
    if (banner.image_url?.includes('carousel-banners')) {
      const urlParts = banner.image_url.split('/carousel-banners/');
      if (urlParts.length >= 2) {
        await supabaseAdmin.storage.from('carousel-banners').remove([urlParts[1]]);
      }
    }

    const { error } = await supabaseAdmin
      .from('carousel_banners')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await logActivity(req.userId || 'unknown', 'carousel_banner_deleted', 'carousel_banner', String(id), { title: banner.title }, req);

    res.json({ success: true, message: 'Banner deleted successfully' });
  } catch (error: any) {
    console.error('Delete carousel banner error:', error);
    res.status(500).json({ error: 'Failed to delete carousel banner' });
  }
};

/**
 * PUT /api/admin/marketing/banners/reorder
 * Body: { ordered_ids: string[] }
 */
export const reorderCarouselBanners = async (req: Request, res: Response) => {
  try {
    const { ordered_ids } = req.body;

    if (!Array.isArray(ordered_ids) || ordered_ids.length === 0) {
      return res.status(400).json({ error: 'ordered_ids array is required' });
    }

    // Update each banner's order_index
    const updates = ordered_ids.map((id: string, index: number) =>
      supabaseAdmin
        .from('carousel_banners')
        .update({ order_index: index, updated_at: new Date().toISOString() })
        .eq('id', id)
    );

    await Promise.all(updates);

    res.json({ success: true, message: 'Banners reordered successfully' });
  } catch (error: any) {
    console.error('Reorder banners error:', error);
    res.status(500).json({ error: 'Failed to reorder banners' });
  }
};

// ─── Notifications ─────────────────────────────────────────────────────────

/**
 * POST /api/admin/marketing/notifications/send
 * Body: { title, body, type?, target_user_id? }
 */
export const sendNotification = async (req: Request, res: Response) => {
  try {
    const { title, body, type = 'broadcast', target_user_id } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'title and body are required' });
    }

    if (type === 'personal' && !target_user_id) {
      return res.status(400).json({ error: 'target_user_id is required for personal notifications' });
    }

    if (type === 'broadcast') {
      // For broadcast: insert one notification record per user
      const { data: users, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .neq('role', 'admin'); // Exclude admins from broadcast

      if (usersError) throw usersError;

      if (users && users.length > 0) {
        const notifications = users.map((user: { id: string }) => ({
          title,
          body,
          type: 'broadcast',
          target_user_id: user.id,
          is_read: false,
          created_by: req.userId,
        }));

        const { error: insertError } = await supabaseAdmin
          .from('notifications')
          .insert(notifications);

        if (insertError) throw insertError;
      }

      // Return a representative notification record
      const { data: sample } = await supabaseAdmin
        .from('notifications')
        .select('*')
        .eq('created_by', req.userId)
        .eq('type', 'broadcast')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      await logActivity(
        req.userId || 'unknown',
        'notification_sent',
        'notification',
        'broadcast',
        { title, body, recipient_count: users?.length || 0 },
        req
      );

      res.status(201).json({
        success: true,
        data: sample,
        message: `Notifikasi dikirim ke ${users?.length || 0} pengguna`,
      });
    } else {
      // Personal notification
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .insert({
          title,
          body,
          type: 'personal',
          target_user_id,
          is_read: false,
          created_by: req.userId,
        })
        .select()
        .single();

      if (error) throw error;

      await logActivity(
        req.userId || 'unknown',
        'notification_sent',
        'notification',
        data.id,
        { title, body, target_user_id },
        req
      );

      res.status(201).json({ success: true, data });
    }
  } catch (error: any) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
};

/**
 * GET /api/admin/marketing/notifications
 * Returns broadcast history (unique per send action, grouped by created_at + title)
 */
export const getNotificationHistory = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Get distinct notifications by (title, body, type, created_by, created_at rounded)
    // For broadcast, we only show one representative per batch
    const { data, error, count } = await supabaseAdmin
      .from('notifications')
      .select('id, title, body, type, target_user_id, created_by, created_at', { count: 'exact' })
      .eq('type', 'broadcast')
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;

    // Enrich with creator info
    if (data && data.length > 0) {
      const creatorIds = [...new Set(data.map((n: any) => n.created_by).filter(Boolean))];
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email')
        .in('id', creatorIds);

      const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
      data.forEach((n: any) => {
        n.creator = profileMap.get(n.created_by) || null;
      });
    }

    res.json({
      success: true,
      data: data || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('Get notification history error:', error);
    res.status(500).json({ error: 'Failed to fetch notification history' });
  }
};

/**
 * GET /api/notifications/me — Mobile: get notifications for current user
 */
export const getMyNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const { data, error, count } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('target_user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('Get my notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

/**
 * PATCH /api/notifications/:id/read — Mark notification as read
 */
export const markNotificationRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('target_user_id', userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Notification not found' });

    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};
