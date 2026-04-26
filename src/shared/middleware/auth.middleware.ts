import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { fail } from '../types/response.types';

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padding), 'base64');
}

function verifyHS256(token: string, secret: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT structure');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;

  const expectedSig = createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64url');

  const expectedBuf = Buffer.from(expectedSig);
  const actualBuf = Buffer.from(signatureB64);

  if (
    expectedBuf.length !== actualBuf.length ||
    !timingSafeEqual(expectedBuf, actualBuf)
  ) {
    throw new Error('Invalid signature');
  }

  const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8')) as Record<string, unknown>;

  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}

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

  const token = authHeader.slice(7);

  try {
    const secret = process.env.NEXTAUTH_SECRET ?? '';
    const payload = verifyHS256(token, secret);

    req.user = {
      id: payload.sub as string,
      email: payload['email'] as string,
      name: payload['name'] as string | undefined,
    };

    next();
  } catch {
    res.status(401).json(fail('UNAUTHORIZED', 'Invalid or expired token'));
  }
}
