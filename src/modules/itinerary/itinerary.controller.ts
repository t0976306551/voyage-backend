import { Request, Response } from 'express';
import { ItineraryService } from './itinerary.service';
import { ItineraryRepository } from './itinerary.repository';
import { ok, fail } from '../../shared/types/response.types';
import { SpotCategory } from './itinerary.entity';
import { broadcastToTrip } from '../../socket/broadcaster';

const VALID_CATEGORIES = ['food', 'lodging', 'attraction', 'activity', 'transport', 'admin'] as const;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function validateExtras(body: {
  startTime?: unknown;
  durationMinutes?: unknown;
  address?: unknown;
}): { error?: string; code?: string } {
  if (body.startTime !== undefined && body.startTime !== null) {
    if (typeof body.startTime !== 'string' || !TIME_REGEX.test(body.startTime)) {
      return { error: '時間格式應為 HH:MM (24h)', code: 'INVALID_TIME' };
    }
  }
  if (body.durationMinutes !== undefined && body.durationMinutes !== null) {
    if (
      typeof body.durationMinutes !== 'number' ||
      !Number.isInteger(body.durationMinutes) ||
      body.durationMinutes < 1 ||
      body.durationMinutes > 1440
    ) {
      return { error: '時長必須介於 1-1440 分鐘', code: 'INVALID_DURATION' };
    }
  }
  if (body.address !== undefined && body.address !== null) {
    if (typeof body.address !== 'string' || body.address.length > 500) {
      return { error: '地址過長 (最多 500 字)', code: 'ADDRESS_TOO_LONG' };
    }
  }
  return {};
}

const service = new ItineraryService(new ItineraryRepository());

