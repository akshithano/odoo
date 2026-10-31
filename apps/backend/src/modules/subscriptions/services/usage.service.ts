import { prisma } from '../../../core/database/prisma.js';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
} from '../../../core/errors/appError.js';
import { TierType } from '@odoo/shared';
import { Decimal } from '@prisma/client/runtime/library';
import { pricingService } from './pricing.service.js';

export interface IngestUsageInput {
  subscriptionId: string;
  customerId?: string;
  usageType: string;
  quantity: number;
  unitOfMeasure?: string;
  timestamp?: string;
  idempotencyKey: string;
  notes?: string | null;
}

export interface AggregatedUsageMetric {
  usageType: string;
  unitOfMeasure: string;
  totalQuantity: number;
  eventCount: number;
  estimatedCharges: number;
  bracketBreakdown?: any[];
}

export class UsageService {
  /**
   * Ingest a single usage event with idempotency protection
   */
  async recordUsageEvent(data: IngestUsageInput) {
    // 1. Check idempotency key to prevent double recording
    const existing = await prisma.usageRecord.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
    });

    if (existing) {
      throw new ConflictError(
        `Usage event with idempotency key '${data.idempotencyKey}' has already been ingested`
      );
    }

    // 2. Validate subscription exists
    const subscription = await prisma.subscription.findUnique({
      where: { id: data.subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundError(`Subscription ${data.subscriptionId} not found`);
    }

    // CustomerId is either supplied or taken directly from subscription
    const customerId = data.customerId || subscription.customerId;
    if (data.customerId && data.customerId !== subscription.customerId) {
      throw new BadRequestError(
        `CustomerId '${data.customerId}' does not match subscription owner '${subscription.customerId}'`
      );
    }

    const eventTimestamp = data.timestamp ? new Date(data.timestamp) : new Date();

    return prisma.usageRecord.create({
      data: {
        subscriptionId: data.subscriptionId,
        customerId,
        usageType: data.usageType,
        quantity: new Decimal(data.quantity),
        unitOfMeasure: data.unitOfMeasure || 'units',
        timestamp: eventTimestamp,
        idempotencyKey: data.idempotencyKey,
        notes: data.notes || null,
        billed: false,
      },
    });
  }

  /**
   * Query raw usage records with filters
   */
  async listUsageRecords(params: {
    subscriptionId?: string;
    customerId?: string;
    usageType?: string;
    billed?: boolean;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.subscriptionId) where.subscriptionId = params.subscriptionId;
    if (params.customerId) where.customerId = params.customerId;
    if (params.usageType) where.usageType = params.usageType;
    if (params.billed !== undefined) where.billed = params.billed;

    if (params.startDate || params.endDate) {
      where.timestamp = {};
      if (params.startDate) where.timestamp.gte = new Date(params.startDate);
      if (params.endDate) where.timestamp.lte = new Date(params.endDate);
    }

    const [totalRecords, items] = await Promise.all([
      prisma.usageRecord.count({ where }),
      prisma.usageRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          subscription: { select: { id: true, subscriptionNumber: true, status: true } },
          customer: {
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
          },
        },
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
   * Aggregate usage for a subscription's current billing cycle or specified date range.
   * Calculates usage charges based on pricing tiers configured for the plan/products.
   * Exposes aggregated data for Member 3's invoicing module.
   */
  async getSubscriptionUsageSummary(
    subscriptionId: string,
    startDateInput?: string,
    endDateInput?: string,
    customerIdFilter?: string | null
  ) {
    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
      },
    });

    if (!sub) {
      throw new NotFoundError(`Subscription ${subscriptionId} not found`);
    }

    if (customerIdFilter && sub.customerId !== customerIdFilter) {
      throw new NotFoundError(`Subscription ${subscriptionId} not found`);
    }

    const periodStart = startDateInput ? new Date(startDateInput) : sub.currentPeriodStart;
    const periodEnd = endDateInput ? new Date(endDateInput) : sub.currentPeriodEnd;

    // Fetch all unbilled usage events in this period
    const events = await prisma.usageRecord.findMany({
      where: {
        subscriptionId,
        timestamp: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Group by usageType
    const grouped = new Map<
      string,
      {
        usageType: string;
        unitOfMeasure: string;
        totalQuantity: number;
        eventsCount: number;
      }
    >();

    for (const evt of events) {
      const existing = grouped.get(evt.usageType);
      const qty = Number(evt.quantity);
      if (existing) {
        existing.totalQuantity += qty;
        existing.eventsCount += 1;
      } else {
        grouped.set(evt.usageType, {
          usageType: evt.usageType,
          unitOfMeasure: evt.unitOfMeasure,
          totalQuantity: qty,
          eventsCount: 1,
        });
      }
    }

    const metrics: AggregatedUsageMetric[] = [];
    let totalUsageCharges = 0;

    for (const [usageType, group] of grouped.entries()) {
      // Calculate charges for this metric using pricing tiers configured for plan
      const calcResult = await pricingService.calculateForEntity({
        planId: sub.planId,
        quantity: group.totalQuantity,
        tierType: TierType.USAGE_BASED,
      });

      const estimatedCharges = calcResult.totalCalculatedPrice;
      totalUsageCharges += estimatedCharges;

      metrics.push({
        usageType: group.usageType,
        unitOfMeasure: group.unitOfMeasure,
        totalQuantity: Number(group.totalQuantity.toFixed(4)),
        eventCount: group.eventsCount,
        estimatedCharges: Number(estimatedCharges.toFixed(4)),
        bracketBreakdown: calcResult.brackets,
      });
    }

    return {
      subscriptionId: sub.id,
      subscriptionNumber: sub.subscriptionNumber,
      planName: sub.plan.name,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalEvents: events.length,
      metrics,
      totalUsageCharges: Number(totalUsageCharges.toFixed(4)),
    };
  }
}

export const usageService = new UsageService();
