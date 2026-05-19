import {
  InvitationHistoryRepository,
  InvitationHistoryListItem,
} from './invitation-history.repository';

export class InvitationHistoryService {
  constructor(private readonly repo: InvitationHistoryRepository) {}

  async listMine(
    inviterId: string,
    excludeTripId?: string,
  ): Promise<InvitationHistoryListItem[]> {
    return this.repo.listForInviter(inviterId, excludeTripId);
  }

  /**
   * Soft-hide one entry. Throws 'NOT_FOUND' when nothing was hidden.
   */
  async hideMine(inviterId: string, inviteeId: string): Promise<void> {
    return this.repo.hide(inviterId, inviteeId);
  }

  async recordInvite(inviterId: string, inviteeId: string): Promise<void> {
    return this.repo.upsert(inviterId, inviteeId);
  }
}