export async function getItinerary(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.params['tripId'] as string;
    const bucket = req.query['bucket'] === 'true';
    const dayParam = req.query['day'];
    if (bucket) {
      const items = await service.getBucketItems(tripId);
      res.json(ok(items));
      return;
    }
    if (typeof dayParam === 'string' && dayParam.length > 0) {
      const day = parseInt(dayParam, 10);
      if (Number.isNaN(day) || day < 1) {
        res.status(400).json(fail('INVALID_DAY', 'day must be a positive integer'));
        return;
      }
      const items = await service.getItemsByDay(tripId, day);
      res.json(ok(items));
      return;
    }
    const items = await service.getItemsByTrip(tripId);
    res.json(ok(items));
  } catch {
    res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function createItem(req: Request, res: Response): Promise<void> {
  try {
    // 新增內容：Owner 或 Editor 永遠可以做（不檢查 canEditContent）。
    // 角色檢查已在 router 的 requireTripRole('Owner','Editor') 完成。
    const body = req.body as {
      day?: number | null;
      title?: string;
      category?: SpotCategory;
      coverImage?: string;
      lat?: number;
      lng?: number;
      sourceUrl?: string;
      note?: string;
      startTime?: string | null;
      durationMinutes?: number | null;
      address?: string | null;
    };
    if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category as 'food')) {
      res.status(400).json(fail('INVALID_CATEGORY', 'Invalid category value'));
      return;
    }
    if (body.day !== undefined && body.day !== null) {
      if (typeof body.day !== 'number' || !Number.isInteger(body.day) || body.day < 1) {
        res.status(400).json(fail('INVALID_DAY', 'day must be a positive integer'));
        return;
      }
    }
    if (body.sourceUrl !== undefined && body.sourceUrl !== null && body.sourceUrl !== '') {
      if (typeof body.sourceUrl !== 'string' || !/^https?:\/\//i.test(body.sourceUrl)) {
        res.status(400).json(fail('INVALID_URL', 'sourceUrl must be a valid http/https URL'));
        return;
      }
    }
    if (body.title !== undefined && typeof body.title === 'string' && body.title.length > 500) {
      res.status(400).json(fail('TITLE_TOO_LONG', 'title must be at most 500 characters'));
      return;
    }
    if (body.note !== undefined && body.note !== null && typeof body.note === 'string' && body.note.length > 5000) {
      res.status(400).json(fail('NOTE_TOO_LONG', 'note must be at most 5000 characters'));
      return;
    }
    const { error, code } = validateExtras(body);
    if (error) {
      res.status(400).json(fail(code!, error));
      return;
    }
    const day = body.day !== undefined ? body.day : null;
    const item = await service.createItem({
      tripId: req.params['tripId'] as string,
      day,
      title: body.title ?? '',
      category: body.category,
      coverImage: body.coverImage,
      lat: body.lat,
      lng: body.lng,
      sourceUrl: body.sourceUrl,
      note: body.note,
      startTime: body.startTime ?? null,
      durationMinutes: body.durationMinutes ?? null,
      address: body.address ?? null,
    });
    broadcastToTrip(item.tripId, 'itinerary:changed', { tripId: item.tripId });
    res.status(201).json(ok(item));
  } catch {
    res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function updateItem(req: Request, res: Response): Promise<void> {
  try {
    if (req.tripRole === 'Editor' && !req.collaboratorPermissions?.canEditContent) {
      res.status(403).json(fail('FORBIDDEN', 'Insufficient permission'));
      return;
    }
    const body = req.body as {
      title?: string; category?: SpotCategory; coverImage?: string;
      lat?: number; lng?: number;
      sourceUrl?: string; note?: string; order?: number; day?: number | null;
      startTime?: string | null; durationMinutes?: number | null; address?: string | null;
    };
    if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category as 'food')) {
      res.status(400).json(fail('INVALID_CATEGORY', 'Invalid category value'));
      return;
    }
    if (body.day !== undefined && body.day !== null) {
      if (typeof body.day !== 'number' || !Number.isInteger(body.day) || body.day < 1) {
        res.status(400).json(fail('INVALID_DAY', 'day must be a positive integer'));
        return;
      }
    }
    if (body.sourceUrl !== undefined && body.sourceUrl !== null && body.sourceUrl !== '') {
      if (typeof body.sourceUrl !== 'string' || !/^https?:\/\//i.test(body.sourceUrl)) {
        res.status(400).json(fail('INVALID_URL', 'sourceUrl must be a valid http/https URL'));
        return;
      }
    }
    if (body.title !== undefined && typeof body.title === 'string' && body.title.length > 500) {
      res.status(400).json(fail('TITLE_TOO_LONG', 'title must be at most 500 characters'));
      return;
    }
    if (body.note !== undefined && body.note !== null && typeof body.note === 'string' && body.note.length > 5000) {
      res.status(400).json(fail('NOTE_TOO_LONG', 'note must be at most 5000 characters'));
      return;
    }
    const { error, code } = validateExtras(body);
    if (error) {
      res.status(400).json(fail(code!, error));
      return;
    }
    const tripId = req.params['tripId'] as string;
    const item = await service.updateItem(req.params['itemId'] as string, tripId, body);
    broadcastToTrip(item.tripId, 'itinerary:changed', { tripId: item.tripId });
    res.json(ok(item));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Itinerary item not found'));
    else if (msg === 'FORBIDDEN') res.status(403).json(fail('FORBIDDEN', 'Item does not belong to this trip'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function deleteItem(req: Request, res: Response): Promise<void> {
  try {
    if (req.tripRole === 'Editor' && !req.collaboratorPermissions?.canDeleteContent) {
      res.status(403).json(fail('FORBIDDEN', 'Insufficient permission'));
      return;
    }
    const tripId = req.params['tripId'] as string;
    await service.deleteItem(req.params['itemId'] as string, tripId);
    broadcastToTrip(tripId, 'itinerary:changed', { tripId });
    res.json(ok(null));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Itinerary item not found'));
    else if (msg === 'FORBIDDEN') res.status(403).json(fail('FORBIDDEN', 'Item does not belong to this trip'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function reorderItems(req: Request, res: Response): Promise<void> {
  try {
    if (req.tripRole === 'Editor' && !req.collaboratorPermissions?.canEditContent) {
      res.status(403).json(fail('FORBIDDEN', 'Insufficient permission'));
      return;
    }
    const tripId = req.params['tripId'] as string;
    const { day, items } = req.body as {
      day: number | null;
      items: { id: string; order: number }[];
    };
    await service.reorderItems(tripId, day ?? null, items);
    broadcastToTrip(tripId, 'itinerary:changed', { tripId });
    res.json(ok(null));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'FORBIDDEN') {
      res.status(403).json(fail('FORBIDDEN', 'Item does not belong to this trip'));
    } else if (msg === 'DAY_MISMATCH') {
      res.status(400).json(fail('DAY_MISMATCH', 'All reordered items must share the same day'));
    } else {
      res.status(500).json(fail('INTERNAL', 'Internal server error'));
    }
  }
}
