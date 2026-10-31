import { z } from 'zod';
import { BillingFrequency, PaymentTerms, SubscriptionStatus } from '@odoo/shared';

export const subscriptionLineSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  variantId: z.string().uuid('Invalid variant ID').optional().nullable(),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').default(1),
  unitPrice: z.coerce.number().min(0, 'Unit price must be non-negative').optional(),
  taxRate: z.coerce.number().min(0).max(100, 'Tax rate must be between 0% and 100%').default(0),
});

export const createSubscriptionSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  planId: z.string().uuid('Invalid plan ID'),
  quotationId: z.string().uuid('Invalid quotation ID').optional().nullable(),
  paymentTerms: z.string().default(PaymentTerms.DUE_ON_RECEIPT),
  billingFrequency: z.nativeEnum(BillingFrequency).optional(),
  startDate: z.string().optional(),
  expiryDate: z.string().optional().nullable(),
  autoRenew: z.boolean().default(true),
  currency: z.string().length(3).default('USD'),
  lines: z.array(subscriptionLineSchema).default([]),
});

export const updateSubscriptionSchema = z.object({
  paymentTerms: z.string().optional(),
  autoRenew: z.boolean().optional(),
  expiryDate: z.string().optional().nullable(),
  lines: z.array(subscriptionLineSchema).optional(),
});

export const upgradeSubscriptionSchema = z.object({
  newPlanId: z.string().uuid('Invalid new plan ID'),
  effectiveDate: z.string().optional(),
});

export const updateSubscriptionStatusSchema = z.object({
  status: z.nativeEnum(SubscriptionStatus, {
    errorMap: () => ({ message: 'Invalid subscription status' }),
  }),
});
