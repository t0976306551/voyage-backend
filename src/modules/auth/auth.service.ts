import bcrypt from 'bcryptjs';
import { UserRepository } from '../users/user.repository';
import { signJWT } from '../../shared/utils/sign-jwt.utils';

// Generate once at module load so bcryptjs will always see a structurally valid hash
const DUMMY_HASH = bcrypt.hashSync('dummy-never-used', 12);

interface AuthResult {
  token: string;
  user: { id: string; email: string; name: string };
}

export class AuthService {
  constructor(private repo: UserRepository) {}

  async register(email: string, password: string, name: string): Promise<AuthResult> {
    const existing = await this.repo.findByEmail(email);
    if (existing) throw new Error('EMAIL_TAKEN');

    const passwordHash = await bcrypt.hash(password, 12);

    // Generate unique handle
    let handle: string;
    do {
      handle = this.generateHandle();
    } while (await this.repo.findByHandle(handle));

    const user = await this.repo.create({
      email,
      name,
      handle,
      passwordHash,
      emailVerified: false,
      authProviders: ['credentials'],
    });

    const secret = process.env['NEXTAUTH_SECRET'];
    if (!secret) throw new Error('MISSING_SECRET');
    const token = signJWT({ sub: user.id, email: user.email, name: user.name }, secret);
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  }

  private generateHandle(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const suffix = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * 36)]).join('');
    return `vs_${suffix}`;
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.repo.findByEmail(email);

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      throw new Error('INVALID_CREDENTIALS');
    }

    if (!user.passwordHash) {
      await bcrypt.compare(password, DUMMY_HASH); // timing safety
      throw new Error('EMAIL_GOOGLE_ONLY');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('INVALID_CREDENTIALS');

    const secret = process.env['NEXTAUTH_SECRET'];
    if (!secret) throw new Error('MISSING_SECRET');
    const token = signJWT({ sub: user.id, email: user.email, name: user.name }, secret);
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  }
}
