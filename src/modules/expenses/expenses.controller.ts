import { Request, Response } from 'express';
import { ExpensesService } from './expenses.service';
import { ExpensesRepository } from './expenses.repository';
import { ok, fail } from '../../shared/types/response.types';
import { broadcastToTrip } from '../../socket/broadcaster';

const service = new ExpensesService(new ExpensesRepository());

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
    if (req.tripRole === 'Editor' && !req.collaboratorPermissions?.canEditContent) {
      res.status(403).json(fail('FORBIDDEN', 'Insufficient permission'));
      return;
    }
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
    if (typeof body.amount !== 'number' || !isFinite(body.amount) || body.amount <= 0) {
      res.status(400).json(fail('INVALID_AMOUNT', 'amount must be a positive number'));
      return;
    }
    if (body.splitInfo && typeof body.splitInfo !== 'object') {
      res.status(400).json(fail('INVALID_SPLIT', 'splitInfo must be an object'));
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
    if (body.amount !== undefined && (typeof body.amount !== 'number' || !isFinite(body.amount) || body.amount <= 0)) {
      res.status(400).json(fail('INVALID_AMOUNT', 'amount must be a positive number'));
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
