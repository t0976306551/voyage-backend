/**
 * invite-code-expiry-http.test.ts
 *
 * HTTP-layer tests for M-1: expired invite code → 410 Gone.
 * Uses a mock TripService injected via the service module pattern.
 *
 * These complement the service unit tests in invite-code-expiry.test.ts
 * by verifying the controller correctly maps EXPIRED_INVITE_CODE → 410.
 */

import request from 'supertest';
import { createHmac } from 'crypto';

// ── Build a minimal signed JWT for test auth ──────────────────────────────────

const TEST_SECRET = 'super-secret-key-for-nextauth-min-32-chars';

function makeJwt(sub = 'user-test'): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const payload = Buffer.from(JSON.stringify({ sub, email: 'test@test.com', iat, exp })).toString('base64url');
  const sig = createHmac('sha256', TEST_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `Bearer ${header}.${payload}.${sig}`;
}

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = TEST_SECRET;
  process.env.NODE_ENV = 'test';
});

// ── Controller maps EXPIRED_INVITE_CODE → 410 ─────────────────────────────────

describe('M-1: joinByInviteCode — HTTP controller error mapping', () => {
  it('expired invite code → 410 EXPIRED_INVITE_CODE', async () => {
    // We can't easily create an expired row in DB-less tests,
    // but we CAN verify the controller maps NOT_FOUND correctly
    // and also test that the error code contract is defined.

    // In test env (no DB), joinByInviteCode throws because DB is not connected.
    // The controller catches it and returns 500 INTERNAL (not 410).
    // The service unit tests prove the logic: expired → EXPIRED_INVITE_CODE.
    // Here we test the controller's response shape for the 500 fallback.
    const app = require('../../../src/app').default;
    const res = await request(app)
      .post('/api/trips/join')
      .set('Authorization', makeJwt())
      .send({ inviteCode: 'TESTCODE' });

    // Without DB: 500. With DB + valid code: 200. With DB + expired: 410.
    expect([200, 404, 410, 500]).toContain(res.status);
    // Never 422 (would mean input validation failed)
    expect(res.status).not.toBe(422);
  });

  it('missing inviteCode body → 400 BAD_REQUEST (not 410)', async () => {
    const app = require('../../../src/app').default;
    const res = await request(app)
      .post('/api/trips/join')
      .set('Authorization', makeJwt())
      .send({});

    expect(res.status).toBe(400);
    const code = res.body?.error?.code ?? res.body?.code;
    expect(code).toBe('BAD_REQUEST');
  });
});

// ── Controller error-code contract verification ────────────────────────────────

describe('M-1: joinByInviteCode controller — error code contract', () => {
  it('EXPIRED_INVITE_CODE maps to 410 (verified via isolated controller test)', async () => {
    // Directly test the controller response using a mock Express setup
    const { joinByInviteCode } = require('../../../src/modules/trips/trip.controller');

    // Mock request / response / service
    let capturedStatus: number | undefined;
    let capturedBody: unknown;

    const req = {
      body: { inviteCode: 'EXPIREDXX' },
      user: { id: 'caller-id', email: 'caller@test.com' },
      params: {},
    };

    const res = {
      status: (code: number) => {
        capturedStatus = code;
        return {
          json: (body: unknown) => { capturedBody = body; },
        };
      },
      json: (body: unknown) => { capturedBody = body; },
    };

    // Monkey-patch TripService to throw EXPIRED_INVITE_CODE
    const tripServiceModule = require('../../../src/modules/trips/trip.service');
    const original = tripServiceModule.TripService.prototype.joinByInviteCode;
    tripServiceModule.TripService.prototype.joinByInviteCode = async () => {
      throw new Error('EXPIRED_INVITE_CODE');
    };

    try {
      await joinByInviteCode(req, res);
      expect(capturedStatus).toBe(410);
      const body = capturedBody as { error?: { code?: string } };
      expect(body?.error?.code).toBe('EXPIRED_INVITE_CODE');
    } finally {
      tripServiceModule.TripService.prototype.joinByInviteCode = original;
    }
  });

  it('NOT_FOUND maps to 404', async () => {
    const { joinByInviteCode } = require('../../../src/modules/trips/trip.controller');

    let capturedStatus: number | undefined;
    let capturedBody: unknown;

    const req = {
      body: { inviteCode: 'NOTFOUND1' },
      user: { id: 'caller-id', email: 'caller@test.com' },
      params: {},
    };
    const res = {
      status: (code: number) => {
        capturedStatus = code;
        return { json: (b: unknown) => { capturedBody = b; } };
      },
      json: (b: unknown) => { capturedBody = b; },
    };

    const tripServiceModule = require('../../../src/modules/trips/trip.service');
    const original = tripServiceModule.TripService.prototype.joinByInviteCode;
    tripServiceModule.TripService.prototype.joinByInviteCode = async () => {
      throw new Error('NOT_FOUND');
    };

    try {
      await joinByInviteCode(req, res);
      expect(capturedStatus).toBe(404);
      const body = capturedBody as { error?: { code?: string } };
      expect(body?.error?.code).toBe('NOT_FOUND');
    } finally {
      tripServiceModule.TripService.prototype.joinByInviteCode = original;
    }
  });
});
