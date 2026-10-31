import { prisma } from '../../../core/database/prisma.js';
import { logger } from '../../../core/logging/logger.js';

export interface RecordHistoryParams {
  subscriptionId: string;
  action: string;
  previousValue?: string | null;
  newValue?: string | null;
  performedById?: string | null;
}

export class HistoryService {
  /**
   * Appends an immutable audit entry to subscription history
   */
  async record(params: RecordHistoryParams) {
    try {
      let validUserId: string | null = null;
      if (params.performedById) {
        const userExists = await prisma.user.findUnique({
          where: { id: params.performedById },
          select: { id: true },
        });
        if (userExists) {
          validUserId = userExists.id;
        }
      }

      const entry = await prisma.subscriptionHistory.create({
        data: {
          subscriptionId: params.subscriptionId,
          action: params.action,
          previousValue: params.previousValue,
          newValue: params.newValue,
          performedById: validUserId,
        },
      });
      return entry;
    } catch (err) {
      logger.error('Failed to append subscription history record:', { error: String(err) });
      throw err;
    }
  }

  /**
   * Retrieves full history timeline for a subscription
   */
  async getBySubscription(subscriptionId: string) {
    return prisma.subscriptionHistory.findMany({
      where: { subscriptionId },
      include: {
        performedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const historyService = new HistoryService();
