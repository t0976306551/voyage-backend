import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

// Brute-force protection for auth endpoints (login / register).
// Default: 15 attempts per 15 minutes per IP.
// Override via AUTH_RATE_MAX env var (useful in staging).
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_MAX ?? '15', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later' } },
});

// Invite-code enumeration protection.
// Default: 30 attempts per 15 minutes per IP.
export const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.JOIN_RATE_MAX ?? '30', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later' } },
});

// Broad API-level guard applied to all /api/* routes.
// Default: 500 requests per 15 minutes per IP.
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.API_RATE_MAX ?? '500', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later' } },
});
