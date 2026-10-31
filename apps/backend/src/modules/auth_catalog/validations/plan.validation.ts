import { z } from 'zod';
import { BillingFrequency } from '@odoo/shared';

export const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required').trim(),
  code: z.string().min(1, 'Plan code is required').trim().toUpperCase(),
  description: z.string().optional(),
  billingFrequency: z.nativeEnum(BillingFrequency, {
    errorMap: () => ({ message: 'Billing frequency must be DAILY, WEEKLY, MONTHLY, or YEARLY' }),
  }),
  basePrice: z.coerce.number().min(0, 'Base price must be non-negative'),
  currency: z.string().length(3, 'Currency must be a 3-letter ISO code (e.g. USD, INR)').toUpperCase().default('USD'),
  minimumQuantity: z.coerce.number().int().min(1, 'Minimum quantity must be at least 1').default(1),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  autoCloseOnExpiry: z.boolean().default(true),
  allowEarlyClosure: z.boolean().default(true),
  allowPause: z.boolean().default(true),
  allowRenewal: z.boolean().default(true),
});

export const updatePlanSchema = createPlanSchema.partial();

export const renewPlanSchema = z.object({
  newValidUntil: z.string().datetime({ message: 'Valid extension date required' }),
});
