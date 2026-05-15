import { Request, Response } from 'express';
import { TripService } from './trip.service';
import { TripRepository } from './trip.repository';
import { ok, fail } from '../../shared/types/response.types';
import { broadcastToTrip } from '../../socket/broadcaster';

const service = new TripService(new TripRepository());

export async function getMyTrips(req: Request, res: Response): Promise<void> {
  try {
    const trips = await service.getMyTrips(req.user!.id);
    res.json(ok(trips));
  } catch {
    res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function getTripById(req: Request, res: Response): Promise<void> {
  try {
    const trip = await service.getTripById(req.params['tripId'] as string, req.user!.id);
    res.json(ok(trip));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
    else if (msg === 'FORBIDDEN') res.status(403).json(fail('FORBIDDEN', 'Access denied'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function createTrip(req: Request, res: Response): Promise<void> {
  try {
    const trip = await service.createTrip(req.body as { title: string; startDate?: string; endDate?: string }, req.user!.id);
    res.status(201).json(ok(trip));
  } catch {
    res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function updateTrip(req: Request, res: Response): Promise<void> {
  try {
    const { title, startDate, endDate, coverImage } = req.body as Record<string, string>;
    const dto: Record<string, string> = {};
    if (title !== undefined) dto['title'] = title;
    if (startDate !== undefined) dto['startDate'] = startDate;
    if (endDate !== undefined) dto['endDate'] = endDate;
    if (coverImage !== undefined) dto['coverImage'] = coverImage;
    const trip = await service.updateTrip(req.params['tripId'] as string, dto, req.user!.id);
    res.json(ok(trip));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
    else if (msg === 'FORBIDDEN') res.status(403).json(fail('FORBIDDEN', 'Access denied'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function patchModules(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.params['tripId'] as string;
    const body = req.body as { tasks?: unknown; expenses?: unknown; checklists?: unknown };
    const patch: Partial<{ tasks: boolean; expenses: boolean; checklists: boolean }> = {};
    for (const k of ['tasks', 'expenses', 'checklists'] as const) {
      const v = body[k];
      if (v !== undefined) {
        if (typeof v !== 'boolean') {
          res.status(400).json(fail('BAD_REQUEST', `${k} must be boolean`));
          return;
        }
        patch[k] = v;
      }
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json(fail('BAD_REQUEST', 'At least one module flag is required'));
      return;
    }
    const trip = await service.setEnabledModules(tripId, patch);
    broadcastToTrip(tripId, 'trip:modules:updated', { tripId, enabledModules: trip.enabledModules });
    res.json(ok(trip));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function joinByInviteCode(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as { inviteCode?: string };
    if (!body.inviteCode) {
      res.status(400).json(fail('BAD_REQUEST', 'inviteCode is required'));
      return;
    }
    const code = body.inviteCode.trim().toUpperCase();
    const trip = await service.joinByInviteCode(code, req.user!.id);
    res.json(ok(trip));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Invite code not found'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}
