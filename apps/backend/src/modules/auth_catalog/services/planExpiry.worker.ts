import { planService } from './plan.service.js';
import { logger } from '../../../core/logging/logger.js';

/**
 * Executes scheduled plan auto-expiry check.
 * Called periodically or via BullMQ worker.
 */
export async function executePlanExpirySweep(): Promise<number> {
  try {
    const closedCount = await planService.autoCloseExpiredPlans();
    if (closedCount > 0) {
      logger.info(`[PlanExpirySweep] Successfully closed ${closedCount} expired plans`);
    }
    return closedCount;
  } catch (error) {
    logger.error('[PlanExpirySweep] Failed to execute plan expiry sweep', {
      error: (error as Error).message,
    });
    return 0;
  }
}
