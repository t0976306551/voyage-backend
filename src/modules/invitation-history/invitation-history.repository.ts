import { AppDataSource } from '../../data-source';
import { InvitationHistory } from './invitation-history.entity';

export interface InvitationHistoryListItem {
  userId: string;
  name: string | null;
  handle: string | null;
  avatar: string | null;
  lastInvitedAt: Date;
  inviteCount: number;
}

export class InvitationHistoryRepository {
  private get repo() {
    return AppDataSource.getRepository(InvitationHistory);
  }

  /**
   * Upsert an invitation history row. If the inviter→invitee pair already
   * exists, bump last_invited_at + invite_count and clear hidden_at (re-invite
   * implicitly un-hides). If it's a new pair, insert a fresh row.
   *
   * Inviting yourself is a no-op (defensive — handle-search already filters).
   */
  async upsert(inviterId: string, inviteeId: string): Promise<void> {
    if (!inviterId || !inviteeId || inviterId === inviteeId) return;

    // TypeORM's QueryBuilder .orUpdate() only supports constant SET values,
    // but we need invite_count = invite_count + 1 — express it in raw SQL.
    await this.repo.query(
      `INSERT INTO "invitation_history" ("inviter_user_id","invitee_user_id")
       VALUES ($1, $2)
       ON CONFLICT ON CONSTRAINT "uq_invitation_history"
       DO UPDATE SET
         "last_invited_at" = now(),
         "invite_count" = "invitation_history"."invite_count" + 1,
         "hidden_at" = NULL`,
      [inviterId, inviteeId],
    );
  }

  /**
   * List entries for a given inviter. When excludeTripId is supplied, also
   * exclude users that are already members of that trip OR have a pending
   * invitation for that trip — they don't need to be re-invited.
   *
   * Always filters out hidden_at IS NOT NULL.
   * Always filters out the inviter themselves (defensive).
   */
  async listForInviter(
    inviterId: string,
    excludeTripId?: string,
  ): Promise<InvitationHistoryListItem[]> {
    const qb = this.repo
      .createQueryBuilder('ih')
      .innerJoin('users', 'u', 'u.id = ih.invitee_user_id')
      .select([
        'ih.invitee_user_id  AS "userId"',
        'u.name              AS "name"',
        'u.handle            AS "handle"',
        'u.avatar            AS "avatar"',
        'ih.last_invited_at  AS "lastInvitedAt"',
        'ih.invite_count     AS "inviteCount"',
      ])
      .where('ih.inviter_user_id = :inviterId', { inviterId })
      .andWhere('ih.hidden_at IS NULL')
      .andWhere('ih.invitee_user_id <> :inviterId', { inviterId });

    if (excludeTripId) {
      // Exclude users that are members of the trip. Build the jsonb match string
      // inline — Postgres concatenation is safe here because invitee_user_id
      // is a UUID column (no SQL injection vector).
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM "trips" t
          WHERE t.id = :excludeTripId::uuid
            AND t.members @> ('[{"userId":"' || ih.invitee_user_id::text || '"}]')::jsonb
        )`,
        { excludeTripId },
      );
      // Exclude users with a pending invitation on that trip.
      // trip_invitations.trip_id and invited_user_id are stored as character
      // varying (legacy schema), so we use a SEPARATE param cast to text.
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM "trip_invitations" ti
          WHERE ti.trip_id = :excludeTripIdText
            AND ti.invited_user_id = ih.invitee_user_id::text
            AND ti.status = 'pending'
        )`,
        { excludeTripIdText: excludeTripId },
      );
    }

    qb.orderBy('ih.last_invited_at', 'DESC');

    const rows = await qb.getRawMany<{
      userId: string;
      name: string | null;
      handle: string | null;
      avatar: string | null;
      lastInvitedAt: Date;
      inviteCount: number | string;
    }>();

    return rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      handle: r.handle,
      avatar: r.avatar,
      lastInvitedAt: r.lastInvitedAt,
      inviteCount: typeof r.inviteCount === 'string' ? parseInt(r.inviteCount, 10) : r.inviteCount,
    }));
  }

  /**
   * Soft-hide the (inviter, invitee) pair by setting hidden_at = now().
   * Throws 'NOT_FOUND' when no row exists — privacy: don't leak existence
   * of other inviters' history.
   */
  async hide(inviterId: string, inviteeId: string): Promise<void> {
    const result = await this.repo
      .createQueryBuilder()
      .update(InvitationHistory)
      .set({ hiddenAt: () => 'now()' })
      .where('inviter_user_id = :inviterId AND invitee_user_id = :inviteeId', {
        inviterId,
        inviteeId,
      })
      .execute();

    if (!result.affected || result.affected === 0) {
      throw new Error('NOT_FOUND');
    }
  }
}
