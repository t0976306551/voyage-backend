import { ChecklistsRepository, ChecklistItemWithAssignments } from './checklists.repository';
import { TripRepository } from '../trips/trip.repository';

export interface CreateChecklistItemDto {
  tripId: string;
  title: string;
  notes?: string | null;
  assigneeIds?: string[];
  createdById: string;
}

export interface UpdateChecklistItemDto {
  title?: string;
  notes?: string | null;
  assigneeIds?: string[];
}

export interface ChecklistItemDto {
  id: string;
  tripId: string;
  title: string;
  notes: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  assignees: Array<{ userId: string; completedAt: Date | null }>;
  progress: { done: number; total: number };
}

function toDto(item: ChecklistItemWithAssignments): ChecklistItemDto {
  const assignees = item.assignments.map((a) => ({
    userId: a.userId,
    completedAt: a.completedAt,
  }));
  return {
    id: item.id,
    tripId: item.tripId,
    title: item.title,
    notes: item.notes,
    createdById: item.createdById,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    assignees,
    progress: {
      done: assignees.filter((a) => a.completedAt !== null).length,
      total: assignees.length,
    },
  };
}

export class ChecklistsService {
  constructor(
    private repo: ChecklistsRepository,
    private tripRepo: TripRepository,
  ) {}

  async listByTrip(tripId: string): Promise<ChecklistItemDto[]> {
    const items = await this.repo.listByTrip(tripId);
    return items.map(toDto);
  }

  async create(dto: CreateChecklistItemDto): Promise<ChecklistItemDto> {
    if (!dto.title?.trim()) throw new Error('INVALID_TITLE');
    const trip = await this.tripRepo.findById(dto.tripId);
    if (!trip) throw new Error('TRIP_NOT_FOUND');
    const memberIds = new Set(trip.members.map((m) => m.userId));
    const assigneeIds = (dto.assigneeIds ?? []).filter((id) => memberIds.has(id));
    const item = await this.repo.createItem({
      tripId: dto.tripId,
      title: dto.title.trim(),
      notes: dto.notes ?? null,
      createdById: dto.createdById,
    });
    if (assigneeIds.length > 0) {
      await this.repo.assignUsers(item.id, assigneeIds);
    }
    const items = await this.repo.listByTrip(dto.tripId);
    const created = items.find((i) => i.id === item.id);
    if (!created) throw new Error('INTERNAL');
    return toDto(created);
  }

  private async memberRole(tripId: string, userId: string): Promise<string | null> {
    const trip = await this.tripRepo.findById(tripId);
    if (!trip) return null;
    return trip.members.find((m) => m.userId === userId)?.role ?? null;
  }

  async update(itemId: string, tripId: string, dto: UpdateChecklistItemDto, actorId: string): Promise<ChecklistItemDto> {
    const existing = await this.repo.findItem(itemId);
    if (!existing) throw new Error('NOT_FOUND');
    if (existing.tripId !== tripId) throw new Error('FORBIDDEN');
    const role = await this.memberRole(tripId, actorId);
    const canUpdate = existing.createdById === actorId || role === 'Owner' || role === 'Editor';
    if (!canUpdate) throw new Error('FORBIDDEN');

    const patch: { title?: string; notes?: string | null } = {};
    if (dto.title !== undefined) {
      if (typeof dto.title !== 'string' || !dto.title.trim()) throw new Error('INVALID_TITLE');
      patch.title = dto.title.trim();
    }
    if (dto.notes !== undefined) {
      patch.notes = dto.notes;
    }
    if (Object.keys(patch).length > 0) {
      await this.repo.updateItem(itemId, patch);
    }
    if (dto.assigneeIds !== undefined) {
      const trip = await this.tripRepo.findById(tripId);
      if (!trip) throw new Error('TRIP_NOT_FOUND');
      const memberIds = new Set(trip.members.map((m) => m.userId));
      const valid = dto.assigneeIds.filter((id) => memberIds.has(id));
      await this.repo.replaceAssignments(itemId, valid);
    }
    const items = await this.repo.listByTrip(tripId);
    const updated = items.find((i) => i.id === itemId);
    if (!updated) throw new Error('INTERNAL');
    return toDto(updated);
  }

  async delete(itemId: string, tripId: string, actorId: string): Promise<void> {
    const existing = await this.repo.findItem(itemId);
    if (!existing) throw new Error('NOT_FOUND');
    if (existing.tripId !== tripId) throw new Error('FORBIDDEN');
    const role = await this.memberRole(tripId, actorId);
    const canDelete = existing.createdById === actorId || role === 'Owner';
    if (!canDelete) throw new Error('FORBIDDEN');
    await this.repo.deleteItem(itemId);
  }

  async toggleCompletion(itemId: string, tripId: string, userId: string, completed: boolean): Promise<{ itemId: string; userId: string; completedAt: Date | null }> {
    const existing = await this.repo.findItem(itemId);
    if (!existing) throw new Error('NOT_FOUND');
    if (existing.tripId !== tripId) throw new Error('FORBIDDEN');
    const assignment = await this.repo.findAssignment(itemId, userId);
    if (!assignment) throw new Error('NOT_ASSIGNED');
    const updated = await this.repo.setCompletion(itemId, userId, completed);
    return { itemId, userId, completedAt: updated.completedAt };
  }
}
