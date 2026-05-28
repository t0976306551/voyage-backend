import { Router, Request, Response } from 'express';
import { PersonalService } from './personal.service';
import { PersonalRepository } from './personal.repository';
import { ok, fail } from '../../shared/types/response.types';
import { PersonalExpenseCategory } from './personal-expense.entity';
import { broadcastToTrip } from '../../socket/broadcaster';

const VALID_CATEGORIES: PersonalExpenseCategory[] = ['food', 'transport', 'lodging', 'shopping', 'activity', 'other'];

const service = new PersonalService(new PersonalRepository());

export const personalRouter = Router({ mergeParams: true });

function handleError(res: Response, e: unknown): void {
  const msg = e instanceof Error ? e.message : 'UNKNOWN';
  if (msg === 'NOT_FOUND') { res.status(404).json(fail('NOT_FOUND', 'Resource not found')); return; }
  if (msg === 'FORBIDDEN') { res.status(403).json(fail('FORBIDDEN', 'Access denied')); return; }
  if (msg === 'INVALID_AMOUNT') { res.status(422).json(fail('INVALID_AMOUNT', 'amount must be a positive number')); return; }
  res.status(500).json(fail('INTERNAL', 'Internal server error'));
}

// ─── Settings ─────────────────────────────────────────────────────────────

// GET /api/trips/:tripId/personal/settings
personalRouter.get('/settings', async (req: Request, res: Response) => {
  try {
    const settings = await service.getSettings(req.params['tripId'] as string, req.user!.id);
    res.json(ok(settings));
  } catch (e) { handleError(res, e); }
});

// PATCH /api/trips/:tripId/personal/settings
personalRouter.patch('/settings', async (req: Request, res: Response) => {
  try {
    const body = req.body as { memosShared?: boolean; expensesShared?: boolean };
    if (body.memosShared !== undefined && typeof body.memosShared !== 'boolean') {
      res.status(400).json(fail('BAD_REQUEST', 'memosShared must be boolean'));
      return;
    }
    if (body.expensesShared !== undefined && typeof body.expensesShared !== 'boolean') {
      res.status(400).json(fail('BAD_REQUEST', 'expensesShared must be boolean'));
      return;
    }
    const settings = await service.updateSettings(req.params['tripId'] as string, req.user!.id, body);
    broadcastToTrip(req.params['tripId'] as string, 'personal:settings:changed', { tripId: req.params['tripId'] });
    res.json(ok(settings));
  } catch (e) { handleError(res, e); }
});

// ─── Memos ────────────────────────────────────────────────────────────────

// GET /api/trips/:tripId/personal/memos
personalRouter.get('/memos', async (req: Request, res: Response) => {
  try {
    const result = await service.getMemosForUser(req.params['tripId'] as string, req.user!.id);
    res.json(ok(result));
  } catch (e) { handleError(res, e); }
});

// POST /api/trips/:tripId/personal/memos
personalRouter.post('/memos', async (req: Request, res: Response) => {
  try {
    const body = req.body as { title?: string; sortOrder?: number };
    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      res.status(400).json(fail('INVALID_TITLE', 'title is required'));
      return;
    }
    const memo = await service.createMemo(req.params['tripId'] as string, req.user!.id, {
      title: body.title,
      sortOrder: body.sortOrder,
    });
    res.status(201).json(ok(memo));
  } catch (e) { handleError(res, e); }
});

// PATCH /api/trips/:tripId/personal/memos/:memoId
personalRouter.patch('/memos/:memoId', async (req: Request, res: Response) => {
  try {
    const body = req.body as { title?: string; sortOrder?: number };
    const memo = await service.updateMemo(req.params['memoId'] as string, req.user!.id, body);
    res.json(ok(memo));
  } catch (e) { handleError(res, e); }
});

// DELETE /api/trips/:tripId/personal/memos/:memoId
personalRouter.delete('/memos/:memoId', async (req: Request, res: Response) => {
  try {
    await service.deleteMemo(req.params['memoId'] as string, req.user!.id);
    res.json(ok(null));
  } catch (e) { handleError(res, e); }
});

// ─── Memo Items ───────────────────────────────────────────────────────────

// GET /api/trips/:tripId/personal/memos/:memoId/items
personalRouter.get('/memos/:memoId/items', async (req: Request, res: Response) => {
  try {
    const items = await service.getMemoItems(req.params['memoId'] as string, req.user!.id);
    res.json(ok(items));
  } catch (e) { handleError(res, e); }
});

// POST /api/trips/:tripId/personal/memos/:memoId/items
personalRouter.post('/memos/:memoId/items', async (req: Request, res: Response) => {
  try {
    const body = req.body as { title?: string; sortOrder?: number };
    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      res.status(400).json(fail('INVALID_TITLE', 'title is required'));
      return;
    }
    const item = await service.createItem(req.params['memoId'] as string, req.user!.id, {
      title: body.title,
      sortOrder: body.sortOrder,
    });
    res.status(201).json(ok(item));
  } catch (e) { handleError(res, e); }
});

