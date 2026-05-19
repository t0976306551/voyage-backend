import { TripService } from '../../../src/modules/trips/trip.service';
import { TripRepository } from '../../../src/modules/trips/trip.repository';
import { Trip } from '../../../src/modules/trips/trip.entity';

// hydrateMembers calls AppDataSource.getRepository(User).find() — mock it so
// unit tests don't need a live DB connection.
jest.mock('../../../src/data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      find: jest.fn().mockResolvedValue([]),
    }),
  },
}));

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

  describe('setPublishState', () => {
    it('updates isPublicTemplate when caller is Owner', async () => {
      const ownerTrip: Partial<Trip> = {
        id: 'trip-1',
        isPublicTemplate: false,
        members: [{ userId: 'user-1', role: 'Owner' }],
      };
      const updated: Partial<Trip> = { id: 'trip-1', isPublicTemplate: true, members: [{ userId: 'user-1', role: 'Owner' }] };
      mockRepo.prototype.findById.mockResolvedValue(ownerTrip as Trip);
      mockRepo.prototype.update.mockResolvedValue(updated as Trip);

      const result = await service.setPublishState('trip-1', true, 'user-1');

      expect(mockRepo.prototype.update).toHaveBeenCalledWith('trip-1', {
        isPublicTemplate: true,
      });
      expect(result.isPublicTemplate).toBe(true);
    });

    it('throws FORBIDDEN when caller is not Owner', async () => {
      const viewerTrip: Partial<Trip> = {
        id: 'trip-1',
        members: [{ userId: 'user-viewer', role: 'Viewer' }],
      };
      mockRepo.prototype.findById.mockResolvedValue(viewerTrip as Trip);

      await expect(service.setPublishState('trip-1', true, 'user-viewer')).rejects.toThrow('FORBIDDEN');
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
      // hydrateMembers adds name/email/avatar from User table (mocked as empty → defaults)
      expect(result.id).toBe('trip-1');
      expect(result.members[0].userId).toBe('user-1');
      expect(result.members[0].role).toBe('Owner');
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
