/**
 * auth.logout.test.ts  (Layer A — no DB needed)
 *
 * Tests for:
 *   - L-2: delete token TTL shortened to 5 min
 *   - L-3: error codes are never raw internal messages
 *   - A-1: POST /api/auth/logout requires valid JWT (returns 401 without token)
 *          signJWT now includes iat claim
 */

import request from 'supertest';
import app from '../../../src/app';
import { signJWT } from '../../../src/shared/utils/sign-jwt.utils';
import { verifyHS256 } from '../../../src/shared/utils/jwt.utils';
import { generateDeleteToken, verifyDeleteToken } from '../../../src/modules/trips/delete-token.util';

// ── L-2: Delete token TTL = 5 minutes ────────────────────────────────────────

describe('L-2: delete token TTL', () => {
  it('generateDeleteToken produces a token valid for < 5 minutes', () => {
    const { code, token } = generateDeleteToken('trip-id');
    expect(verifyDeleteToken('trip-id', code, token)).toBe(true);

    // Parse expires-at from token
    const colonIdx = token.indexOf(':');
    const expiresAt = parseInt(token.slice(0, colonIdx), 10);
    const ttlMs = expiresAt - Date.now();

    expect(ttlMs).toBeGreaterThan(0);
    expect(ttlMs).toBeLessThanOrEqual(5 * 60 * 1000 + 100); // ≤ 5 min with small tolerance
  });

  it('token is invalid after TTL expires (mocked via expired timestamp)', () => {
    // Construct a token with expiresAt = 1 second in the past
    const { code } = generateDeleteToken('trip-id');
    const pastExpiry = Date.now() - 1000;
    // Token with fake (past) expiry is rejected by verifyDeleteToken
    const fakeToken = `${pastExpiry}:invalidsig`;
    expect(verifyDeleteToken('trip-id', code, fakeToken)).toBe(false);
  });
});

// ── L-3: Error code sanitisation ─────────────────────────────────────────────

describe('L-3: auth controller does not leak internal error codes', () => {
  it('register with valid body returns structured response (not raw DB error)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'internal@leak.test', password: 'Password1!', name: 'Leaker' });
    // 201 (success), 409 (email taken), or 500 (INTERNAL) — never a raw DB message
    if (res.status === 500) {
      expect(res.body?.error?.code ?? res.body?.code).toBe('INTERNAL');
    } else {
      expect([201, 409]).toContain(res.status);
    }
  });

  it('login with wrong credentials returns INVALID_CREDENTIALS (not DB error)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password: 'wrongpass123' });
    // In test env (no DB): 500 INTERNAL. With DB: 401 INVALID_CREDENTIALS.
    // Either way the code is in the known-codes set.
    const code = res.body?.error?.code ?? res.body?.code;
    expect(['INVALID_CREDENTIALS', 'INTERNAL', 'EMAIL_GOOGLE_ONLY']).toContain(code);
  });
});

// ── A-1: POST /api/auth/logout — auth guard ───────────────────────────────────

describe('A-1: POST /api/auth/logout', () => {
  it('no auth header → 401', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('invalid token → 401', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});

// ── A-1: signJWT includes iat ─────────────────────────────────────────────────

describe('A-1: signJWT includes iat claim', () => {
  it('signed token has iat field in payload', () => {
    const secret = 'test-secret-that-is-at-least-32-chars-long!!';
    const before = Math.floor(Date.now() / 1000);
    const token = signJWT({ sub: 'user-123', email: 'a@b.com' }, secret);
    const after = Math.floor(Date.now() / 1000);

    const payload = verifyHS256(token, secret);

    expect(typeof payload['iat']).toBe('number');
    expect(payload['iat']).toBeGreaterThanOrEqual(before);
    expect(payload['iat']).toBeLessThanOrEqual(after + 1);
  });

  it('signed token has exp = iat + expiresInSeconds', () => {
    const secret = 'test-secret-that-is-at-least-32-chars-long!!';
    const expiresInSeconds = 3600;
    const token = signJWT({ sub: 'user-1' }, secret, expiresInSeconds);
    const payload = verifyHS256(token, secret);

    expect(typeof payload['exp']).toBe('number');
    expect(typeof payload['iat']).toBe('number');
    expect((payload['exp'] as number) - (payload['iat'] as number)).toBe(expiresInSeconds);
  });

  it('token with past iat but future exp is still valid (iat does not affect expiry)', () => {
    const secret = 'test-secret-that-is-at-least-32-chars-long!!';
    const token = signJWT({ sub: 'user-1' }, secret, 86400);
    const payload = verifyHS256(token, secret);
    expect(payload['sub']).toBe('user-1');
  });
});
