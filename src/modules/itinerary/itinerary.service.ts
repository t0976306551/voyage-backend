import { SpotCategory, Itinerary } from './itinerary.entity';
import { ItineraryRepository } from './itinerary.repository';

interface CreateItemDto {
  tripId: string;
  day: number | null;
  title: string;
  category?: SpotCategory;
  coverImage?: string;
  lat?: number;
  lng?: number;
  sourceUrl?: string;
  note?: string;
  startTime?: string | null;
  durationMinutes?: number | null;
  address?: string | null;
}

interface ReorderItemDto {
  id: string;
  order: number;
}

interface UpdateItemDto {
  title?: string;
  category?: SpotCategory;
  coverImage?: string;
  lat?: number;
  lng?: number;
  sourceUrl?: string;
  note?: string;
  order?: number;
  day?: number | null;
  startTime?: string | null;
  durationMinutes?: number | null;
  address?: string | null;
}

export class ItineraryService {
  constructor(private repo: ItineraryRepository) {}

  async getItemsByTrip(tripId: string): Promise<Itinerary[]> {
    return this.repo.findByTrip(tripId);
  }

  async getItemsByDay(tripId: string, day: number): Promise<Itinerary[]> {
    return this.repo.findByTripAndDay(tripId, day);
  }

  async getBucketItems(tripId: string): Promise<Itinerary[]> {
    return this.repo.findBucket(tripId);
  }

  async createItem(dto: CreateItemDto): Promise<Itinerary> {
    const order =
      dto.day === null
        ? await this.repo.countBucket(dto.tripId)
        : await this.repo.countByTripAndDay(dto.tripId, dto.day);
    return this.repo.create({ ...dto, order });
  }

  async updateItem(id: string, tripId: string, data: UpdateItemDto): Promise<Itinerary> {
    const existing = (await this.repo.findByIds([id]))[0];
    if (!existing) throw new Error('NOT_FOUND');
    if (existing.tripId !== tripId) throw new Error('FORBIDDEN');
    return this.repo.update(id, data);
  }

  async deleteItem(id: string, tripId: string): Promise<void> {
    const existing = (await this.repo.findByIds([id]))[0];
    if (!existing) throw new Error('NOT_FOUND');
    if (existing.tripId !== tripId) throw new Error('FORBIDDEN');
    return this.repo.delete(id);
  }

  async reorderItems(
    tripId: string,
    day: number | null,
    items: ReorderItemDto[],
  ): Promise<void> {
    const ids = items.map((i) => i.id);
    const existing = await this.repo.findByIds(ids);
    const foreignItem = existing.find((e) => e.tripId !== tripId);
    if (foreignItem) throw new Error('FORBIDDEN');
    const mismatch = existing.find((e) => e.day !== day);
    if (mismatch) throw new Error('DAY_MISMATCH');
    await Promise.all(items.map((item) => this.repo.updateOrder(item.id, item.order)));
  }
}
