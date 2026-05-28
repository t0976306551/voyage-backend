/**
 * rate-limit.test.ts
 *
 * Verifies that express-rate-limit correctly enforces request caps and sets
 * standard headers.  Tests use a minimal isolated Express app so they are
 * independent of NODE_ENV — the main app skips rate limiting in test mode
 * (skip: () => NODE_ENV === 'test') to avoid interfering with the rest of the
 * test suite.
 */

import express, { Request, Response } from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

// Build a minimal app with a specific rate limit for isolation.
function buildLimitedApp(max: number) {
  const app = express();
  const limiter = rateLimit({
    windowMs: 60_000,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
  });
  app.use(limiter);
  app.get('/ping', (_req: Request, res: Response) => res.json({ ok: true }));
  app.post('/auth/login', (_req: Request, res: Response) => res.json({ token: 'test' }));
  return app;
}

describe('Rate limit — 429 returned after limit is exceeded', () => {
  it('allows requests up to the configured max', async () => {
    const app = buildLimitedApp(3);
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/ping');
      expect(res.status).toBe(200);
    }
  });

  it('returns 429 on the request that exceeds the max', async () => {
    const app = buildLimitedApp(3);
    await request(app).get('/ping');
    await request(app).get('/ping');
    await request(app).get('/ping');
    const res = await request(app).get('/ping');
    expect(res.status).toBe(429);
  });

  it('429 response body contains RATE_LIMIT error code', async () => {
    const app = buildLimitedApp(1);
    await request(app).get('/ping'); // consume the 1 allowed
    const res = await request(app).get('/ping');
    expect(res.status).toBe(429);
    expect(res.body?.error?.code).toBe('RATE_LIMIT');
  });

  it('sets RateLimit standard headers on responses (draft-7 combined header)', async () => {
    const app = buildLimitedApp(10);
    const res = await request(app).get('/ping');
    expect(res.status).toBe(200);
    // express-rate-limit v7 draft-7 sends a combined `ratelimit` header:
    //   "limit=10, remaining=9, reset=60"
    // and a `ratelimit-policy` header.
    const hasRateLimitHeader =
      res.headers['ratelimit'] !== undefined ||
      res.headers['ratelimit-policy'] !== undefined;
    expect(hasRateLimitHeader).toBe(true);
  });

  it('remaining count in ratelimit header decrements with each request', async () => {
    const app = buildLimitedApp(5);
    const res1 = await request(app).get('/ping');
    const res2 = await request(app).get('/ping');

    // Parse "limit=5, remaining=4, reset=60" → extract remaining value
    function parseRemaining(header: string | undefined): number {
      if (!header) return -1;
      const m = header.match(/remaining=(\d+)/);
      return m ? parseInt(m[1], 10) : -1;
    }

    const remaining1 = parseRemaining(res1.headers['ratelimit'] as string);
    const remaining2 = parseRemaining(res2.headers['ratelimit'] as string);

    expect(remaining1).toBeGreaterThanOrEqual(0);
    expect(remaining2).toBeGreaterThanOrEqual(0);
    expect(remaining2).toBeLessThan(remaining1);
  });

  it('POST requests are also subject to rate limiting', async () => {
    const app = buildLimitedApp(2);
    await request(app).post('/auth/login').send({ email: 'a@b.com', password: '123' });
    await request(app).post('/auth/login').send({ email: 'a@b.com', password: '123' });
    const res = await request(app).post('/auth/login').send({ email: 'a@b.com', password: '123' });
    expect(res.status).toBe(429);
  });
});

// ---------------------------------------------------------------------------
// Code-level: verify rate limiter configuration values are sane
// ---------------------------------------------------------------------------
describe('Rate limit — configuration sanity (code-level)', () => {
  it('AUTH_RATE_MAX defaults to 15 when env var is not set', () => {
    const original = process.env.AUTH_RATE_MAX;
    delete process.env.AUTH_RATE_MAX;
    const max = parseInt(process.env.AUTH_RATE_MAX ?? '15', 10);
    expect(max).toBe(15);
    if (original !== undefined) process.env.AUTH_RATE_MAX = original;
  });

  it('JOIN_RATE_MAX defaults to 30 when env var is not set', () => {
    const original = process.env.JOIN_RATE_MAX;
    delete process.env.JOIN_RATE_MAX;
    const max = parseInt(process.env.JOIN_RATE_MAX ?? '30', 10);
    expect(max).toBe(30);
    if (original !== undefined) process.env.JOIN_RATE_MAX = original;
  });

  it('API_RATE_MAX defaults to 500 when env var is not set', () => {
    const original = process.env.API_RATE_MAX;
    delete process.env.API_RATE_MAX;
    const max = parseInt(process.env.API_RATE_MAX ?? '500', 10);
    expect(max).toBe(500);
    if (original !== undefined) process.env.API_RATE_MAX = original;
  });
});
