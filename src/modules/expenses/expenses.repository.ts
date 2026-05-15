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
}
