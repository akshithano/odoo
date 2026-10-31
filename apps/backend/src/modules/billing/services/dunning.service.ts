import { prisma } from '../../../core/database/prisma.js';
import { NotFoundError, UnprocessableEntityError } from '../../../core/errors/appError.js';
import { InvoiceStatus, RetryStatus } from '@odoo/shared';
import { logger } from '../../../core/logging/logger.js';

export interface RetryPolicy {
  maxAttempts: number;
  intervalsInDays: number[]; // e.g. [1, 3, 5, 7]
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 4,
  intervalsInDays: [1, 3, 5, 7],
};

export class DunningService {
  private policy: RetryPolicy = { ...DEFAULT_RETRY_POLICY };

  getPolicy(): RetryPolicy {
    return { ...this.policy };
  }

  updatePolicy(policy: Partial<RetryPolicy>): RetryPolicy {
    if (policy.maxAttempts) this.policy.maxAttempts = policy.maxAttempts;
    if (policy.intervalsInDays) this.policy.intervalsInDays = policy.intervalsInDays;
    return this.getPolicy();
  }

  /**
   * Schedules next automated payment retry or escalates if max retries reached
   */
  async scheduleOrExecuteRetry(invoiceId: string, isManual = false) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: true,
        retries: { orderBy: { attemptNumber: 'desc' } },
      },
    });

    if (!invoice) {
      throw new NotFoundError(`Invoice '${invoiceId}' not found`);
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new UnprocessableEntityError('Invoice is already fully paid');
    }
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new UnprocessableEntityError('Cannot retry payment for a cancelled invoice');
    }

    const previousAttempts = invoice.retries.length;
    const nextAttemptNumber = previousAttempts + 1;

    // Check if max attempts reached
    if (!isManual && nextAttemptNumber > this.policy.maxAttempts) {
      // Mark latest retry as ABANDONED
      if (invoice.retries[0]) {
        await prisma.paymentRetry.update({
          where: { id: invoice.retries[0].id },
          data: { status: RetryStatus.ABANDONED },
        });
      }

      // Escalation: Suspend/Pause subscription due to dunning exhaustion
      await prisma.subscription.update({
        where: { id: invoice.subscriptionId },
        data: { status: 'PAUSED' },
      });

      logger.warn(
        `[Dunning] Max retries (${this.policy.maxAttempts}) reached for invoice ${invoice.invoiceNumber}. Subscription ${invoice.subscription.subscriptionNumber} set to PAUSED. Escalating to Member 4.`
      );

      return {
        escalated: true,
        reason: 'MAX_RETRIES_EXCEEDED',
        subscriptionSuspended: true,
        totalAttempts: previousAttempts,
      };
    }

    // Attempt processing (simulate card recharge)
    const success = false; // By default simulation fails without card details until customer pays or admin records
    const intervalDays =
      this.policy.intervalsInDays[Math.min(nextAttemptNumber - 1, this.policy.intervalsInDays.length - 1)] || 3;

    const nextRetryDate = new Date();
    nextRetryDate.setDate(nextRetryDate.getDate() + intervalDays);

    const retryRecord = await prisma.paymentRetry.create({
      data: {
        invoiceId: invoice.id,
        attemptNumber: nextAttemptNumber,
        attemptDate: new Date(),
        nextRetryDate: success ? null : nextRetryDate,
        status: success ? RetryStatus.SUCCESS : RetryStatus.FAILED,
        errorMessage: success ? null : `Gateway charge failed (insufficient_funds / card_declined)`,
      },
    });

    return {
      escalated: false,
      attemptNumber: nextAttemptNumber,
      status: retryRecord.status,
      nextRetryDate: retryRecord.nextRetryDate,
      retryRecord,
    };
  }

  /**
   * Retrieves retry logs across invoices
   */
  async listRetries(invoiceId?: string) {
    const where: Record<string, unknown> = {};
    if (invoiceId) where.invoiceId = invoiceId;

    return prisma.paymentRetry.findMany({
      where,
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            totalAmount: true,
            amountPaid: true,
            status: true,
            customer: {
              include: { user: { select: { firstName: true, lastName: true, email: true } } },
            },
          },
        },
      },
      orderBy: { attemptDate: 'desc' },
      take: 100,
    });
  }
}

export const dunningService = new DunningService();
