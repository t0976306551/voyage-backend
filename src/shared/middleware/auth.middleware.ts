import { Request, Response, NextFunction } from 'express';
import { fail } from '../types/response.types';
import { verifyHS256 } from '../utils/jwt.utils';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json(fail('UNAUTHORIZED', 'Missing authorization header'));
    return;
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    res.status(500).json(fail('INTERNAL_ERROR', 'Server misconfiguration'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyHS256(token, secret);

    const sub = payload['sub'];
    const email = payload['email'];
    if (typeof sub !== 'string' || typeof email !== 'string') {
      res.status(401).json(fail('UNAUTHORIZED', 'Invalid token claims'));
      return;
    }

    req.user = {
      id: sub,
      email,
      name: typeof payload['name'] === 'string' ? payload['name'] : undefined,
    };

    next();
  } catch {
    res.status(401).json(fail('UNAUTHORIZED', 'Invalid or expired token'));
  }
}
