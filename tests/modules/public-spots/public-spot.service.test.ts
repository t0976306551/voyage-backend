import { PublicSpotService } from '../../../src/modules/public-spots/public-spot.service';
import { PublicSpotRepository } from '../../../src/modules/public-spots/public-spot.repository';
import { ItineraryRepository } from '../../../src/modules/itinerary/itinerary.repository';
import { TripRepository } from '../../../src/modules/trips/trip.repository';
import { PublicSpot } from '../../../src/modules/public-spots/public-spot.entity';
import { Trip } from '../../../src/modules/trips/trip.entity';
import { Itinerary } from '../../../src/modules/itinerary/itinerary.entity';

jest.mock('../../../src/modules/public-spots/public-spot.repository');
jest.mock('../../../src/modules/itinerary/itinerary.repository');
jest.mock('../../../src/modules/trips/trip.repository');

const MockPublicSpotRepo = PublicSpotRepository as jest.MockedClass<typeof PublicSpotRepository>;
const MockItineraryRepo = ItineraryRepository as jest.MockedClass<typeof ItineraryRepository>;
const MockTripRepo = TripRepository as jest.MockedClass<typeof TripRepository>;

describe('PublicSpotService', () => {
  let service: PublicSpotService;
  let psRepo: jest.Mocked<PublicSpotRepository>;
  let itinRepo: jest.Mocked<ItineraryRepository>;
  let tripRepo: jest.Mocked<TripRepository>;

  beforeEach(() => {
    MockPublicSpotRepo.mockClear();
    MockItineraryRepo.mockClear();
    MockTripRepo.mockClear();
    psRepo = new MockPublicSpotRepo() as jest.Mocked<PublicSpotRepository>;
    itinRepo = new MockItineraryRepo() as jest.Mocked<ItineraryRepository>;
    tripRepo = new MockTripRepo() as jest.Mocked<TripRepository>;
    service = new PublicSpotService(psRepo, itinRepo, tripRepo);
  });

  describe('create', () => {
    it('creates a public spot with creator info and defaults', async () => {
      const fake: Partial<PublicSpot> = { id: 'ps-1', title: 'Tokyo Tower' };
      psRepo.create = jest.fn().mockResolvedValue(fake as PublicSpot);
      const result = await service.create(
        { title: 'Tokyo Tower' },
        'user-1',
        'Alice',
      );
      expect(result.id).toBe('ps-1');
      expect(psRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Tokyo Tower',
          createdById: 'user-1',
          createdByName: 'Alice',
          category: 'attraction',
          sourcePlatform: 'manual',
          addedCount: 0,
        }),
      );
    });

    it('throws INVALID_TITLE when title missing', async () => {
      await expect(
        service.create({ title: '' }, 'user-1', 'Alice'),
      ).rejects.toThrow('INVALID_TITLE');
    });
  });

  describe('addToTrip', () => {
    it('FORBIDDEN when user is not a trip member', async () => {
      tripRepo.findById = jest.fn().mockResolvedValue({
        id: 'trip-1',
        members: [{ userId: 'other', role: 'Owner' }],
      } as Trip);

      await expect(service.addToTrip('ps-1', 'trip-1', 'user-1')).rejects.toThrow(
        'FORBIDDEN',
      );
    });

    it('TRIP_NOT_FOUND when trip missing', async () => {
      tripRepo.findById = jest.fn().mockResolvedValue(null);
      await expect(service.addToTrip('ps-1', 'trip-1', 'user-1')).rejects.toThrow(
        'TRIP_NOT_FOUND',
      );
    });

    it('NOT_FOUND when public spot missing', async () => {
      tripRepo.findById = jest.fn().mockResolvedValue({
        id: 'trip-1',
        members: [{ userId: 'user-1', role: 'Owner' }],
      } as Trip);
      psRepo.findById = jest.fn().mockResolvedValue(null);
      await expect(service.addToTrip('ps-1', 'trip-1', 'user-1')).rejects.toThrow(
        'NOT_FOUND',
      );
    });

    it('creates bucket item AND increments addedCount', async () => {
      tripRepo.findById = jest.fn().mockResolvedValue({
        id: 'trip-1',
        members: [{ userId: 'user-1', role: 'Owner' }],
      } as Trip);
      psRepo.findById = jest.fn().mockResolvedValue({
        id: 'ps-1',
        title: 'Cafe X',
        category: 'food',
        coverImage: 'https://x.jpg',
        lat: 25.0,
        lng: 121.5,
        sourceUrl: 'https://maps.google.com/x',
        note: null,
      } as PublicSpot);
      itinRepo.countBucket = jest.fn().mockResolvedValue(2);
      itinRepo.create = jest
        .fn()
        .mockResolvedValue({ id: 'item-new', tripId: 'trip-1', day: null, order: 2 } as Itinerary);
      psRepo.incrementAddedCount = jest.fn().mockResolvedValue(undefined);

      const result = await service.addToTrip('ps-1', 'trip-1', 'user-1');

      expect(result.id).toBe('item-new');
      expect(itinRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tripId: 'trip-1',
          day: null,
          title: 'Cafe X',
          category: 'food',
          coverImage: 'https://x.jpg',
          order: 2,
        }),
      );
      expect(psRepo.incrementAddedCount).toHaveBeenCalledWith('ps-1');
    });
  });

  describe('list', () => {
    it('forwards options to repo', async () => {
      psRepo.list = jest.fn().mockResolvedValue([]);
      await service.list({ category: 'food', limit: 10, offset: 5 });
      expect(psRepo.list).toHaveBeenCalledWith({ category: 'food', limit: 10, offset: 5 });
    });
  });
});
