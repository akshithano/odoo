/**
 * Member 1 – Plan Tests
 * Tests for subscription plan lifecycle operations on /api/v1/plans
 */

process.env.MOCK_AUTH = 'true';
process.env.NODE_ENV = 'test';

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

const timestamp = Date.now();
const planCode = `PLAN_TEST_${timestamp}`;
let planId = '';

// Admin mock headers
const adminHeaders = {
  'x-mock-role': 'ADMIN',
  'x-mock-user-id': 'usr_admin_test',
};

describe('Plans – Create', () => {
  it('POST /api/v1/plans with admin → 201 plan created', async () => {
    const res = await request(app)
      .post('/api/v1/plans')
      .set(adminHeaders)
      .send({
        name: 'Monthly Starter Plan',
        code: planCode,
        description: 'Test plan for monthly billing',
        billingFrequency: 'MONTHLY',
        basePrice: 29.99,
        currency: 'USD',
        minimumQuantity: 1,
        allowPause: true,
        allowRenewal: true,
        allowEarlyClosure: true,
        autoCloseOnExpiry: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.code).toBe(planCode);
    expect(res.body.data.status).toBe('ACTIVE');
    planId = res.body.data.id;
  });

  it('POST /api/v1/plans with duplicate code → 409', async () => {
    const res = await request(app)
      .post('/api/v1/plans')
      .set(adminHeaders)
      .send({
        name: 'Duplicate Plan',
        code: planCode,
        billingFrequency: 'MONTHLY',
        basePrice: 19.99,
        currency: 'USD',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/plans with invalid billing frequency → 400', async () => {
    const res = await request(app)
      .post('/api/v1/plans')
      .set(adminHeaders)
      .send({
        name: 'Invalid Frequency Plan',
        code: `INV_FREQ_${timestamp}`,
        billingFrequency: 'HOURLY', // Not allowed (only DAILY, WEEKLY, MONTHLY, YEARLY)
        basePrice: 10.0,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/plans with validUntil <= validFrom → 400', async () => {
    const from = new Date(Date.now() + 100000).toISOString();
    const until = new Date(Date.now() + 50000).toISOString(); // before 'from'

    const res = await request(app)
      .post('/api/v1/plans')
      .set(adminHeaders)
      .send({
        name: 'Invalid Date Plan',
        code: `INV_DATE_${timestamp}`,
        billingFrequency: 'MONTHLY',
        basePrice: 20.0,
        validFrom: from,
        validUntil: until,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/validUntil date must be strictly after validFrom/i);
  });
});

describe('Plans – List & Get', () => {
  it('GET /api/v1/plans → 200 array', async () => {
    const res = await request(app).get('/api/v1/plans');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/v1/plans/:id → 200 plan', async () => {
    expect(planId).toBeTruthy();
    const res = await request(app).get(`/api/v1/plans/${planId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(planId);
  });
});

describe('Plans – Update', () => {
  it('PUT /api/v1/plans/:id → 200 updated', async () => {
    expect(planId).toBeTruthy();
    const res = await request(app)
      .put(`/api/v1/plans/${planId}`)
      .set(adminHeaders)
      .send({ name: 'Updated Monthly Plan', basePrice: 34.99 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Updated Monthly Plan');
  });
});

describe('Plans – Lifecycle', () => {
  it('POST /api/v1/plans/:id/pause → 200, status=PAUSED', async () => {
    expect(planId).toBeTruthy();
    const res = await request(app)
      .post(`/api/v1/plans/${planId}/pause`)
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PAUSED');
  });

  it('POST /api/v1/plans/:id/pause again → 400 (already paused)', async () => {
    expect(planId).toBeTruthy();
    const res = await request(app)
      .post(`/api/v1/plans/${planId}/pause`)
      .set(adminHeaders);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/plans/:id/resume → 200, status=ACTIVE', async () => {
    expect(planId).toBeTruthy();
    const res = await request(app)
      .post(`/api/v1/plans/${planId}/resume`)
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('POST /api/v1/plans/:id/close → 200, status=CLOSED', async () => {
    expect(planId).toBeTruthy();
    const res = await request(app)
      .post(`/api/v1/plans/${planId}/close`)
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('CLOSED');
  });

  it('POST /api/v1/plans/:id/renew with future date → 200, status=ACTIVE', async () => {
    expect(planId).toBeTruthy();
    // Future date: 1 year from now
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post(`/api/v1/plans/${planId}/renew`)
      .set(adminHeaders)
      .send({ newValidUntil: futureDate });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('Disallow early closure when allowEarlyClosure is false → 400', async () => {
    // 1. Create a plan with allowEarlyClosure = false
    const createRes = await request(app)
      .post('/api/v1/plans')
      .set(adminHeaders)
      .send({
        name: 'No Early Close Plan',
        code: `NO_CLOSE_${timestamp}`,
        billingFrequency: 'YEARLY',
        basePrice: 500,
        allowEarlyClosure: false,
      });

    expect(createRes.status).toBe(201);
    const noClosePlanId = createRes.body.data.id;

    // 2. Attempt early closure
    const closeRes = await request(app)
      .post(`/api/v1/plans/${noClosePlanId}/close`)
      .set(adminHeaders);

    expect(closeRes.status).toBe(400);
    expect(closeRes.body.success).toBe(false);
    expect(closeRes.body.error.message).toMatch(/disallow early closure/i);
  });

  it('Automatic expiry sweep closes plans past validUntil date', async () => {
    // 1. Create plan with validUntil already in the past
    const { prisma } = await import('../../src/core/database/prisma.js');
    const expiredPlan = await prisma.subscriptionPlan.create({
      data: {
        name: 'Auto Expire Target Plan',
        code: `EXPIRE_TARGET_${timestamp}`,
        billingFrequency: 'MONTHLY',
        basePrice: 50,
        validUntil: new Date(Date.now() - 60000), // 1 minute in the past
        autoCloseOnExpiry: true,
        status: 'ACTIVE',
      },
    });

    // 2. Trigger sweep-expiry
    const sweepRes = await request(app)
      .post('/api/v1/plans/sweep-expiry')
      .set(adminHeaders);

    expect(sweepRes.status).toBe(200);
    expect(sweepRes.body.success).toBe(true);
    expect(sweepRes.body.data.closedPlansCount).toBeGreaterThanOrEqual(1);

    // 3. Verify target plan is now CLOSED
    const checkRes = await request(app).get(`/api/v1/plans/${expiredPlan.id}`);
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.status).toBe('CLOSED');
  });
});
