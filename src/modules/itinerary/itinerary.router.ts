import { Router } from 'express';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { requireTripRole } from '../../shared/middleware/permission.middleware';
import { getItinerary, createItem, updateItem, deleteItem, reorderItems } from './itinerary.controller';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/', requireTripRole('Owner', 'Editor', 'Viewer'), getItinerary);
router.post('/', requireTripRole('Owner', 'Editor'), createItem);
router.patch('/reorder', requireTripRole('Owner', 'Editor'), reorderItems);
router.patch('/:itemId', requireTripRole('Owner', 'Editor'), updateItem);
router.delete('/:itemId', requireTripRole('Owner', 'Editor'), deleteItem);

export default router;
