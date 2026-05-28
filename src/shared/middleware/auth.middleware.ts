import { Request, Response, NextFunction } from 'express';
import { fail } from '../types/response.types';
import { verifyHS256 } from '../utils/jwt.utils';
import { AppDataSource } from '../../data-source';
import { User } from '../../modules/users/user.entity';

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

    // Revocation check: compare token iat against user's token_revoked_before.
    // Only runs when DB is connected (skipped in unit-test env without DB).
    // Users not in the DB (ghost/test actors) are allowed through — downstream
    // middleware (requireTripRole) handles membership enforcement.
    if (AppDataSource.isInitialized) {
      const user = await AppDataSource.getRepository(User).findOne({
        where: { id: sub },
        select: ['id', 'tokenRevokedBefore'],
      });
      if (user?.tokenRevokedBefore) {
        const iat = typeof payload['iat'] === 'number' ? payload['iat'] : null;
        const revokedEpochSec = Math.floor(user.tokenRevokedBefore.getTime() / 1000);
        // Token issued before (or at) revocation time → rejected
        if (iat === null || iat <= revokedEpochSec) {
          res.status(401).json(fail('TOKEN_REVOKED', 'Token has been revoked'));
          return;
        }
      }
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
