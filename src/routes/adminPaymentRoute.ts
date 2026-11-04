import { Router } from 'express';
import {
  getPendingPayments,
  getPaymentProof,
  approvePaymentHandler,
  rejectPaymentHandler,
} from '../controllers/adminPaymentController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { isAdmin } from '../controllers/adminController';

const router = Router();

// All routes require authentication + admin role
router.use(authMiddleware);
router.use(isAdmin);

// List transactions awaiting manual payment verification
router.get('/pending', getPendingPayments);

// Get signed URL for proof of payment image
router.get('/:id/proof', getPaymentProof);

// Approve a pending payment
router.post('/:id/approve', approvePaymentHandler);

// Reject a pending payment (requires reason in body)
router.post('/:id/reject', rejectPaymentHandler);

export default router;
