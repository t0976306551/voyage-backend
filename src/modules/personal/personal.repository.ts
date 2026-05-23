import { AppDataSource } from '../../data-source';
import { PersonalMemo } from './personal-memo.entity';
import { PersonalMemoItem } from './personal-memo-item.entity';
import { PersonalExpense } from './personal-expense.entity';
import { PersonalSettings } from './personal-settings.entity';

export class PersonalRepository {
  private get memoRepo() { return AppDataSource.getRepository(PersonalMemo); }
  private get itemRepo() { return AppDataSource.getRepository(PersonalMemoItem); }
  private get expenseRepo() { return AppDataSource.getRepository(PersonalExpense); }
  private get settingsRepo() { return AppDataSource.getRepository(PersonalSettings); }

  // ─── Settings ─────────────────────────────────────────────────────────────

  async findSettings(tripId: string, userId: string): Promise<PersonalSettings | null> {
    return this.settingsRepo.findOne({ where: { tripId, userId } });
  }

  async upsertSettings(tripId: string, userId: string, patch: { memosShared?: boolean; expensesShared?: boolean }): Promise<PersonalSettings> {
    let settings = await this.findSettings(tripId, userId);
    if (!settings) {
      settings = this.settingsRepo.create({ tripId, userId, memosShared: false, expensesShared: false });
    }
    if (patch.memosShared !== undefined) settings.memosShared = patch.memosShared;
    if (patch.expensesShared !== undefined) settings.expensesShared = patch.expensesShared;
    return this.settingsRepo.save(settings);
  }

  // ─── Memos ───────────────────────────────────────────────────────────────

  async findMemosByUser(tripId: string, userId: string): Promise<PersonalMemo[]> {
    return this.memoRepo.find({
      where: { tripId, userId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /** Returns memos from users who have memosShared = true, excluding the caller. */
  async findSharedMemos(tripId: string, excludeUserId: string): Promise<PersonalMemo[]> {
    const sharedSettings = await this.settingsRepo.find({
      where: { tripId, memosShared: true },
    });
    const sharedUserIds = sharedSettings
      .map((s) => s.userId)
      .filter((id) => id !== excludeUserId);
    if (sharedUserIds.length === 0) return [];

    return this.memoRepo
      .createQueryBuilder('m')
      .where('m.trip_id = :tripId', { tripId })
      .andWhere('m.user_id IN (:...userIds)', { userIds: sharedUserIds })
      .orderBy('m.user_id', 'ASC')
      .addOrderBy('m.sort_order', 'ASC')
      .addOrderBy('m.created_at', 'ASC')
      .getMany();
  }

  async findMemoById(id: string): Promise<PersonalMemo | null> {
    return this.memoRepo.findOne({ where: { id } });
  }

  async createMemo(data: Partial<PersonalMemo>): Promise<PersonalMemo> {
    return this.memoRepo.save(this.memoRepo.create(data));
  }

  async updateMemo(id: string, data: Partial<PersonalMemo>): Promise<PersonalMemo> {
    await this.memoRepo.update(id, data);
    return this.memoRepo.findOneOrFail({ where: { id } });
  }

  async deleteMemo(id: string): Promise<void> {
    await this.itemRepo.delete({ memoId: id });
    await this.memoRepo.delete(id);
  }

  async countMemosByUser(tripId: string, userId: string): Promise<number> {
    return this.memoRepo.count({ where: { tripId, userId } });
  }

  // ─── Memo Items ───────────────────────────────────────────────────────────

  async findItemsByMemo(memoId: string): Promise<PersonalMemoItem[]> {
    return this.itemRepo.find({
      where: { memoId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async findItemById(id: string): Promise<PersonalMemoItem | null> {
    return this.itemRepo.findOne({ where: { id } });
  }

  async createItem(data: Partial<PersonalMemoItem>): Promise<PersonalMemoItem> {
    return this.itemRepo.save(this.itemRepo.create(data));
  }

  async updateItem(id: string, data: Partial<PersonalMemoItem>): Promise<PersonalMemoItem> {
    await this.itemRepo.update(id, data);
    return this.itemRepo.findOneOrFail({ where: { id } });
  }

  async deleteItem(id: string): Promise<void> {
    await this.itemRepo.delete(id);
  }

  async reorderItems(updates: { id: string; sortOrder: number }[]): Promise<void> {
    await Promise.all(updates.map(({ id, sortOrder }) => this.itemRepo.update(id, { sortOrder })));
  }

  // ─── Expenses ─────────────────────────────────────────────────────────────

  async findExpensesByUser(tripId: string, userId: string): Promise<PersonalExpense[]> {
    return this.expenseRepo.find({
      where: { tripId, userId },
      order: { spentAt: 'DESC', createdAt: 'DESC' },
    });
  }

  /** Returns expenses from users who have expensesShared = true, excluding the caller. */
  async findSharedExpenses(tripId: string, excludeUserId: string): Promise<PersonalExpense[]> {
    const sharedSettings = await this.settingsRepo.find({
      where: { tripId, expensesShared: true },
    });
    const sharedUserIds = sharedSettings
      .map((s) => s.userId)
      .filter((id) => id !== excludeUserId);
    if (sharedUserIds.length === 0) return [];

    return this.expenseRepo
      .createQueryBuilder('e')
      .where('e.trip_id = :tripId', { tripId })
      .andWhere('e.user_id IN (:...userIds)', { userIds: sharedUserIds })
      .orderBy('e.user_id', 'ASC')
      .addOrderBy('e.spent_at', 'DESC', 'NULLS LAST')
      .addOrderBy('e.created_at', 'DESC')
      .getMany();
  }

  async findExpenseById(id: string): Promise<PersonalExpense | null> {
    return this.expenseRepo.findOne({ where: { id } });
  }

  async createExpense(data: Partial<PersonalExpense>): Promise<PersonalExpense> {
    return this.expenseRepo.save(this.expenseRepo.create(data));
  }

  async updateExpense(id: string, data: Partial<PersonalExpense>): Promise<PersonalExpense> {
    await this.expenseRepo.update(id, data);
    return this.expenseRepo.findOneOrFail({ where: { id } });
  }

  async deleteExpense(id: string): Promise<void> {
    await this.expenseRepo.delete(id);
  }

  async countExpensesByUser(tripId: string, userId: string): Promise<number> {
    return this.expenseRepo.count({ where: { tripId, userId } });
  }

  async deleteAllByUser(tripId: string, userId: string): Promise<void> {
    const memos = await this.findMemosByUser(tripId, userId);
    for (const memo of memos) {
      await this.itemRepo.delete({ memoId: memo.id });
    }
    await this.memoRepo.delete({ tripId, userId });
    await this.expenseRepo.delete({ tripId, userId });
    await this.settingsRepo.delete({ tripId, userId });
  }
}
