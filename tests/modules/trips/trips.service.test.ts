import { TripService } from '../../../src/modules/trips/trip.service';
import { TripRepository } from '../../../src/modules/trips/trip.repository';
import { Trip } from '../../../src/modules/trips/trip.entity';

jest.mock('../../../src/modules/trips/trip.repository');

const mockRepo = TripRepository as jest.MockedClass<typeof TripRepository>;

describe('TripService', () => {
  let service: TripService;

  beforeEach(() => {
    mockRepo.mockClear();
    service = new TripService(new mockRepo());
  });

  describe('createTrip', () => {
    it('should create a trip with Owner member', async () => {
      const fakeTrip: Partial<Trip> = {
        id: 'trip-1',
        title: 'Japan 2026',
        members: [{ userId: 'user-1', role: 'Owner' }],
        inviteCode: 'ABC12345',
      };
      mockRepo.prototype.create.mockResolvedValue(fakeTrip as Trip);

      const result = await service.createTrip(
        { title: 'Japan 2026', startDate: '2026-05-01', endDate: '2026-05-10' },
        'user-1',
      );

      expect(result.members[0]).toEqual({ userId: 'user-1', role: 'Owner' });
      expect(result.inviteCode).toBeDefined();
    });
  });

  describe('getTripById', () => {
    it('should return trip if user is a member', async () => {
      const fakeTrip: Partial<Trip> = {
        id: 'trip-1',
        members: [{ userId: 'user-1', role: 'Owner' }],
      };
      mockRepo.prototype.findById.mockResolvedValue(fakeTrip as Trip);

      const result = await service.getTripById('trip-1', 'user-1');
      expect(result).toEqual(fakeTrip);
    });

    it('should throw FORBIDDEN if user is not a member', async () => {
      const fakeTrip: Partial<Trip> = {
        id: 'trip-1',
        members: [{ userId: 'other-user', role: 'Owner' }],
      };
      mockRepo.prototype.findById.mockResolvedValue(fakeTrip as Trip);

      await expect(service.getTripById('trip-1', 'user-1')).rejects.toThrow('FORBIDDEN');
    });
  });
});
