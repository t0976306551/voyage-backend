import bcrypt from 'bcryptjs';
import { QueryFailedError } from 'typeorm';
import { UserRepository } from '../users/user.repository';
import { signJWT } from '../../shared/utils/sign-jwt.utils';

// Generate once at module load so bcryptjs will always see a structurally valid hash
const DUMMY_HASH = bcrypt.hashSync('dummy-never-used', 12);

interface AuthResult {
  token: string;
  user: { id: string; email: string; name: string };
}

interface OAuthUpsertResult {
  id: string;
  email: string;
  name: string;
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

  async googleUpsert(
    googleId: string,
    email: string,
    name?: string,
    avatar?: string,
  ): Promise<OAuthUpsertResult> {
    // Step 1: 已綁定 googleId 的帳號 → 更新 name/avatar 後返回
    let user = await this.repo.findByGoogleId(googleId);
    if (user) {
      await this.repo.update(user.id, {
        name: name ?? user.name,
        avatar: avatar ?? user.avatar,
      });
      return { id: user.id, email: user.email, name: name ?? user.name };
    }

    // Step 2: 同 email 的 credentials 帳號 → 合併（Set 去重 authProviders）
    user = await this.repo.findByEmail(email);
    if (user) {
      const providers = new Set(user.authProviders);
      providers.add('google');
      const updated = await this.repo.update(user.id, {
        googleId,
        authProviders: Array.from(providers),
        avatar: user.avatar ?? avatar,
        emailVerified: true,
      });
      return { id: updated.id, email: updated.email, name: updated.name };
    }

    // Step 3: 全新 Google 使用者
    let handle: string;
    do {
      handle = this.generateHandle();
    } while (await this.repo.findByHandle(handle));

    try {
      const newUser = await this.repo.create({
        email,
        name: name ?? email.split('@')[0],
        googleId,
        avatar,
        handle,
        emailVerified: true,
        authProviders: ['google'],
        passwordHash: null,
      });
      return { id: newUser.id, email: newUser.email, name: newUser.name };
    } catch (e: unknown) {
      // PG 23505 = unique_violation（email UNIQUE constraint）
      // 使用 QueryFailedError.driverError.code 而非 e.message，避免版本升級後字串格式改變
      const isUniqueViolation =
        e instanceof QueryFailedError &&
        (e.driverError as { code?: string }).code === '23505';

      if (isUniqueViolation) {
        const existing = await this.repo.findByEmail(email);
        // 若 retry 後仍為 null（極端 race），re-throw 避免靜默回傳 undefined
        if (!existing) throw e;
        return { id: existing.id, email: existing.email, name: existing.name };
      }
      throw e;
    }
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
