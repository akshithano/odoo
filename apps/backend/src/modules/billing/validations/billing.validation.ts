import { z } from 'zod';

export const createTaxRuleSchema = z.object({
  name: z.string().min(1, 'Tax name is required').max(100),
  ratePercentage: z.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%'),
  country: z.string().length(2, 'Country must be a 2-letter ISO code').optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  isCompound: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const updateTaxRuleSchema = createTaxRuleSchema.partial();

export const createDiscountSchema = z.object({
  code: z.string().min(2, 'Discount code must be at least 2 characters').max(50),
  type: z.enum(['FIXED', 'PERCENTAGE']),
  value: z.number().positive('Discount value must be positive'),
  minPurchaseAmount: z.number().min(0).optional(),
  minQuantity: z.number().int().min(0).optional(),
  maxRedemptions: z.number().int().positive('Max redemptions must be positive'),
  maxPerCustomer: z.number().int().positive().optional(),
  startDate: z.string().datetime({ offset: true }).or(z.string().min(10)),
  endDate: z.string().datetime({ offset: true }).or(z.string().min(10)),
  productId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateDiscountSchema = createDiscountSchema.partial();

export const validateDiscountSchema = z.object({
  code: z.string().min(1, 'Discount code is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  purchaseAmount: z.number().min(0, 'Purchase amount cannot be negative'),
  quantity: z.number().int().min(0).optional(),
  productId: z.string().optional(),
});

export const generateCycleSchema = z.object({
  asOfDate: z.string().optional(),
  subscriptionId: z.string().uuid().optional(),
});

export const confirmInvoiceSchema = z.object({
  discountCode: z.string().optional(),
});

export const updateDraftInvoiceSchema = z.object({
  notes: z.string().optional(),
  dueDate: z.string().optional(),
  lines: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().min(0),
        taxRate: z.number().min(0).max(100).optional(),
      })
    )
    .optional(),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID format'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  paymentDate: z.string().optional(),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
});

export const createOnlineOrderSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID format'),
});

export const verifyPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  orderId: z.string().min(1, 'Order ID is required'),
  paymentId: z.string().min(1, 'Payment ID is required'),
  signature: z.string().min(1, 'Signature is required'),
});

export const createRefundSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID format'),
  amount: z.number().positive('Refund amount must be greater than zero'),
  reason: z.string().min(3, 'Refund reason must be provided (min 3 chars)'),
  transactionReference: z.string().optional(),
});
