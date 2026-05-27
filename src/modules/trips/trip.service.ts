import { randomBytes } from 'crypto';
import { In } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { User } from '../users/user.entity';
import { Trip, TripMember, CollaboratorPermissions, DEFAULT_COLLABORATOR_PERMISSIONS } from './trip.entity';
import { TripRepository, ListOpts } from './trip.repository';
import { InvitationHistoryRepository } from '../invitation-history/invitation-history.repository';
import { ExpensesRepository } from '../expenses/expenses.repository';
import { TasksRepository } from '../tasks/tasks.repository';
import { ChecklistsRepository } from '../checklists/checklists.repository';
import { Task } from '../tasks/task.entity';
import { ChecklistAssignment } from '../checklists/checklist-assignment.entity';
import { ChecklistItem } from '../checklists/checklist-item.entity';
import { Expense } from '../expenses/expense.entity';
import { PersonalRepository } from '../personal/personal.repository';
import { PersonalMemo } from '../personal/personal-memo.entity';
import { PersonalMemoItem } from '../personal/personal-memo-item.entity';
import { PersonalExpense } from '../personal/personal-expense.entity';
import { Itinerary } from '../itinerary/itinerary.entity';
import { TripInvitation } from '../invitations/invitation.entity';

const invitationHistoryRepo = new InvitationHistoryRepository();
const expensesRepo = new ExpensesRepository();
const tasksRepo = new TasksRepository();
const checklistsRepo = new ChecklistsRepository();
const personalRepo = new PersonalRepository();

/** Best-effort upsert — never throw to the caller (write to Owner's history). */
async function trackOwnerHistory(trip: { members: TripMember[] }, joinedUserId: string): Promise<void> {
  const owner = trip.members.find((m) => m.role === 'Owner');
  if (!owner || owner.userId === joinedUserId) return;
  try {
    await invitationHistoryRepo.upsert(owner.userId, joinedUserId);
  } catch (e) {
    console.error('[trip.service] track owner history failed', e instanceof Error ? e.message : e);
  }
}

function generateInviteCode(): string {
  return randomBytes(6).toString('hex').toUpperCase();
}

interface HydratedMember extends TripMember {
  name: string;
  email: string;
  avatar: string | null;
}

export interface HydratedTrip extends Omit<Trip, 'members'> {
  members: HydratedMember[];
}

export interface TripPreview {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  ownerName: string;
  memberCount: number;
}

interface UnsettledDebt {
  expenseId: string;
  description: string | null;
  amount: number;
  currency: string;
  payerName: string;
}

export interface LeavePreview {
  targetUserId: string;
  targetName: string;
  isSelf: boolean;
  canRemove: boolean;
  blockReason?: 'UNSETTLED_DEBTS';
  unsettledDebts: UnsettledDebt[];
  assignedTasks: Array<{ id: string; title: string }>;
  assignedChecklists: Array<{ id: string; title: string }>;
  createdContent: {
    itineraryItems: number;
    checklists: number;
    expensesPaidByThem: number;
  };
  personalData: {
    memos: number;
    expenses: number;
  };
}

async function hydrateMembers(trip: Trip): Promise<HydratedTrip> {
  const ids = trip.members.map((m) => m.userId);
  if (ids.length === 0) return { ...trip, members: [] };
  const users = await AppDataSource.getRepository(User).find({
    where: { id: In(ids) },
    select: ['id', 'name', 'email', 'avatar'],
  });
  const userMap = new Map(users.map((u) => [u.id, u]));
  return {
    ...trip,
    members: trip.members.map((m) => {
      const u = userMap.get(m.userId);
      return {
        ...m,
        name: u?.name || u?.email?.split('@')[0] || 'Unknown',
        email: u?.email ?? '',
        avatar: u?.avatar ?? null,
      };
    }),
  };
}

interface CreateTripDto {
  title: string;
  startDate?: string;
  endDate?: string;
  coverImage?: string;
}

interface UpdateTripDto {
  title?: string;
  startDate?: string;
  endDate?: string;
  coverImage?: string;
  collaboratorPermissions?: CollaboratorPermissions;
}

