import { Itinerary } from './itinerary.entity';
import { ItineraryRepository } from './itinerary.repository';

interface CreateItemDto {
  tripId: string;
  day: number;
  title: string;
  lat?: number;
  lng?: number;
  sourceUrl?: string;
  note?: string;
}

interface ReorderItemDto {
  id: string;
  order: number;
}

export class ItineraryService {
  constructor(private repo: ItineraryRepository) {}

  async getItemsByTrip(tripId: string): Promise<Itinerary[]> {
    return this.repo.findByTrip(tripId);
  }

  async createItem(dto: CreateItemDto): Promise<Itinerary> {
    const count = await this.repo.countByTripAndDay(dto.tripId, dto.day);
    return this.repo.create({ ...dto, order: count });
  }

  async updateItem(id: string, data: Partial<CreateItemDto>): Promise<Itinerary> {
    return this.repo.update(id, data);
  }

  async deleteItem(id: string): Promise<void> {
    return this.repo.delete(id);
  }

  async reorderItems(
    _tripId: string,
    _day: number,
    items: ReorderItemDto[],
  ): Promise<void> {
    await Promise.all(items.map((item) => this.repo.updateOrder(item.id, item.order)));
  }
}
