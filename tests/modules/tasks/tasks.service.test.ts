import { TasksService } from '../../../src/modules/tasks/tasks.service';
import { TasksRepository } from '../../../src/modules/tasks/tasks.repository';
import { Task } from '../../../src/modules/tasks/task.entity';

jest.mock('../../../src/modules/tasks/tasks.repository');

const MockRepo = TasksRepository as jest.MockedClass<typeof TasksRepository>;

const mkTask = (over: Partial<Task>): Task => ({
  id: 't' + Math.random(),
  tripId: 'trip-1',
  assignedUserId: '',
  title: 'Sample',
  category: 'general',
  status: 'todo',
  dueDate: '',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
} as Task);

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(() => {
    MockRepo.mockClear();
    service = new TasksService(new MockRepo());
  });

  it('create defaults category=general and status=todo', async () => {
    MockRepo.prototype.create.mockImplementation(async (data) => mkTask(data as Partial<Task>));
    const t = await service.create({ tripId: 'trip-1', title: 'Buy SIM' });
    expect(t.category).toBe('general');
    expect(t.status).toBe('todo');
    expect(MockRepo.prototype.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'general', status: 'todo', title: 'Buy SIM' }),
    );
  });

  it('create forwards explicit category/status/assignedUserId', async () => {
    MockRepo.prototype.create.mockImplementation(async (data) => mkTask(data as Partial<Task>));
    await service.create({
      tripId: 'trip-1',
      title: 'Visa',
      category: 'visa',
      status: 'in_progress',
      assignedUserId: 'u9',
    });
    expect(MockRepo.prototype.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'visa', status: 'in_progress', assignedUserId: 'u9' }),
    );
  });

  it('update throws NOT_FOUND when missing', async () => {
    MockRepo.prototype.findById.mockResolvedValue(null);
    await expect(service.update('x', 'trip-1', { status: 'done' })).rejects.toThrow('NOT_FOUND');
  });

  it('update throws FORBIDDEN on wrong trip', async () => {
    MockRepo.prototype.findById.mockResolvedValue(mkTask({ id: 't1', tripId: 'trip-other' }));
    await expect(service.update('t1', 'trip-1', { status: 'done' })).rejects.toThrow('FORBIDDEN');
  });

  it('delete throws FORBIDDEN on wrong trip', async () => {
    MockRepo.prototype.findById.mockResolvedValue(mkTask({ id: 't1', tripId: 'trip-other' }));
    await expect(service.delete('t1', 'trip-1')).rejects.toThrow('FORBIDDEN');
  });
});
