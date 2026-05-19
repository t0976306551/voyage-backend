import { AppDataSource } from '../../data-source';
import { Trip } from './trip.entity';

export interface ListOpts {
  page: number;     // 1-based
  pageSize: number; // default 10, max 50
  from?: string;    // ISO date — trip.endDate >= from (excludes trips ending before)
  to?: string;      // ISO date — trip.startDate <= to (excludes trips starting after)
}

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

  async findByUserIdPaginated(userId: string, opts: ListOpts): Promise<[Trip[], number]> {
    const page = Math.max(1, Math.floor(opts.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Math.floor(opts.pageSize) || 10));

    const qb = this.repo
      .createQueryBuilder('trip')
      .where(`trip.members @> :member::jsonb`, {
        member: JSON.stringify([{ userId }]),
      });

    if (opts.from) {
      // trip.endDate >= from — exclude trips ending before `from`.
      // Trips without endDate are kept (cannot prove they ended before).
      qb.andWhere('(trip.end_date IS NULL OR trip.end_date >= :from)', { from: opts.from });
    }

    if (opts.to) {
      // trip.startDate <= to — exclude trips starting after `to`.
      // Trips without startDate are kept (cannot prove they start after).
      qb.andWhere('(trip.start_date IS NULL OR trip.start_date <= :to)', { to: opts.to });
    }

    // Order: startDate DESC, NULLs last
    qb.orderBy('trip.start_date', 'DESC', 'NULLS LAST')
      .addOrderBy('trip.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    return qb.getManyAndCount();
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

  async isMember(tripId: string, userId: string): Promise<boolean> {
    const trip = await this.repo.findOne({
      where: { id: tripId },
      select: ['id', 'members'],
    });
    return trip?.members.some((m) => m.userId === userId) ?? false;
  }
}
