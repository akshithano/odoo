/**
 * Member 3 – Invoicing Lifecycle & Recurring Billing Engine Tests
 */

process.env.MOCK_AUTH = 'true';
process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/core/database/prisma.js';

const app = createApp();

const adminHeaders = {
  'x-mock-role': 'ADMIN',
  'x-mock-user-id': 'usr_admin_test',
  'x-mock-customer-id': '',
};

describe('Member 3 – Invoicing Lifecycle & Billing Engine', () => {
  let customerId = '';
  let subscriptionId = '';
  let invoiceId = '';

  beforeAll(async () => {
    // Find or create customer
    const cust = await prisma.customer.findFirst({
      include: { user: true },
    });
    customerId = cust!.id;

    // Find or create subscription
    const sub = await prisma.subscription.findFirst({
      where: { status: { in: ['ACTIVE', 'CONFIRMED'] } },
    });
    subscriptionId = sub!.id;
  });

  it('POST /api/v1/invoices/generate-cycle executes idempotent billing run', async () => {
    const res = await request(app)
      .post('/api/v1/invoices/generate-cycle')
      .set(adminHeaders)
      .send({ asOfDate: new Date().toISOString() });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('subscriptionsEvaluated');
    expect(res.body.data).toHaveProperty('invoicesCreated');
    expect(res.body.data).toHaveProperty('invoicesSkippedAlreadyBilled');

    if (res.body.data.invoiceIds && res.body.data.invoiceIds.length > 0) {
      invoiceId = res.body.data.invoiceIds[0];
    }
  });

  it('POST /api/v1/invoices/generate-cycle run a second time skips already billed cycles (Zero Duplication)', async () => {
    const res = await request(app)
      .post('/api/v1/invoices/generate-cycle')
      .set(adminHeaders)
      .send({ asOfDate: new Date().toISOString() });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Invoices for the same cycle are skipped
    expect(res.body.data.invoicesSkippedAlreadyBilled).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/invoices returns paginated list of invoices with formatting', async () => {
    const res = await request(app)
      .get('/api/v1/invoices')
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);

    const generatedInv = res.body.items.find((i: any) => /^INV-\d{6}-\d{4}$/.test(i.invoiceNumber));
    expect(generatedInv).toBeDefined();
    if (generatedInv) {
      invoiceId = generatedInv.id;
    }
  });

  it('GET /api/v1/invoices/:id retrieves full invoice details with lines and snapshot', async () => {
    const res = await request(app)
      .get(`/api/v1/invoices/${invoiceId}`)
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(invoiceId);
    expect(res.body.data).toHaveProperty('customerSnapshot');
    expect(res.body.data.customerSnapshot).toHaveProperty('email');
    expect(Array.isArray(res.body.data.lines)).toBe(true);
  });

  it('Customer Isolation: Customers can only query their own invoices', async () => {
    const res = await request(app)
      .get(`/api/v1/invoices/${invoiceId}`)
      .set({
        'x-mock-role': 'CUSTOMER',
        'x-mock-user-id': 'usr_other_customer',
        'x-mock-customer-id': 'cust_non_existent_9999',
      });

    // Cross-tenant access is blocked with 404
    expect(res.status).toBe(404);
  });

  it('POST /api/v1/invoices/:id/confirm locks snapshot and transitions status to CONFIRMED', async () => {
    // If invoice is already confirmed or draft, test transition
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (inv?.status === 'DRAFT') {
      const res = await request(app)
        .post(`/api/v1/invoices/${invoiceId}/confirm`)
        .set(adminHeaders)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CONFIRMED');
    }

    // Attempting to re-confirm a confirmed invoice fails with 422 Unprocessable
    const resDuplicate = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/confirm`)
      .set(adminHeaders)
      .send({});

    expect(resDuplicate.status).toBe(422);
  });

  it('GET /api/v1/invoices/:id/pdf returns printable HTML document', async () => {
    const res = await request(app)
      .get(`/api/v1/invoices/${invoiceId}/pdf`)
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('INVOICE');
    expect(res.text).toContain('Subtotal');
  });

  it('POST /api/v1/invoices/mark-overdue and GET /api/v1/invoices/overdue returns aging analysis', async () => {
    const markRes = await request(app)
      .post('/api/v1/invoices/mark-overdue')
      .set(adminHeaders);

    expect(markRes.status).toBe(200);
    expect(markRes.body.success).toBe(true);
    expect(markRes.body.data).toHaveProperty('evaluated');

    const getRes = await request(app)
      .get('/api/v1/invoices/overdue')
      .set(adminHeaders);

    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data).toHaveProperty('totalOverdueCount');
    expect(getRes.body.data).toHaveProperty('totalOutstandingAmount');
  });
});
