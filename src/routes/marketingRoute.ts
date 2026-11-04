import { Router } from 'express';
import { getCarouselBanners, getMyNotifications, markNotificationRead } from '../controllers/marketingController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// ─── Public routes (no auth) ───────────────────────────────────────────────

// Public carousel banners for mobile (only active ones)
router.get('/banners', getCarouselBanners);

// ─── Protected routes (auth required) ─────────────────────────────────────
router.use(authMiddleware);

// Mobile: get my notifications
router.get('/me', getMyNotifications);
router.patch('/:id/read', markNotificationRead);

export default router;
