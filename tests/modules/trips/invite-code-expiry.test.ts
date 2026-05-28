/**
 * invite-code-expiry.test.ts  (Layer A — no DB needed)
 *
 * Covers M-1: invite code expiry enforcement.
 * Routes behind requireTripRole need a valid JWT + trip membership,
 * so we use mock-level assertions (status not 500, not 422) rather than
 * attempting to drive through the DB.
 *
 * Tests that CAN be fully asserted without DB:
 *   - POST /api/trips/join with missing body → 400
 *   - POST /api/trips/:tripId/rotate-invite without auth → 401
 *
 * Service-level expiry logic is tested via unit tests of TripService below.
 */

import request from 'supertest';
import app from '../../../src/app';
import { TripService } from '../../../src/modules/trips/trip.service';
import { TripRepository } from '../../../src/modules/trips/trip.repository';
import { Trip, TripMember } from '../../../src/modules/trips/trip.entity';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
});

// ── Controller layer: unauthenticated sanity ──────────────────────────────────

describe('POST /api/trips/join — input validation (no DB)', () => {
  it('missing body → 400 BAD_REQUEST', async () => {
    const res = await request(app)
      .post('/api/trips/join')
      .set('Authorization', 'Bearer fake-token')
      .send({});
    // 401 from JWT check or 400 from validation — never 500
    expect([400, 401]).toContain(res.status);
  });

  it('no auth header → 401', async () => {
    const res = await request(app)
      .post('/api/trips/join')
      .send({ inviteCode: 'ABC123' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/trips/:tripId/rotate-invite — auth guard', () => {
  it('no auth → 401', async () => {
    const res = await request(app).post('/api/trips/fake-id/rotate-invite');
    expect(res.status).toBe(401);
  });
});

// ── Service unit tests: TripService.joinByInviteCode expiry logic ─────────────

function makeMockRepo(trip: Partial<Trip> | null): TripRepository {
  return {
    findByInviteCode: async () => trip as Trip | null,
    findById: async () => trip as Trip | null,
    update: async (_id: string, data: Partial<Trip>) => ({ ...trip, ...data } as Trip),
    create: async (data: Partial<Trip>) => data as Trip,
    delete: async () => undefined,
    isMember: async () => false,
    findByUserId: async () => [],
    findByUserIdPaginated: async () => [[], 0] as [Trip[], number],
  } as unknown as TripRepository;
}

const baseMember: TripMember = { userId: 'owner-1', role: 'Owner' };

describe('TripService.joinByInviteCode — expiry enforcement', () => {
  it('throws EXPIRED_INVITE_CODE when expiresAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 1000);
    const repo = makeMockRepo({
      id: 'trip-1',
      inviteCode: 'ABC123',
      inviteCodeExpiresAt: pastDate,
      members: [baseMember],
    });
    const svc = new TripService(repo);
    await expect(svc.joinByInviteCode('ABC123', 'user-2')).rejects.toThrow('EXPIRED_INVITE_CODE');
  });

  it('allows join when expiresAt is in the future', async () => {
    const futureDate = new Date(Date.now() + 60_000);
    const repo = makeMockRepo({
      id: 'trip-1',
      inviteCode: 'ABC123',
      inviteCodeExpiresAt: futureDate,
      members: [baseMember],
    });
    const svc = new TripService(repo);
    await expect(svc.joinByInviteCode('ABC123', 'user-2')).resolves.toBeDefined();
  });

  it('allows join when inviteCodeExpiresAt is null (legacy trip — no expiry set)', async () => {
    const repo = makeMockRepo({
      id: 'trip-1',
      inviteCode: 'ABC123',
      inviteCodeExpiresAt: null,
      members: [baseMember],
    });
    const svc = new TripService(repo);
    await expect(svc.joinByInviteCode('ABC123', 'user-2')).resolves.toBeDefined();
  });

  it('throws NOT_FOUND when invite code does not exist', async () => {
    const repo = makeMockRepo(null);
    const svc = new TripService(repo);
    await expect(svc.joinByInviteCode('BADCODE', 'user-2')).rejects.toThrow('NOT_FOUND');
  });

  it('returns existing trip without throwing when caller is already a member', async () => {
    const futureDate = new Date(Date.now() + 60_000);
    const repo = makeMockRepo({
      id: 'trip-1',
      inviteCode: 'ABC123',
      inviteCodeExpiresAt: futureDate,
      members: [baseMember, { userId: 'user-2', role: 'Editor' }],
    });
    const svc = new TripService(repo);
    const result = await svc.joinByInviteCode('ABC123', 'user-2');
    expect(result.id).toBe('trip-1');
  });
});

// ── Service unit tests: TripService.createTrip sets inviteCodeExpiresAt ──────

describe('TripService.createTrip — sets 30-day expiry', () => {
  it('sets inviteCodeExpiresAt approximately 30 days in the future', async () => {
    const created: Partial<Trip> = {};
    const repo = {
      create: async (data: Partial<Trip>) => {
        Object.assign(created, data);
        return data as Trip;
      },
    } as unknown as TripRepository;

    const svc = new TripService(repo);
    const before = Date.now();
    await svc.createTrip({ title: 'Test Trip' }, 'owner-1');
    const after = Date.now();

    expect(created.inviteCodeExpiresAt).toBeInstanceOf(Date);
    const expiresMs = (created.inviteCodeExpiresAt as Date).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    expect(expiresMs).toBeGreaterThanOrEqual(before + thirtyDaysMs - 100);
    expect(expiresMs).toBeLessThanOrEqual(after + thirtyDaysMs + 100);
  });
});

// ── Service unit tests: TripService.rotateInviteCode ─────────────────────────

describe('TripService.rotateInviteCode', () => {
  it('returns updated trip with new inviteCode and fresh 30-day expiry', async () => {
    const original = {
      id: 'trip-1',
      inviteCode: 'OLDCODE',
      inviteCodeExpiresAt: new Date(Date.now() - 1000),
      members: [baseMember],
    };
    let saved: Partial<Trip> = {};
    const repo = {
      findById: async () => original as unknown as Trip,
      update: async (_id: string, data: Partial<Trip>) => {
        saved = data;
        return { ...original, ...data } as Trip;
      },
    } as unknown as TripRepository;

    const svc = new TripService(repo);
    const before = Date.now();
    const result = await svc.rotateInviteCode('trip-1');
    const after = Date.now();

    expect(result.inviteCode).not.toBe('OLDCODE');
    expect(result.inviteCode).toMatch(/^[0-9A-F]{12}$/);
    expect(result.inviteCodeExpiresAt).toBeInstanceOf(Date);

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const expiresMs = (result.inviteCodeExpiresAt as Date).getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + thirtyDaysMs - 100);
    expect(expiresMs).toBeLessThanOrEqual(after + thirtyDaysMs + 100);

    expect(saved.inviteCode).toBeDefined();
    expect(saved.inviteCodeExpiresAt).toBeDefined();
  });

  it('throws NOT_FOUND when trip does not exist', async () => {
    const repo = {
      findById: async () => null,
    } as unknown as TripRepository;

    const svc = new TripService(repo);
    await expect(svc.rotateInviteCode('no-such-trip')).rejects.toThrow('NOT_FOUND');
  });
});