export class TripService {
  constructor(private repo: TripRepository) {}

  async createTrip(dto: CreateTripDto, userId: string): Promise<Trip> {
    return this.repo.create({
      ...dto,
      inviteCode: generateInviteCode(),
      members: [{ userId, role: 'Owner' }],
    });
  }

  async getMyTrips(userId: string): Promise<HydratedTrip[]> {
    const trips = await this.repo.findByUserId(userId);
    return Promise.all(trips.map((t) => hydrateMembers(t)));
  }

  async getMyTripsPaginated(
    userId: string,
    opts: ListOpts,
  ): Promise<{
    items: HydratedTrip[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Math.floor(opts.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Math.floor(opts.pageSize) || 10));

    const [trips, total] = await this.repo.findByUserIdPaginated(userId, { ...opts, page, pageSize });
    const items = await Promise.all(trips.map((t) => hydrateMembers(t)));
    const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

    return { items, total, page, pageSize, totalPages };
  }

  async getTripById(tripId: string, userId: string): Promise<HydratedTrip> {
    const trip = await this.repo.findById(tripId);
    if (!trip) throw new Error('NOT_FOUND');

    const isMember = trip.members.some((m) => m.userId === userId);
    if (!isMember) throw new Error('FORBIDDEN');

    return hydrateMembers(trip);
  }

  async updateTrip(tripId: string, dto: UpdateTripDto, userId: string): Promise<HydratedTrip> {
    const trip = await this.getTripById(tripId, userId);
    const member = trip.members.find((m) => m.userId === userId);
    if (!['Owner', 'Editor'].includes(member?.role ?? '')) throw new Error('FORBIDDEN');

    const updated = await this.repo.update(tripId, dto);
    return hydrateMembers(updated);
  }

  async setEnabledModules(
    tripId: string,
    patch: Partial<{ tasks: boolean; expenses: boolean; checklists: boolean }>,
  ): Promise<HydratedTrip> {
    const trip = await this.repo.findById(tripId);
    if (!trip) throw new Error('NOT_FOUND');
    const merged = { ...trip.enabledModules, ...patch };
    const updated = await this.repo.update(tripId, { enabledModules: merged });
    return hydrateMembers(updated);
  }

  async setCollaboratorPermissions(
    tripId: string,
    patch: Partial<CollaboratorPermissions>,
  ): Promise<HydratedTrip> {
    const trip = await this.repo.findById(tripId);
    if (!trip) throw new Error('NOT_FOUND');
    const current = trip.collaboratorPermissions ?? DEFAULT_COLLABORATOR_PERMISSIONS;
    const merged = { ...current, ...patch };
    const updated = await this.repo.update(tripId, { collaboratorPermissions: merged });
    return hydrateMembers(updated);
  }

  async joinByInviteCode(code: string, userId: string): Promise<Trip> {
    const trip = await this.repo.findByInviteCode(code);
    if (!trip) throw new Error('NOT_FOUND');

    const alreadyMember = trip.members.some((m) => m.userId === userId);
    if (alreadyMember) return trip;

    const updatedMembers = [...trip.members, { userId, role: 'Editor' as const }];
    const updated = await this.repo.update(trip.id, { members: updatedMembers });
    await trackOwnerHistory(updated, userId);
    return updated;
  }

  async removeMember(tripId: string, targetUserId: string): Promise<HydratedTrip> {
    await this._removeMemberWithCleanup(tripId, targetUserId, false);
    const reloaded = await this.repo.findById(tripId);
    if (!reloaded) throw new Error('NOT_FOUND');
    return hydrateMembers(reloaded);
  }

  async leaveTrip(tripId: string, userId: string): Promise<void> {
    await this._removeMemberWithCleanup(tripId, userId, true);
  }

