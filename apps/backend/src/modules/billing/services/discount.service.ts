import { prisma } from '../../../core/database/prisma.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../../core/errors/appError.js';
import { Decimal } from '@prisma/client/runtime/library';
import { CreateDiscountInput, ValidateDiscountInput, DiscountType } from '@odoo/shared';

export interface DiscountApplicationResult {
  discountId: string;
  code: string;
  type: string;
  discountAmount: number;
  newTotal: number;
}

export class DiscountService {
  /**
   * List all discounts, optionally only active
   */
  async listDiscounts(onlyActive = false) {
    const where = onlyActive ? { isActive: true } : {};
    return prisma.discount.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, code: true } },
        _count: { select: { usages: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single discount by code or ID
   */
  async getDiscount(identifier: string) {
    const discount = await prisma.discount.findFirst({
      where: {
        OR: [{ id: identifier }, { code: identifier.toUpperCase() }],
      },
      include: {
        product: { select: { id: true, name: true, code: true } },
        usages: {
          include: {
            customer: {
              include: {
                user: { select: { firstName: true, lastName: true, email: true } },
              },
            },
          },
          orderBy: { redeemedAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!discount) {
      throw new NotFoundError(`Discount '${identifier}' not found`);
    }
    return discount;
  }

  /**
   * Create a new discount rule
   */
  async createDiscount(input: CreateDiscountInput) {
    const existing = await prisma.discount.findUnique({
      where: { code: input.code.toUpperCase() },
    });
    if (existing) {
      throw new ConflictError(`Discount code '${input.code.toUpperCase()}' already exists`);
    }

    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestError('Invalid start or end date provided');
    }
    if (endDate <= startDate) {
      throw new BadRequestError('Discount end date must be after start date');
    }

    if (input.type === DiscountType.PERCENTAGE && (input.value <= 0 || input.value > 100)) {
      throw new BadRequestError('Percentage discount value must be between 0 and 100');
    }
    if (input.type === DiscountType.FIXED && input.value <= 0) {
      throw new BadRequestError('Fixed discount value must be greater than zero');
    }

    if (input.maxRedemptions <= 0) {
      throw new BadRequestError('Max redemptions must be greater than zero');
    }

    return prisma.discount.create({
      data: {
        code: input.code.toUpperCase().trim(),
        type: input.type,
        value: new Decimal(input.value.toFixed(4)),
        minPurchaseAmount: new Decimal((input.minPurchaseAmount || 0).toFixed(4)),
        minQuantity: input.minQuantity || 0,
        maxRedemptions: input.maxRedemptions,
        currentRedemptions: 0,
        maxPerCustomer: input.maxPerCustomer || 1,
        startDate,
        endDate,
        productId: input.productId || null,
        isActive: input.isActive ?? true,
      },
      include: {
        product: { select: { id: true, name: true, code: true } },
      },
    });
  }

  /**
   * Update an existing discount
   */
  async updateDiscount(id: string, input: Partial<CreateDiscountInput>) {
    const discount = await prisma.discount.findUnique({ where: { id } });
    if (!discount) {
      throw new NotFoundError(`Discount with ID '${id}' not found`);
    }

    let startDate = discount.startDate;
    let endDate = discount.endDate;

    if (input.startDate) {
      startDate = new Date(input.startDate);
    }
    if (input.endDate) {
      endDate = new Date(input.endDate);
    }

    if (endDate <= startDate) {
      throw new BadRequestError('Discount end date must be after start date');
    }

    return prisma.discount.update({
      where: { id },
      data: {
        ...(input.type && { type: input.type }),
        ...(input.value !== undefined && { value: new Decimal(input.value.toFixed(4)) }),
        ...(input.minPurchaseAmount !== undefined && {
          minPurchaseAmount: new Decimal(input.minPurchaseAmount.toFixed(4)),
        }),
        ...(input.minQuantity !== undefined && { minQuantity: input.minQuantity }),
        ...(input.maxRedemptions !== undefined && { maxRedemptions: input.maxRedemptions }),
        ...(input.maxPerCustomer !== undefined && { maxPerCustomer: input.maxPerCustomer }),
        startDate,
        endDate,
        ...(input.productId !== undefined && { productId: input.productId }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
  }

  /**
   * Toggle discount active state
   */
  async toggleActive(id: string) {
    const discount = await prisma.discount.findUnique({ where: { id } });
    if (!discount) {
      throw new NotFoundError(`Discount with ID '${id}' not found`);
    }
    return prisma.discount.update({
      where: { id },
      data: { isActive: !discount.isActive },
    });
  }

  /**
   * Validates discount eligibility for an order/invoice without redeeming it
   */
  async validateDiscount(input: ValidateDiscountInput): Promise<DiscountApplicationResult> {
    const discount = await prisma.discount.findUnique({
      where: { code: input.code.toUpperCase().trim() },
    });

    if (!discount) {
      throw new NotFoundError(`Discount coupon '${input.code}' does not exist`);
    }

    if (!discount.isActive) {
      throw new BadRequestError(`Discount coupon '${discount.code}' is inactive`);
    }

    const now = new Date();
    if (now < discount.startDate) {
      throw new BadRequestError(`Discount coupon '${discount.code}' has not started yet`);
    }
    if (now > discount.endDate) {
      throw new BadRequestError(`Discount coupon '${discount.code}' has expired`);
    }

    if (discount.currentRedemptions >= discount.maxRedemptions) {
      throw new BadRequestError(`Discount coupon '${discount.code}' has reached its maximum redemptions limit`);
    }

    // Check minimum purchase amount
    const minAmount = Number(discount.minPurchaseAmount);
    if (input.purchaseAmount < minAmount) {
      throw new BadRequestError(
        `Minimum purchase amount of $${minAmount.toFixed(2)} required for coupon '${discount.code}'`
      );
    }

    // Check minimum quantity
    if (input.quantity !== undefined && input.quantity < discount.minQuantity) {
      throw new BadRequestError(
        `Minimum quantity of ${discount.minQuantity} items required for coupon '${discount.code}'`
      );
    }

    // Check customer redemption count
    if (input.customerId) {
      const customerRedemptions = await prisma.discountUsage.count({
        where: {
          discountId: discount.id,
          customerId: input.customerId,
        },
      });

      if (customerRedemptions >= discount.maxPerCustomer) {
        throw new BadRequestError(
          `Customer has already reached the maximum usage limit (${discount.maxPerCustomer}) for coupon '${discount.code}'`
        );
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (discount.type === 'PERCENTAGE' || discount.type === DiscountType.PERCENTAGE) {
      const percent = Number(discount.value);
      discountAmount = Math.round(((input.purchaseAmount * percent) / 100) * 10000) / 10000;
    } else {
      discountAmount = Math.min(Number(discount.value), input.purchaseAmount);
    }

    // Ensure total is never negative
    discountAmount = Math.min(discountAmount, input.purchaseAmount);
    const newTotal = Math.max(0, Math.round((input.purchaseAmount - discountAmount) * 10000) / 10000);

    return {
      discountId: discount.id,
      code: discount.code,
      type: discount.type,
      discountAmount,
      newTotal,
    };
  }

  /**
   * Concurrency-safe atomic discount redemption
   */
  async redeemDiscountAtomically(
    code: string,
    customerId: string,
    invoiceId: string | null | undefined,
    purchaseAmount: number
  ): Promise<number> {
    const validation = await this.validateDiscount({
      code,
      customerId,
      purchaseAmount,
    });

    // Execute atomic conditional increment in transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // Raw SQL conditional update guaranteeing zero race condition over maxRedemptions
      const updateCount = await tx.$executeRaw`
        UPDATE discounts
        SET current_redemptions = current_redemptions + 1,
            updated_at = NOW()
        WHERE id = ${validation.discountId}
          AND current_redemptions < max_redemptions
          AND is_active = TRUE
      `;

      if (updateCount === 0) {
        throw new ConflictError(
          `Discount limit reached concurrently for code '${code}'. Could not redeem.`
        );
      }

      await tx.discountUsage.create({
        data: {
          discountId: validation.discountId,
          customerId,
          invoiceId: invoiceId || null,
        },
      });

      return validation.discountAmount;
    });

    return result;
  }
}

export const discountService = new DiscountService();
