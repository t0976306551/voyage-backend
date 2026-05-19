import { In } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { ChecklistItem } from './checklist-item.entity';
import { ChecklistAssignment } from './checklist-assignment.entity';

export interface ChecklistItemWithAssignments extends ChecklistItem {
  assignments: ChecklistAssignment[];
}

export class ChecklistsRepository {
  private get itemRepo() {
    return AppDataSource.getRepository(ChecklistItem);
  }
  private get assignRepo() {
    return AppDataSource.getRepository(ChecklistAssignment);
  }

  async createItem(data: Pick<ChecklistItem, 'tripId' | 'title' | 'createdById'> & {
    notes?: string | null;
  }): Promise<ChecklistItem> {
    const item = this.itemRepo.create({
      tripId: data.tripId,
      title: data.title,
      createdById: data.createdById,
      notes: data.notes ?? null,
    });
    return this.itemRepo.save(item);
  }

  async assignUsers(itemId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    const rows = userIds.map((userId) => this.assignRepo.create({ itemId, userId }));
    await this.assignRepo.save(rows);
  }

  async replaceAssignments(itemId: string, userIds: string[]): Promise<void> {
    await this.assignRepo.delete({ itemId });
    await this.assignUsers(itemId, userIds);
  }

  async findItem(itemId: string): Promise<ChecklistItem | null> {
    return this.itemRepo.findOne({ where: { id: itemId } });
  }

  async findAssignment(itemId: string, userId: string): Promise<ChecklistAssignment | null> {
    return this.assignRepo.findOne({ where: { itemId, userId } });
  }

  async listByTrip(tripId: string): Promise<ChecklistItemWithAssignments[]> {
    const items = await this.itemRepo.find({
      where: { tripId },
      order: { createdAt: 'DESC' },
    });
    if (items.length === 0) return [];
    const assigns = await this.assignRepo.find({
      where: { itemId: In(items.map((i) => i.id)) },
    });
    const byItem = new Map<string, ChecklistAssignment[]>();
    for (const a of assigns) {
      const arr = byItem.get(a.itemId) ?? [];
      arr.push(a);
      byItem.set(a.itemId, arr);
    }
    return items.map((it) => ({ ...it, assignments: byItem.get(it.id) ?? [] }));
  }

  async updateItem(itemId: string, patch: { title?: string; notes?: string | null }): Promise<ChecklistItem> {
    await this.itemRepo.update(itemId, patch);
    return this.itemRepo.findOneOrFail({ where: { id: itemId } });
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.assignRepo.delete({ itemId });
    await this.itemRepo.delete(itemId);
  }

  async setCompletion(itemId: string, userId: string, completed: boolean): Promise<ChecklistAssignment> {
    const existing = await this.assignRepo.findOne({ where: { itemId, userId } });
    if (!existing) throw new Error('NOT_ASSIGNED');
    existing.completedAt = completed ? new Date() : null;
    return this.assignRepo.save(existing);
  }

  /**
   * Find checklist items in a trip that the given user is assigned to.
   * Joins checklist_items + checklist_assignments.
   */
  async findAssignmentsForUser(
    tripId: string,
    userId: string,
  ): Promise<Array<{ id: string; title: string }>> {
    const rows = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin(
        ChecklistAssignment,
        'a',
        'a.item_id = item.id AND a.user_id = :userId',
        { userId },
      )
      .where('item.trip_id = :tripId', { tripId })
      .orderBy('item.created_at', 'ASC')
      .select(['item.id AS id', 'item.title AS title'])
      .getRawMany<{ id: string; title: string }>();
    return rows;
  }
}
