import { signJWT } from '../../src/shared/utils/sign-jwt.utils';
import { verifyHS256 } from '../../src/shared/utils/jwt.utils';

const SECRET = 'test-secret-min-32-chars-long!!!';

describe('signJWT', () => {
  it('creates a token verifiable by verifyHS256', () => {
    const token = signJWT({ sub: 'u1', email: 'a@b.com', name: 'Alice' }, SECRET);
    const payload = verifyHS256(token, SECRET);
    expect(payload['sub']).toBe('u1');
    expect(payload['email']).toBe('a@b.com');
    expect(typeof payload['exp']).toBe('number');
  });

  it('respects custom expiresInSeconds', () => {
    const token = signJWT({ sub: 'u1' }, SECRET, -1);
    expect(() => verifyHS256(token, SECRET)).toThrow('Token expired');
  });
});
