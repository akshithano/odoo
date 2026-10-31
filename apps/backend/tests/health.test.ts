import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Health Endpoints', () => {
  const app = createApp();

  it('GET /health should return 200 with basic status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('subscription-management-backend');
  });

  it('GET /api/v1/health/live should return 200 for liveness probe', async () => {
    const res = await request(app).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/v1/health should return health check structure', async () => {
    const res = await request(app).get('/api/v1/health');
    // Depending on whether local Postgres/Redis are running, status will be 200 or 503
    expect([200, 503]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('services');
    expect(res.body.data.services).toHaveProperty('database');
    expect(res.body.data.services).toHaveProperty('redis');
    expect(res.body.data.services).toHaveProperty('queue');
  });
});
