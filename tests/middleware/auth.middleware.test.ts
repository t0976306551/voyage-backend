import request from 'supertest';
import app from '../../src/app';

describe('auth middleware', () => {
  it('should return 401 when no Authorization header', async () => {
    const res = await request(app).get('/api/trips');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 401 when invalid token', async () => {
    const res = await request(app)
      .get('/api/trips')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