// PATCH /api/trips/:tripId/personal/memos/:memoId/items/:itemId
personalRouter.patch('/memos/:memoId/items/:itemId', async (req: Request, res: Response) => {
  try {
    const body = req.body as { title?: string; completed?: boolean; sortOrder?: number };
    const item = await service.updateItem(
      req.params['itemId'] as string,
      req.params['memoId'] as string,
      req.user!.id,
      body,
    );
    res.json(ok(item));
  } catch (e) { handleError(res, e); }
});

// DELETE /api/trips/:tripId/personal/memos/:memoId/items/:itemId
personalRouter.delete('/memos/:memoId/items/:itemId', async (req: Request, res: Response) => {
  try {
    await service.deleteItem(req.params['itemId'] as string, req.params['memoId'] as string, req.user!.id);
    res.json(ok(null));
  } catch (e) { handleError(res, e); }
});

// PATCH /api/trips/:tripId/personal/memos/:memoId/items/reorder
personalRouter.patch('/memos/:memoId/items/reorder', async (req: Request, res: Response) => {
  try {
    const body = req.body as { items?: { id: string; sortOrder: number }[] };
    if (!Array.isArray(body.items)) {
      res.status(400).json(fail('BAD_REQUEST', 'items array is required'));
      return;
    }
    await service.reorderItems(req.params['memoId'] as string, req.user!.id, body.items);
    res.json(ok(null));
  } catch (e) { handleError(res, e); }
});

// ─── Expenses ─────────────────────────────────────────────────────────────

// GET /api/trips/:tripId/personal/expenses
personalRouter.get('/expenses', async (req: Request, res: Response) => {
  try {
    const result = await service.getExpensesForUser(req.params['tripId'] as string, req.user!.id);
    res.json(ok(result));
  } catch (e) { handleError(res, e); }
});

// POST /api/trips/:tripId/personal/expenses
personalRouter.post('/expenses', async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      amount?: number;
      currency?: string;
      description?: string | null;
      category?: PersonalExpenseCategory;
      spentAt?: string | null;
    };
    const MAX_AMOUNT = 10_000_000;
    if (body.amount === undefined || typeof body.amount !== 'number' || !isFinite(body.amount) || body.amount <= 0 || body.amount > MAX_AMOUNT) {
      res.status(400).json(fail('INVALID_AMOUNT', `amount must be a positive number up to ${MAX_AMOUNT}`));
      return;
    }
    if (body.spentAt !== undefined && body.spentAt !== null && body.spentAt !== '') {
      if (typeof body.spentAt !== 'string' || isNaN(new Date(body.spentAt).getTime())) {
        res.status(400).json(fail('INVALID_DATE', 'spentAt must be a valid date string'));
        return;
      }
    }
    if (body.description !== undefined && body.description !== null && typeof body.description === 'string' && body.description.length > 1000) {
      res.status(400).json(fail('DESCRIPTION_TOO_LONG', 'description must be at most 1000 characters'));
      return;
    }
    if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
      res.status(400).json(fail('INVALID_CATEGORY', 'Invalid category'));
      return;
    }
    const expense = await service.createExpense(req.params['tripId'] as string, req.user!.id, body as { amount: number });
    res.status(201).json(ok(expense));
  } catch (e) { handleError(res, e); }
});

// PATCH /api/trips/:tripId/personal/expenses/:expenseId
personalRouter.patch('/expenses/:expenseId', async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      amount?: number;
      currency?: string;
      description?: string | null;
      category?: PersonalExpenseCategory;
      spentAt?: string | null;
    };
    const MAX_AMOUNT_PATCH = 10_000_000;
    if (body.amount !== undefined && (typeof body.amount !== 'number' || !isFinite(body.amount) || body.amount <= 0 || body.amount > MAX_AMOUNT_PATCH)) {
      res.status(400).json(fail('INVALID_AMOUNT', `amount must be a positive number up to ${MAX_AMOUNT_PATCH}`));
      return;
    }
    if (body.spentAt !== undefined && body.spentAt !== null && body.spentAt !== '') {
      if (typeof body.spentAt !== 'string' || isNaN(new Date(body.spentAt).getTime())) {
        res.status(400).json(fail('INVALID_DATE', 'spentAt must be a valid date string'));
        return;
      }
    }
    if (body.description !== undefined && body.description !== null && typeof body.description === 'string' && body.description.length > 1000) {
      res.status(400).json(fail('DESCRIPTION_TOO_LONG', 'description must be at most 1000 characters'));
      return;
    }
    if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
      res.status(400).json(fail('INVALID_CATEGORY', 'Invalid category'));
      return;
    }
    const expense = await service.updateExpense(req.params['expenseId'] as string, req.user!.id, body);
    res.json(ok(expense));
  } catch (e) { handleError(res, e); }
});

// DELETE /api/trips/:tripId/personal/expenses/:expenseId
personalRouter.delete('/expenses/:expenseId', async (req: Request, res: Response) => {
  try {
    await service.deleteExpense(req.params['expenseId'] as string, req.user!.id);
    res.json(ok(null));
  } catch (e) { handleError(res, e); }
});
