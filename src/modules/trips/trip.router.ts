import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { requireTripRole } from '../../shared/middleware/permission.middleware';
import {
  getMyTrips, getTripById, createTrip, updateTrip, joinByInviteCode, patchModules,
  removeMember, getTripPreviewByCode, getTripPreviewById, joinByTripId, leaveTrip,
  patchCollaboratorPermissions, getLeavePreview,
} from './trip.controller';
import { coverUploadMiddleware, coverUploadErrorHandler, uploadTripCover } from './trip-cover.controller';
import itineraryRouter from '../itinerary/itinerary.router';
import expensesRouter from '../expenses/expenses.router';
import tasksRouter from '../tasks/tasks.router';
import checklistsRouter from '../checklists/checklists.router';
import { InvitationRepository } from '../invitations/invitation.repository';
import { UserRepository } from '../users/user.repository';
import { TripRepository } from './trip.repository';
import { InvitationHistoryRepository } from '../invitation-history/invitation-history.repository';

const invitationRepo = new InvitationRepository();
const userRepo = new UserRepository();
const tripRepo = new TripRepository();
const invitationHistoryRepo = new InvitationHistoryRepository();

const router = Router();

router.use(authMiddleware);

router.get('/', getMyTrips);
router.post('/', createTrip);
router.post('/join', joinByInviteCode);
router.get('/preview', getTripPreviewByCode);
router.get('/:tripId/preview', getTripPreviewById);
router.post('/:tripId/join', joinByTripId);
router.get('/:tripId', getTripById);
router.patch('/:tripId', requireTripRole('Owner', 'Editor'), updateTrip);
router.patch('/:tripId/modules', requireTripRole('Owner', 'Editor'), patchModules);
router.patch('/:tripId/collaborator-permissions', requireTripRole('Owner'), patchCollaboratorPermissions);
router.get('/:tripId/leave-preview', requireTripRole('Owner', 'Editor', 'Viewer'), getLeavePreview);
router.delete('/:tripId/members/me', leaveTrip);
router.delete('/:tripId/members/:userId', requireTripRole('Owner'), removeMember);
router.post(
  '/:tripId/cover',
  requireTripRole('Owner', 'Editor'),
  coverUploadMiddleware,
  coverUploadErrorHandler,
  uploadTripCover,
);

router.use('/:tripId/itinerary', itineraryRouter);
router.use('/:tripId/expenses', expensesRouter);
router.use('/:tripId/tasks', tasksRouter);
router.use('/:tripId/checklists', checklistsRouter);

// POST /api/trips/:tripId/invitations — Owner invites user by handle
router.post(
  '/:tripId/invitations',
  requireTripRole('Owner', 'Editor'),
  async (req: Request, res: Response) => {
    if (req.tripRole === 'Editor' && !req.collaboratorPermissions?.canInvite) {
      return void res.status(403).json({ error: 'FORBIDDEN' });
    }
    const handle = typeof req.body?.handle === 'string' ? req.body.handle.trim().toUpperCase() : null;
    if (!handle) return void res.status(400).json({ error: 'MISSING_HANDLE' });

    const invitedUser = await userRepo.findByHandle(handle);
    if (!invitedUser) return void res.status(404).json({ error: 'USER_NOT_FOUND' });

    const trip = await tripRepo.findById(req.params['tripId']!);
    if (!trip) return void res.status(404).json({ error: 'NOT_FOUND' });

    if (trip.members.some((m: any) => m.userId === invitedUser.id)) {
      return void res.status(409).json({ error: 'ALREADY_MEMBER' });
    }

    const existing = await invitationRepo.findPendingByTripAndUser(req.params['tripId']!, invitedUser.id);
    if (existing) return void res.status(409).json({ error: 'ALREADY_INVITED' });

    await invitationRepo.create({
      tripId: req.params['tripId']!,
      invitedUserId: invitedUser.id,
      invitedByUserId: req.user!.id,
      status: 'pending',
    });

    // Record in invitation history (best-effort; don't fail the request).
    try {
      await invitationHistoryRepo.upsert(req.user!.id, invitedUser.id);
    } catch (e) {
      console.error('[invitation-history] upsert failed', e);
    }

    res.status(201).json({ ok: true, invitedUser: { id: invitedUser.id, name: invitedUser.name, handle: invitedUser.handle } });
  }
);

