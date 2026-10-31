import { PlanStatus, BillingFrequency } from '@odoo/shared';
import { prisma } from '../../../core/database/prisma.js';
import { ConflictError, NotFoundError, BadRequestError } from '../../../core/errors/appError.js';
import { logger } from '../../../core/logging/logger.js';
import { z } from 'zod';
import { createPlanSchema, updatePlanSchema } from '../validations/plan.validation.js';

type CreatePlanInput = z.infer<typeof createPlanSchema>;
type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export class PlanService {
  /**
   * Creates a subscription plan
   */
  async createPlan(input: CreatePlanInput) {
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { code: input.code.toUpperCase() },
    });

    if (existing) {
      throw new ConflictError(`A plan with code '${input.code}' already exists`);
    }

    if (input.validFrom && input.validUntil) {
      const from = new Date(input.validFrom);
      const until = new Date(input.validUntil);
      if (until <= from) {
        throw new BadRequestError('Plan validUntil date must be strictly after validFrom date');
      }
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: input.name,
        code: input.code.toUpperCase(),
        description: input.description,
        billingFrequency: input.billingFrequency as BillingFrequency,
        basePrice: input.basePrice,
        currency: input.currency.toUpperCase(),
        minimumQuantity: input.minimumQuantity,
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        autoCloseOnExpiry: input.autoCloseOnExpiry,
        allowEarlyClosure: input.allowEarlyClosure,
        allowPause: input.allowPause,
        allowRenewal: input.allowRenewal,
        status: PlanStatus.ACTIVE,
        isActive: true,
      },
    });

    logger.info(`Subscription plan created [ID: ${plan.id}, Code: ${plan.code}]`);
    return this.serializePlan(plan);
  }

  /**
   * Updates an existing subscription plan
   */
  async updatePlan(id: string, input: UpdatePlanInput) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundError(`Subscription plan with ID '${id}' not found`);
    }

    if (input.code && input.code.toUpperCase() !== plan.code) {
      const existing = await prisma.subscriptionPlan.findUnique({
        where: { code: input.code.toUpperCase() },
      });
      if (existing) {
        throw new ConflictError(`A plan with code '${input.code}' already exists`);
      }
    }

    const updated = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.code ? { code: input.code.toUpperCase() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.billingFrequency ? { billingFrequency: input.billingFrequency as BillingFrequency } : {}),
        ...(input.basePrice !== undefined ? { basePrice: input.basePrice } : {}),
        ...(input.currency ? { currency: input.currency.toUpperCase() } : {}),
        ...(input.minimumQuantity !== undefined ? { minimumQuantity: input.minimumQuantity } : {}),
        ...(input.validFrom !== undefined ? { validFrom: input.validFrom ? new Date(input.validFrom) : null } : {}),
        ...(input.validUntil !== undefined ? { validUntil: input.validUntil ? new Date(input.validUntil) : null } : {}),
        ...(input.autoCloseOnExpiry !== undefined ? { autoCloseOnExpiry: input.autoCloseOnExpiry } : {}),
        ...(input.allowEarlyClosure !== undefined ? { allowEarlyClosure: input.allowEarlyClosure } : {}),
        ...(input.allowPause !== undefined ? { allowPause: input.allowPause } : {}),
        ...(input.allowRenewal !== undefined ? { allowRenewal: input.allowRenewal } : {}),
      },
    });

    logger.info(`Subscription plan updated [ID: ${updated.id}, Code: ${updated.code}]`);
    return this.serializePlan(updated);
  }

  /**
   * Lists subscription plans with role-aware availability filters
   */
  async listPlans(options: {
    status?: PlanStatus;
    billingFrequency?: BillingFrequency;
    search?: string;
    isActiveOnly?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (options.status) {
      where.status = options.status;
    }

    if (options.billingFrequency) {
      where.billingFrequency = options.billingFrequency;
    }

    if (options.isActiveOnly) {
      where.isActive = true;
      where.status = PlanStatus.ACTIVE;
    }

    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { code: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [plans, totalRecords] = await Promise.all([
      prisma.subscriptionPlan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.subscriptionPlan.count({ where }),
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      plans: plans.map((p) => this.serializePlan(p)),
      meta: {
        page,
        limit,
        totalRecords,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Retrieves single plan by ID
   */
  async getPlanById(id: string) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundError(`Subscription plan with ID '${id}' not found`);
    }
    return this.serializePlan(plan);
  }

  /**
   * Lifecycle Action: Pause Plan
   * Suspends the plan so that new subscriptions cannot be created.
   * Note: Existing active subscriptions continue unaffected.
   */
  async pausePlan(id: string) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundError(`Subscription plan with ID '${id}' not found`);
    }

    if (!plan.allowPause) {
      throw new BadRequestError(`Plan '${plan.name}' is configured to disallow pausing (allowPause=false)`);
    }

    if (plan.status !== PlanStatus.ACTIVE) {
      throw new BadRequestError(`Only ACTIVE plans can be paused. Current status is ${plan.status}`);
    }

    const updated = await prisma.subscriptionPlan.update({
      where: { id },
      data: { status: PlanStatus.PAUSED },
    });

    logger.info(`Plan paused [ID: ${id}, Code: ${plan.code}]`);
    return this.serializePlan(updated);
  }

  /**
   * Lifecycle Action: Resume Plan
   * Reactivates a paused plan.
   */
  async resumePlan(id: string) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundError(`Subscription plan with ID '${id}' not found`);
    }

    if (plan.status !== PlanStatus.PAUSED) {
      throw new BadRequestError(`Only PAUSED plans can be resumed. Current status is ${plan.status}`);
    }

    const updated = await prisma.subscriptionPlan.update({
      where: { id },
      data: { status: PlanStatus.ACTIVE },
    });

    logger.info(`Plan resumed [ID: ${id}, Code: ${plan.code}]`);
    return this.serializePlan(updated);
  }

  /**
   * Lifecycle Action: Early Closure
   * Terminates plan availability before its validity date.
   */
  async closePlanEarly(id: string) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundError(`Subscription plan with ID '${id}' not found`);
    }

    if (!plan.allowEarlyClosure) {
      throw new BadRequestError(`Plan '${plan.name}' is configured to disallow early closure (allowEarlyClosure=false)`);
    }

    if (plan.status === PlanStatus.CLOSED) {
      throw new BadRequestError(`Plan is already closed`);
    }

    const updated = await prisma.subscriptionPlan.update({
      where: { id },
      data: { status: PlanStatus.CLOSED },
    });

    logger.info(`Plan closed early [ID: ${id}, Code: ${plan.code}]`);
    return this.serializePlan(updated);
  }

  /**
   * Lifecycle Action: Renew Plan
   * Extends plan validity date and reactivates if closed.
   */
  async renewPlan(id: string, newValidUntil: string) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundError(`Subscription plan with ID '${id}' not found`);
    }

    if (!plan.allowRenewal) {
      throw new BadRequestError(`Plan '${plan.name}' is configured to disallow renewal (allowRenewal=false)`);
    }

    const validUntilDate = new Date(newValidUntil);
    if (isNaN(validUntilDate.getTime()) || validUntilDate <= new Date()) {
      throw new BadRequestError('New renewal date must be a valid future timestamp');
    }

    const updated = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        validUntil: validUntilDate,
        status: PlanStatus.ACTIVE,
      },
    });

    logger.info(`Plan renewed [ID: ${id}, New Expiry: ${validUntilDate.toISOString()}]`);
    return this.serializePlan(updated);
  }

  /**
   * Toggles active flag (soft delete / archive)
   */
  async togglePlanActive(id: string, isActive: boolean) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundError(`Subscription plan with ID '${id}' not found`);
    }

    const updated = await prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive },
    });

    return this.serializePlan(updated);
  }

  /**
   * Automatic Expiry Worker: Closes plans whose validUntil date has passed
   */
  async autoCloseExpiredPlans(): Promise<number> {
    const now = new Date();
    const result = await prisma.subscriptionPlan.updateMany({
      where: {
        status: PlanStatus.ACTIVE,
        autoCloseOnExpiry: true,
        validUntil: {
          not: null,
          lt: now,
        },
      },
      data: {
        status: PlanStatus.CLOSED,
      },
    });

    if (result.count > 0) {
      logger.info(`Auto-closed ${result.count} expired subscription plans`);
    }

    return result.count;
  }

  private serializePlan(p: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    billingFrequency: string;
    basePrice: unknown;
    currency: string;
    minimumQuantity: number;
    validFrom: Date | null;
    validUntil: Date | null;
    autoCloseOnExpiry: boolean;
    allowEarlyClosure: boolean;
    allowPause: boolean;
    allowRenewal: boolean;
    status: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      description: p.description,
      billingFrequency: p.billingFrequency as BillingFrequency,
      basePrice: Number(p.basePrice),
      currency: p.currency,
      minimumQuantity: p.minimumQuantity,
      validFrom: p.validFrom ? p.validFrom.toISOString() : null,
      validUntil: p.validUntil ? p.validUntil.toISOString() : null,
      autoCloseOnExpiry: p.autoCloseOnExpiry,
      allowEarlyClosure: p.allowEarlyClosure,
      allowPause: p.allowPause,
      allowRenewal: p.allowRenewal,
      status: p.status as PlanStatus,
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}

export const planService = new PlanService();
