/**
 * Member 3 – Tax Rules & Discount Management Tests
 */

process.env.MOCK_AUTH = 'true';
process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/core/database/prisma.js';
import { taxService } from '../../src/modules/billing/services/tax.service.js';
import { discountService } from '../../src/modules/billing/services/discount.service.js';

const app = createApp();

const adminHeaders = {
  'x-mock-role': 'ADMIN',
  'x-mock-user-id': 'usr_admin_test',
  'x-mock-customer-id': '',
};

describe('Member 3 – Tax Rules Management & Calculations', () => {
  let createdTaxId = '';

  it('POST /api/v1/tax-rules creates a new tax rule (Admin only)', async () => {
    const res = await request(app)
      .post('/api/v1/tax-rules')
      .set(adminHeaders)
      .send({
        name: `VAT Test ${Date.now()}`,
        ratePercentage: 18.0,
        country: 'US',
        isCompound: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.data.ratePercentage)).toBe(18);
    createdTaxId = res.body.data.id;
  });

  it('POST /api/v1/tax-rules rejects invalid percentage (>100 or <0)', async () => {
    const res = await request(app)
      .post('/api/v1/tax-rules')
      .set(adminHeaders)
      .send({
        name: 'Invalid Tax',
        ratePercentage: 150.0,
      });

    expect(res.status).toBe(400);
  });

  it('GET /api/v1/tax-rules returns list of tax rules', async () => {
    const res = await request(app)
      .get('/api/v1/tax-rules')
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('PATCH /api/v1/tax-rules/:id/toggle-active toggles rule status', async () => {
    const res = await request(app)
      .patch(`/api/v1/tax-rules/${createdTaxId}/toggle-active`)
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isActive).toBe(false);
  });

  it('Tax Calculation Engine computes compound tax accurately', async () => {
    // Base amount 1000
    // Standard rule 10% -> 100 tax, subtotal 1100
    // Compound rule 10% -> 10% of 1100 = 110 tax
    // Total tax = 210, Total with tax = 1210
    const rule1 = await prisma.taxRule.create({
      data: {
        name: `Standard ${Date.now()}`,
        ratePercentage: 10.0,
        isCompound: false,
        isActive: true,
      },
    });

    const rule2 = await prisma.taxRule.create({
      data: {
        name: `Compound ${Date.now()}`,
        ratePercentage: 10.0,
        isCompound: true,
        isActive: true,
      },
    });

    const calc = await taxService.calculateTaxForAmount(1000, [rule1.id, rule2.id]);
    expect(calc.taxAmount).toBe(210);
    expect(calc.totalWithTax).toBe(1210);
  });
});

describe('Member 3 – Discount Rules & Concurrency Control', () => {
  let customerId = '';
  const testCouponCode = `PROMO_${Date.now()}`;

  beforeAll(async () => {
    const cust = await prisma.customer.findFirst();
    customerId = cust!.id;
  });

  it('POST /api/v1/discounts creates discount coupon with limits and date range', async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    const res = await request(app)
      .post('/api/v1/discounts')
      .set(adminHeaders)
      .send({
        code: testCouponCode,
        type: 'PERCENTAGE',
        value: 15.0,
        minPurchaseAmount: 50.0,
        minQuantity: 1,
        maxRedemptions: 5,
        maxPerCustomer: 2,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe(testCouponCode);
  });

  it('POST /api/v1/discounts rejects duplicate coupon code (409 Conflict)', async () => {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 10);

    const res = await request(app)
      .post('/api/v1/discounts')
      .set(adminHeaders)
      .send({
        code: testCouponCode,
        type: 'PERCENTAGE',
        value: 10.0,
        maxRedemptions: 10,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

    expect(res.status).toBe(409);
  });

  it('POST /api/v1/discounts/validate verifies eligibility and computes discount', async () => {
    const res = await request(app)
      .post('/api/v1/discounts/validate')
      .set(adminHeaders)
      .send({
        code: testCouponCode,
        customerId,
        purchaseAmount: 200.0,
        quantity: 2,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // 15% of 200 = 30
    expect(res.body.data.discountAmount).toBe(30);
    expect(res.body.data.newTotal).toBe(170);
  });

  it('POST /api/v1/discounts/validate rejects coupon when purchase amount is below minimum', async () => {
    const res = await request(app)
      .post('/api/v1/discounts/validate')
      .set(adminHeaders)
      .send({
        code: testCouponCode,
        customerId,
        purchaseAmount: 20.0, // Minimum is 50.0
        quantity: 1,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Minimum purchase amount');
  });

  it('Concurrency Test: Atomic redemptions cannot exceed maxRedemptions', async () => {
    // Create discount with maxRedemptions = 2
    const concurrencyCode = `CONCUR_${Date.now()}`;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 10);

    await prisma.discount.create({
      data: {
        code: concurrencyCode,
        type: 'FIXED',
        value: 10.0,
        maxRedemptions: 2,
        currentRedemptions: 0,
        maxPerCustomer: 10,
        startDate,
        endDate,
        isActive: true,
      },
    });

    // Launch 5 parallel redemption attempts
    const attempts = Array.from({ length: 5 }).map((_, i) =>
      discountService
        .redeemDiscountAtomically(concurrencyCode, customerId, undefined, 100)
        .then(() => 'success')
        .catch(() => 'failed')
    );

    const outcomes = await Promise.all(attempts);
    const successCount = outcomes.filter((o) => o === 'success').length;
    const failCount = outcomes.filter((o) => o === 'failed').length;

    expect(successCount).toBe(2);
    expect(failCount).toBe(3);
  });
});
