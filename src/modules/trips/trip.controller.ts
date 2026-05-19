import { Request, Response } from 'express';
import { TripService } from './trip.service';
import { TripRepository } from './trip.repository';
import { CollaboratorPermissions } from './trip.entity';
import { ok, fail } from '../../shared/types/response.types';
import { broadcastToTrip, forceLeaveTrip } from '../../socket/broadcaster';

const service = new TripService(new TripRepository());

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!ISO_DATE_RE.test(s)) return undefined;
  // Validate it's a real calendar date
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return s;
}

function parsePositiveInt(v: unknown, def: number, min: number, max: number): number {
  if (typeof v !== 'string' && typeof v !== 'number') return def;
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export async function getMyTrips(req: Request, res: Response): Promise<void> {
  try {
    const page = parsePositiveInt(req.query['page'], 1, 1, Number.MAX_SAFE_INTEGER);
    const pageSize = parsePositiveInt(req.query['pageSize'], 10, 1, 50);
    const from = parseIsoDate(req.query['from']);
    const to = parseIsoDate(req.query['to']);

    const result = await service.getMyTripsPaginated(req.user!.id, { page, pageSize, from, to });
    res.json(ok(result));
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
    if (req.tripRole === 'Editor' && !req.collaboratorPermissions?.canEditTripInfo) {
      res.status(403).json(fail('FORBIDDEN', 'Insufficient permission'));
      return;
    }
    const { title, startDate, endDate, coverImage } = req.body as Record<string, string>;
    const dto: Record<string, string> = {};
    if (title !== undefined) dto['title'] = title;
    if (startDate !== undefined) dto['startDate'] = startDate;
    if (endDate !== undefined) dto['endDate'] = endDate;
    if (coverImage !== undefined) dto['coverImage'] = coverImage;
    const tripId = req.params['tripId'] as string;
    const trip = await service.updateTrip(tripId, dto, req.user!.id);
    broadcastToTrip(tripId, 'trip:updated', { tripId, trip });
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
    if (req.tripRole === 'Editor' && !req.collaboratorPermissions?.canManageModules) {
      res.status(403).json(fail('FORBIDDEN', 'Insufficient permission'));
      return;
    }
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

export async function patchCollaboratorPermissions(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.params['tripId'] as string;
    const body = req.body as Partial<CollaboratorPermissions>;
    const patch: Partial<CollaboratorPermissions> = {};
    for (const k of ['canEditTripInfo', 'canInvite', 'canDeleteContent', 'canManageModules', 'canEditContent'] as const) {
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
      res.status(400).json(fail('BAD_REQUEST', 'At least one permission flag is required'));
      return;
    }
    const trip = await service.setCollaboratorPermissions(tripId, patch);
    broadcastToTrip(tripId, 'trip:updated', { tripId, trip });
    res.json(ok(trip));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  try {
    const { tripId, userId } = req.params as { tripId: string; userId: string };
    const trip = await service.removeMember(tripId, userId);
    broadcastToTrip(tripId, 'trip:member:removed', { tripId, userId });
    forceLeaveTrip(userId, tripId);
    res.json(ok(trip));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
    else if (msg === 'NOT_MEMBER') res.status(404).json(fail('NOT_MEMBER', 'User is not a member'));
    else if (msg === 'CANNOT_KICK_OWNER') res.status(400).json(fail('CANNOT_KICK_OWNER', 'Cannot remove the trip owner'));
    else if (msg === 'UNSETTLED_DEBTS') res.status(400).json(fail('UNSETTLED_DEBTS', 'Cannot remove member with unsettled debts'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function getLeavePreview(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.params['tripId'] as string;
    const callerId = req.user!.id;
    const queryUserId = typeof req.query['userId'] === 'string' ? req.query['userId'].trim() : '';
    const targetUserId = queryUserId && queryUserId !== callerId ? queryUserId : callerId;
    const isSelf = targetUserId === callerId;

    // Permission gate: requireTripRole already verified caller is a member.
    // For kick-preview (target != self), caller must be Owner.
    if (!isSelf && req.tripRole !== 'Owner') {
      res.status(403).json(fail('FORBIDDEN', 'Only the trip owner can preview kicking another member'));
      return;
    }
    // For self-preview, caller must not be Owner (Owner cannot leave).
    if (isSelf && req.tripRole === 'Owner') {
      res.status(400).json(fail('CANNOT_LEAVE_AS_OWNER', 'Owner cannot leave the trip'));
      return;
    }

    const preview = await service.getLeavePreview(tripId, targetUserId, callerId);
    res.json(ok(preview));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
    else if (msg === 'NOT_MEMBER') res.status(404).json(fail('NOT_MEMBER', 'Target user is not a member'));
    else if (msg === 'CANNOT_KICK_OWNER') res.status(400).json(fail('CANNOT_KICK_OWNER', 'Cannot remove the trip owner'));
    else if (msg === 'CANNOT_LEAVE_AS_OWNER') res.status(400).json(fail('CANNOT_LEAVE_AS_OWNER', 'Owner cannot leave the trip'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function getTripPreviewByCode(req: Request, res: Response): Promise<void> {
  try {
    const code = typeof req.query['code'] === 'string' ? req.query['code'].trim().toUpperCase() : '';
    if (!code) { res.status(400).json(fail('BAD_REQUEST', 'code is required')); return; }
    const preview = await service.getTripPreviewByCode(code);
    res.json(ok(preview));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Invite code not found'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function getTripPreviewById(req: Request, res: Response): Promise<void> {
  try {
    const preview = await service.getTripPreviewById(req.params['tripId'] as string);
    res.json(ok(preview));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function joinByTripId(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.params['tripId'] as string;
    const trip = await service.joinByTripId(tripId, req.user!.id);
    broadcastToTrip(tripId, 'trip:member:joined', { tripId, userId: req.user!.id });
    res.json(ok(trip));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function leaveTrip(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.params['tripId'] as string;
    await service.leaveTrip(tripId, req.user!.id);
    broadcastToTrip(tripId, 'trip:member:removed', { tripId, userId: req.user!.id });
    forceLeaveTrip(req.user!.id, tripId);
    res.json(ok({ ok: true }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
    else if (msg === 'NOT_MEMBER') res.status(400).json(fail('NOT_MEMBER', 'Not a member'));
    else if (msg === 'CANNOT_LEAVE_AS_OWNER') res.status(400).json(fail('CANNOT_LEAVE_AS_OWNER', 'Owner cannot leave the trip'));
    else if (msg === 'UNSETTLED_DEBTS') res.status(400).json(fail('UNSETTLED_DEBTS', 'Cannot leave with unsettled debts'));
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
    broadcastToTrip(trip.id, 'trip:member:joined', { tripId: trip.id, userId: req.user!.id });
    res.json(ok(trip));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Invite code not found'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}