  /**
   * Compute the impact of removing a member from a trip (self-leave or kick).
   * Caller-permission validation is done by the controller/middleware.
   */
  async getLeavePreview(tripId: string, targetUserId: string, callerUserId: string): Promise<LeavePreview> {
    const trip = await this.repo.findById(tripId);
    if (!trip) throw new Error('NOT_FOUND');

    const target = trip.members.find((m) => m.userId === targetUserId);
    if (!target) throw new Error('NOT_MEMBER');
    if (target.role === 'Owner') {
      throw new Error(targetUserId === callerUserId ? 'CANNOT_LEAVE_AS_OWNER' : 'CANNOT_KICK_OWNER');
    }

    // Hydrate user names for target + payers
    const debts = await expensesRepo.findUnsettledByDebtor(tripId, targetUserId);
    const payerIds = Array.from(new Set(debts.map((d) => d.payerId)));
    const userIdsToLoad = Array.from(new Set([targetUserId, ...payerIds]));
    const users = await AppDataSource.getRepository(User).find({
      where: { id: In(userIdsToLoad) },
      select: ['id', 'name', 'email'],
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    const targetUser = userMap.get(targetUserId);
    const targetName = targetUser?.name || targetUser?.email?.split('@')[0] || 'Unknown';

    const unsettledDebts: UnsettledDebt[] = debts.map((e) => {
      const payer = userMap.get(e.payerId);
      const payerName = payer?.name || payer?.email?.split('@')[0] || 'Unknown';
      const owed = Number(e.splitInfo?.[targetUserId] ?? 0);
      return {
        expenseId: e.id,
        description: e.description ?? null,
        amount: owed,
        currency: e.currency,
        payerName,
      };
    });

    const assignedTasksRaw = await tasksRepo.findAssignedToUser(tripId, targetUserId);
    const assignedTasks = assignedTasksRaw.map((t) => ({ id: t.id, title: t.title }));

    const assignedChecklists = await checklistsRepo.findAssignmentsForUser(tripId, targetUserId);

    // createdContent counts
    const itineraryItems = 0; // itinerary entity does not track creator
    const checklistsCount = await AppDataSource.getRepository(ChecklistItem).count({
      where: { tripId, createdById: targetUserId },
    });
    const expensesPaidByThem = await AppDataSource.getRepository(Expense).count({
      where: { tripId, payerId: targetUserId },
    });

    const personalCounts = await personalRepo.countMemosByUser(tripId, targetUserId)
      .then(async (memos) => ({
        memos,
        expenses: await personalRepo.countExpensesByUser(tripId, targetUserId),
      }));

    const canRemove = unsettledDebts.length === 0;
    const result: LeavePreview = {
      targetUserId,
      targetName,
      isSelf: targetUserId === callerUserId,
      canRemove,
      unsettledDebts,
      assignedTasks,
      assignedChecklists,
      createdContent: {
        itineraryItems,
        checklists: checklistsCount,
        expensesPaidByThem,
      },
      personalData: personalCounts,
    };
    if (!canRemove) result.blockReason = 'UNSETTLED_DEBTS';
    return result;
  }

  private async _removeMemberWithCleanup(
    tripId: string,
    targetUserId: string,
    isSelf: boolean,
  ): Promise<void> {
    const trip = await this.repo.findById(tripId);
    if (!trip) throw new Error('NOT_FOUND');

    const target = trip.members.find((m) => m.userId === targetUserId);
    if (!target) throw new Error('NOT_MEMBER');
    if (target.role === 'Owner') {
      throw new Error(isSelf ? 'CANNOT_LEAVE_AS_OWNER' : 'CANNOT_KICK_OWNER');
    }

    const debts = await expensesRepo.findUnsettledByDebtor(tripId, targetUserId);
    if (debts.length > 0) throw new Error('UNSETTLED_DEBTS');

    const nextMembers = trip.members.filter((m) => m.userId !== targetUserId);

    await AppDataSource.transaction(async (manager) => {
      // 1. Unassign tasks
      await manager
        .createQueryBuilder()
        .update(Task)
        .set({ assignedUserId: null as unknown as string })
        .where('trip_id = :tripId AND assigned_user_id = :userId', {
          tripId,
          userId: targetUserId,
        })
        .execute();

      // 2. Delete checklist assignments for items belonging to this trip
      await manager
        .createQueryBuilder()
        .delete()
        .from(ChecklistAssignment)
        .where(
          'user_id = :userId AND item_id IN (SELECT id FROM checklist_items WHERE trip_id = :tripId)',
          { userId: targetUserId, tripId },
        )
        .execute();

      // 3. Delete all personal memos (+ items via repo) and expenses for this user in this trip
      const memos = await manager.find(PersonalMemo, { where: { tripId, userId: targetUserId } });
      if (memos.length > 0) {
        const memoIds = memos.map((m) => m.id);
        await manager.delete(PersonalMemoItem, { memoId: In(memoIds) });
        await manager.delete(PersonalMemo, { tripId, userId: targetUserId });
      }
      await manager.delete(PersonalExpense, { tripId, userId: targetUserId });

      // 4. Remove from trip.members (jsonb)
      await manager.update(Trip, tripId, { members: nextMembers });
    });
  }

  async getTripPreviewByCode(code: string): Promise<TripPreview> {
    const trip = await this.repo.findByInviteCode(code);
    if (!trip) throw new Error('NOT_FOUND');
    return this._buildPreview(trip);
  }

  async getTripPreviewById(tripId: string): Promise<TripPreview> {
    const trip = await this.repo.findById(tripId);
    if (!trip) throw new Error('NOT_FOUND');
    return this._buildPreview(trip);
  }

  async joinByTripId(tripId: string, userId: string): Promise<HydratedTrip> {
    const trip = await this.repo.findById(tripId);
    if (!trip) throw new Error('NOT_FOUND');

    const alreadyMember = trip.members.some((m) => m.userId === userId);
    if (alreadyMember) return hydrateMembers(trip);

    const updatedMembers = [...trip.members, { userId, role: 'Editor' as const }];
    const updated = await this.repo.update(tripId, { members: updatedMembers });
    await trackOwnerHistory(updated, userId);
    return hydrateMembers(updated);
  }

  private async _buildPreview(trip: Trip): Promise<TripPreview> {
    const ownerMember = trip.members.find((m) => m.role === 'Owner');
    let ownerName = '未知';
    if (ownerMember) {
      const users = await AppDataSource.getRepository(User).find({
        where: { id: ownerMember.userId },
        select: ['name', 'email'],
      });
      const owner = users[0];
      ownerName = owner?.name || owner?.email?.split('@')[0] || '未知';
    }
    return {
      id: trip.id,
      title: trip.title,
      startDate: trip.startDate ?? undefined,
      endDate: trip.endDate ?? undefined,
      ownerName,
      memberCount: trip.members.length,
    };
  }

  async deleteTrip(tripId: string): Promise<string[]> {
    const trip = await this.repo.findById(tripId);
    if (!trip) throw new Error('NOT_FOUND');
    const memberIds = trip.members.map((m) => m.userId);

    await AppDataSource.transaction(async (manager) => {
      // 1. 清單分配記錄（FK: item_id → checklist_items.id，必須先刪）
      await manager
        .createQueryBuilder()
        .delete()
        .from(ChecklistAssignment)
        .where(
          'item_id IN (SELECT id FROM checklist_items WHERE trip_id = :tripId)',
          { tripId },
        )
        .execute();

      // 2. 清單項目
      await manager.delete(ChecklistItem, { tripId });

      // 3. 費用（splitInfo 是 jsonb，無獨立子表）
      await manager.delete(Expense, { tripId });

      // 4. 待辦
      await manager.delete(Task, { tripId });

      // 5. 行程景點
      await manager.delete(Itinerary, { tripId });

      // 6. 個人費用
      await manager.delete(PersonalExpense, { tripId });

      // 7. 個人備忘 items（FK: memo_id → personal_memos.id，必須先刪）
      const memos = await manager.find(PersonalMemo, { where: { tripId } });
      if (memos.length > 0) {
        await manager.delete(PersonalMemoItem, { memoId: In(memos.map((m) => m.id)) });
      }

      // 8. 個人備忘
      await manager.delete(PersonalMemo, { tripId });

      // 9. 邀請記錄
      await manager.delete(TripInvitation, { tripId });

      // 10. 行程本體
      await manager.delete(Trip, { id: tripId });
    });

    return memberIds;
  }
}
