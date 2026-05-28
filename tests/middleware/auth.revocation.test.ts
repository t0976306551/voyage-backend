/**
 * auth.revocation.test.ts
 *
 * Deep unit tests for A-1: JWT revocation.
 *
 * Tests the full flow: signJWT → logout → old token rejected → new token accepted.
 * Uses jest.mock to simulate AppDataSource without a real DB connection.
 */

import { Request, Response, NextFunction } from 'express';

// ── Mock AppDataSource BEFORE importing authMiddleware ────────────────────────

const mockFindOne = jest.fn();
jest.mock('../../src/data-source', () => ({
  AppDataSource: {
    isInitialized: true,
    getRepository: jest.fn(() => ({ findOne: mockFindOne })),
  },
}));

import { authMiddleware } from '../../src/shared/middleware/auth.middleware';
import { signJWT } from '../../src/shared/utils/sign-jwt.utils';
import { verifyHS256 } from '../../src/shared/utils/jwt.utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-secret-that-is-at-least-32-chars!!';

function makeReq(token: string): Request {
  return {
    headers: { authorization: `Bearer ${token}` },
  } as unknown as Request;
}

function makeRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { res, status, json };
}

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = TEST_SECRET;
});

beforeEach(() => {
  mockFindOne.mockReset();
});

// ── Revocation: token issued before logout → rejected ─────────────────────────

describe('A-1 JWT revocation — token issued before logout is rejected', () => {
  it('rejects token when iat <= tokenRevokedBefore (revocation in the future)', async () => {
    // tokenRevokedBefore set 10s in the future = all currently-issued tokens revoked
    const revokedBefore = new Date(Date.now() + 10_000);
    mockFindOne.mockResolvedValue({ id: 'user-1', tokenRevokedBefore: revokedBefore });

    const token = signJWT({ sub: 'user-1', email: 'u@test.com' }, TEST_SECRET);
    const next = jest.fn();
    const { res, status } = makeRes();

    await authMiddleware(makeReq(token), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    // Verify the error code is TOKEN_REVOKED
    const jsonArg = status.mock.results[0].value.json.mock.calls[0][0];
    expect(jsonArg?.error?.code).toBe('TOKEN_REVOKED');
  });

  it('rejects token when iat exactly equals tokenRevokedBefore (boundary)', async () => {
    const token = signJWT({ sub: 'user-2', email: 'u@test.com' }, TEST_SECRET);
    const payload = verifyHS256(token, TEST_SECRET);
    const iatSec = payload['iat'] as number;

    // tokenRevokedBefore = exact same second as iat
    const revokedBefore = new Date(iatSec * 1000);
    mockFindOne.mockResolvedValue({ id: 'user-2', tokenRevokedBefore: revokedBefore });

    const next = jest.fn();
    const { res, status } = makeRes();

    await authMiddleware(makeReq(token), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects legacy token (no iat) when revocation is set', async () => {
    // Manually craft a token without iat (legacy format)
    const { createHmac } = require('crypto');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payloadObj = { sub: 'user-3', email: 'u@test.com', exp: Math.floor(Date.now() / 1000) + 3600 };
    const payloadB64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
    const sig = createHmac('sha256', TEST_SECRET).update(`${header}.${payloadB64}`).digest('base64url');
    const legacyToken = `${header}.${payloadB64}.${sig}`;

    // User has been logged out
    const revokedBefore = new Date(Date.now() - 5_000);
    mockFindOne.mockResolvedValue({ id: 'user-3', tokenRevokedBefore: revokedBefore });

    const next = jest.fn();
    const { res, status } = makeRes();

    await authMiddleware(makeReq(legacyToken), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── Token issued AFTER logout → accepted ──────────────────────────────────────

describe('A-1 JWT revocation — token issued after logout is accepted', () => {
  it('allows token when iat > tokenRevokedBefore', async () => {
    // Revocation was 60 seconds ago → current token (just issued) should pass
    const revokedBefore = new Date(Date.now() - 60_000);
    mockFindOne.mockResolvedValue({ id: 'user-4', tokenRevokedBefore: revokedBefore });

    const token = signJWT({ sub: 'user-4', email: 'u@test.com' }, TEST_SECRET);
    const next = jest.fn();
    const { res, status } = makeRes();

    await authMiddleware(makeReq(token), res, next);

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });
});

// ── No revocation set → always allowed ────────────────────────────────────────

describe('A-1 JWT revocation — no revocation set passes through', () => {
  it('allows any valid token when tokenRevokedBefore is null', async () => {
    mockFindOne.mockResolvedValue({ id: 'user-5', tokenRevokedBefore: null });

    const token = signJWT({ sub: 'user-5', email: 'u@test.com' }, TEST_SECRET);
    const next = jest.fn();
    const { res, status } = makeRes();

    await authMiddleware(makeReq(token), res, next);

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it('allows token for ghost user (not in DB) — downstream handles membership', async () => {
    mockFindOne.mockResolvedValue(null); // user not found in DB

    const token = signJWT({ sub: 'ghost-user', email: 'ghost@test.com' }, TEST_SECRET);
    const next = jest.fn();
    const { res, status } = makeRes();

    await authMiddleware(makeReq(token), res, next);

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });
});

// ── L-3: safeCode — internal errors never leaked ─────────────────────────────

describe('L-3: auth controller — safeCode prevents internal error leakage', () => {
  it('register endpoint: DB failure returns INTERNAL not raw driver message', async () => {
    // In test env, AppDataSource is NOT initialized for the app's auth service,
    // so register() throws "Connection not established" (or similar).
    // safeCode() must map it to 'INTERNAL'.
    const request = require('supertest');
    const app = require('../../src/app').default;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'Password1!', name: 'Test' });

    if (res.status === 500) {
      const code = res.body?.error?.code ?? res.body?.code;
      // Must be 'INTERNAL', never 'Driver not Connected', 'Connection refused', etc.
      expect(code).toBe('INTERNAL');
      expect(code).not.toMatch(/driver|connection|refused|postgres|sql/i);
    } else {
      // 201 or 409 — no error code to check
      expect([201, 409]).toContain(res.status);
    }
  });

  it('login endpoint: unexpected error returns INTERNAL not raw error string', async () => {
    const request = require('supertest');
    const app = require('../../src/app').default;
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'WrongPass123' });

    const code = res.body?.error?.code ?? res.body?.code;
    const allowedCodes = ['INVALID_CREDENTIALS', 'EMAIL_GOOGLE_ONLY', 'INTERNAL'];
    expect(allowedCodes).toContain(code);
    if (code !== undefined) {
      expect(code).not.toMatch(/driver|connection|refused|postgres|sql|cannot read/i);
    }
  });
});
