import { prisma } from '../../../core/database/prisma.js';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
} from '../../../core/errors/appError.js';
import {
  SubscriptionStatus,
  BillingFrequency,
  PaymentTerms,
} from '@odoo/shared';
import { Decimal } from '@prisma/client/runtime/library';
import { prorationService } from './proration.service.js';
import { historyService } from './history.service.js';
import { enqueueSubscriptionClosedJob } from '../../../core/queue/queue.js';

export interface SubscriptionLineInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice?: number;
  taxRate?: number;
}

export interface CreateSubscriptionInput {
  customerId: string;
  planId: string;
  quotationId?: string | null;
  paymentTerms?: string;
  billingFrequency?: BillingFrequency;
  startDate?: string;
  expiryDate?: string | null;
  autoRenew?: boolean;
  currency?: string;
  lines?: SubscriptionLineInput[];
}

export class SubscriptionService {
  /**
   * Generates a deterministic, unique human-readable subscription number: SUB-YYYYMM-XXXX
   */
  async generateSubscriptionNumber(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `SUB-${yearMonth}-`;

    const latest = await prisma.subscription.findFirst({
      where: { subscriptionNumber: { startsWith: prefix } },
      orderBy: { subscriptionNumber: 'desc' },
      select: { subscriptionNumber: true },
    });

    let nextSeq = 1;
    if (latest && latest.subscriptionNumber) {
      const parts = latest.subscriptionNumber.split('-');
      if (parts.length === 3) {
        const lastNum = parseInt(parts[2], 10);
        if (!isNaN(lastNum)) {
          nextSeq = lastNum + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Calculates the end date of a billing cycle given the start date and frequency
   */
  calculatePeriodEnd(startDate: Date, frequency: BillingFrequency): Date {
    const end = new Date(startDate.getTime());
    switch (frequency) {
      case BillingFrequency.DAILY:
        end.setDate(end.getDate() + 1);
        break;
      case BillingFrequency.WEEKLY:
        end.setDate(end.getDate() + 7);
        break;
      case BillingFrequency.MONTHLY:
        end.setMonth(end.getMonth() + 1);
        break;
      case BillingFrequency.YEARLY:
        end.setFullYear(end.getFullYear() + 1);
        break;
      default:
        end.setMonth(end.getMonth() + 1);
    }
    return end;
  }

  /**
   * Create a new subscription
   */
  async createSubscription(data: CreateSubscriptionInput, userId?: string | null) {
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
    });
    if (!customer) {
      throw new NotFoundError(`Customer with ID ${data.customerId} not found`);
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: data.planId },
    });
    if (!plan) {
      throw new NotFoundError(`Subscription plan with ID ${data.planId} not found`);
    }

    const billingFrequency = data.billingFrequency || (plan.billingFrequency as BillingFrequency);
    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const currentPeriodStart = new Date(startDate.getTime());
    const currentPeriodEnd = this.calculatePeriodEnd(currentPeriodStart, billingFrequency);
    const expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;

    const subscriptionNumber = await this.generateSubscriptionNumber();

    const createdSub = await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.create({
        data: {
          subscriptionNumber,
          customerId: data.customerId,
          planId: data.planId,
          quotationId: data.quotationId || null,
          status: SubscriptionStatus.CONFIRMED,
          paymentTerms: data.paymentTerms || PaymentTerms.DUE_ON_RECEIPT,
          billingFrequency,
          currentPeriodStart,
          currentPeriodEnd,
          startDate,
          expiryDate,
          autoRenew: data.autoRenew ?? true,
          currency: data.currency || customer.defaultCurrency || 'USD',
          subtotal: new Decimal(0),
          taxAmount: new Decimal(0),
          totalAmount: new Decimal(0),
        },
      });

      let subtotal = Number(plan.basePrice); // Include base plan price in subtotal
      let taxAmount = 0;

      if (data.lines && data.lines.length > 0) {
        for (const line of data.lines) {
          const prod = await tx.product.findUnique({ where: { id: line.productId } });
          if (!prod) throw new NotFoundError(`Product ${line.productId} not found`);

          let unitPrice = line.unitPrice !== undefined ? line.unitPrice : Number(prod.salesPrice);
          if (line.variantId) {
            const variant = await tx.productVariant.findUnique({ where: { id: line.variantId } });
            if (!variant) throw new NotFoundError(`Product variant ${line.variantId} not found`);
            if (line.unitPrice === undefined) {
              unitPrice += Number(variant.additionalPrice);
            }
          }

          const quantity = line.quantity || 1;
          const lineBase = quantity * unitPrice;
          const taxRate = line.taxRate || 0;
          const lineTax = lineBase * (taxRate / 100);
          const lineTotal = lineBase + lineTax;

          subtotal += lineBase;
          taxAmount += lineTax;

          await tx.subscriptionLine.create({
            data: {
              subscriptionId: sub.id,
              productId: line.productId,
              variantId: line.variantId || null,
              quantity,
              unitPrice: new Decimal(unitPrice),
              taxRate: new Decimal(taxRate),
              taxAmount: new Decimal(lineTax),
              lineTotal: new Decimal(lineTotal),
            },
          });
        }
      }

      const totalAmount = subtotal + taxAmount;

      return tx.subscription.update({
        where: { id: sub.id },
        data: {
          subtotal: new Decimal(subtotal.toFixed(4)),
          taxAmount: new Decimal(taxAmount.toFixed(4)),
          totalAmount: new Decimal(totalAmount.toFixed(4)),
        },
        include: {
          customer: { include: { user: true } },
          plan: true,
          lines: { include: { product: true, variant: true } },
        },
      });
    });

    // Record creation in history
    await historyService.record({
      subscriptionId: createdSub.id,
      action: 'CREATED',
      newValue: `Created subscription ${createdSub.subscriptionNumber} with plan ${plan.name}`,
      performedById: userId,
    });

    return createdSub;
  }

  /**
   * Internal helper: create subscription from an accepted quotation
   */
  async createFromQuotation(quotation: any, userId?: string | null) {
    const plan = quotation.plan;
    const billingFrequency = (plan?.billingFrequency as BillingFrequency) || BillingFrequency.MONTHLY;
    const startDate = new Date();
    const currentPeriodStart = new Date();
    const currentPeriodEnd = this.calculatePeriodEnd(currentPeriodStart, billingFrequency);

    const subscriptionNumber = await this.generateSubscriptionNumber();

    const createdSub = await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.create({
        data: {
          subscriptionNumber,
          customerId: quotation.customerId,
          planId: quotation.planId!,
          quotationId: quotation.id,
          status: SubscriptionStatus.CONFIRMED,
          paymentTerms: PaymentTerms.DUE_ON_RECEIPT,
          billingFrequency,
          currentPeriodStart,
          currentPeriodEnd,
          startDate,
          expiryDate: quotation.validUntil,
          autoRenew: true,
          currency: quotation.customer?.defaultCurrency || 'USD',
          subtotal: quotation.subtotal,
          taxAmount: quotation.taxAmount,
          totalAmount: quotation.totalAmount,
        },
      });

      // Transfer lines
      for (const line of quotation.lines) {
        await tx.subscriptionLine.create({
          data: {
            subscriptionId: sub.id,
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            taxAmount: line.taxAmount,
            lineTotal: line.lineTotal,
          },
        });
      }

      return tx.subscription.findUnique({
        where: { id: sub.id },
        include: {
          customer: { include: { user: true } },
          plan: true,
          lines: { include: { product: true, variant: true } },
        },
      });
    });

    await historyService.record({
      subscriptionId: createdSub!.id,
      action: 'CREATED_FROM_QUOTATION',
      previousValue: quotation.quotationNumber,
      newValue: createdSub!.subscriptionNumber,
      performedById: userId,
    });

    return createdSub!;
  }

  /**
   * Get subscription by ID with isolation support
   */
  async getSubscriptionById(id: string, customerIdFilter?: string | null) {
    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        plan: true,
        quotation: {
          select: { id: true, quotationNumber: true, status: true, validUntil: true },
        },
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
        changes: {
          include: {
            previousPlan: { select: { id: true, name: true, code: true, basePrice: true } },
            newPlan: { select: { id: true, name: true, code: true, basePrice: true } },
            createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundError(`Subscription ${id} not found`);
    }

    if (customerIdFilter && subscription.customerId !== customerIdFilter) {
      throw new NotFoundError(`Subscription ${id} not found`);
    }

    return subscription;
  }

  /**
   * List subscriptions with search, filter, and pagination
   */
  async listSubscriptions(params: {
    customerId?: string;
    status?: SubscriptionStatus;
    planId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.customerId) {
      where.customerId = params.customerId;
    }
    if (params.status) {
      where.status = params.status;
    }
    if (params.planId) {
      where.planId = params.planId;
    }
    if (params.search) {
      where.OR = [
        { subscriptionNumber: { contains: params.search, mode: 'insensitive' } },
        { customer: { companyName: { contains: params.search, mode: 'insensitive' } } },
        { customer: { user: { email: { contains: params.search, mode: 'insensitive' } } } },
        { plan: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [totalRecords, items] = await Promise.all([
      prisma.subscription.count({ where }),
      prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: {
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
          },
          plan: { select: { id: true, name: true, code: true, basePrice: true, billingFrequency: true } },
          quotation: { select: { id: true, quotationNumber: true } },
          _count: { select: { lines: true, usageRecords: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        hasNextPage: page * limit < totalRecords,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Update subscription details (payment terms, autoRenew, expiryDate, lines)
   */
  async updateSubscription(
    id: string,
    data: {
      paymentTerms?: string;
      autoRenew?: boolean;
      expiryDate?: string | null;
      lines?: SubscriptionLineInput[];
    },
    customerIdFilter?: string | null,
    userId?: string | null
  ) {
    const sub = await this.getSubscriptionById(id, customerIdFilter);

    if (sub.status === SubscriptionStatus.CLOSED) {
      throw new UnprocessableEntityError('Cannot modify a closed subscription');
    }

    const updateData: any = {};
    if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms;
    if (data.autoRenew !== undefined) updateData.autoRenew = data.autoRenew;
    if (data.expiryDate !== undefined) {
      updateData.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (data.lines) {
        await tx.subscriptionLine.deleteMany({ where: { subscriptionId: id } });
        let subtotal = Number(sub.plan.basePrice);
        let taxAmount = 0;

        for (const line of data.lines) {
          const prod = await tx.product.findUnique({ where: { id: line.productId } });
          if (!prod) throw new NotFoundError(`Product ${line.productId} not found`);

          let unitPrice = line.unitPrice !== undefined ? line.unitPrice : Number(prod.salesPrice);
          if (line.variantId) {
            const variant = await tx.productVariant.findUnique({ where: { id: line.variantId } });
            if (line.unitPrice === undefined && variant) {
              unitPrice += Number(variant.additionalPrice);
            }
          }

          const quantity = line.quantity || 1;
          const lineBase = quantity * unitPrice;
          const taxRate = line.taxRate || 0;
          const lineTax = lineBase * (taxRate / 100);
          const lineTotal = lineBase + lineTax;

          subtotal += lineBase;
          taxAmount += lineTax;

          await tx.subscriptionLine.create({
            data: {
              subscriptionId: id,
              productId: line.productId,
              variantId: line.variantId || null,
              quantity,
              unitPrice: new Decimal(unitPrice),
              taxRate: new Decimal(taxRate),
              taxAmount: new Decimal(lineTax),
              lineTotal: new Decimal(lineTotal),
            },
          });
        }

        updateData.subtotal = new Decimal(subtotal.toFixed(4));
        updateData.taxAmount = new Decimal(taxAmount.toFixed(4));
        updateData.totalAmount = new Decimal((subtotal + taxAmount).toFixed(4));
      }

      return tx.subscription.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          plan: true,
          lines: { include: { product: true, variant: true } },
        },
      });
    });

    await historyService.record({
      subscriptionId: id,
      action: 'UPDATED',
      newValue: `Updated details: ${JSON.stringify(updateData)}`,
      performedById: userId,
    });

    return updated;
  }

  /**
   * Lifecycle: Confirm Subscription (DRAFT -> CONFIRMED)
   */
  async confirmSubscription(id: string, customerIdFilter?: string | null, userId?: string | null) {
    const sub = await this.getSubscriptionById(id, customerIdFilter);
    if (sub.status !== SubscriptionStatus.DRAFT && sub.status !== SubscriptionStatus.QUOTATION) {
      throw new UnprocessableEntityError(`Subscription in status ${sub.status} cannot be confirmed`);
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.CONFIRMED },
    });

    await historyService.record({
      subscriptionId: id,
      action: 'STATUS_CHANGED',
      previousValue: sub.status,
      newValue: SubscriptionStatus.CONFIRMED,
      performedById: userId,
    });

    return updated;
  }

  /**
   * Lifecycle: Activate Subscription (CONFIRMED/DRAFT/PAUSED -> ACTIVE)
   */
  async activateSubscription(id: string, customerIdFilter?: string | null, userId?: string | null) {
    const sub = await this.getSubscriptionById(id, customerIdFilter);

    if (sub.status === SubscriptionStatus.CLOSED) {
      throw new UnprocessableEntityError('Cannot activate a closed subscription');
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.ACTIVE },
    });

    await historyService.record({
      subscriptionId: id,
      action: 'ACTIVATED',
      previousValue: sub.status,
      newValue: SubscriptionStatus.ACTIVE,
      performedById: userId,
    });

    return updated;
  }

  /**
   * Lifecycle: Pause Subscription (ACTIVE -> PAUSED)
   */
  async pauseSubscription(id: string, customerIdFilter?: string | null, userId?: string | null) {
    const sub = await this.getSubscriptionById(id, customerIdFilter);

    if (sub.status !== SubscriptionStatus.ACTIVE) {
      throw new UnprocessableEntityError('Only active subscriptions can be paused');
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.PAUSED },
    });

    await historyService.record({
      subscriptionId: id,
      action: 'PAUSED',
      previousValue: SubscriptionStatus.ACTIVE,
      newValue: SubscriptionStatus.PAUSED,
      performedById: userId,
    });

    return updated;
  }

  /**
   * Lifecycle: Resume Subscription (PAUSED -> ACTIVE)
   */
  async resumeSubscription(id: string, customerIdFilter?: string | null, userId?: string | null) {
    const sub = await this.getSubscriptionById(id, customerIdFilter);

    if (sub.status !== SubscriptionStatus.PAUSED) {
      throw new UnprocessableEntityError('Only paused subscriptions can be resumed');
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.ACTIVE },
    });

    await historyService.record({
      subscriptionId: id,
      action: 'RESUMED',
      previousValue: SubscriptionStatus.PAUSED,
      newValue: SubscriptionStatus.ACTIVE,
      performedById: userId,
    });

    return updated;
  }

  /**
   * Lifecycle: Renew Subscription (advance period & extend validity)
   */
  async renewSubscription(id: string, customerIdFilter?: string | null, userId?: string | null) {
    const sub = await this.getSubscriptionById(id, customerIdFilter);

    if (sub.status === SubscriptionStatus.CLOSED) {
      throw new UnprocessableEntityError('Cannot renew a closed subscription');
    }

    // New period starts from current period end
    const newPeriodStart = new Date(sub.currentPeriodEnd);
    const newPeriodEnd = this.calculatePeriodEnd(newPeriodStart, sub.billingFrequency as BillingFrequency);

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    await historyService.record({
      subscriptionId: id,
      action: 'RENEWED',
      previousValue: `${sub.currentPeriodStart.toISOString()} - ${sub.currentPeriodEnd.toISOString()}`,
      newValue: `${newPeriodStart.toISOString()} - ${newPeriodEnd.toISOString()}`,
      performedById: userId,
    });

    return updated;
  }

  /**
   * Lifecycle: Close Subscription (Immediate termination -> CLOSED)
   */
  async closeSubscription(id: string, customerIdFilter?: string | null, userId?: string | null) {
    const sub = await this.getSubscriptionById(id, customerIdFilter);

    if (sub.status === SubscriptionStatus.CLOSED) {
      throw new UnprocessableEntityError('Subscription is already closed');
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.CLOSED },
    });

    await historyService.record({
      subscriptionId: id,
      action: 'CLOSED',
      previousValue: sub.status,
      newValue: SubscriptionStatus.CLOSED,
      performedById: userId,
    });

    // Asynchronously dispatch subscription-closed event for Member 4 exit surveys
    await enqueueSubscriptionClosedJob({
      subscriptionId: id,
      customerId: sub.customerId,
    });

    return updated;
  }

  /**
   * Preview Mid-Cycle Upgrade Proration
   */
  async previewUpgrade(
    subscriptionId: string,
    newPlanId: string,
    effectiveDateInput?: string,
    customerIdFilter?: string | null
  ) {
    const sub = await this.getSubscriptionById(subscriptionId, customerIdFilter);

    if (sub.status === SubscriptionStatus.CLOSED) {
      throw new UnprocessableEntityError('Cannot upgrade a closed subscription');
    }

    if (sub.planId === newPlanId) {
      throw new BadRequestError('Subscription is already on the requested plan');
    }

    const newPlan = await prisma.subscriptionPlan.findUnique({ where: { id: newPlanId } });
    if (!newPlan) {
      throw new NotFoundError(`New subscription plan ${newPlanId} not found`);
    }

    const effectiveDate = effectiveDateInput ? new Date(effectiveDateInput) : new Date();

    const proration = prorationService.calculateProration({
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      effectiveDate,
      oldPlanPrice: Number(sub.plan.basePrice),
      newPlanPrice: Number(newPlan.basePrice),
    });

    return {
      subscriptionId: sub.id,
      subscriptionNumber: sub.subscriptionNumber,
      previousPlan: {
        id: sub.plan.id,
        name: sub.plan.name,
        code: sub.plan.code,
        basePrice: Number(sub.plan.basePrice),
      },
      newPlan: {
        id: newPlan.id,
        name: newPlan.name,
        code: newPlan.code,
        basePrice: Number(newPlan.basePrice),
      },
      billingPeriod: {
        start: sub.currentPeriodStart,
        end: sub.currentPeriodEnd,
      },
      proration,
    };
  }

  /**
   * Execute Mid-Cycle Upgrade:
   * 1. Calculates proration
   * 2. Swaps plan
   * 3. Creates immutable subscription_changes record
   * 4. Updates totals and logs in history
   */
  async upgradeSubscription(
    subscriptionId: string,
    newPlanId: string,
    effectiveDateInput?: string,
    customerIdFilter?: string | null,
    userId?: string | null
  ) {
    const preview = await this.previewUpgrade(subscriptionId, newPlanId, effectiveDateInput, customerIdFilter);
    const sub = await this.getSubscriptionById(subscriptionId, customerIdFilter);

    const effectiveDate = effectiveDateInput ? new Date(effectiveDateInput) : new Date();
    const { proration } = preview;

    return prisma.$transaction(async (tx) => {
      let validUserId: string | null = null;
      if (userId) {
        const u = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
        if (u) validUserId = u.id;
      }

      // 1. Record subscription change
      const changeRecord = await tx.subscriptionChange.create({
        data: {
          subscriptionId: sub.id,
          changeType: 'UPGRADE',
          previousPlanId: sub.planId,
          newPlanId,
          proratedCredit: new Decimal(proration.proratedCredit),
          proratedDebit: new Decimal(proration.proratedDebit),
          netAdjustment: new Decimal(proration.netAdjustmentDue),
          daysRemaining: proration.daysRemaining,
          totalDaysInCycle: proration.totalDaysInCycle,
          effectiveDate,
          createdById: validUserId,
        },
      });

      // 2. Adjust subtotal by net adjustment
      const newSubtotal = Math.max(0, Number(sub.subtotal) + proration.netAdjustmentDue);
      const newTotal = Math.max(0, Number(sub.totalAmount) + proration.netAdjustmentDue);

      // 3. Update subscription with new plan
      const updatedSub = await tx.subscription.update({
        where: { id: sub.id },
        data: {
          planId: newPlanId,
          subtotal: new Decimal(newSubtotal.toFixed(4)),
          totalAmount: new Decimal(newTotal.toFixed(4)),
        },
        include: {
          plan: true,
          customer: true,
          lines: true,
        },
      });

      // 4. Log in history
      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: sub.id,
          action: 'UPGRADED',
          previousValue: `${sub.plan.name} (${sub.plan.code})`,
          newValue: `${preview.newPlan.name} (${preview.newPlan.code}) - Net Adjustment Due: ${proration.netAdjustmentDue}`,
          performedById: validUserId,
        },
      });

      return {
        subscription: updatedSub,
        proration,
        changeRecord,
      };
    });
  }

  /**
   * Get all plan changes and proration adjustments for a subscription
   */
  async getSubscriptionChanges(subscriptionId: string, customerIdFilter?: string | null) {
    await this.getSubscriptionById(subscriptionId, customerIdFilter);

    return prisma.subscriptionChange.findMany({
      where: { subscriptionId },
      include: {
        previousPlan: true,
        newPlan: true,
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const subscriptionService = new SubscriptionService();
