/**
 * Member 1 – Product Tests
 * Tests for CRUD operations on /api/v1/products
 */

process.env.MOCK_AUTH = 'true';
process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

const timestamp = Date.now();
const productCode = `PROD_TEST_${timestamp}`;
let productId = '';
let variantId = '';

// Admin mock headers
const adminHeaders = {
  'x-mock-role': 'ADMIN',
  'x-mock-user-id': 'usr_admin_test',
  'x-mock-customer-id': '',
};

describe('Products – Create', () => {
  it('POST /api/v1/products with admin → 201 with product', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set(adminHeaders)
      .send({
        name: 'Test Product',
        code: productCode,
        type: 'SERVICE',
        description: 'A test product',
        salesPrice: 99.99,
        costPrice: 50.00,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.code).toBe(productCode);
    productId = res.body.data.id;
  });

  it('POST /api/v1/products with duplicate code → 409', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set(adminHeaders)
      .send({
        name: 'Duplicate Product',
        code: productCode,
        type: 'SERVICE',
        salesPrice: 49.99,
        costPrice: 25.00,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/products with missing name → 400', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set(adminHeaders)
      .send({
        code: `NO_NAME_${timestamp}`,
        type: 'SERVICE',
        salesPrice: 49.99,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/products with negative sales price → 400 (Invalid product data)', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set(adminHeaders)
      .send({
        name: 'Negative Price Product',
        code: `NEG_PRICE_${timestamp}`,
        type: 'SERVICE',
        salesPrice: -25.0,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/products with invalid product type → 400 (Invalid product data)', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set(adminHeaders)
      .send({
        name: 'Invalid Type Product',
        code: `INV_TYPE_${timestamp}`,
        type: 'NOT_A_VALID_TYPE',
        salesPrice: 100.0,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('Products – List & Get', () => {
  it('GET /api/v1/products → 200 with array', async () => {
    const res = await request(app).get('/api/v1/products');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/v1/products/:id → 200 with product', async () => {
    expect(productId).toBeTruthy();
    const res = await request(app).get(`/api/v1/products/${productId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(productId);
  });

  it('GET /api/v1/products/:id with invalid id → 404', async () => {
    const res = await request(app).get('/api/v1/products/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('Products – Update & Status', () => {
  it('PUT /api/v1/products/:id → 200 updated', async () => {
    expect(productId).toBeTruthy();
    const res = await request(app)
      .put(`/api/v1/products/${productId}`)
      .set(adminHeaders)
      .send({ name: 'Updated Product Name', salesPrice: 149.99 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Updated Product Name');
  });

  it('PATCH /api/v1/products/:id/status → 200 toggled', async () => {
    expect(productId).toBeTruthy();
    const res = await request(app)
      .patch(`/api/v1/products/${productId}/status`)
      .set(adminHeaders)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isActive).toBe(false);
  });
});

describe('Products – Variants', () => {
  it('POST /api/v1/products/:id/variants with admin → 201 variant', async () => {
    expect(productId).toBeTruthy();
    const res = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(adminHeaders)
      .send({
        variantName: 'Enterprise Edition',
        sku: `SKU_ENT_${timestamp}`,
        attributeName: 'License',
        attributeValue: 'Enterprise',
        additionalPrice: 200.00,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    variantId = res.body.data.id;
  });

  it('POST /api/v1/products/:id/variants/:variantId/calculate → 200 with finalPrice = basePrice + additionalPrice', async () => {
    expect(productId).toBeTruthy();
    expect(variantId).toBeTruthy();
    const res = await request(app)
      .post(`/api/v1/products/${productId}/variants/${variantId}/calculate`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('finalCalculatedPrice');
    expect(res.body.data).toHaveProperty('baseSalesPrice');
    expect(res.body.data).toHaveProperty('variantAdditionalPrice');
    // finalPrice should be baseSalesPrice + additionalPrice
    const { baseSalesPrice, variantAdditionalPrice, finalCalculatedPrice } = res.body.data;
    expect(finalCalculatedPrice).toBeCloseTo(baseSalesPrice + variantAdditionalPrice, 2);
  });

  it('Support the example where selecting the Odoo brand adds ₹560 to base price of ₹1000', async () => {
    // 1. Create product with base price ₹1000
    const prodRes = await request(app)
      .post('/api/v1/products')
      .set(adminHeaders)
      .send({
        name: 'Odoo ERP Core Suite',
        code: `ODOO_CORE_${timestamp}`,
        type: 'SERVICE',
        salesPrice: 1000.0,
        costPrice: 400.0,
      });

    expect(prodRes.status).toBe(201);
    const odooProdId = prodRes.body.data.id;

    // 2. Add variant: Brand Odoo with additional price ₹560
    const varRes = await request(app)
      .post(`/api/v1/products/${odooProdId}/variants`)
      .set(adminHeaders)
      .send({
        variantName: 'Odoo Official Brand Certification',
        sku: `SKU_ODOO_BRAND_${timestamp}`,
        attributeName: 'Brand',
        attributeValue: 'Odoo',
        additionalPrice: 560.0,
      });

    expect(varRes.status).toBe(201);
    const odooVarId = varRes.body.data.id;

    // 3. Calculate final price
    const calcRes = await request(app)
      .post(`/api/v1/products/${odooProdId}/variants/${odooVarId}/calculate`);

    expect(calcRes.status).toBe(200);
    expect(calcRes.body.data.baseSalesPrice).toBe(1000.0);
    expect(calcRes.body.data.variantAdditionalPrice).toBe(560.0);
    // Base 1000 + Odoo Brand 560 = 1560
    expect(calcRes.body.data.finalCalculatedPrice).toBe(1560.0);
    expect(calcRes.body.data.attributeName).toBe('Brand');
    expect(calcRes.body.data.attributeValue).toBe('Odoo');
  });
});
