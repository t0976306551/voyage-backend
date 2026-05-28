import { Task, TaskCategory, TaskStatus } from './task.entity';
import { TasksRepository } from './tasks.repository';

export interface CreateTaskDto {
  tripId: string;
  title: string;
  category?: TaskCategory;
  status?: TaskStatus;
  assignedUserId?: string;
  dueDate?: string | null;
  notes?: string | null;
}

export interface UpdateTaskDto {
  title?: string;
  category?: TaskCategory;
  status?: TaskStatus;
  assignedUserId?: string | null;
  dueDate?: string | null;
  notes?: string | null;
}

export class TasksService {
  constructor(private repo: TasksRepository) {}

  async listByTrip(tripId: string): Promise<Task[]> {
    return this.repo.findByTrip(tripId);
  }

  async create(dto: CreateTaskDto): Promise<Task> {
    const data: Partial<Task> = {
      tripId: dto.tripId,
      title: dto.title,
      category: dto.category ?? 'general',
      status: dto.status ?? 'todo',
    };
    if (dto.assignedUserId !== undefined) data.assignedUserId = dto.assignedUserId;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ?? undefined;
    if (dto.notes !== undefined) data.notes = dto.notes;
    return this.repo.create(data);
  }

  async update(id: string, tripId: string, dto: UpdateTaskDto): Promise<Task> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error('NOT_FOUND');
    if (existing.tripId !== tripId) throw new Error('FORBIDDEN');
    return this.repo.update(id, dto as Partial<Task>);
  }

  async delete(id: string, tripId: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error('NOT_FOUND');
    if (existing.tripId !== tripId) throw new Error('FORBIDDEN');
    return this.repo.delete(id);
  }
}
