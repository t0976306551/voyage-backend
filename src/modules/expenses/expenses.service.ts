import { Expense } from './expense.entity';
import { ExpensesRepository } from './expenses.repository';

export interface CreateExpenseDto {
  tripId: string;
  payerId: string;
  amount: number;
  currency?: string;
  description?: string;
  splitInfo: Record<string, number>;
}

export interface UpdateExpenseDto {
  payerId?: string;
  amount?: number;
  currency?: string;
  description?: string;
  splitInfo?: Record<string, number>;
}

export interface SettlementTransfer {
  from: string;
  to: string;
  amount: number;
}

export class ExpensesService {
  constructor(private repo: ExpensesRepository) {}

  async listByTrip(tripId: string): Promise<Expense[]> {
    return this.repo.findByTrip(tripId);
  }

  async create(dto: CreateExpenseDto): Promise<Expense> {
    return this.repo.create({
      tripId: dto.tripId,
      payerId: dto.payerId,
      amount: dto.amount,
      currency: dto.currency ?? 'TWD',
      description: dto.description,
      splitInfo: dto.splitInfo ?? {},
    });
  }

  async update(id: string, tripId: string, dto: UpdateExpenseDto): Promise<Expense> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error('NOT_FOUND');
    if (existing.tripId !== tripId) throw new Error('FORBIDDEN');
    return this.repo.update(id, dto);
  }

  async delete(id: string, tripId: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error('NOT_FOUND');
    if (existing.tripId !== tripId) throw new Error('FORBIDDEN');
    return this.repo.delete(id);
  }

  /**
   * Mark a non-payer's share as paid back (or undo). Payer never gets tracked here.
   * Caller must be either the target user themselves OR the payer (acting on their behalf).
   */
  async togglePaid(
    id: string, tripId: string, userId: string, paid: boolean, callerId: string,
  ): Promise<Expense> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error('NOT_FOUND');
    if (existing.tripId !== tripId) throw new Error('FORBIDDEN');
    if (userId === existing.payerId) throw new Error('PAYER_CANNOT_BE_MARKED');
    if (!(userId in (existing.splitInfo ?? {}))) throw new Error('NOT_IN_SPLIT');
    // Permission: caller must be the target user OR the payer
    if (callerId !== userId && callerId !== existing.payerId) {
      throw new Error('CALLER_NOT_ALLOWED');
    }
    const next: Record<string, string> = { ...(existing.paidBack ?? {}) };
    if (paid) {
      next[userId] = new Date().toISOString();
    } else {
      delete next[userId];
    }
    return this.repo.update(id, { paidBack: next });
  }

  /**
   * Compute minimal-transfer settlement for a trip.
   * Net balance per user = (sum paid) - (sum owed via splitInfo).
   * Greedy match max creditor with max debtor until everyone is near zero.
   */
  async computeSettlement(tripId: string): Promise<SettlementTransfer[]> {
    const expenses = await this.repo.findByTrip(tripId);
    const balances = new Map<string, number>();

    const add = (userId: string, delta: number): void => {
      balances.set(userId, (balances.get(userId) ?? 0) + delta);
    };

    for (const exp of expenses) {
      // Decimal columns come back as strings from pg; coerce to number.
      const amount = Number(exp.amount);
      add(exp.payerId, amount);
      const split = exp.splitInfo ?? {};
      for (const [userId, share] of Object.entries(split)) {
        add(userId, -Number(share));
      }
    }

    const transfers: SettlementTransfer[] = [];
    const EPS = 0.01;

    // Build mutable sortable arrays
    const entries = Array.from(balances.entries())
      .map(([userId, bal]) => ({ userId, bal: Math.round(bal * 100) / 100 }))
      .filter((e) => Math.abs(e.bal) > EPS);

    while (entries.length > 1) {
      entries.sort((a, b) => a.bal - b.bal); // ascending: most-debtor first
      const debtor = entries[0]!;
      const creditor = entries[entries.length - 1]!;
      if (creditor.bal <= EPS || debtor.bal >= -EPS) break;

      const transfer = Math.min(-debtor.bal, creditor.bal);
      const rounded = Math.round(transfer * 100) / 100;
      transfers.push({ from: debtor.userId, to: creditor.userId, amount: rounded });
      debtor.bal = Math.round((debtor.bal + transfer) * 100) / 100;
      creditor.bal = Math.round((creditor.bal - transfer) * 100) / 100;

      // Remove settled
      if (Math.abs(debtor.bal) <= EPS) entries.shift();
      if (Math.abs(creditor.bal) <= EPS) entries.pop();
    }

    return transfers;
  }
}
