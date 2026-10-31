import { z } from 'zod';
import { QuotationStatus } from '@odoo/shared';

export const quotationLineSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  variantId: z.string().uuid('Invalid variant ID').optional().nullable(),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').default(1),
  unitPrice: z.coerce.number().min(0, 'Unit price must be non-negative').optional(),
  taxRate: z.coerce.number().min(0).max(100, 'Tax rate must be between 0% and 100%').default(0),
});

export const createQuotationSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  planId: z.string().uuid('Invalid plan ID').optional().nullable(),
  templateId: z.string().uuid('Invalid template ID').optional().nullable(),
  validFrom: z.string().min(1, 'Valid from date is required'),
  validUntil: z.string().min(1, 'Valid until date is required'),
  notes: z.string().optional().nullable(),
  lines: z.array(quotationLineSchema).default([]),
});

export const updateQuotationSchema = z.object({
  planId: z.string().uuid('Invalid plan ID').optional().nullable(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional().nullable(),
  lines: z.array(quotationLineSchema).optional(),
});

export const updateQuotationStatusSchema = z.object({
  status: z.nativeEnum(QuotationStatus, {
    errorMap: () => ({ message: 'Status must be DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED, or CONVERTED' }),
  }),
});
