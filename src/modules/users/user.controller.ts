import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserRepository } from './user.repository';
import { InvitationRepository } from '../invitations/invitation.repository';
import { TripRepository } from '../trips/trip.repository';
import {
  listMyInvitationHistory,
  hideInvitationHistoryEntry,
} from '../invitation-history/invitation-history.controller';

const userRepo = new UserRepository();
const invitationRepo = new InvitationRepository();
const tripRepo = new TripRepository();

export const userRouter = Router();

// Invitation history (caller-scoped; never accepts inviterId from input).
userRouter.get('/me/invitation-history', listMyInvitationHistory);
userRouter.post('/me/invitation-history/:userId/hide', hideInvitationHistoryEntry);

// GET /api/users/me
userRouter.get('/me', async (req: Request, res: Response) => {
  const user = await userRepo.findById(req.user!.id);
  if (!user) return void res.status(404).json({ error: 'NOT_FOUND' });
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    handle: user.handle,
    avatar: user.avatar,
    hasPassword: !!user.passwordHash,
    authProviders: user.authProviders ?? [],
  });
});

// POST /api/users/me/password — change own password (credentials accounts only)
userRouter.post('/me/password', async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    return void res.status(422).json({ error: 'VALIDATION_ERROR', message: '請填寫舊密碼與新密碼' });
  }
  if (newPassword.length < 8) {
    return void res.status(422).json({ error: 'VALIDATION_ERROR', message: '新密碼至少 8 個字元' });
  }
  if (newPassword === currentPassword) {
    return void res.status(422).json({ error: 'VALIDATION_ERROR', message: '新密碼不可與舊密碼相同' });
  }

  const user = await userRepo.findById(req.user!.id);
  if (!user) return void res.status(404).json({ error: 'NOT_FOUND' });

  if (!user.passwordHash) {
    return void res.status(409).json({ error: 'NO_PASSWORD_SET', message: '此帳號未設定密碼（透過第三方登入），無法修改' });
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return void res.status(401).json({ error: 'INVALID_CURRENT_PASSWORD', message: '舊密碼不正確' });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await userRepo.update(user.id, { passwordHash: newHash });
  res.json({ ok: true });
});

// GET /api/users/search?handle=vs_XXXXX
userRouter.get('/search', async (req: Request, res: Response) => {
  const handle = typeof req.query['handle'] === 'string' ? req.query['handle'].trim() : null;
  if (!handle) return void res.status(400).json({ error: 'MISSING_HANDLE' });
  const user = await userRepo.findByHandle(handle);
  if (!user) return void res.status(404).json({ error: 'USER_NOT_FOUND' });
  res.json({ id: user.id, name: user.name, handle: user.handle, avatar: user.avatar });
});

// GET /api/users/me/invitations — pending trip invitations for current user
userRouter.get('/me/invitations', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const invitations = await invitationRepo.findPendingForUser(userId);
  // Hydrate with trip and inviter info
  const hydrated = await Promise.all(invitations.map(async (inv) => {
    const trip = await tripRepo.findById(inv.tripId);
    const inviter = await userRepo.findById(inv.invitedByUserId);
    return {
      id: inv.id,
      tripId: inv.tripId,
      tripTitle: trip?.title ?? '',
      tripCover: trip?.coverImage ?? null,
      inviterName: inviter?.name ?? inviter?.email ?? '',
      createdAt: inv.createdAt,
    };
  }));
  res.json(hydrated);
});

// POST /api/users/me/invitations/:id/accept
userRouter.post('/me/invitations/:id/accept', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const inv = await invitationRepo.findById(req.params['id'] as string);
  if (!inv || inv.invitedUserId !== userId) return void res.status(404).json({ error: 'NOT_FOUND' });
  if (inv.status !== 'pending') return void res.status(409).json({ error: 'ALREADY_RESPONDED' });

  // Add user to trip as Editor (consistent with joinByInviteCode / joinByTripId).
  // Owner can later downgrade to Viewer via permission settings if needed.
  const trip = await tripRepo.findById(inv.tripId);
  if (trip && !trip.members.some((m: any) => m.userId === userId)) {
    trip.members = [...trip.members, { userId, role: 'Editor' }];
    await tripRepo.update(inv.tripId, { members: trip.members });
  }

  await invitationRepo.update(inv.id, { status: 'accepted' });
  res.json({ ok: true });
});

// POST /api/users/me/invitations/:id/decline
userRouter.post('/me/invitations/:id/decline', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const inv = await invitationRepo.findById(req.params['id'] as string);
  if (!inv || inv.invitedUserId !== userId) return void res.status(404).json({ error: 'NOT_FOUND' });
  if (inv.status !== 'pending') return void res.status(409).json({ error: 'ALREADY_RESPONDED' });
  await invitationRepo.update(inv.id, { status: 'declined' });
  res.json({ ok: true });
});
