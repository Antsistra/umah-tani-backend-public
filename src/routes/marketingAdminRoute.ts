import { Router } from 'express';
import {
  getCarouselBanners,
  createCarouselBanner,
  updateCarouselBanner,
  deleteCarouselBanner,
  reorderCarouselBanners,
  sendNotification,
  getNotificationHistory,
} from '../controllers/marketingController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { isAdmin } from '../controllers/adminController';

const router = Router();

// All admin marketing routes require authentication + admin role
router.use(authMiddleware);
router.use(isAdmin);

// ─── Carousel Banners ──────────────────────────────────────────────────────
router.get('/banners', (req, res) => {
  (req as any).isAdminRoute = true;
  return getCarouselBanners(req, res);
});
router.post('/banners', createCarouselBanner);
router.put('/banners/reorder', reorderCarouselBanners);
router.put('/banners/:id', updateCarouselBanner);
router.delete('/banners/:id', deleteCarouselBanner);

// ─── Notifications ─────────────────────────────────────────────────────────
router.post('/notifications/send', sendNotification);
router.get('/notifications', getNotificationHistory);

export default router;
