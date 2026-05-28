import { Request, Response } from 'express';
import { ExpensesService } from './expenses.service';
import { ExpensesRepository } from './expenses.repository';
import { ok, fail } from '../../shared/types/response.types';
import { broadcastToTrip } from '../../socket/broadcaster';

const service = new ExpensesService(new ExpensesRepository());

const ALLOWED_CURRENCIES = new Set([
  'TWD', 'USD', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 'HKD', 'SGD', 'KRW',
  'CNY', 'THB', 'MYR', 'IDR', 'PHP', 'VND', 'INR', 'CHF', 'NZD', 'SEK',
  'NOK', 'DKK', 'BRL', 'ZAR', 'MXN', 'AED', 'SAR', 'TRY', 'ILS', 'CZK',
]);
const MAX_AMOUNT = 10_000_000;

export async function listExpenses(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.params['tripId'] as string;
    const items = await service.listByTrip(tripId);
    res.json(ok(items));
  } catch {
    res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function createExpense(req: Request, res: Response): Promise<void> {
  try {
    // 新增內容：Owner 或 Editor 永遠可以做（不檢查 canEditContent）。
    // 角色檢查已在 router 的 requireTripRole('Owner','Editor') 完成。
    const tripId = req.params['tripId'] as string;
    const body = req.body as {
      payerId?: string;
      amount?: number;
      currency?: string;
      description?: string;
      splitInfo?: Record<string, number>;
    };
    if (!body.payerId || typeof body.payerId !== 'string') {
      res.status(400).json(fail('INVALID_PAYER', 'payerId is required'));
      return;
    }
    if (typeof body.amount !== 'number' || !isFinite(body.amount) || body.amount <= 0 || body.amount > MAX_AMOUNT) {
      res.status(400).json(fail('INVALID_AMOUNT', `amount must be a positive number up to ${MAX_AMOUNT}`));
      return;
    }
    if (body.currency !== undefined && !ALLOWED_CURRENCIES.has(body.currency)) {
      res.status(400).json(fail('INVALID_CURRENCY', 'Unsupported currency code'));
      return;
    }
    if (body.splitInfo !== null && body.splitInfo !== undefined) {
      if (typeof body.splitInfo !== 'object' || Array.isArray(body.splitInfo)) {
        res.status(400).json(fail('INVALID_SPLIT', 'splitInfo must be an object'));
        return;
      }
      let splitTotal = 0;
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const entries = Object.entries(body.splitInfo);
      if (entries.length > 50) {
        res.status(400).json(fail('INVALID_SPLIT', 'splitInfo must not have more than 50 entries'));
        return;
      }
      for (const [k, v] of entries) {
        if (!k || !UUID_RE.test(k)) {
          res.status(400).json(fail('INVALID_SPLIT', 'splitInfo keys must be valid user UUIDs'));
          return;
        }
        if (typeof v !== 'number' || !isFinite(v) || v < 0) {
          res.status(400).json(fail('INVALID_SPLIT', 'splitInfo values must be non-negative numbers'));
          return;
        }
        splitTotal += v;
      }
      if (splitTotal > body.amount * 1.01) {
        res.status(400).json(fail('INVALID_SPLIT', 'splitInfo total must not exceed the expense amount'));
        return;
      }
    }
    if (body.description !== undefined && typeof body.description === 'string' && body.description.length > 1000) {
      res.status(400).json(fail('DESCRIPTION_TOO_LONG', 'description must be at most 1000 characters'));
      return;
    }
    const item = await service.create({
      tripId,
      payerId: body.payerId,
      amount: body.amount,
      currency: body.currency,
      description: body.description,
      splitInfo: body.splitInfo ?? {},
    });
    broadcastToTrip(tripId, 'expense:changed', { tripId });
    res.status(201).json(ok(item));
  } catch {
    res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function updateExpense(req: Request, res: Response): Promise<void> {
  try {
    if (req.tripRole === 'Editor' && !req.collaboratorPermissions?.canEditContent) {
      res.status(403).json(fail('FORBIDDEN', 'Insufficient permission'));
      return;
    }
    const tripId = req.params['tripId'] as string;
    const id = req.params['expenseId'] as string;
    const body = req.body as {
      payerId?: string;
      amount?: number;
      currency?: string;
      description?: string;
      splitInfo?: Record<string, number>;
    };
    if (body.amount !== undefined && (typeof body.amount !== 'number' || !isFinite(body.amount) || body.amount <= 0 || body.amount > MAX_AMOUNT)) {
      res.status(400).json(fail('INVALID_AMOUNT', `amount must be a positive number up to ${MAX_AMOUNT}`));
      return;
    }
    if (body.currency !== undefined && !ALLOWED_CURRENCIES.has(body.currency)) {
      res.status(400).json(fail('INVALID_CURRENCY', 'Unsupported currency code'));
      return;
    }
    if (body.splitInfo !== null && body.splitInfo !== undefined) {
      if (typeof body.splitInfo !== 'object' || Array.isArray(body.splitInfo)) {
        res.status(400).json(fail('INVALID_SPLIT', 'splitInfo must be an object'));
        return;
      }
      let splitTotal = 0;
      for (const [k, v] of Object.entries(body.splitInfo)) {
        if (!k || typeof v !== 'number' || !isFinite(v) || v < 0) {
          res.status(400).json(fail('INVALID_SPLIT', 'splitInfo values must be non-negative numbers'));
          return;
        }
        splitTotal += v;
      }
      // Only validate against amount when amount is also being updated in this request.
      if (body.amount !== undefined && splitTotal > body.amount * 1.01) {
        res.status(400).json(fail('INVALID_SPLIT', 'splitInfo total must not exceed the expense amount'));
        return;
      }
    }
    if (body.description !== undefined && typeof body.description === 'string' && body.description.length > 1000) {
      res.status(400).json(fail('DESCRIPTION_TOO_LONG', 'description must be at most 1000 characters'));
      return;
    }
    const item = await service.update(id, tripId, body);
    broadcastToTrip(tripId, 'expense:changed', { tripId });
    res.json(ok(item));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Expense not found'));
    else if (msg === 'FORBIDDEN') res.status(403).json(fail('FORBIDDEN', 'Expense does not belong to this trip'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function deleteExpense(req: Request, res: Response): Promise<void> {
  try {
    if (req.tripRole === 'Editor' && !req.collaboratorPermissions?.canDeleteContent) {
      res.status(403).json(fail('FORBIDDEN', 'Insufficient permission'));
      return;
    }
    const tripId = req.params['tripId'] as string;
    const id = req.params['expenseId'] as string;
    await service.delete(id, tripId);
    broadcastToTrip(tripId, 'expense:changed', { tripId });
    res.json(ok(null));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Expense not found'));
    else if (msg === 'FORBIDDEN') res.status(403).json(fail('FORBIDDEN', 'Expense does not belong to this trip'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function getSettlement(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.params['tripId'] as string;
    const transfers = await service.computeSettlement(tripId);
    res.json(ok(transfers));
  } catch {
    res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function togglePaid(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.params['tripId'] as string;
    const id = req.params['expenseId'] as string;
    const body = req.body as { userId?: string; paid?: boolean };
    if (typeof body.paid !== 'boolean') {
      res.status(400).json(fail('INVALID_PAID', 'paid must be a boolean'));
      return;
    }
    const callerId = req.user!.id;
    // Target defaults to caller; payer is allowed to mark on behalf of any debtor.
    const targetUserId = (typeof body.userId === 'string' && body.userId) || callerId;
    const item = await service.togglePaid(id, tripId, targetUserId, body.paid, callerId);
    broadcastToTrip(tripId, 'expense:changed', { tripId });
    res.json(ok(item));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Expense not found'));
    else if (msg === 'FORBIDDEN') res.status(403).json(fail('FORBIDDEN', 'Expense does not belong to this trip'));
    else if (msg === 'PAYER_CANNOT_BE_MARKED') res.status(400).json(fail('PAYER_CANNOT_BE_MARKED', 'Payer is not in the debt list'));
    else if (msg === 'NOT_IN_SPLIT') res.status(400).json(fail('NOT_IN_SPLIT', 'User is not part of this expense split'));
    else if (msg === 'CALLER_NOT_ALLOWED') res.status(403).json(fail('CALLER_NOT_ALLOWED', 'You can only mark your own share or others if you are the payer'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}
