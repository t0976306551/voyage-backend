import { PersonalRepository } from './personal.repository';
import { PersonalMemo } from './personal-memo.entity';
import { PersonalMemoItem } from './personal-memo-item.entity';
import { PersonalExpense, PersonalExpenseCategory } from './personal-expense.entity';
import { PersonalSettings } from './personal-settings.entity';

export class PersonalService {
  constructor(private repo: PersonalRepository) {}

  // ─── Settings ─────────────────────────────────────────────────────────────

  async getSettings(tripId: string, userId: string): Promise<{ memosShared: boolean; expensesShared: boolean }> {
    const settings = await this.repo.findSettings(tripId, userId);
    return {
      memosShared: settings?.memosShared ?? false,
      expensesShared: settings?.expensesShared ?? false,
    };
  }

  async updateSettings(tripId: string, userId: string, patch: {
    memosShared?: boolean;
    expensesShared?: boolean;
  }): Promise<PersonalSettings> {
    return this.repo.upsertSettings(tripId, userId, patch);
  }

  // ─── Memos ───────────────────────────────────────────────────────────────

  async getMemosForUser(tripId: string, userId: string) {
    const [mine, shared] = await Promise.all([
      this.repo.findMemosByUser(tripId, userId),
      this.repo.findSharedMemos(tripId, userId),
    ]);
    return { mine, shared };
  }

  async createMemo(tripId: string, userId: string, dto: {
    title: string;
    sortOrder?: number;
  }): Promise<PersonalMemo> {
    return this.repo.createMemo({
      tripId,
      userId,
      title: dto.title.trim(),
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async updateMemo(id: string, userId: string, dto: {
    title?: string;
    sortOrder?: number;
  }): Promise<PersonalMemo> {
    const memo = await this.repo.findMemoById(id);
    if (!memo) throw new Error('NOT_FOUND');
    if (memo.userId !== userId) throw new Error('FORBIDDEN');

    const patch: Partial<PersonalMemo> = {};
    if (dto.title !== undefined) patch.title = dto.title.trim();
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    return this.repo.updateMemo(id, patch);
  }

  async deleteMemo(id: string, userId: string): Promise<void> {
    const memo = await this.repo.findMemoById(id);
    if (!memo) throw new Error('NOT_FOUND');
    if (memo.userId !== userId) throw new Error('FORBIDDEN');
    await this.repo.deleteMemo(id);
  }

  // ─── Memo Items ───────────────────────────────────────────────────────────

  async getMemoItems(memoId: string, userId: string): Promise<PersonalMemoItem[]> {
    const memo = await this.repo.findMemoById(memoId);
    if (!memo) throw new Error('NOT_FOUND');
    // Allow if owner, or if memo's owner has memosShared = true
    if (memo.userId !== userId) {
      const settings = await this.repo.findSettings(memo.tripId, memo.userId);
      if (!settings?.memosShared) throw new Error('FORBIDDEN');
    }
    return this.repo.findItemsByMemo(memoId);
  }

  async createItem(memoId: string, userId: string, dto: {
    title: string;
    sortOrder?: number;
  }): Promise<PersonalMemoItem> {
    const memo = await this.repo.findMemoById(memoId);
    if (!memo) throw new Error('NOT_FOUND');
    if (memo.userId !== userId) throw new Error('FORBIDDEN');
    return this.repo.createItem({
      memoId,
      title: dto.title.trim(),
      completed: false,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async updateItem(itemId: string, memoId: string, userId: string, dto: {
    title?: string;
    completed?: boolean;
    sortOrder?: number;
  }): Promise<PersonalMemoItem> {
    const memo = await this.repo.findMemoById(memoId);
    if (!memo) throw new Error('NOT_FOUND');
    if (memo.userId !== userId) throw new Error('FORBIDDEN');

    const item = await this.repo.findItemById(itemId);
    if (!item || item.memoId !== memoId) throw new Error('NOT_FOUND');

    const patch: Partial<PersonalMemoItem> = {};
    if (dto.title !== undefined) patch.title = dto.title.trim();
    if (dto.completed !== undefined) patch.completed = dto.completed;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    return this.repo.updateItem(itemId, patch);
  }

  async deleteItem(itemId: string, memoId: string, userId: string): Promise<void> {
    const memo = await this.repo.findMemoById(memoId);
    if (!memo) throw new Error('NOT_FOUND');
    if (memo.userId !== userId) throw new Error('FORBIDDEN');

    const item = await this.repo.findItemById(itemId);
    if (!item || item.memoId !== memoId) throw new Error('NOT_FOUND');
    await this.repo.deleteItem(itemId);
  }

  async reorderItems(memoId: string, userId: string, items: { id: string; sortOrder: number }[]): Promise<void> {
    const memo = await this.repo.findMemoById(memoId);
    if (!memo) throw new Error('NOT_FOUND');
    if (memo.userId !== userId) throw new Error('FORBIDDEN');
    await this.repo.reorderItems(items);
  }

  // ─── Expenses ─────────────────────────────────────────────────────────────

  async getExpensesForUser(tripId: string, userId: string) {
    const [mine, shared] = await Promise.all([
      this.repo.findExpensesByUser(tripId, userId),
      this.repo.findSharedExpenses(tripId, userId),
    ]);
    return { mine, shared };
  }

  async createExpense(tripId: string, userId: string, dto: {
    amount: number;
    currency?: string;
    description?: string | null;
    category?: PersonalExpenseCategory;
    spentAt?: string | null;
  }): Promise<PersonalExpense> {
    if (!dto.amount || dto.amount <= 0) throw new Error('INVALID_AMOUNT');
    return this.repo.createExpense({
      tripId,
      userId,
      amount: String(dto.amount),
      currency: dto.currency ?? 'TWD',
      description: dto.description ?? null,
      category: dto.category ?? 'other',
      spentAt: dto.spentAt ?? null,
    });
  }

  async updateExpense(id: string, userId: string, dto: {
    amount?: number;
    currency?: string;
    description?: string | null;
    category?: PersonalExpenseCategory;
    spentAt?: string | null;
  }): Promise<PersonalExpense> {
    const expense = await this.repo.findExpenseById(id);
    if (!expense) throw new Error('NOT_FOUND');
    if (expense.userId !== userId) throw new Error('FORBIDDEN');

    if (dto.amount !== undefined && dto.amount <= 0) throw new Error('INVALID_AMOUNT');

    const patch: Partial<PersonalExpense> = {};
    if (dto.amount !== undefined) patch.amount = String(dto.amount);
    if (dto.currency !== undefined) patch.currency = dto.currency;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.category !== undefined) patch.category = dto.category;
    if (dto.spentAt !== undefined) patch.spentAt = dto.spentAt;
    return this.repo.updateExpense(id, patch);
  }

  async deleteExpense(id: string, userId: string): Promise<void> {
    const expense = await this.repo.findExpenseById(id);
    if (!expense) throw new Error('NOT_FOUND');
    if (expense.userId !== userId) throw new Error('FORBIDDEN');
    await this.repo.deleteExpense(id);
  }

  async deleteAllForUser(tripId: string, userId: string): Promise<void> {
    await this.repo.deleteAllByUser(tripId, userId);
  }

  async getPersonalCounts(tripId: string, userId: string): Promise<{ memos: number; expenses: number }> {
    const [memos, expenses] = await Promise.all([
      this.repo.countMemosByUser(tripId, userId),
      this.repo.countExpensesByUser(tripId, userId),
    ]);
    return { memos, expenses };
  }
}
