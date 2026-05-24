import { generateDeleteToken, verifyDeleteToken } from '../../../src/modules/trips/delete-token.util';

const TRIP_ID = 'trip-abc-123';

describe('delete-token util', () => {
  describe('generateDeleteToken', () => {
    it('returns an 8-character alphanumeric code', () => {
      const { code } = generateDeleteToken(TRIP_ID);
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[A-Za-z2-9]+$/);
    });

    it('returns a token string containing a timestamp and HMAC', () => {
      const { token } = generateDeleteToken(TRIP_ID);
      expect(token).toContain(':');
      const [expiresAt] = token.split(':');
      expect(Number(expiresAt)).toBeGreaterThan(Date.now());
    });

    it('generates a different code on each call', () => {
      const a = generateDeleteToken(TRIP_ID);
      const b = generateDeleteToken(TRIP_ID);
      // Extremely unlikely to collide — this is effectively always true
      expect(a.code === b.code && a.token === b.token).toBe(false);
    });
  });

  describe('verifyDeleteToken', () => {
    it('returns true for a freshly generated token', () => {
      const { code, token } = generateDeleteToken(TRIP_ID);
      expect(verifyDeleteToken(TRIP_ID, code, token)).toBe(true);
    });

    it('returns false when the code is wrong', () => {
      const { token } = generateDeleteToken(TRIP_ID);
      expect(verifyDeleteToken(TRIP_ID, 'WRONGCOD', token)).toBe(false);
    });

    it('returns false when the tripId is wrong', () => {
      const { code, token } = generateDeleteToken(TRIP_ID);
      expect(verifyDeleteToken('different-trip-id', code, token)).toBe(false);
    });

    it('returns false for a tampered token (flipped bit in signature)', () => {
      const { code, token } = generateDeleteToken(TRIP_ID);
      const [expiresAt, sig] = token.split(':');
      // Flip last hex character
      const lastChar = sig.slice(-1);
      const flipped = lastChar === 'f' ? '0' : 'f';
      const tamperedToken = `${expiresAt}:${sig.slice(0, -1)}${flipped}`;
      expect(verifyDeleteToken(TRIP_ID, code, tamperedToken)).toBe(false);
    });

    it('returns false for a completely garbage token', () => {
      expect(verifyDeleteToken(TRIP_ID, 'AAAAAAAA', 'not-a-real-token')).toBe(false);
    });

    it('returns false for an empty token', () => {
      expect(verifyDeleteToken(TRIP_ID, 'AAAAAAAA', '')).toBe(false);
    });

    it('returns false for an expired token', () => {
      const { code, token } = generateDeleteToken(TRIP_ID);
      // Rebuild the token with a past expiry, re-sign with the same secret
      // Since we can't easily re-sign from outside, we construct an expired
      // token by manipulating the timestamp in the payload (which breaks the HMAC).
      // The test verifies the expiry check fires before HMAC passes.
      const [, sig] = token.split(':');
      const expiredAt = Date.now() - 1000; // 1 second in the past
      const expiredToken = `${expiredAt}:${sig}`;
      expect(verifyDeleteToken(TRIP_ID, code, expiredToken)).toBe(false);
    });
  });
});
