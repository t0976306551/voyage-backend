import { createHmac } from 'crypto';

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function signJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds = 30 * 24 * 60 * 60,
): string {
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresInSeconds;
  const body = b64url(Buffer.from(JSON.stringify({ ...payload, iat, exp })));
  const sig = b64url(createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}
