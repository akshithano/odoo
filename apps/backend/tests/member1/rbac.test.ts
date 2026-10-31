/**
 * Member 1 – RBAC Tests
 * Tests for role-based access control on user management endpoints
 */

process.env.MOCK_AUTH = 'true';
process.env.NODE_ENV = 'test';

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

const timestamp = Date.now();
const staffEmail = `staff_test_${timestamp}@example.com`;

const adminHeaders = {
  'x-mock-role': 'ADMIN',
  'x-mock-user-id': 'usr_admin_rbac_test',
};

const staffHeaders = {
  'x-mock-role': 'STAFF',
  'x-mock-user-id': 'usr_staff_rbac_test',
};

const customerHeaders = {
  'x-mock-role': 'CUSTOMER',
  'x-mock-user-id': 'usr_customer_rbac_test',
  'x-mock-customer-id': 'cust_rbac_test_01',
};

describe('RBAC – User Management & Authorization', () => {
  it('Admin creates staff via POST /api/v1/users/staff → 201', async () => {
    const res = await request(app)
      .post('/api/v1/users/staff')
      .set(adminHeaders)
      .send({
        email: staffEmail,
        password: 'StaffPass@1234',
        firstName: 'Staff',
        lastName: 'Member',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.role).toBe('STAFF');
  });

  it('Staff role tries to create staff → 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/users/staff')
      .set(staffHeaders)
      .send({
        email: `staff_attempt_${timestamp}@example.com`,
        password: 'StaffPass@1234',
        firstName: 'Unauthorized',
        lastName: 'StaffAttempt',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('Customer role tries to create staff → 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/users/staff')
      .set(customerHeaders)
      .send({
        email: `customer_staff_${timestamp}@example.com`,
        password: 'StaffPass@1234',
        firstName: 'Unauthorized',
        lastName: 'Attempt',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('Staff role tries to create product → 403 Forbidden (Admin only)', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set(staffHeaders)
      .send({
        name: 'Staff Unauthorized Product',
        code: `STAFF_PROD_${timestamp}`,
        type: 'SERVICE',
        salesPrice: 100,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('Staff role tries to create plan → 403 Forbidden (Admin only)', async () => {
    const res = await request(app)
      .post('/api/v1/plans')
      .set(staffHeaders)
      .send({
        name: 'Staff Unauthorized Plan',
        code: `STAFF_PLAN_${timestamp}`,
        billingFrequency: 'MONTHLY',
        basePrice: 50,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('Customer tries to GET /api/v1/users (admin list) → 403', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set(customerHeaders);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('Customer attempting to access another customer\'s data → 403', async () => {
    // Customer requesting another user's profile
    const res = await request(app)
      .get('/api/v1/users/00000000-0000-0000-0000-000000000001')
      .set(customerHeaders);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/cannot view another user/i);
  });

  it('Admin can GET /api/v1/users → 200', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('Unauthorized access attempt (no token) → 401', async () => {
    const origMockAuth = process.env.MOCK_AUTH;
    process.env.MOCK_AUTH = 'false';

    const res = await request(app)
      .get('/api/v1/users');

    process.env.MOCK_AUTH = origMockAuth;

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
