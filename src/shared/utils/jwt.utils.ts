import { createHmac, timingSafeEqual } from 'crypto';

function base64UrlDecode(input: string): Buffer {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

export function verifyHS256(token: string, secret: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');

  const [headerB64, payloadB64, signatureB64] = parts;

  const headerJson = base64UrlDecode(headerB64).toString('utf8');
  const header = JSON.parse(headerJson) as Record<string, unknown>;
  if (header['alg'] !== 'HS256') throw new Error('Unsupported algorithm');

  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64url');

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

  if (typeof payload['exp'] === 'number' && payload['exp'] < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}
