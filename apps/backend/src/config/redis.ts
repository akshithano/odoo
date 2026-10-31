import { Redis } from 'ioredis';
import { ComponentHealth } from '@odoo/shared';
import { env } from './env.js';
import { logger } from '../core/logging/logger.js';

class RedisManager {
  private static instance: Redis | null = null;

  public static getInstance(): Redis {
    if (!RedisManager.instance) {
      RedisManager.instance = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        connectTimeout: 2000,
        retryStrategy(times) {
          if (times > 3) {
            return null; // Stop retrying after 3 attempts if offline
          }
          return Math.min(times * 100, 1000);
        },
      });

      RedisManager.instance.on('connect', () => {
        logger.info('Connected to Redis');
      });

      RedisManager.instance.on('error', (err) => {
        // Suppress repetitive offline warnings in dev/test
        if (process.env.NODE_ENV !== 'test') {
          logger.warn(`Redis connection error: ${err.message}`);
        }
      });
    }

    return RedisManager.instance;
  }
}

export const redisClient = RedisManager.getInstance();

/**
 * Checks Redis connectivity with a 2-second fail-fast timeout.
 */
export async function checkRedisConnection(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const pingPromise = (async () => {
      if (redisClient.status === 'wait' || redisClient.status === 'close') {
        await redisClient.connect();
      }
      return await redisClient.ping();
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Redis ping timed out after 1500ms')), 1500);
    });

    const pong = await Promise.race([pingPromise, timeoutPromise]);
    if (pong === 'PONG') {
      return {
        status: 'healthy',
        responseTimeMs: Date.now() - start,
        message: 'Redis 7 server reachable',
      };
    }
    return {
      status: 'degraded',
      responseTimeMs: Date.now() - start,
      message: `Unexpected Redis response: ${pong}`,
    };
  } catch (error) {
    const err = error as Error;
    return {
      status: 'unhealthy',
      responseTimeMs: Date.now() - start,
      message: 'Redis connection unavailable (offline)',
      error: err.message,
    };
  }
}

/**
 * Gracefully disconnects the Redis client.
 */
export async function disconnectRedis(): Promise<void> {
  try {
    if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
      await redisClient.quit();
      logger.info('Redis connection closed gracefully');
    }
  } catch (err) {
    logger.error('Error disconnecting Redis', { error: (err as Error).message });
  }
}
