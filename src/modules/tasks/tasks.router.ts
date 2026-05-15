import { Router } from 'express';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { requireTripRole } from '../../shared/middleware/permission.middleware';
import { listTasks, createTask, updateTask, deleteTask } from './tasks.controller';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/', listTasks);
router.post('/', requireTripRole('Owner', 'Editor'), createTask);
router.patch('/:taskId', requireTripRole('Owner', 'Editor'), updateTask);
router.delete('/:taskId', requireTripRole('Owner', 'Editor'), deleteTask);

export default router;