// POST /api/trips/:tripId/invitations/batch — invite multiple users by id at once
router.post(
  '/:tripId/invitations/batch',
  requireTripRole('Owner', 'Editor'),
  async (req: Request, res: Response) => {
    if (req.tripRole === 'Editor' && !req.collaboratorPermissions?.canInvite) {
      return void res.status(403).json({ error: 'FORBIDDEN' });
    }

    const body = req.body as { userIds?: unknown };
    const userIdsRaw = Array.isArray(body.userIds) ? body.userIds : null;
    if (!userIdsRaw) {
      return void res.status(400).json({ error: 'BAD_REQUEST', message: 'userIds must be an array' });
    }
    if (userIdsRaw.length === 0) {
      return void res.status(400).json({ error: 'BAD_REQUEST', message: 'userIds is empty' });
    }
    if (userIdsRaw.length > 20) {
      return void res.status(400).json({ error: 'BAD_REQUEST', message: 'Up to 20 users per batch' });
    }

    // De-dup + filter non-strings
    const userIds = Array.from(
      new Set(
        userIdsRaw.filter((x): x is string => typeof x === 'string' && x.length > 0),
      ),
    );

    const tripId = req.params['tripId'] as string;
    const trip = await tripRepo.findById(tripId);
    if (!trip) return void res.status(404).json({ error: 'NOT_FOUND' });

    const invited: { userId: string; name: string | null; handle: string | null }[] = [];
    const skipped: { userId: string; reason: 'ALREADY_MEMBER' | 'ALREADY_INVITED' | 'NOT_FOUND' }[] = [];

    for (const userId of userIds) {
      // Self-invite — treat as NOT_FOUND to avoid leaking
      if (userId === req.user!.id) {
        skipped.push({ userId, reason: 'NOT_FOUND' });
        continue;
      }

      const targetUser = await userRepo.findById(userId);
      if (!targetUser) {
        skipped.push({ userId, reason: 'NOT_FOUND' });
        continue;
      }

      if (trip.members.some((m: { userId: string }) => m.userId === targetUser.id)) {
        skipped.push({ userId, reason: 'ALREADY_MEMBER' });
        continue;
      }

      const existing = await invitationRepo.findPendingByTripAndUser(tripId, targetUser.id);
      if (existing) {
        skipped.push({ userId, reason: 'ALREADY_INVITED' });
        continue;
      }

      await invitationRepo.create({
        tripId,
        invitedUserId: targetUser.id,
        invitedByUserId: req.user!.id,
        status: 'pending',
      });

      try {
        await invitationHistoryRepo.upsert(req.user!.id, targetUser.id);
      } catch (e) {
        console.error('[invitation-history] upsert failed in batch', e);
      }

      invited.push({ userId: targetUser.id, name: targetUser.name ?? null, handle: targetUser.handle ?? null });
    }

    res.json({ invited, skipped });
  }
);

// GET /api/trips/:tripId/invitations — list pending invitations
router.get(
  '/:tripId/invitations',
  requireTripRole('Owner', 'Editor'),
  async (req: Request, res: Response) => {
    const invitations = await invitationRepo.findPendingForTrip(req.params['tripId']!);
    const hydrated = await Promise.all(invitations.map(async (inv) => {
      const user = await userRepo.findById(inv.invitedUserId);
      return {
        id: inv.id,
        userId: inv.invitedUserId,
        userName: user?.name ?? user?.email ?? '',
        userHandle: user?.handle ?? '',
        invitedAt: inv.createdAt,
      };
    }));
    res.json(hydrated);
  }
);

// DELETE /api/trips/:tripId/invitations/:userId — cancel invitation
router.delete(
  '/:tripId/invitations/:userId',
  requireTripRole('Owner'),
  async (req: Request, res: Response) => {
    await invitationRepo.cancelByTripAndUser(req.params['tripId']!, req.params['userId']!);
    res.json({ ok: true });
  }
);

export default router;
