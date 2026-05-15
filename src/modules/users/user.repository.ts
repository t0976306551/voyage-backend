import { AppDataSource } from '../../data-source';
import { User } from './user.entity';

export class UserRepository {
  private get repo() {
    return AppDataSource.getRepository(User);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByHandle(handle: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.handle) = LOWER(:handle)', { handle })
      .getOne();
  }

  async create(data: Partial<User>): Promise<User> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.repo.update(id, data);
    return this.repo.findOneOrFail({ where: { id } });
  }
}
