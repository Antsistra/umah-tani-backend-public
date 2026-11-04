import { Router } from 'express';
import {
  getOwnerBankAccounts,
  createOwnerBankAccount,
  updateOwnerBankAccount,
  toggleOwnerBankAccountStatus,
  deleteOwnerBankAccount,
} from '../controllers/ownerBankAccountController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { isOwner } from '../controllers/adminController';

const router = Router();

// Proteksi ketat: Hanya user yang terautentikasi dan memiliki role 'owner' yang bisa mengakses
router.use(authMiddleware);
router.use(isOwner);

// GET all bank accounts
router.get('/', getOwnerBankAccounts);

// POST create bank account
router.post('/', createOwnerBankAccount);

// PUT update bank account
router.put('/:id', updateOwnerBankAccount);

// PATCH toggle active status
router.patch('/:id/toggle', toggleOwnerBankAccountStatus);

// DELETE bank account
router.delete('/:id', deleteOwnerBankAccount);

export default router;
