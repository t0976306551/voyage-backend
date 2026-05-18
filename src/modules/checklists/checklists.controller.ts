import { Request, Response } from 'express';
import { ChecklistsService } from './checklists.service';
import { ChecklistsRepository } from './checklists.repository';
import { TripRepository } from '../trips/trip.repository';
import { ok, fail } from '../../shared/types/response.types';
import { broadcastToTrip } from '../../socket/broadcaster';

const tripRepo = new TripRepository();
const service = new ChecklistsService(new ChecklistsRepository(), tripRepo);

export async function listChecklists(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.params['tripId'] as string;
    const items = await service.listByTrip(tripId);
    res.json(ok(items));
  } catch {
    res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function createChecklist(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.params['tripId'] as string;
    const body = req.body as { title?: string; notes?: string | null; assigneeIds?: string[] };
    const item = await service.create({
      tripId,
      title: body.title ?? '',
      notes: body.notes ?? null,
      assigneeIds: Array.isArray(body.assigneeIds) ? body.assigneeIds : [],
      createdById: req.user!.id,
    });
    broadcastToTrip(tripId, 'checklist:item:created', { tripId, item });
    res.status(201).json(ok(item));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'INVALID_TITLE') res.status(400).json(fail('INVALID_TITLE', '請輸入標題'));
    else if (msg === 'TRIP_NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function updateChecklist(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.params['tripId'] as string;
    const itemId = req.params['itemId'] as string;
    const body = req.body as { title?: string; notes?: string | null; assigneeIds?: string[] };
    const item = await service.update(itemId, tripId, body, req.user!.id);
    broadcastToTrip(tripId, 'checklist:item:updated', { tripId, item });
    res.json(ok(item));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Checklist item not found'));
    else if (msg === 'FORBIDDEN') res.status(403).json(fail('FORBIDDEN', 'Not allowed'));
    else if (msg === 'INVALID_TITLE') res.status(400).json(fail('INVALID_TITLE', '請輸入標題'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function deleteChecklist(req: Request, res: Response): Promise<void> {
  try {
    if (req.tripRole === 'Editor' && !req.collaboratorPermissions?.canDeleteContent) {
      res.status(403).json(fail('FORBIDDEN', 'Insufficient permission'));
      return;
    }
    const tripId = req.params['tripId'] as string;
    const itemId = req.params['itemId'] as string;
    await service.delete(itemId, tripId, req.user!.id);
    broadcastToTrip(tripId, 'checklist:item:deleted', { tripId, itemId });
    res.json(ok({ id: itemId }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Checklist item not found'));
    else if (msg === 'FORBIDDEN') res.status(403).json(fail('FORBIDDEN', 'Not allowed'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function toggleChecklist(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.params['tripId'] as string;
    const itemId = req.params['itemId'] as string;
    const body = req.body as { completed?: boolean };
    if (typeof body.completed !== 'boolean') {
      res.status(400).json(fail('BAD_REQUEST', 'completed (boolean) is required'));
      return;
    }
    const result = await service.toggleCompletion(itemId, tripId, req.user!.id, body.completed);
    broadcastToTrip(tripId, 'checklist:assignment:toggled', {
      tripId, itemId, userId: req.user!.id, completedAt: result.completedAt,
    });
    res.json(ok(result));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Checklist item not found'));
    else if (msg === 'NOT_ASSIGNED') res.status(403).json(fail('NOT_ASSIGNED', 'You are not assigned to this item'));
    else if (msg === 'FORBIDDEN') res.status(403).json(fail('FORBIDDEN', 'Not allowed'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}
