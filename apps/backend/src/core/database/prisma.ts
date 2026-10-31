import { PrismaClient } from '@prisma/client';
import { ComponentHealth } from '@odoo/shared';
import { logger } from '../logging/logger.js';

class DatabaseClient {
  private static instance: PrismaClient | null = null;

  public static getInstance(): PrismaClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      });
    }
    return DatabaseClient.instance;
  }
}

export const prisma = DatabaseClient.getInstance();

/**
 * Verifies connectivity to the PostgreSQL database with a 1500ms timeout.
 */
export async function checkDatabaseConnection(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const queryPromise = prisma.$queryRawUnsafe('SELECT 1');
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('PostgreSQL connection timed out after 1500ms')), 1500);
    });

    await Promise.race([queryPromise, timeoutPromise]);
    return {
      status: 'healthy',
      responseTimeMs: Date.now() - start,
      message: 'PostgreSQL connection active',
    };
  } catch (error) {
    const err = error as Error;
    if (process.env.NODE_ENV !== 'test') {
      logger.warn('Database health check failed', { error: err.message });
    }
    return {
      status: 'unhealthy',
      responseTimeMs: Date.now() - start,
      message: 'PostgreSQL connection unavailable (offline)',
      error: err.message,
    };
  }
}

/**
 * Gracefully disconnects Prisma client.
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database client disconnected');
  } catch (err) {
    logger.error('Error disconnecting database', { error: (err as Error).message });
  }
}
