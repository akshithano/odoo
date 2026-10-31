import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Error Handling Middleware', () => {
  const app = createApp();

  it('Unmatched routes should return 404 in standard ApiErrorResponse format', async () => {
    const res = await request(app).get('/api/v1/non-existent-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('Route GET /api/v1/non-existent-route not found');
    expect(res.body.error.timestamp).toBeDefined();
    expect(res.body.error.path).toBe('/api/v1/non-existent-route');
  });
});
