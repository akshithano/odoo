import { z } from 'zod';
import { PricingModel, TierType } from '@odoo/shared';

export const pricingTierItemSchema = z.object({
  id: z.string().uuid().optional(),
  planId: z.string().uuid().optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  tierType: z.nativeEnum(TierType).default(TierType.QUANTITY_BASED),
  modelType: z.nativeEnum(PricingModel).default(PricingModel.GRADUATED),
  minQuantity: z.coerce.number().int().min(0, 'Minimum quantity cannot be negative').default(0),
  maxQuantity: z.coerce.number().int().min(1).optional().nullable(),
  unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative'),
});

export const createPricingTierSchema = pricingTierItemSchema.refine(
  (data) => !data.maxQuantity || data.maxQuantity >= data.minQuantity,
  {
    message: 'Max quantity must be greater than or equal to minimum quantity',
    path: ['maxQuantity'],
  }
);

export const bulkPricingTiersSchema = z.object({
  planId: z.string().uuid().optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  tierType: z.nativeEnum(TierType).default(TierType.QUANTITY_BASED),
  modelType: z.nativeEnum(PricingModel).default(PricingModel.GRADUATED),
  tiers: z
    .array(
      z.object({
        minQuantity: z.coerce.number().int().min(0, 'Min quantity cannot be negative'),
        maxQuantity: z.coerce.number().int().optional().nullable(),
        unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative'),
      })
    )
    .min(1, 'At least one tier bracket must be defined'),
});

export const calculatePriceSchema = z.object({
  planId: z.string().uuid().optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  quantity: z.coerce.number().min(0, 'Quantity cannot be negative'),
  tierType: z.nativeEnum(TierType).optional().default(TierType.QUANTITY_BASED),
  modelType: z.nativeEnum(PricingModel).optional(),
  customTiers: z
    .array(
      z.object({
        minQuantity: z.coerce.number().int().min(0),
        maxQuantity: z.coerce.number().int().optional().nullable(),
        unitPrice: z.coerce.number().min(0),
      })
    )
    .optional(),
});
