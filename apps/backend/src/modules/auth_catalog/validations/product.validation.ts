import { z } from 'zod';
import { ProductType } from '@odoo/shared';

export const createVariantSchema = z.object({
  variantName: z.string().min(1, 'Variant name is required').trim(),
  sku: z.string().min(1, 'SKU is required').trim().toUpperCase(),
  attributeName: z.string().optional(),
  attributeValue: z.string().optional(),
  additionalPrice: z.coerce.number().min(0, 'Additional price must be non-negative').default(0),
});

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').trim(),
  code: z.string().min(1, 'Product code is required').trim().toUpperCase(),
  type: z.nativeEnum(ProductType, {
    errorMap: () => ({ message: 'Product type must be SERVICE, PHYSICAL, or DIGITAL' }),
  }),
  description: z.string().optional(),
  internalNotes: z.string().optional(),
  salesPrice: z.coerce.number().min(0, 'Sales price must be non-negative'),
  costPrice: z.coerce.number().min(0, 'Cost price must be non-negative').default(0),
  variants: z.array(createVariantSchema).optional().default([]),
});

export const updateProductSchema = createProductSchema.partial();

export const calculateVariantPriceSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  variantId: z.string().uuid('Invalid variant ID'),
});
