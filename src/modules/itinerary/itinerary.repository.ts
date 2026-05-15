import { IsNull, Not } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { Itinerary } from './itinerary.entity';

export class ItineraryRepository {
  private get repo() {
    return AppDataSource.getRepository(Itinerary);
  }

  async create(data: Partial<Itinerary>): Promise<Itinerary> {
    return this.repo.save(this.repo.create(data));
  }

  async findByTrip(tripId: string): Promise<Itinerary[]> {
    return this.repo.find({
      where: { tripId, day: Not(IsNull()) },
      order: { day: 'ASC', order: 'ASC' },
    });
  }

  async findByTripAndDay(tripId: string, day: number): Promise<Itinerary[]> {
    return this.repo.find({
      where: { tripId, day },
      order: { order: 'ASC' },
    });
  }

  async findBucket(tripId: string): Promise<Itinerary[]> {
    return this.repo.find({
      where: { tripId, day: IsNull() },
      order: { order: 'ASC' },
    });
  }

  async countByTripAndDay(tripId: string, day: number): Promise<number> {
    return this.repo.count({ where: { tripId, day } });
  }

  async countBucket(tripId: string): Promise<number> {
    return this.repo.count({ where: { tripId, day: IsNull() } });
  }

  async findByIds(ids: string[]): Promise<Itinerary[]> {
    if (ids.length === 0) return [];
    return this.repo
      .createQueryBuilder('itinerary')
      .where('itinerary.id IN (:...ids)', { ids })
      .getMany();
  }

  async updateOrder(id: string, order: number): Promise<void> {
    await this.repo.update(id, { order });
  }

  async update(id: string, data: Partial<Itinerary>): Promise<Itinerary> {
    await this.repo.update(id, data);
    return this.repo.findOneOrFail({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
