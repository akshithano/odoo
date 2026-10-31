import { Router, Request, Response } from 'express';
import { ApiResponse, HealthCheckResult, HealthStatus } from '@odoo/shared';
import { checkDatabaseConnection } from '../core/database/prisma.js';
import { checkRedisConnection } from '../config/redis.js';
import { checkQueueHealth } from '../core/queue/queue.js';
import { env } from '../config/env.js';

const router = Router();

/**
 * Lightweight liveness check for load balancers and orchestrators
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Detailed readiness check verifying Database, Redis, and BullMQ connectivity
 */
router.get('/', async (req: Request, res: Response) => {
  const [database, redis, queue] = await Promise.all([
    checkDatabaseConnection(),
    checkRedisConnection(),
    checkQueueHealth(),
  ]);

  let overallStatus: HealthStatus = 'healthy';
  if (
    database.status === 'unhealthy' ||
    redis.status === 'unhealthy' ||
    queue.status === 'unhealthy'
  ) {
    overallStatus = 'unhealthy';
  } else if (
    database.status === 'degraded' ||
    redis.status === 'degraded' ||
    queue.status === 'degraded'
  ) {
    overallStatus = 'degraded';
  }

  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
    version: '1.0.0',
    services: {
      database,
      redis,
      queue,
    },
  };

  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;

  const response: ApiResponse<HealthCheckResult> = {
    success: true,
    data: result,
  };

  res.status(httpStatus).json(response);
});

export const healthRoutes = router;
