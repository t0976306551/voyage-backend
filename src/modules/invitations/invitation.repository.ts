import { AppDataSource } from '../../data-source';
import { TripInvitation } from './invitation.entity';

export class InvitationRepository {
  private get repo() {
    return AppDataSource.getRepository(TripInvitation);
  }

  async create(data: Partial<TripInvitation>): Promise<TripInvitation> {
    return this.repo.save(this.repo.create(data));
  }

  async findById(id: string): Promise<TripInvitation | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findPendingForUser(userId: string): Promise<TripInvitation[]> {
    return this.repo.find({ where: { invitedUserId: userId, status: 'pending' }, order: { createdAt: 'DESC' } });
  }

  async findPendingForTrip(tripId: string): Promise<TripInvitation[]> {
    return this.repo.find({ where: { tripId, status: 'pending' }, order: { createdAt: 'DESC' } });
  }

  async findPendingByTripAndUser(tripId: string, userId: string): Promise<TripInvitation | null> {
    return this.repo.findOne({ where: { tripId, invitedUserId: userId, status: 'pending' } });
  }

  async update(id: string, data: Partial<TripInvitation>): Promise<void> {
    await this.repo.update(id, data);
  }

  async cancelByTripAndUser(tripId: string, userId: string): Promise<void> {
    await this.repo.delete({ tripId, invitedUserId: userId, status: 'pending' });
  }
}
