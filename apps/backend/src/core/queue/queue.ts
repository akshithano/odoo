import { Queue, ConnectionOptions } from 'bullmq';
import { ComponentHealth } from '@odoo/shared';
import { env } from '../../config/env.js';
import { logger } from '../logging/logger.js';

export const queueConnectionOptions: ConnectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  connectTimeout: 2000,
  retryStrategy(times) {
    if (times > 3) return null;
    return Math.min(times * 100, 1000);
  },
};

export const SYSTEM_QUEUE_NAME = 'system-foundation-queue';
let systemQueue: Queue | null = null;

export function getSystemQueue(): Queue {
  if (!systemQueue) {
    systemQueue = new Queue(SYSTEM_QUEUE_NAME, {
      connection: queueConnectionOptions,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
      },
    });

    systemQueue.on('error', (err) => {
      if (process.env.NODE_ENV !== 'test') {
        logger.warn(`BullMQ Queue Error [${SYSTEM_QUEUE_NAME}]: ${err.message}`);
      }
    });
  }
  return systemQueue;
}

/**
 * Checks BullMQ Queue connectivity with a 1500ms timeout
 */
export async function checkQueueHealth(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const queue = getSystemQueue();
    const countPromise = queue.getJobCounts('waiting', 'active', 'completed', 'failed');
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('BullMQ connection timed out after 1500ms')), 1500);
    });

    const count = await Promise.race([countPromise, timeoutPromise]);
    return {
      status: 'healthy',
      responseTimeMs: Date.now() - start,
      message: `BullMQ active (${count.waiting} waiting, ${count.active} active)`,
    };
  } catch (error) {
    const err = error as Error;
    return {
      status: 'unhealthy',
      responseTimeMs: Date.now() - start,
      message: 'BullMQ queue connection unavailable (offline)',
      error: err.message,
    };
  }
}

/**
 * Enqueues a plan expiry sweep job onto the BullMQ system queue
 */
export async function enqueuePlanExpiryJob(): Promise<void> {
  try {
    const queue = getSystemQueue();
    await queue.add('plan-expiry-sweep', { action: 'plan-expiry-sweep', timestamp: new Date().toISOString() });
    logger.info('Enqueued plan-expiry-sweep job onto BullMQ system queue');
  } catch (err) {
    logger.warn(`Could not enqueue plan-expiry-sweep job: ${(err as Error).message}`);
  }
}

/**
 * Closes queues gracefully
 */
export async function closeQueues(): Promise<void> {
  if (systemQueue) {
    await systemQueue.close();
    systemQueue = null;
    logger.info('BullMQ system queues closed');
  }
}
