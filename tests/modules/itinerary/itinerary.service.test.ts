import { ItineraryService } from '../../../src/modules/itinerary/itinerary.service';
import { ItineraryRepository } from '../../../src/modules/itinerary/itinerary.repository';
import { Itinerary } from '../../../src/modules/itinerary/itinerary.entity';

jest.mock('../../../src/modules/itinerary/itinerary.repository');

const mockRepo = ItineraryRepository as jest.MockedClass<typeof ItineraryRepository>;

describe('ItineraryService', () => {
  let service: ItineraryService;

  beforeEach(() => {
    mockRepo.mockClear();
    service = new ItineraryService(new mockRepo());
  });

  describe('reorderItems', () => {
    it('should update order for each item', async () => {
      mockRepo.prototype.findByIds.mockResolvedValue([
        { id: 'item-2', tripId: 'trip-1' } as Itinerary,
        { id: 'item-1', tripId: 'trip-1' } as Itinerary,
      ]);
      mockRepo.prototype.updateOrder.mockResolvedValue(undefined);

      await service.reorderItems('trip-1', 1, [
        { id: 'item-2', order: 0 },
        { id: 'item-1', order: 1 },
      ]);

      expect(mockRepo.prototype.updateOrder).toHaveBeenCalledTimes(2);
    });

    it('should throw FORBIDDEN when item belongs to a different trip', async () => {
      mockRepo.prototype.findByIds.mockResolvedValue([
        { id: 'item-x', tripId: 'trip-2' } as Itinerary,
      ]);

      await expect(
        service.reorderItems('trip-1', 1, [{ id: 'item-x', order: 0 }]),
      ).rejects.toThrow('FORBIDDEN');
    });
  });

  describe('createItem', () => {
    it('should assign order as last in day', async () => {
      mockRepo.prototype.countByTripAndDay.mockResolvedValue(3);
      mockRepo.prototype.create.mockResolvedValue({ id: 'new', order: 3 } as Itinerary);

      const result = await service.createItem({
        tripId: 'trip-1',
        day: 1,
        title: 'Tokyo Tower',
      });

      expect(result.order).toBe(3);
    });
  });
});
