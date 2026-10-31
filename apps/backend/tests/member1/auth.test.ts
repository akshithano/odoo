/**
 * Member 1 – Authentication Tests
 * Tests for POST /api/v1/auth/register, login, forgot-password, reset-password, GET /api/v1/auth/me
 */

process.env.MOCK_AUTH = 'true';
process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

// Unique email per test run to avoid conflicts
const timestamp = Date.now();
const testEmail = `auth_test_${timestamp}@example.com`;
const testPassword = 'SecurePass@1234';
let registeredToken = '';
let devResetToken = '';

describe('Auth – Registration', () => {
  it('POST /api/v1/auth/register → 201 with user + token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        firstName: 'Test',
        lastName: 'User',
        billingAddress: {
          line1: '123 Main St',
          city: 'Springfield',
          postalCode: '62701',
          country: 'US',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('user');
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data.user).toHaveProperty('email', testEmail);
    registeredToken = res.body.data.accessToken;
  });

  it('POST /api/v1/auth/register with same email → 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        firstName: 'Test',
        lastName: 'Duplicate',
        billingAddress: {
          line1: '123 Main St',
          city: 'Springfield',
          postalCode: '62701',
          country: 'US',
        },
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/register with weak password (no uppercase) → 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `weak_upper_${timestamp}@example.com`,
        password: 'nouppercase@1234',
        firstName: 'Test',
        lastName: 'User',
        billingAddress: {
          line1: '123 Main St',
          city: 'Springfield',
          postalCode: '62701',
          country: 'US',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/register with weak password (no special char) → 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `weak_special_${timestamp}@example.com`,
        password: 'NoSpecialChar1234',
        firstName: 'Test',
        lastName: 'User',
        billingAddress: {
          line1: '123 Main St',
          city: 'Springfield',
          postalCode: '62701',
          country: 'US',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('Auth – Login', () => {
  it('POST /api/v1/auth/login with correct credentials → 200 with accessToken', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('POST /api/v1/auth/login with wrong password → 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: 'WrongPass@9999' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Auth – Forgot / Reset Password', () => {
  it('POST /api/v1/auth/forgot-password → 200 + devResetToken in response', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: testEmail });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('message');
    // devResetToken is exposed in non-production env
    expect(res.body.data).toHaveProperty('devResetToken');
    devResetToken = res.body.data.devResetToken;
  });

  it('POST /api/v1/auth/reset-password with valid token → 200', async () => {
    expect(devResetToken).toBeTruthy();
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: devResetToken, newPassword: 'NewSecure@5678' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/v1/auth/reset-password with wrong token → 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'totally_invalid_token_xyz123', newPassword: 'NewSecure@5678' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/reset-password with expired token → 400', async () => {
    // Insert an expired token directly into DB
    const crypto = await import('crypto');
    const { prisma } = await import('../../src/core/database/prisma.js');
    const expiredRaw = crypto.randomBytes(32).toString('hex');
    const expiredHash = crypto.createHash('sha256').update(expiredRaw).digest('hex');

    const testUser = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(testUser).toBeTruthy();

    await prisma.passwordResetToken.create({
      data: {
        userId: testUser!.id,
        tokenHash: expiredHash,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: expiredRaw, newPassword: 'AnotherSecure@1234' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/expired/i);
  });
});

describe('Auth – Get Current User (/me)', () => {
  it('GET /api/v1/auth/me with valid JWT → 200', async () => {
    const origMockAuth = process.env.MOCK_AUTH;
    process.env.MOCK_AUTH = 'false';

    expect(registeredToken).toBeTruthy();
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registeredToken}`);

    process.env.MOCK_AUTH = origMockAuth;

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('email');
  });

  it('GET /api/v1/auth/me with invalid JWT → 401', async () => {
    const origMockAuth = process.env.MOCK_AUTH;
    process.env.MOCK_AUTH = 'false';

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid.malformed.jwt.token');

    process.env.MOCK_AUTH = origMockAuth;

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/auth/me without token → 401', async () => {
    const origMockAuth = process.env.MOCK_AUTH;
    process.env.MOCK_AUTH = 'false';

    const res = await request(app)
      .get('/api/v1/auth/me');

    process.env.MOCK_AUTH = origMockAuth;

    expect(res.status).toBe(401);
  });
});
