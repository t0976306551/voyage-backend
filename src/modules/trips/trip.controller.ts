import { Request, Response } from 'express';
import { TripService } from './trip.service';
import { TripRepository } from './trip.repository';
import { ok, fail } from '../../shared/types/response.types';

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
    const trip = await service.updateTrip(req.params['tripId'] as string, req.body as Record<string, string>, req.user!.id);
    res.json(ok(trip));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
    else if (msg === 'FORBIDDEN') res.status(403).json(fail('FORBIDDEN', 'Access denied'));
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
