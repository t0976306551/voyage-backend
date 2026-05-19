import { ItineraryService } from '../../../src/modules/itinerary/itinerary.service';
import { ItineraryRepository } from '../../../src/modules/itinerary/itinerary.repository';

jest.mock('../../../src/modules/itinerary/itinerary.repository');

const MockRepo = ItineraryRepository as jest.MockedClass<typeof ItineraryRepository>;

function makeItem(overrides: Partial<{ id: string; tripId: string; day: number | null; order: number }> = {}) {
  return {
    id: 'item-1',
    tripId: 'trip-1',
    day: null,
    order: 0,
    title: 'Test Place',
    lat: null,
    lng: null,
    sourceUrl: null,
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ItineraryService — bucket', () => {
  let service: ItineraryService;
  let repo: jest.Mocked<ItineraryRepository>;

  beforeEach(() => {
    repo = new MockRepo() as jest.Mocked<ItineraryRepository>;
    service = new ItineraryService(repo);
  });

  it('getBucketItems returns items with day null', async () => {
    repo.findBucket = jest.fn().mockResolvedValue([makeItem({ day: null })]);
    const items = await service.getBucketItems('trip-1');
    expect(repo.findBucket).toHaveBeenCalledWith('trip-1');
    expect(items[0].day).toBeNull();
  });

  it('createItem with day=null uses countBucket for order', async () => {
    repo.countBucket = jest.fn().mockResolvedValue(2);
    repo.create = jest.fn().mockResolvedValue(makeItem({ order: 2 }));
    const item = await service.createItem({ tripId: 'trip-1', day: null, title: 'Spot' });
    expect(repo.countBucket).toHaveBeenCalledWith('trip-1');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ order: 2 }));
  });

  it('reorderItems throws DAY_MISMATCH for cross-day items', async () => {
    repo.findByIds = jest.fn().mockResolvedValue([
      makeItem({ id: 'a', tripId: 'trip-1', day: 1 }),
      makeItem({ id: 'b', tripId: 'trip-1', day: 2 }),
    ]);
    await expect(
      service.reorderItems('trip-1', 1, [
        { id: 'a', order: 0 },
        { id: 'b', order: 1 },
      ]),
    ).rejects.toThrow('DAY_MISMATCH');
  });

  it('reorderItems succeeds for all-null day (bucket reorder)', async () => {
    repo.findByIds = jest.fn().mockResolvedValue([
      makeItem({ id: 'a', tripId: 'trip-1', day: null }),
      makeItem({ id: 'b', tripId: 'trip-1', day: null }),
    ]);
    repo.updateOrder = jest.fn().mockResolvedValue(undefined);
    await expect(
      service.reorderItems('trip-1', null, [
        { id: 'a', order: 0 },
        { id: 'b', order: 1 },
      ]),
    ).resolves.toBeUndefined();
  });
});
