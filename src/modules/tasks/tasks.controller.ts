import { Request, Response } from 'express';
import { TasksService } from './tasks.service';
import { TasksRepository } from './tasks.repository';
import { ok, fail } from '../../shared/types/response.types';
import { TaskCategory, TaskStatus } from './task.entity';
import { broadcastToTrip } from '../../socket/broadcaster';

const VALID_CATEGORIES: TaskCategory[] = ['general', 'esim', 'visa', 'accommodation', 'transport'];
const VALID_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done'];

const service = new TasksService(new TasksRepository());

export async function listTasks(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.params['tripId'] as string;
    const items = await service.listByTrip(tripId);
    res.json(ok(items));
  } catch {
    res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function createTask(req: Request, res: Response): Promise<void> {
  try {
    // 新增內容：Owner 或 Editor 永遠可以做（不檢查 canEditContent）。
    // 角色檢查已在 router 的 requireTripRole('Owner','Editor') 完成。
    const tripId = req.params['tripId'] as string;
    const body = req.body as {
      title?: string;
      category?: TaskCategory;
      status?: TaskStatus;
      assignedUserId?: string;
      dueDate?: string | null;
      notes?: string | null;
    };
    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      res.status(400).json(fail('INVALID_TITLE', 'title is required'));
      return;
    }
    if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
      res.status(400).json(fail('INVALID_CATEGORY', 'Invalid category'));
      return;
    }
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      res.status(400).json(fail('INVALID_STATUS', 'Invalid status'));
      return;
    }
    const item = await service.create({
      tripId,
      title: body.title,
      category: body.category,
      status: body.status,
      assignedUserId: body.assignedUserId,
      dueDate: body.dueDate ?? null,
      notes: body.notes ?? null,
    });
    broadcastToTrip(tripId, 'task:changed', { tripId });
    res.status(201).json(ok(item));
  } catch {
    res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.params['tripId'] as string;
    const id = req.params['taskId'] as string;
    const body = req.body as {
      title?: string;
      category?: TaskCategory;
      status?: TaskStatus;
      assignedUserId?: string | null;
      dueDate?: string | null;
      notes?: string | null;
    };
    // status-only 更新（例如「打勾完成」）視為自我進度管理，任何成員可做。
    // 其他欄位（title/category/assignedUserId/dueDate/notes）才視為內容編輯，需 canEditContent。
    const keys = Object.keys(body).filter((k) => (body as Record<string, unknown>)[k] !== undefined);
    const isStatusOnly = keys.length === 1 && keys[0] === 'status';
    if (!isStatusOnly && req.tripRole === 'Editor' && !req.collaboratorPermissions?.canEditContent) {
      res.status(403).json(fail('FORBIDDEN', 'Insufficient permission'));
      return;
    }
    if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
      res.status(400).json(fail('INVALID_CATEGORY', 'Invalid category'));
      return;
    }
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      res.status(400).json(fail('INVALID_STATUS', 'Invalid status'));
      return;
    }
    if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim().length === 0)) {
      res.status(400).json(fail('INVALID_TITLE', 'title cannot be empty'));
      return;
    }
    const item = await service.update(id, tripId, body);
    broadcastToTrip(tripId, 'task:changed', { tripId });
    res.json(ok(item));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Task not found'));
    else if (msg === 'FORBIDDEN') res.status(403).json(fail('FORBIDDEN', 'Task does not belong to this trip'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function deleteTask(req: Request, res: Response): Promise<void> {
  try {
    if (req.tripRole === 'Editor' && !req.collaboratorPermissions?.canDeleteContent) {
      res.status(403).json(fail('FORBIDDEN', 'Insufficient permission'));
      return;
    }
    const tripId = req.params['tripId'] as string;
    const id = req.params['taskId'] as string;
    await service.delete(id, tripId);
    broadcastToTrip(tripId, 'task:changed', { tripId });
    res.json(ok(null));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Task not found'));
    else if (msg === 'FORBIDDEN') res.status(403).json(fail('FORBIDDEN', 'Task does not belong to this trip'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}
