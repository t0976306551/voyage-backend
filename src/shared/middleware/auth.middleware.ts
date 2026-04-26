import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { fail } from '../types/response.types';

function base64UrlDecode(input: string): Buffer {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function verifyHS256(token: string, secret: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');

  const [headerB64, payloadB64, signatureB64] = parts;

  // C1: Validate algorithm field in header
  const headerJson = base64UrlDecode(headerB64).toString('utf8');
  const header = JSON.parse(headerJson) as Record<string, unknown>;
  if (header['alg'] !== 'HS256') throw new Error('Unsupported algorithm');

  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64url');

  // Use raw bytes for timing-safe comparison
  const expectedBytes = Buffer.from(expectedSig, 'base64url');
  const actualBytes = base64UrlDecode(signatureB64);
  if (
    expectedBytes.length !== actualBytes.length ||
    !timingSafeEqual(expectedBytes, actualBytes)
  ) {
    throw new Error('Invalid signature');
  }

  const payloadJson = base64UrlDecode(payloadB64).toString('utf8');
  const payload = JSON.parse(payloadJson) as Record<string, unknown>;

  // Check expiry
  if (typeof payload['exp'] === 'number' && payload['exp'] < Math.floor(Date.now() / 1000)) {
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

  // C2: Guard against missing NEXTAUTH_SECRET
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    res.status(500).json(fail('INTERNAL_ERROR', 'Server misconfiguration'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyHS256(token, secret);

    // I2: Runtime validation of required claims
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
