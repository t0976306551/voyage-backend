import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { UserRepository } from '../users/user.repository';
import { ok, fail } from '../../shared/types/response.types';

const service = new AuthService(new UserRepository());

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
  if (!email.includes('@')) {
    res.status(422).json(fail('VALIDATION_ERROR', '請輸入有效的 Email'));
    return;
  }
  if (password.length < 8) {
    res.status(422).json(fail('VALIDATION_ERROR', '密碼至少 8 個字元'));
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

  try {
    const result = await service.login(email.trim().toLowerCase(), password);
    res.json(ok(result));
  } catch (e: unknown) {
    const code = e instanceof Error ? e.message : 'INTERNAL';
    res.status(ERROR_STATUS[code] ?? 500).json(fail(code, ERROR_MSG[code] ?? '伺服器錯誤'));
  }
}
