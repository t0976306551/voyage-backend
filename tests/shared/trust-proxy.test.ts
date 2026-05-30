import { resolveTrustProxy } from '../../src/shared/config/trust-proxy';

describe('resolveTrustProxy', () => {
  it('returns undefined when unset (keep Express default — zero regression)', () => {
    expect(resolveTrustProxy(undefined)).toBeUndefined();
  });

  it('returns undefined for empty / whitespace-only', () => {
    expect(resolveTrustProxy('')).toBeUndefined();
    expect(resolveTrustProxy('   ')).toBeUndefined();
  });

  it('parses a non-negative integer as a hop count', () => {
    expect(resolveTrustProxy('1')).toBe(1);
    expect(resolveTrustProxy('2')).toBe(2);
    expect(resolveTrustProxy(' 3 ')).toBe(3);
    expect(resolveTrustProxy('0')).toBe(0);
  });

  it('parses "false" (case-insensitive) as boolean false', () => {
    expect(resolveTrustProxy('false')).toBe(false);
    expect(resolveTrustProxy('FALSE')).toBe(false);
  });

  it('rejects "true" — returns undefined and warns (unsafe, spoofable)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(resolveTrustProxy('true')).toBeUndefined();
    expect(resolveTrustProxy('TRUE')).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('passes through IP / CIDR / preset lists verbatim', () => {
    expect(resolveTrustProxy('loopback')).toBe('loopback');
    expect(resolveTrustProxy('10.0.0.0/8')).toBe('10.0.0.0/8');
    expect(resolveTrustProxy('loopback,10.0.0.0/8')).toBe('loopback,10.0.0.0/8');
  });
});
