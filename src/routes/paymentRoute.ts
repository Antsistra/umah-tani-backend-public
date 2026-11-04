import { Router } from 'express';
import {
  initiatePayment,
  submitProof,
  listBankAccounts,
  getActivePayment,
  uploadMiddleware,
} from '../controllers/paymentController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Initiate a new manual payment (QRIS or bank transfer)
router.post('/initiate', authMiddleware, initiatePayment);

// Submit proof of payment image (multipart/form-data)
router.post(
  '/submit-proof',
  authMiddleware,
  (req, res, next) => {
    uploadMiddleware(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'File upload error' });
      }
      next();
    });
  },
  submitProof
);

// List active bank accounts for bank transfer
router.get('/bank-accounts', authMiddleware, listBankAccounts);

// Get active/latest payment info for an order
router.get('/active/:orderNumber', authMiddleware, getActivePayment);

export default router;
