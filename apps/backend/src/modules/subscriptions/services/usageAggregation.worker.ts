import { prisma } from '../../../core/database/prisma.js';
import { logger } from '../../../core/logging/logger.js';
import { usageService } from './usage.service.js';

/**
 * Background worker task: Aggregates usage consumption across active subscriptions
 * whose billing cycle is due or ending. Prepares consumption line items for Member 3.
 */
export async function executeUsageAggregationSweep(): Promise<number> {
  logger.info('[UsageAggregationWorker] Starting scheduled usage consumption aggregation sweep...');

  try {
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        subscriptionNumber: true,
        customerId: true,
        planId: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
      },
    });

    let processedCount = 0;

    for (const sub of activeSubscriptions) {
      try {
        const summary = await usageService.getSubscriptionUsageSummary(sub.id);
        if (summary.totalEvents > 0) {
          logger.info(
            `[UsageAggregationWorker] Aggregated ${summary.totalEvents} events for Sub ${sub.subscriptionNumber}: Charges = ${summary.totalUsageCharges}`
          );
          processedCount++;
        }
      } catch (subErr) {
        logger.error(
          `[UsageAggregationWorker] Failed to aggregate usage for ${sub.subscriptionNumber}: ${(subErr as Error).message}`
        );
      }
    }

    logger.info(
      `[UsageAggregationWorker] Completed usage aggregation sweep. Processed ${processedCount} subscriptions with billable usage.`
    );
    return processedCount;
  } catch (err) {
    logger.error(`[UsageAggregationWorker] Sweep encountered fatal error: ${(err as Error).message}`);
    throw err;
  }
}
