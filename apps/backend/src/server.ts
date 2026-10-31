import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './core/logging/logger.js';
import { disconnectDatabase } from './core/database/prisma.js';
import { disconnectRedis } from './config/redis.js';
import { closeQueues } from './core/queue/queue.js';
import { startWorkers, stopWorkers } from './core/queue/worker.js';

const app = createApp();
const server = http.createServer(app);

// Start background workers (BullMQ) if Redis is configured
startWorkers();

server.listen(env.PORT, () => {
  logger.info(`========================================================`);
  logger.info(` Subscription Management Backend API`);
  logger.info(` Environment: ${env.NODE_ENV}`);
  logger.info(` Listening on: http://localhost:${env.PORT}`);
  logger.info(` Health endpoint: http://localhost:${env.PORT}/api/v1/health`);
  logger.info(`========================================================`);
});

// Graceful Shutdown Handling
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await stopWorkers();
      await closeQueues();
      await disconnectRedis();
      await disconnectDatabase();
      logger.info('All database and queue connections closed. Shutdown complete.');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', { error: (error as Error).message });
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds if hanging
  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcefully terminating process.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
