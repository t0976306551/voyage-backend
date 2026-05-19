import { AppDataSource } from '../../data-source';
import { Expense } from './expense.entity';

export class ExpensesRepository {
  private get repo() {
    return AppDataSource.getRepository(Expense);
  }

  async create(data: Partial<Expense>): Promise<Expense> {
    return this.repo.save(this.repo.create(data));
  }

  async findByTrip(tripId: string): Promise<Expense[]> {
    return this.repo.find({
      where: { tripId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Expense | null> {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: string, data: Partial<Expense>): Promise<Expense> {
    await this.repo.update(id, data);
    return this.repo.findOneOrFail({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  /**
   * Find expenses in a trip where `userId` owes a positive share to a different payer
   * and has not yet marked as paid back.
   * Returns the full Expense rows so callers can hydrate names/amounts.
   */
  async findUnsettledByDebtor(tripId: string, userId: string): Promise<Expense[]> {
    const all = await this.repo.find({ where: { tripId } });
    return all.filter((e) => {
      if (e.payerId === userId) return false;
      const owed = Number(e.splitInfo?.[userId] ?? 0);
      if (!Number.isFinite(owed) || owed <= 0) return false;
      const paid = e.paidBack?.[userId];
      return !paid;
    });
  }
}
