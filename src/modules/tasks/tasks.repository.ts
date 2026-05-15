import { AppDataSource } from '../../data-source';
import { Task } from './task.entity';

export class TasksRepository {
  private get repo() {
    return AppDataSource.getRepository(Task);
  }

  async create(data: Partial<Task>): Promise<Task> {
    return this.repo.save(this.repo.create(data));
  }

  async findByTrip(tripId: string): Promise<Task[]> {
    // dueDate ASC NULLS LAST → status → createdAt
    return this.repo
      .createQueryBuilder('task')
      .where('task.trip_id = :tripId', { tripId })
      .orderBy('task.due_date', 'ASC', 'NULLS LAST')
      .addOrderBy('task.status', 'ASC')
      .addOrderBy('task.created_at', 'ASC')
      .getMany();
  }

  async findById(id: string): Promise<Task | null> {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: string, data: Partial<Task>): Promise<Task> {
    await this.repo.update(id, data);
    return this.repo.findOneOrFail({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
