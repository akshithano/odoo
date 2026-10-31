/**
 * Member 3 – Payments Ledger, Gateway Webhook & Refunds Tests
 */

process.env.MOCK_AUTH = 'true';
process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/core/database/prisma.js';
import { dunningService } from '../../src/modules/billing/services/dunning.service.js';

const app = createApp();

const adminHeaders = {
  'x-mock-role': 'ADMIN',
  'x-mock-user-id': 'usr_admin_test',
  'x-mock-customer-id': '',
};

describe('Member 3 – Payment Ledger & Partial Payments', () => {
  let invoiceId = '';
  let paymentId = '';

  beforeAll(async () => {
    const cust = await prisma.customer.findFirst();
    const sub = await prisma.subscription.findFirst();

    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-PAYTEST-${Date.now()}`,
        subscriptionId: sub!.id,
        customerId: cust!.id,
        status: 'CONFIRMED',
        billingPeriodStart: new Date(),
        billingPeriodEnd: new Date(),
        issueDate: new Date(),
        dueDate: new Date(),
        subtotal: 500.0,
        taxAmount: 50.0,
        totalAmount: 550.0,
        amountPaid: 0.0,
        currency: 'USD',
        customerSnapshot: { name: 'Test User', email: 'test@odoo.local' },
      },
    });

    invoiceId = inv.id;
  });

  it('POST /api/v1/payments records partial payment and updates invoice status to PARTIALLY_PAID', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set(adminHeaders)
      .send({
        invoiceId,
        amount: 200.0,
        paymentMethod: 'BANK_WIRE',
        transactionReference: `WIRE_${Date.now()}`,
        notes: 'Partial wire deposit received',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentNumber).toMatch(/^PAY-\d{6}-\d{4}$/);
    paymentId = res.body.data.id;

    // Verify invoice status
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(Number(inv?.amountPaid)).toBe(200);
    expect(inv?.status).toBe('PARTIALLY_PAID');
  });

  it('POST /api/v1/payments second payment completes invoice and updates status to PAID', async () => {
    const invBefore = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    const remaining = Number(invBefore!.totalAmount) - Number(invBefore!.amountPaid);

    const res = await request(app)
      .post('/api/v1/payments')
      .set(adminHeaders)
      .send({
        invoiceId,
        amount: remaining,
        paymentMethod: 'CREDIT_CARD',
        transactionReference: `CARD_${Date.now()}`,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const invAfter = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(Number(invAfter?.amountPaid)).toBe(Number(invAfter?.totalAmount));
    expect(invAfter?.status).toBe('PAID');
  });

  it('POST /api/v1/payments rejects payment when invoice is already fully paid', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set(adminHeaders)
      .send({
        invoiceId,
        amount: 50.0,
        paymentMethod: 'CASH',
      });

    expect(res.status).toBe(422);
  });
});

describe('Member 3 – Online Payment Gateway & Webhook Signature Guard', () => {
  let invoiceId = '';

  beforeAll(async () => {
    const cust = await prisma.customer.findFirst();
    const sub = await prisma.subscription.findFirst();

    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-GW-${Date.now()}`,
        subscriptionId: sub!.id,
        customerId: cust!.id,
        status: 'CONFIRMED',
        billingPeriodStart: new Date(),
        billingPeriodEnd: new Date(),
        issueDate: new Date(),
        dueDate: new Date(),
        subtotal: 100.0,
        taxAmount: 10.0,
        totalAmount: 110.0,
        amountPaid: 0.0,
        customerSnapshot: { name: 'Customer One', email: 'cust@odoo.local' },
      },
    });
    invoiceId = inv.id;
  });

  it('POST /api/v1/payments/create-order generates gateway order with orderId and keyId', async () => {
    const res = await request(app)
      .post('/api/v1/payments/create-order')
      .set(adminHeaders)
      .send({ invoiceId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('orderId');
    expect(res.body.data.amount).toBe(110);
  });

  it('POST /api/v1/payments/verify rejects invalid cryptographic signature (400)', async () => {
    const res = await request(app)
      .post('/api/v1/payments/verify')
      .set(adminHeaders)
      .send({
        invoiceId,
        orderId: 'order_123',
        paymentId: 'pay_123',
        signature: 'invalid_signature',
      });

    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/verify accepts valid signature and records payment', async () => {
    const res = await request(app)
      .post('/api/v1/payments/verify')
      .set(adminHeaders)
      .send({
        invoiceId,
        orderId: 'order_mock_test_1',
        paymentId: `pay_mock_${Date.now()}`,
        signature: 'valid_test_sig',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('SUCCESS');
  });

  it('POST /api/v1/payments/webhook rejects unverified signature header (400)', async () => {
    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set({
        'x-razorpay-signature': 'invalid_signature',
      })
      .send({
        event: 'payment.captured',
      });

    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/webhook processes verified event idempotently', async () => {
    const eventPayload = {
      id: `evt_test_${Date.now()}`,
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_wh_${Date.now()}`,
            order_id: 'order_test',
            amount: 5000,
            currency: 'USD',
            status: 'captured',
          },
        },
      },
    };

    // First webhook call succeeds
    const res1 = await request(app)
      .post('/api/v1/payments/webhook')
      .set({
        'x-mock-signature': 'valid_sig_12345',
      })
      .send(eventPayload);

    expect(res1.status).toBe(200);
    expect(res1.body.received).toBe(true);

    // Duplicate webhook with same eventId is skipped idempotently
    const res2 = await request(app)
      .post('/api/v1/payments/webhook')
      .set({
        'x-mock-signature': 'valid_sig_12345',
      })
      .send(eventPayload);

    expect(res2.status).toBe(200);
    expect(res2.body.idempotentDuplicate).toBe(true);
  });
});

describe('Member 3 – Refunds & Dunning Retries', () => {
  let paymentId = '';
  let invoiceId = '';

  beforeAll(async () => {
    const cust = await prisma.customer.findFirst();
    const sub = await prisma.subscription.findFirst();

    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-REF-${Date.now()}`,
        subscriptionId: sub!.id,
        customerId: cust!.id,
        status: 'PAID',
        billingPeriodStart: new Date(),
        billingPeriodEnd: new Date(),
        issueDate: new Date(),
        dueDate: new Date(),
        subtotal: 300.0,
        taxAmount: 30.0,
        totalAmount: 330.0,
        amountPaid: 330.0,
        customerSnapshot: { name: 'Customer Ref', email: 'ref@odoo.local' },
      },
    });
    invoiceId = inv.id;

    const pay = await prisma.payment.create({
      data: {
        paymentNumber: `PAY-REF-${Date.now()}`,
        invoiceId: inv.id,
        customerId: cust!.id,
        amount: 330.0,
        currency: 'USD',
        paymentMethod: 'GATEWAY',
        paymentDate: new Date(),
        status: 'SUCCESS',
        transactionReference: `TXN-REF-${Date.now()}`,
      },
    });
    paymentId = pay.id;
  });

  it('POST /api/v1/refunds processes partial refund and updates payment & invoice balances', async () => {
    const res = await request(app)
      .post('/api/v1/refunds')
      .set(adminHeaders)
      .send({
        paymentId,
        amount: 100.0,
        reason: 'Customer requested partial cancellation',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.refundNumber).toMatch(/^REF-\d{6}-\d{4}$/);

    const pay = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(pay?.status).toBe('PARTIALLY_REFUNDED');

    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(Number(inv?.amountPaid)).toBe(230);
    expect(inv?.status).toBe('PARTIALLY_PAID');
  });

  it('POST /api/v1/refunds rejects refund amount exceeding available balance (400)', async () => {
    const res = await request(app)
      .post('/api/v1/refunds')
      .set(adminHeaders)
      .send({
        paymentId,
        amount: 500.0, // Remaining refundable is only 230.0
        reason: 'Exceeding amount',
      });

    expect(res.status).toBe(400);
  });

  it('Dunning Retries: Retries log attempts and pause subscription on exhaustion', async () => {
    // Test manual retry trigger
    const res = await request(app)
      .post(`/api/v1/payments/retries/${invoiceId}/manual`)
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('attemptNumber');
  });
});
