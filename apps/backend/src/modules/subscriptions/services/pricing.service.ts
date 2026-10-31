import { prisma } from '../../../core/database/prisma.js';
import { BadRequestError, NotFoundError } from '../../../core/errors/appError.js';
import { PricingModel, TierType } from '@odoo/shared';
import { Decimal } from '@prisma/client/runtime/library';

export interface TierBracketInput {
  minQuantity: number;
  maxQuantity?: number | null;
  unitPrice: number;
}

export interface CalculationBracketResult {
  tierNumber: number;
  minQuantity: number;
  maxQuantity: number | null;
  applicableQuantity: number;
  unitPrice: number;
  bracketTotal: number;
}

export interface PriceCalculationResult {
  modelType: PricingModel;
  totalQuantity: number;
  totalCalculatedPrice: number;
  effectiveUnitPrice: number;
  brackets: CalculationBracketResult[];
}

export class PricingService {
  /**
   * Validates that an array of tiers has valid bounds and no overlaps
   */
  validateTierRanges(tiers: TierBracketInput[]): void {
    if (!tiers || tiers.length === 0) {
      throw new BadRequestError('At least one pricing tier bracket is required');
    }

    // Sort by minQuantity ascending
    const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);

    for (let i = 0; i < sorted.length; i++) {
      const tier = sorted[i];

      if (tier.minQuantity < 0) {
        throw new BadRequestError(`Tier bracket ${i + 1} has negative minQuantity (${tier.minQuantity})`);
      }

      if (tier.unitPrice < 0) {
        throw new BadRequestError(`Tier bracket ${i + 1} has negative unitPrice (${tier.unitPrice})`);
      }

      if (tier.maxQuantity !== null && tier.maxQuantity !== undefined) {
        if (tier.maxQuantity < tier.minQuantity) {
          throw new BadRequestError(
            `Tier bracket ${i + 1} maxQuantity (${tier.maxQuantity}) cannot be less than minQuantity (${tier.minQuantity})`
          );
        }
      }

      if (i > 0) {
        const prevTier = sorted[i - 1];
        if (prevTier.maxQuantity === null || prevTier.maxQuantity === undefined) {
          throw new BadRequestError(
            `Tier bracket ${i} is unbounded (maxQuantity is null), so no subsequent tier can be defined`
          );
        }

        if (tier.minQuantity <= prevTier.maxQuantity && tier.minQuantity !== prevTier.maxQuantity + 1) {
          // Detect strict overlap (e.g. 1-10 and 5-20)
          if (tier.minQuantity < prevTier.maxQuantity) {
            throw new BadRequestError(
              `Overlapping tier ranges detected between bracket ${i} (up to ${prevTier.maxQuantity}) and bracket ${i + 1} (starts at ${tier.minQuantity})`
            );
          }
        }
      }
    }
  }

  /**
   * Core Tiered Pricing Math: Graduated vs Volume calculations
   */
  calculateTieredPrice(
    quantity: number,
    tiers: TierBracketInput[],
    modelType: PricingModel = PricingModel.GRADUATED
  ): PriceCalculationResult {
    this.validateTierRanges(tiers);

    if (quantity <= 0) {
      return {
        modelType,
        totalQuantity: 0,
        totalCalculatedPrice: 0,
        effectiveUnitPrice: 0,
        brackets: [],
      };
    }

    const sortedTiers = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);

    if (modelType === PricingModel.VOLUME) {
      // VOLUME PRICING:
      // Find the single tier bracket that contains the requested quantity.
      // All units are charged at that bracket's unit price.
      let matchedTier: TierBracketInput | null = null;
      let matchedIndex = -1;

      for (let i = 0; i < sortedTiers.length; i++) {
        const t = sortedTiers[i];
        const isAboveMin = quantity >= t.minQuantity;
        const isBelowMax = t.maxQuantity === null || t.maxQuantity === undefined || quantity <= t.maxQuantity;

        if (isAboveMin && isBelowMax) {
          matchedTier = t;
          matchedIndex = i;
          break;
        }
      }

      // If quantity exceeds the highest defined tier, fallback to highest tier
      if (!matchedTier && sortedTiers.length > 0) {
        matchedIndex = sortedTiers.length - 1;
        matchedTier = sortedTiers[matchedIndex];
      }

      const unitPrice = matchedTier ? Number(matchedTier.unitPrice) : 0;
      const totalCalculatedPrice = Number((quantity * unitPrice).toFixed(4));
      const effectiveUnitPrice = Number(unitPrice.toFixed(4));

      return {
        modelType: PricingModel.VOLUME,
        totalQuantity: quantity,
        totalCalculatedPrice,
        effectiveUnitPrice,
        brackets: matchedTier
          ? [
              {
                tierNumber: matchedIndex + 1,
                minQuantity: matchedTier.minQuantity,
                maxQuantity: matchedTier.maxQuantity ?? null,
                applicableQuantity: quantity,
                unitPrice,
                bracketTotal: totalCalculatedPrice,
              },
            ]
          : [],
      };
    }

    // GRADUATED PRICING:
    // Each portion of quantity is charged at the rate applicable to its respective tier.
    const brackets: CalculationBracketResult[] = [];
    let totalPrice = 0;
    let unitsAllocated = 0;

    for (let i = 0; i < sortedTiers.length; i++) {
      if (unitsAllocated >= quantity) break;

      const t = sortedTiers[i];
      const tierMin = t.minQuantity;
      const tierMax = t.maxQuantity ?? null;
      const unitPrice = Number(t.unitPrice);

      // Determine starting offset for this tier
      // If minQuantity is 0 or 1, base starts from 0 or minQuantity - 1
      const tierFloor = tierMin === 0 ? 0 : tierMin - 1;

      // Units in this tier
      let applicableQuantity = 0;

      if (quantity > tierFloor) {
        if (tierMax !== null) {
          const upperCap = Math.min(quantity, tierMax);
          applicableQuantity = Math.max(0, upperCap - tierFloor);
        } else {
          applicableQuantity = Math.max(0, quantity - tierFloor);
        }
      }

      if (applicableQuantity > 0) {
        const bracketTotal = Number((applicableQuantity * unitPrice).toFixed(4));
        totalPrice += bracketTotal;
        unitsAllocated += applicableQuantity;

        brackets.push({
          tierNumber: i + 1,
          minQuantity: tierMin,
          maxQuantity: tierMax,
          applicableQuantity,
          unitPrice,
          bracketTotal,
        });
      }
    }

    const totalCalculatedPrice = Number(totalPrice.toFixed(4));
    const effectiveUnitPrice = quantity > 0 ? Number((totalCalculatedPrice / quantity).toFixed(4)) : 0;

    return {
      modelType: PricingModel.GRADUATED,
      totalQuantity: quantity,
      totalCalculatedPrice,
      effectiveUnitPrice,
      brackets,
    };
  }

  /**
   * Calculate price from database tiers configured for a plan or product
   */
  async calculateForEntity(params: {
    planId?: string | null;
    productId?: string | null;
    quantity: number;
    tierType?: TierType;
    modelType?: PricingModel;
    customTiers?: TierBracketInput[];
  }): Promise<PriceCalculationResult> {
    if (params.customTiers && params.customTiers.length > 0) {
      return this.calculateTieredPrice(
        params.quantity,
        params.customTiers,
        params.modelType || PricingModel.GRADUATED
      );
    }

    if (!params.planId && !params.productId) {
      throw new BadRequestError('Either planId, productId, or customTiers must be provided');
    }

    const whereClause: any = {};
    if (params.planId) whereClause.planId = params.planId;
    if (params.productId) whereClause.productId = params.productId;
    if (params.tierType) whereClause.tierType = params.tierType;

    const tiers = await prisma.pricingTier.findMany({
      where: whereClause,
      orderBy: { minQuantity: 'asc' },
    });

    if (tiers.length === 0) {
      // If no tiers configured, fetch base price of product or plan
      let fallbackPrice = 0;
      if (params.productId) {
        const prod = await prisma.product.findUnique({ where: { id: params.productId } });
        fallbackPrice = prod ? Number(prod.salesPrice) : 0;
      } else if (params.planId) {
        const plan = await prisma.subscriptionPlan.findUnique({ where: { id: params.planId } });
        fallbackPrice = plan ? Number(plan.basePrice) : 0;
      }

      const total = Number((params.quantity * fallbackPrice).toFixed(4));
      return {
        modelType: params.modelType || PricingModel.FLAT,
        totalQuantity: params.quantity,
        totalCalculatedPrice: total,
        effectiveUnitPrice: fallbackPrice,
        brackets: [
          {
            tierNumber: 1,
            minQuantity: 0,
            maxQuantity: null,
            applicableQuantity: params.quantity,
            unitPrice: fallbackPrice,
            bracketTotal: total,
          },
        ],
      };
    }

    const modelType = (params.modelType || tiers[0].modelType || PricingModel.GRADUATED) as PricingModel;
    const tierInputs: TierBracketInput[] = tiers.map((t) => ({
      minQuantity: t.minQuantity,
      maxQuantity: t.maxQuantity,
      unitPrice: Number(t.unitPrice),
    }));

    return this.calculateTieredPrice(params.quantity, tierInputs, modelType);
  }

  /**
   * Bulk configure/replace pricing tiers for a plan or product
   */
  async setBulkPricingTiers(params: {
    planId?: string | null;
    productId?: string | null;
    tierType: TierType;
    modelType: PricingModel;
    tiers: TierBracketInput[];
  }) {
    if (!params.planId && !params.productId) {
      throw new BadRequestError('Must specify either planId or productId');
    }

    this.validateTierRanges(params.tiers);

    return prisma.$transaction(async (tx) => {
      // Remove existing tiers for this target and type
      await tx.pricingTier.deleteMany({
        where: {
          planId: params.planId || null,
          productId: params.productId || null,
          tierType: params.tierType,
        },
      });

      // Insert new tiers
      const createdTiers = [];
      for (const t of params.tiers) {
        const created = await tx.pricingTier.create({
          data: {
            planId: params.planId || null,
            productId: params.productId || null,
            tierType: params.tierType,
            modelType: params.modelType,
            minQuantity: t.minQuantity,
            maxQuantity: t.maxQuantity ?? null,
            unitPrice: new Decimal(t.unitPrice),
          },
        });
        createdTiers.push(created);
      }

      return createdTiers;
    });
  }

  /**
   * List pricing tiers with optional filtering
   */
  async listTiers(filters: {
    planId?: string;
    productId?: string;
    tierType?: TierType;
    modelType?: PricingModel;
  }) {
    const where: any = {};
    if (filters.planId) where.planId = filters.planId;
    if (filters.productId) where.productId = filters.productId;
    if (filters.tierType) where.tierType = filters.tierType;
    if (filters.modelType) where.modelType = filters.modelType;

    return prisma.pricingTier.findMany({
      where,
      include: {
        plan: { select: { id: true, name: true, code: true, basePrice: true } },
        product: { select: { id: true, name: true, code: true, salesPrice: true } },
      },
      orderBy: [{ planId: 'asc' }, { productId: 'asc' }, { minQuantity: 'asc' }],
    });
  }

  /**
   * Delete pricing tier by ID
   */
  async deleteTier(id: string) {
    const existing = await prisma.pricingTier.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Pricing tier ${id} not found`);
    }
    return prisma.pricingTier.delete({ where: { id } });
  }
}

export const pricingService = new PricingService();
