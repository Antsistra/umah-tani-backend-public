import { Router } from 'express';
import { 
  getUserAddresses, 
  createAddress, 
  updateAddress, 
  deleteAddress,
  setDefaultAddress
} from '../controllers/addressController';
import { searchAreas } from '../controllers/biteshipController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// All address routes require authentication
router.use(authMiddleware);

// Search areas (Biteship Maps API)
router.get('/areas/search', searchAreas);

// Get all user addresses
router.get('/', getUserAddresses);

// Create new address
router.post('/', createAddress);

// Update address
router.put('/:id', updateAddress);

// Delete address
router.delete('/:id', deleteAddress);

// Set address as default
router.put('/:id/set-default', setDefaultAddress);

export default router;
