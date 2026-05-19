import bcrypt from 'bcryptjs';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { UserRepository } from '../../../src/modules/users/user.repository';
import { User } from '../../../src/modules/users/user.entity';

jest.mock('../../../src/modules/users/user.repository');

const MockRepo = UserRepository as jest.MockedClass<typeof UserRepository>;

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    MockRepo.mockClear();
    service = new AuthService(new MockRepo());
    process.env['NEXTAUTH_SECRET'] = 'test-secret-min-32-chars-long!!!';
  });

  describe('register', () => {
    it('throws EMAIL_TAKEN if email already exists', async () => {
      MockRepo.prototype.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com' } as User);
      await expect(service.register('a@b.com', 'password123', 'Alice')).rejects.toThrow('EMAIL_TAKEN');
    });

    it('creates user and returns token + user', async () => {
      MockRepo.prototype.findByEmail.mockResolvedValue(null);
      MockRepo.prototype.create.mockResolvedValue({
        id: 'u1', email: 'a@b.com', name: 'Alice',
        passwordHash: 'hash', emailVerified: false, authProviders: ['credentials'],
      } as User);

      const result = await service.register('a@b.com', 'password123', 'Alice');
      expect(result.user.email).toBe('a@b.com');
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.split('.').length).toBe(3);
    });

    it('stores bcrypt hash, not plaintext', async () => {
      MockRepo.prototype.findByEmail.mockResolvedValue(null);
      let storedHash = '';
      MockRepo.prototype.create.mockImplementation(async (data) => {
        storedHash = (data as Partial<User>).passwordHash ?? '';
        return { id: 'u1', email: 'a@b.com', name: 'Alice', ...data } as User;
      });

      await service.register('a@b.com', 'password123', 'Alice');
      expect(storedHash).not.toBe('password123');
      expect(await bcrypt.compare('password123', storedHash)).toBe(true);
    });
  });

  describe('login', () => {
    it('throws INVALID_CREDENTIALS if user not found (timing-safe)', async () => {
      const spy = jest.spyOn(bcrypt, 'compare');
      MockRepo.prototype.findByEmail.mockResolvedValue(null);
      await expect(service.login('a@b.com', 'password123')).rejects.toThrow('INVALID_CREDENTIALS');
      expect(spy).toHaveBeenCalledWith('password123', expect.stringMatching(/^\$2b\$12\$/));
      spy.mockRestore();
    });

    it('throws EMAIL_GOOGLE_ONLY if passwordHash is null', async () => {
      MockRepo.prototype.findByEmail.mockResolvedValue({
        id: 'u1', email: 'a@b.com', passwordHash: null, authProviders: ['google'],
      } as User);
      await expect(service.login('a@b.com', 'password123')).rejects.toThrow('EMAIL_GOOGLE_ONLY');
    });

    it('runs dummy bcrypt compare when email is Google-only', async () => {
      const spy = jest.spyOn(bcrypt, 'compare');
      MockRepo.prototype.findByEmail.mockResolvedValue({
        id: 'u1', email: 'a@b.com', passwordHash: null, authProviders: ['google'],
      } as User);
      await expect(service.login('a@b.com', 'password123')).rejects.toThrow('EMAIL_GOOGLE_ONLY');
      expect(spy).toHaveBeenCalledWith('password123', expect.stringMatching(/^\$2b\$12\$/));
      spy.mockRestore();
    });

    it('throws INVALID_CREDENTIALS on wrong password', async () => {
      const hash = await bcrypt.hash('correctpassword', 12);
      MockRepo.prototype.findByEmail.mockResolvedValue({
        id: 'u1', email: 'a@b.com', name: 'Alice', passwordHash: hash, authProviders: ['credentials'],
      } as User);
      await expect(service.login('a@b.com', 'wrongpassword')).rejects.toThrow('INVALID_CREDENTIALS');
    });

    it('returns token + user on valid credentials', async () => {
      const hash = await bcrypt.hash('password123', 12);
      MockRepo.prototype.findByEmail.mockResolvedValue({
        id: 'u1', email: 'a@b.com', name: 'Alice', passwordHash: hash, authProviders: ['credentials'],
      } as User);

      const result = await service.login('a@b.com', 'password123');
      expect(result.user.email).toBe('a@b.com');
      expect(result.token.split('.').length).toBe(3);
    });
  });
});
