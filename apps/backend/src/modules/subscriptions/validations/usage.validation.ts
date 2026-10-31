import { z } from 'zod';

export const ingestUsageEventSchema = z.object({
  subscriptionId: z.string().uuid('Invalid subscription ID'),
  customerId: z.string().uuid('Invalid customer ID').optional(),
  usageType: z.string().min(1, 'Usage type is required').trim(),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unitOfMeasure: z.string().trim().default('units'),
  timestamp: z.string().datetime().optional(),
  idempotencyKey: z.string().min(1, 'Idempotency key is required').trim(),
  notes: z.string().optional().nullable(),
});

export const queryUsageSummarySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
