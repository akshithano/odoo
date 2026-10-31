import { Worker, Job } from 'bullmq';
import { queueConnectionOptions, SYSTEM_QUEUE_NAME } from './queue.js';
import { logger } from '../logging/logger.js';
import { executePlanExpirySweep } from '../../modules/auth_catalog/services/planExpiry.worker.js';

let systemWorker: Worker | null = null;

export interface SystemJobData {
  action?: 'ping' | 'verify' | 'plan-expiry-sweep';
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Initializes and starts background workers.
 */
export function startWorkers(): void {
  if (systemWorker) {
    logger.warn('Workers are already initialized');
    return;
  }

  systemWorker = new Worker<SystemJobData>(
    SYSTEM_QUEUE_NAME,
    async (job: Job<SystemJobData>) => {
      logger.info(`[Worker] Processing job ${job.id} (${job.name})`, { data: job.data });
      if (job.name === 'ping') {
        return { status: 'pong', timestamp: new Date().toISOString() };
      }
      if (job.name === 'plan-expiry-sweep' || job.data?.action === 'plan-expiry-sweep') {
        const closedCount = await executePlanExpirySweep();
        return { status: 'completed', action: 'plan-expiry-sweep', closedCount };
      }
      return { status: 'processed', jobId: job.id };
    },
    {
      connection: queueConnectionOptions,
      concurrency: 5,
    }
  );

  systemWorker.on('completed', (job: Job) => {
    logger.info(`[Worker] Job ${job.id} completed successfully`);
  });

  systemWorker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
  });

  systemWorker.on('error', (err: Error) => {
    logger.warn(`BullMQ Worker connection error: ${err.message}`);
  });

  logger.info(`BullMQ background worker started listening on [${SYSTEM_QUEUE_NAME}]`);
}

/**
 * Gracefully shuts down workers
 */
export async function stopWorkers(): Promise<void> {
  if (systemWorker) {
    logger.info('Stopping BullMQ workers gracefully...');
    await systemWorker.close();
    systemWorker = null;
    logger.info('BullMQ workers stopped');
  }
}
