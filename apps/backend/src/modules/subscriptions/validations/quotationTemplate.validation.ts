import { z } from 'zod';

export const quotationTemplateLineSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  variantId: z.string().uuid('Invalid variant ID').optional().nullable(),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').default(1),
  unitPrice: z.coerce.number().min(0, 'Unit price must be non-negative').default(0),
});

export const createQuotationTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').trim(),
  code: z.string().min(1, 'Template code is required').trim().toUpperCase(),
  description: z.string().optional().nullable(),
  planId: z.string().uuid('Invalid plan ID').optional().nullable(),
  defaultValidityDays: z.coerce.number().int().min(1, 'Validity days must be at least 1').default(30),
  isActive: z.boolean().default(true),
  lines: z.array(quotationTemplateLineSchema).default([]),
});

export const updateQuotationTemplateSchema = createQuotationTemplateSchema.partial();
