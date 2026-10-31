import { prisma } from '../../../core/database/prisma.js';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  UnprocessableEntityError,
} from '../../../core/errors/appError.js';
import { Decimal } from '@prisma/client/runtime/library';
import { PaymentStatus, InvoiceStatus, CreateRefundInput } from '@odoo/shared';
import { PaymentGatewayFactory } from './gateway/gateway.factory.js';
import { logger } from '../../../core/logging/logger.js';

export class RefundService {
  /**
   * Generates next sequential human-readable refund number: REF-YYYYMM-XXXX
   */
  private async getNextRefundNumber(tx: typeof prisma, date = new Date()): Promise<string> {
    const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `REF-${yearMonth}-`;

    const last = await tx.refund.findFirst({
      where: { refundNumber: { startsWith: prefix } },
      orderBy: { refundNumber: 'desc' },
      select: { refundNumber: true },
    });

    let nextSeq = 1;
    if (last && last.refundNumber) {
      const parts = last.refundNumber.split('-');
      const currentSeq = parseInt(parts[2], 10);
      if (!isNaN(currentSeq)) {
        nextSeq = currentSeq + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Creates and processes a full or partial refund
   */
  async processRefund(input: CreateRefundInput) {
    if (input.amount <= 0) {
      throw new BadRequestError('Refund amount must be greater than zero');
    }

    const payment = await prisma.payment.findUnique({
      where: { id: input.paymentId },
      include: {
        invoice: true,
        refunds: true,
      },
    });

    if (!payment) {
      throw new NotFoundError(`Payment '${input.paymentId}' not found`);
    }

    if (payment.status === PaymentStatus.FAILED || payment.status === PaymentStatus.PENDING) {
      throw new UnprocessableEntityError('Cannot refund an unsuccessful payment');
    }

    // Calculate existing refunded amount
    const alreadyRefunded = payment.refunds.reduce(
      (sum: number, r: any) => sum + Number(r.amount),
      0
    );

    const paymentAmount = Number(payment.amount);
    const availableToRefund = Math.round((paymentAmount - alreadyRefunded) * 10000) / 10000;

    if (input.amount > availableToRefund) {
      throw new BadRequestError(
        `Refund amount of $${input.amount.toFixed(2)} exceeds available refundable balance of $${availableToRefund.toFixed(2)}`
      );
    }

    if (input.transactionReference) {
      const existingRef = await prisma.refund.findUnique({
        where: { transactionReference: input.transactionReference },
      });
      if (existingRef) {
        throw new ConflictError(
          `Refund with transaction reference '${input.transactionReference}' already exists`
        );
      }
    }

    // Process gateway refund if online payment
    let gatewayTxRef = input.transactionReference;
    if (
      payment.paymentMethod === 'RAZORPAY' ||
      payment.paymentMethod === 'STRIPE' ||
      payment.paymentMethod === 'MOCK'
    ) {
      try {
        const adapter = PaymentGatewayFactory.getAdapter();
        const gwRefund = await adapter.refundPayment({
          paymentReference: payment.transactionReference || payment.id,
          amount: input.amount,
          currency: payment.currency,
          reason: input.reason,
        });
        gatewayTxRef = gwRefund.refundId;
      } catch (err) {
        logger.warn(`Gateway refund call warning: ${(err as Error).message}`);
      }
    }

    return prisma.$transaction(async (tx: any) => {
      const refundNumber = await this.getNextRefundNumber(tx);
      const newTotalRefunded = Math.round((alreadyRefunded + input.amount) * 10000) / 10000;
      const isFullRefund = newTotalRefunded >= paymentAmount;

      const refund = await tx.refund.create({
        data: {
          refundNumber,
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          amount: new Decimal(input.amount.toFixed(4)),
          currency: payment.currency,
          reason: input.reason,
          transactionReference: gatewayTxRef || `RFND-TXN-${Date.now()}`,
          status: 'SUCCESS',
        },
      });

      // Update payment status
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
        },
      });

      // Recalculate invoice amountPaid
      const invoice = payment.invoice;
      const currentInvoicePaid = Number(invoice.amountPaid);
      const newInvoicePaid = Math.max(0, Math.round((currentInvoicePaid - input.amount) * 10000) / 10000);
      const invoiceTotal = Number(invoice.totalAmount);

      let newInvoiceStatus = invoice.status;
      if (newInvoicePaid === 0) {
        newInvoiceStatus = InvoiceStatus.CONFIRMED;
      } else if (newInvoicePaid < invoiceTotal) {
        newInvoiceStatus = InvoiceStatus.PARTIALLY_PAID;
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: new Decimal(newInvoicePaid.toFixed(4)),
          status: newInvoiceStatus,
        },
      });

      return refund;
    });
  }

  /**
   * Lists all refunds
   */
  async listRefunds(query: { invoiceId?: string; paymentId?: string }) {
    const where: Record<string, unknown> = {};
    if (query.invoiceId) where.invoiceId = query.invoiceId;
    if (query.paymentId) where.paymentId = query.paymentId;

    return prisma.refund.findMany({
      where,
      include: {
        payment: { select: { paymentNumber: true, paymentMethod: true } },
        invoice: { select: { invoiceNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const refundService = new RefundService();
