import { Router } from 'express';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { requireTripRole } from '../../shared/middleware/permission.middleware';
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getSettlement,
  togglePaid,
} from './expenses.controller';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/', listExpenses);
router.get('/settlement', getSettlement);
router.post('/', requireTripRole('Owner', 'Editor'), createExpense);
router.patch('/:expenseId', requireTripRole('Owner', 'Editor'), updateExpense);
router.delete('/:expenseId', requireTripRole('Owner', 'Editor'), deleteExpense);

// Toggle paid-back status — any trip member can mark
router.post('/:expenseId/toggle-paid', requireTripRole('Owner', 'Editor', 'Viewer'), togglePaid);

export default router;
