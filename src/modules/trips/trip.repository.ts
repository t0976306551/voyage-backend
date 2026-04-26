import { AppDataSource } from '../../data-source';
import { Trip } from './trip.entity';

export class TripRepository {
  private get repo() {
    return AppDataSource.getRepository(Trip);
  }

  async create(data: Partial<Trip>): Promise<Trip> {
    const trip = this.repo.create(data);
    return this.repo.save(trip);
  }

  async findById(id: string): Promise<Trip | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByUserId(userId: string): Promise<Trip[]> {
    return this.repo
      .createQueryBuilder('trip')
      .where(`trip.members @> :member::jsonb`, {
        member: JSON.stringify([{ userId }]),
      })
      .orderBy('trip.created_at', 'DESC')
      .getMany();
  }

  async update(id: string, data: Partial<Trip>): Promise<Trip> {
    await this.repo.update(id, data);
    return this.repo.findOneOrFail({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async findByInviteCode(code: string): Promise<Trip | null> {
    return this.repo.findOne({ where: { inviteCode: code } });
  }
}
