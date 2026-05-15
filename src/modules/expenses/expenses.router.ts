import { Router } from 'express';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { requireTripRole } from '../../shared/middleware/permission.middleware';
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getSettlement,
} from './expenses.controller';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/', listExpenses);
router.get('/settlement', getSettlement);
router.post('/', requireTripRole('Owner', 'Editor'), createExpense);
router.patch('/:expenseId', requireTripRole('Owner', 'Editor'), updateExpense);
router.delete('/:expenseId', requireTripRole('Owner', 'Editor'), deleteExpense);

export default router;
