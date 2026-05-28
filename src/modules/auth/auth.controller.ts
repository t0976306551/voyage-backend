import { Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { AuthService } from './auth.service';
import { UserRepository } from '../users/user.repository';
import { ok, fail } from '../../shared/types/response.types';

const service = new AuthService(new UserRepository());

/**
 * Timing-safe 字串比對，防止 timing attack 爆破 INTERNAL_API_SECRET。
 * 長度不同時直接 return false，不呼叫 timingSafeEqual（要求等長 buffer）。
 */
function safeCompareToken(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const ERROR_STATUS: Record<string, number> = {
  EMAIL_TAKEN: 409,
  EMAIL_GOOGLE_ONLY: 401,
  INVALID_CREDENTIALS: 401,
  MISSING_SECRET: 500,
};

const ERROR_MSG: Record<string, string> = {
  EMAIL_TAKEN: '此 Email 已被使用',
  EMAIL_GOOGLE_ONLY: '請使用 Google 登入',
  INVALID_CREDENTIALS: 'Email 或密碼錯誤',
};

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string };

  if (!email || !password || !name) {
    res.status(422).json(fail('VALIDATION_ERROR', 'email, password, name are required'));
    return;
  }
  if (email.trim().length > 254) {
    res.status(422).json(fail('VALIDATION_ERROR', 'Email 過長（最多 254 字元）'));
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(422).json(fail('VALIDATION_ERROR', '請輸入有效的 Email'));
    return;
  }
  if (password.length < 8) {
    res.status(422).json(fail('VALIDATION_ERROR', '密碼至少 8 個字元'));
    return;
  }
  if (password.length > 128) {
    res.status(422).json(fail('VALIDATION_ERROR', '密碼最多 128 個字元'));
    return;
  }
  if (name.trim().length === 0) {
    res.status(422).json(fail('VALIDATION_ERROR', '請輸入名稱'));
    return;
  }
  if (name.trim().length > 100) {
    res.status(422).json(fail('VALIDATION_ERROR', '名稱最多 100 個字元'));
    return;
  }

  try {
    const result = await service.register(email.trim().toLowerCase(), password, name.trim());
    res.status(201).json(ok(result));
  } catch (e: unknown) {
    const code = e instanceof Error ? e.message : 'INTERNAL';
    res.status(ERROR_STATUS[code] ?? 500).json(fail(code, ERROR_MSG[code] ?? '伺服器錯誤'));
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(422).json(fail('VALIDATION_ERROR', 'email and password are required'));
    return;
  }
  if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(422).json(fail('VALIDATION_ERROR', '請輸入有效的 Email'));
    return;
  }

  try {
    const result = await service.login(email.trim().toLowerCase(), password);
    res.json(ok(result));
  } catch (e: unknown) {
    const code = e instanceof Error ? e.message : 'INTERNAL';
    res.status(ERROR_STATUS[code] ?? 500).json(fail(code, ERROR_MSG[code] ?? '伺服器錯誤'));
  }
}

export async function googleUpsert(req: Request, res: Response): Promise<void> {
  const rawToken = req.headers['x-internal-token'];
  const internalToken = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const expectedToken = process.env['INTERNAL_API_SECRET'];

  if (!expectedToken || !internalToken || !safeCompareToken(internalToken, expectedToken)) {
    res.status(401).json(fail('UNAUTHORIZED', 'Invalid internal token'));
    return;
  }

  const { googleId, email, name, avatar } = req.body as {
    googleId?: string;
    email?: string;
    name?: string;
    avatar?: string;
  };

  if (!googleId || !email) {
    res.status(422).json(fail('VALIDATION_ERROR', 'googleId and email are required'));
    return;
  }
  if (googleId.trim().length > 50) {
    res.status(422).json(fail('VALIDATION_ERROR', 'googleId 過長'));
    return;
  }
  if (email.trim().length > 254) {
    res.status(422).json(fail('VALIDATION_ERROR', 'Email 過長（最多 254 字元）'));
    return;
  }

  const safeAvatar =
    typeof avatar === 'string' && avatar.startsWith('https://')
      ? avatar.slice(0, 500)
      : null;

  try {
    const user = await service.googleUpsert(
      googleId.trim(),
      email.trim().toLowerCase(),
      name?.trim().slice(0, 100),
      safeAvatar ?? undefined,
    );
    res.json(ok({ id: user.id, email: user.email, name: user.name }));
  } catch (e: unknown) {
    const code = e instanceof Error ? e.message : 'INTERNAL';
    res.status(500).json(fail(code, '伺服器錯誤'));
  }
}
