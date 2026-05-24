import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const SECRET = process.env.DELETE_TOKEN_SECRET ?? 'dev-delete-secret';
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Alphanumeric without visually ambiguous characters (0/O, 1/l/I)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function generateDeleteToken(tripId: string): { code: string; token: string } {
  const code = randomCode();
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const token = buildToken(tripId, code, expiresAt);
  return { code, token };
}

export function verifyDeleteToken(tripId: string, code: string, token: string): boolean {
  const colonIdx = token.indexOf(':');
  if (colonIdx < 0) return false;

  const expiresAtStr = token.slice(0, colonIdx);
  const sig = token.slice(colonIdx + 1);

  const expiresAt = parseInt(expiresAtStr, 10);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expected = buildToken(tripId, code, expiresAt);
  const expectedSig = expected.slice(expected.indexOf(':') + 1);

  try {
    const aBuf = Buffer.from(sig, 'hex');
    const bBuf = Buffer.from(expectedSig, 'hex');
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

function buildToken(tripId: string, code: string, expiresAt: number): string {
  const payload = `${tripId}:${code}:${expiresAt}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${expiresAt}:${sig}`;
}

function randomCode(): string {
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join('');
}
