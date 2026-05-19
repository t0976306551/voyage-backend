import { Request, Response } from 'express';
import { InvitationHistoryRepository } from './invitation-history.repository';
import { InvitationHistoryService } from './invitation-history.service';

const service = new InvitationHistoryService(new InvitationHistoryRepository());

/**
 * GET /api/users/me/invitation-history?excludeTripId=:id
 *
 * Privacy: ALWAYS uses req.user!.id as the inviter. NEVER accepts an
 * inviterId from the body or query — that would let any authed user
 * enumerate other people's invitation history.
 */
export async function listMyInvitationHistory(req: Request, res: Response): Promise<void> {
  const inviterId = req.user!.id;
  const excludeTripIdRaw = req.query['excludeTripId'];
  const excludeTripId =
    typeof excludeTripIdRaw === 'string' && excludeTripIdRaw.trim().length > 0
      ? excludeTripIdRaw.trim()
      : undefined;

  try {
    const items = await service.listMine(inviterId, excludeTripId);
    // user.api.ts fetchWithAuth doesn't unwrap a {data,error} envelope, so
    // return the array directly — consistent with the other user endpoints.
    res.json(items);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    console.error('[invitation-history] list failed', msg);
    res.status(500).json({ error: 'INTERNAL' });
  }
}

/**
 * POST /api/users/me/invitation-history/:userId/hide
 *
 * Privacy: scoped to req.user!.id; returns 404 (not 403) when the row
 * doesn't exist for the caller — don't leak existence of other inviters'
 * relations to the target.
 */
export async function hideInvitationHistoryEntry(req: Request, res: Response): Promise<void> {
  const inviterId = req.user!.id;
  const inviteeIdRaw = req.params['userId'];
  const inviteeId = typeof inviteeIdRaw === 'string' ? inviteeIdRaw : null;
  if (!inviteeId) {
    res.status(400).json({ error: 'MISSING_USER_ID' });
    return;
  }

  try {
    await service.hideMine(inviterId, inviteeId);
    res.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    console.error('[invitation-history] hide failed', msg);
    res.status(500).json({ error: 'INTERNAL' });
  }
}
