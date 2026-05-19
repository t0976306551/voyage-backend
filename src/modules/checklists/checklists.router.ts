import { Router } from 'express';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { requireTripRole } from '../../shared/middleware/permission.middleware';
import {
  listChecklists,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  toggleChecklist,
} from './checklists.controller';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/', requireTripRole('Owner', 'Editor', 'Viewer'), listChecklists);
router.post('/', requireTripRole('Owner', 'Editor'), createChecklist);
router.patch('/:itemId', requireTripRole('Owner', 'Editor', 'Viewer'), updateChecklist);
router.delete('/:itemId', requireTripRole('Owner', 'Editor', 'Viewer'), deleteChecklist);
// Toggle: any member (auth required); the service ensures only the assigned user can toggle their own row.
router.post('/:itemId/toggle', requireTripRole('Owner', 'Editor', 'Viewer'), toggleChecklist);

export default router;
