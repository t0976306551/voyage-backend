import { ExpensesService } from '../../../src/modules/expenses/expenses.service';
import { ExpensesRepository } from '../../../src/modules/expenses/expenses.repository';
import { Expense } from '../../../src/modules/expenses/expense.entity';

jest.mock('../../../src/modules/expenses/expenses.repository');

const MockRepo = ExpensesRepository as jest.MockedClass<typeof ExpensesRepository>;

const mkExp = (over: Partial<Expense>): Expense => ({
  id: 'e' + Math.random(),
  tripId: 'trip-1',
  payerId: 'u1',
  amount: 0,
  currency: 'TWD',
  description: '',
  splitInfo: {},
  createdAt: new Date(),
  ...over,
} as Expense);

describe('ExpensesService.computeSettlement', () => {
  let service: ExpensesService;

  beforeEach(() => {
    MockRepo.mockClear();
    service = new ExpensesService(new MockRepo());
  });

  it('returns empty for zero expenses', async () => {
    MockRepo.prototype.findByTrip.mockResolvedValue([]);
    const transfers = await service.computeSettlement('trip-1');
    expect(transfers).toEqual([]);
  });

  it('produces zero transfers when everyone is square', async () => {
    // u1 paid 100, u1 owes 100 (paid for self only)
    MockRepo.prototype.findByTrip.mockResolvedValue([
      mkExp({ payerId: 'u1', amount: 100, splitInfo: { u1: 100 } }),
    ]);
    expect(await service.computeSettlement('trip-1')).toEqual([]);
  });

  it('handles simple two-person case (u1 paid 90, split u1:30/u2:60)', async () => {
    MockRepo.prototype.findByTrip.mockResolvedValue([
      mkExp({ payerId: 'u1', amount: 90, splitInfo: { u1: 30, u2: 60 } }),
    ]);
    const t = await service.computeSettlement('trip-1');
    expect(t).toEqual([{ from: 'u2', to: 'u1', amount: 60 }]);
  });

  it('minimizes transfers across 3 users with offsetting balances', async () => {
    // u1 pays 300 split equally among u1,u2,u3 (each owes 100)
    // u2 pays 60 split equally among u1,u2,u3 (each owes 20)
    // u3 pays 30 split equally among u1,u2,u3 (each owes 10)
    // Net: u1=+300-130=+170, u2=+60-130=-70, u3=+30-130=-100
    MockRepo.prototype.findByTrip.mockResolvedValue([
      mkExp({ payerId: 'u1', amount: 300, splitInfo: { u1: 100, u2: 100, u3: 100 } }),
      mkExp({ payerId: 'u2', amount: 60, splitInfo: { u1: 20, u2: 20, u3: 20 } }),
      mkExp({ payerId: 'u3', amount: 30, splitInfo: { u1: 10, u2: 10, u3: 10 } }),
    ]);
    const t = await service.computeSettlement('trip-1');
    // Two transfers: u3->u1 100, u2->u1 70  (or order may vary by greedy step)
    const total = t.reduce((s, x) => s + x.amount, 0);
    expect(Math.round(total * 100) / 100).toBe(170);
    expect(t.length).toBeLessThanOrEqual(2);
    // All transfers go TO u1
    expect(t.every((x) => x.to === 'u1')).toBe(true);
  });

  it('handles decimal amounts that sum cleanly', async () => {
    MockRepo.prototype.findByTrip.mockResolvedValue([
      mkExp({ payerId: 'u1', amount: 99.99, splitInfo: { u1: 33.33, u2: 33.33, u3: 33.33 } }),
    ]);
    const t = await service.computeSettlement('trip-1');
    const total = t.reduce((s, x) => s + x.amount, 0);
    expect(total).toBeCloseTo(66.66, 1);
  });
});

describe('ExpensesService.update guards trip ownership', () => {
  let service: ExpensesService;

  beforeEach(() => {
    MockRepo.mockClear();
    service = new ExpensesService(new MockRepo());
  });

  it('throws NOT_FOUND when expense missing', async () => {
    MockRepo.prototype.findById.mockResolvedValue(null);
    await expect(service.update('x', 'trip-1', { amount: 1 })).rejects.toThrow('NOT_FOUND');
  });

  it('throws FORBIDDEN when expense belongs to a different trip', async () => {
    MockRepo.prototype.findById.mockResolvedValue(mkExp({ id: 'e1', tripId: 'trip-other' }));
    await expect(service.update('e1', 'trip-1', { amount: 1 })).rejects.toThrow('FORBIDDEN');
  });
});
