import { prisma } from '../../../core/database/prisma.js';
import { NotFoundError, BadRequestError } from '../../../core/errors/appError.js';
import { Decimal } from '@prisma/client/runtime/library';
import { CreateTaxRuleInput } from '@odoo/shared';

export interface TaxCalculationResult {
  taxRate: number;
  taxAmount: number;
  totalWithTax: number;
  appliedRules: Array<{
    name: string;
    ratePercentage: number;
    amount: number;
    isCompound: boolean;
  }>;
}

export class TaxService {
  /**
   * Retrieves all tax rules, optionally filtering by active state
   */
  async listTaxRules(onlyActive = false) {
    const where = onlyActive ? { isActive: true } : {};
    return prisma.taxRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves single tax rule by ID
   */
  async getTaxRuleById(id: string) {
    const rule = await prisma.taxRule.findUnique({
      where: { id },
    });
    if (!rule) {
      throw new NotFoundError(`Tax rule with ID '${id}' not found`);
    }
    return rule;
  }

  /**
   * Creates a new tax rule
   */
  async createTaxRule(input: CreateTaxRuleInput) {
    if (input.ratePercentage < 0 || input.ratePercentage > 100) {
      throw new BadRequestError('Tax rate percentage must be between 0 and 100');
    }

    return prisma.taxRule.create({
      data: {
        name: input.name,
        ratePercentage: new Decimal(input.ratePercentage.toFixed(4)),
        country: input.country?.toUpperCase() || null,
        state: input.state || null,
        isCompound: Boolean(input.isCompound),
        isActive: input.isActive ?? true,
      },
    });
  }

  /**
   * Updates an existing tax rule
   */
  async updateTaxRule(id: string, input: Partial<CreateTaxRuleInput>) {
    await this.getTaxRuleById(id);

    if (input.ratePercentage !== undefined && (input.ratePercentage < 0 || input.ratePercentage > 100)) {
      throw new BadRequestError('Tax rate percentage must be between 0 and 100');
    }

    return prisma.taxRule.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.ratePercentage !== undefined && {
          ratePercentage: new Decimal(input.ratePercentage.toFixed(4)),
        }),
        ...(input.country !== undefined && { country: input.country?.toUpperCase() || null }),
        ...(input.state !== undefined && { state: input.state || null }),
        ...(input.isCompound !== undefined && { isCompound: Boolean(input.isCompound) }),
        ...(input.isActive !== undefined && { isActive: Boolean(input.isActive) }),
      },
    });
  }

  /**
   * Toggles the active status of a tax rule
   */
  async toggleActive(id: string) {
    const existing = await this.getTaxRuleById(id);
    return prisma.taxRule.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
  }

  /**
   * Deactivates or removes a tax rule
   */
  async deleteTaxRule(id: string) {
    await this.getTaxRuleById(id);
    return prisma.taxRule.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Computes tax on a base amount using applicable tax rules.
   * Supports standard and compound taxes:
   * Non-compound taxes apply to the baseAmount directly.
   * Compound taxes apply to baseAmount + non-compound taxes.
   */
  async calculateTaxForAmount(
    baseAmount: number,
    taxRuleIds?: string[],
    country?: string
  ): Promise<TaxCalculationResult> {
    if (baseAmount <= 0) {
      return {
        taxRate: 0,
        taxAmount: 0,
        totalWithTax: 0,
        appliedRules: [],
      };
    }

    let rules = [];
    if (taxRuleIds && taxRuleIds.length > 0) {
      rules = await prisma.taxRule.findMany({
        where: { id: { in: taxRuleIds }, isActive: true },
      });
    } else {
      // Find rules matching country or global default rules
      const countryFilter = country ? [{ country }, { country: null }] : [{ country: null }];
      rules = await prisma.taxRule.findMany({
        where: {
          isActive: true,
          OR: countryFilter,
        },
      });
    }

    if (rules.length === 0) {
      return {
        taxRate: 0,
        taxAmount: 0,
        totalWithTax: baseAmount,
        appliedRules: [],
      };
    }

    // Separate into non-compound and compound rules
    const nonCompoundRules = rules.filter((r: { isCompound: boolean }) => !r.isCompound);
    const compoundRules = rules.filter((r: { isCompound: boolean }) => r.isCompound);

    let totalTax = 0;
    const appliedRules: TaxCalculationResult['appliedRules'] = [];

    // 1. Calculate non-compound taxes on the base amount
    for (const rule of nonCompoundRules) {
      const rate = Number(rule.ratePercentage);
      const amount = Math.round(((baseAmount * rate) / 100) * 10000) / 10000;
      totalTax += amount;
      appliedRules.push({
        name: rule.name,
        ratePercentage: rate,
        amount,
        isCompound: false,
      });
    }

    // 2. Calculate compound taxes on base amount + previous taxes
    let intermediateSubtotal = baseAmount + totalTax;
    for (const rule of compoundRules) {
      const rate = Number(rule.ratePercentage);
      const amount = Math.round(((intermediateSubtotal * rate) / 100) * 10000) / 10000;
      totalTax += amount;
      intermediateSubtotal += amount;
      appliedRules.push({
        name: rule.name,
        ratePercentage: rate,
        amount,
        isCompound: true,
      });
    }

    // Effective combined tax rate
    const effectiveRate = baseAmount > 0 ? (totalTax / baseAmount) * 100 : 0;

    return {
      taxRate: Math.round(effectiveRate * 100) / 100,
      taxAmount: Math.round(totalTax * 10000) / 10000,
      totalWithTax: Math.round((baseAmount + totalTax) * 10000) / 10000,
      appliedRules,
    };
  }
}

export const taxService = new TaxService();
