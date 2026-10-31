/**
 * Database Seed Runner Infrastructure
 * Coordinates mock data and initial configuration for Member 1 and foundation.
 */

import { PrismaClient, Role, ProductType, BillingFrequency, PlanStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding infrastructure...');

  // 1. Minimum baseline health record for connectivity verification
  const healthCheck = await prisma.systemHealth.upsert({
    where: { id: 'health-foundation-01' },
    update: { checkedAt: new Date(), status: 'SYSTEM_BOOTSTRAPPED' },
    create: {
      id: 'health-foundation-01',
      status: 'SYSTEM_BOOTSTRAPPED',
      checkedAt: new Date(),
    },
  });
  console.log(`✅ System health seed record verified [ID: ${healthCheck.id}]`);

  // 2. Currencies
  const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRateToBase: 1.0, isBaseCurrency: true },
    { code: 'EUR', name: 'Euro', symbol: '€', exchangeRateToBase: 0.92, isBaseCurrency: false },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', exchangeRateToBase: 86.5, isBaseCurrency: false },
    { code: 'GBP', name: 'British Pound', symbol: '£', exchangeRateToBase: 0.79, isBaseCurrency: false },
  ];

  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: c,
      create: c,
    });
  }
  console.log('✅ Currencies seeded (USD, EUR, INR, GBP)');

  // 3. Default Users for Member 1 RBAC Testing & Demo
  const defaultPasswordHash = await bcrypt.hash('AdminPass@1234', 12);
  const staffPasswordHash = await bcrypt.hash('StaffPass@1234', 12);
  const customerPasswordHash = await bcrypt.hash('CustomerPass@1234', 12);

  // Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@odoo.local' },
    update: { isActive: true },
    create: {
      email: 'admin@odoo.local',
      passwordHash: defaultPasswordHash,
      role: Role.ADMIN,
      firstName: 'Admin',
      lastName: 'Superuser',
      isActive: true,
    },
  });
  console.log(`✅ Admin user seeded: admin@odoo.local [${adminUser.id}]`);

  // Staff User
  const staffUser = await prisma.user.upsert({
    where: { email: 'staff@odoo.local' },
    update: { isActive: true },
    create: {
      email: 'staff@odoo.local',
      passwordHash: staffPasswordHash,
      role: Role.STAFF,
      firstName: 'John',
      lastName: 'Operator',
      isActive: true,
    },
  });
  console.log(`✅ Staff user seeded: staff@odoo.local [${staffUser.id}]`);

  // Customer User + Customer Profile
  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@odoo.local' },
    update: { isActive: true },
    create: {
      email: 'customer@odoo.local',
      passwordHash: customerPasswordHash,
      role: Role.CUSTOMER,
      firstName: 'Sarah',
      lastName: 'Connor',
      isActive: true,
    },
  });

  await prisma.customer.upsert({
    where: { userId: customerUser.id },
    update: {
      companyName: 'Cyberdyne Systems Inc.',
      phone: '+1-555-0199',
      billingAddressLine1: '100 Industrial Parkway',
      billingCity: 'Los Angeles',
      billingState: 'CA',
      billingPostalCode: '90001',
      billingCountry: 'US',
      defaultCurrency: 'USD',
    },
    create: {
      userId: customerUser.id,
      companyName: 'Cyberdyne Systems Inc.',
      phone: '+1-555-0199',
      billingAddressLine1: '100 Industrial Parkway',
      billingCity: 'Los Angeles',
      billingState: 'CA',
      billingPostalCode: '90001',
      billingCountry: 'US',
      defaultCurrency: 'USD',
    },
  });
  console.log(`✅ Customer user seeded: customer@odoo.local [${customerUser.id}]`);

  // 4. Products & Variants (including Odoo Brand +₹560 example)
  const odooCore = await prisma.product.upsert({
    where: { code: 'PRD-ODOO-CORE' },
    update: {
      salesPrice: 1000.0,
      costPrice: 400.0,
    },
    create: {
      name: 'Odoo Enterprise ERP Core',
      code: 'PRD-ODOO-CORE',
      type: ProductType.SERVICE,
      description: 'Comprehensive ERP platform subscription with CRM, Accounting, and Inventory modules.',
      internalNotes: 'Flagship product line. Requires annual maintenance agreement.',
      salesPrice: 1000.0,
      costPrice: 400.0,
      isActive: true,
    },
  });

  // Variants for Odoo Core: Standard vs Odoo Brand (+560)
  await prisma.productVariant.upsert({
    where: { sku: 'SKU-ODOO-COMMUNITY' },
    update: { additionalPrice: 0.0 },
    create: {
      productId: odooCore.id,
      variantName: 'Community Edition',
      sku: 'SKU-ODOO-COMMUNITY',
      attributeName: 'Brand',
      attributeValue: 'Community',
      additionalPrice: 0.0,
      isActive: true,
    },
  });

  await prisma.productVariant.upsert({
    where: { sku: 'SKU-ODOO-BRAND' },
    update: { additionalPrice: 560.0 },
    create: {
      productId: odooCore.id,
      variantName: 'Odoo Certified Enterprise Brand Edition',
      sku: 'SKU-ODOO-BRAND',
      attributeName: 'Brand',
      attributeValue: 'Odoo',
      additionalPrice: 560.0, // Specific example requirement: Odoo brand adds ₹560
      isActive: true,
    },
  });
  console.log(`✅ Product seeded: Odoo Enterprise ERP Core with Odoo Brand variant (+₹560)`);

  const cloudStorage = await prisma.product.upsert({
    where: { code: 'PRD-STORAGE-01' },
    update: {
      salesPrice: 50.0,
      costPrice: 15.0,
    },
    create: {
      name: 'Managed Cloud Backup 1TB',
      code: 'PRD-STORAGE-01',
      type: ProductType.DIGITAL,
      description: 'Encrypted offsite replication with automated daily snapshots.',
      internalNotes: 'Hosted across 3 availability zones.',
      salesPrice: 50.0,
      costPrice: 15.0,
      isActive: true,
    },
  });

  await prisma.productVariant.upsert({
    where: { sku: 'SKU-STRG-NVME' },
    update: { additionalPrice: 25.0 },
    create: {
      productId: cloudStorage.id,
      variantName: 'High IOPS NVMe Tier',
      sku: 'SKU-STRG-NVME',
      attributeName: 'Tier',
      attributeValue: 'NVMe',
      additionalPrice: 25.0,
      isActive: true,
    },
  });
  console.log('✅ Product seeded: Managed Cloud Backup 1TB with variants');

  // 5. Subscription Plans
  const plansData = [
    {
      name: 'Daily Developer Sandbox',
      code: 'PLAN-DAILY-SANDBOX',
      description: 'Short-term testing and development cluster billed daily.',
      billingFrequency: BillingFrequency.DAILY,
      basePrice: 5.0,
      currency: 'USD',
      minimumQuantity: 1,
      allowPause: true,
      allowRenewal: true,
      allowEarlyClosure: true,
      autoCloseOnExpiry: true,
      status: PlanStatus.ACTIVE,
      isActive: true,
    },
    {
      name: 'Weekly Growth Sprint',
      code: 'PLAN-WEEKLY-GROWTH',
      description: 'Agile subscription for fast-scaling engineering teams.',
      billingFrequency: BillingFrequency.WEEKLY,
      basePrice: 25.0,
      currency: 'USD',
      minimumQuantity: 1,
      allowPause: true,
      allowRenewal: true,
      allowEarlyClosure: true,
      autoCloseOnExpiry: true,
      status: PlanStatus.ACTIVE,
      isActive: true,
    },
    {
      name: 'Professional Monthly Tier',
      code: 'PLAN-MONTHLY-PRO',
      description: 'Full-featured enterprise plan with standard 30-day billing cycle.',
      billingFrequency: BillingFrequency.MONTHLY,
      basePrice: 99.0,
      currency: 'USD',
      minimumQuantity: 1,
      allowPause: true,
      allowRenewal: true,
      allowEarlyClosure: true,
      autoCloseOnExpiry: true,
      status: PlanStatus.ACTIVE,
      isActive: true,
    },
    {
      name: 'Enterprise Annual Contract',
      code: 'PLAN-YEARLY-ENT',
      description: 'Premium annual tier with 20% discount and dedicated account manager.',
      billingFrequency: BillingFrequency.YEARLY,
      basePrice: 999.0,
      currency: 'USD',
      minimumQuantity: 1,
      allowPause: true,
      allowRenewal: true,
      allowEarlyClosure: false, // Disallow early closure example
      autoCloseOnExpiry: true,
      status: PlanStatus.ACTIVE,
      isActive: true,
    },
  ];

  for (const p of plansData) {
    await prisma.subscriptionPlan.upsert({
      where: { code: p.code },
      update: p,
      create: p,
    });
  }
  console.log('✅ Subscription plans seeded across Daily, Weekly, Monthly, and Yearly frequencies');

  console.log('🚀 Seeding complete! Credentials:');
  console.log('   Admin:    admin@odoo.local    / AdminPass@1234');
  console.log('   Staff:    staff@odoo.local    / StaffPass@1234');
  console.log('   Customer: customer@odoo.local / CustomerPass@1234');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

