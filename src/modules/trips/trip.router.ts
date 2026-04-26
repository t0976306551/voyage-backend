import { Router } from 'express';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { requireTripRole } from '../../shared/middleware/permission.middleware';
import { getMyTrips, getTripById, createTrip, updateTrip, joinByInviteCode } from './trip.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', getMyTrips);
router.post('/', createTrip);
router.post('/join', joinByInviteCode);
router.get('/:tripId', getTripById);
router.patch('/:tripId', requireTripRole('Owner', 'Editor'), updateTrip);

export default router;
