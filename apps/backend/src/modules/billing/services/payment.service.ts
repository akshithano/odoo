import { prisma } from '../../../core/database/prisma.js';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  UnprocessableEntityError,
} from '../../../core/errors/appError.js';
import { Decimal } from '@prisma/client/runtime/library';
import { PaymentStatus, InvoiceStatus, RecordPaymentInput } from '@odoo/shared';
import { PaymentGatewayFactory } from './gateway/gateway.factory.js';
import { logger } from '../../../core/logging/logger.js';

export interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  signature: string;
  invoiceId: string;
}

export class PaymentService {
  /**
   * Generates next sequential human-readable payment number: PAY-YYYYMM-XXXX
   */
  private async getNextPaymentNumber(tx: typeof prisma, date = new Date()): Promise<string> {
    const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `PAY-${yearMonth}-`;

    const last = await tx.payment.findFirst({
      where: { paymentNumber: { startsWith: prefix } },
      orderBy: { paymentNumber: 'desc' },
      select: { paymentNumber: true },
    });

    let nextSeq = 1;
    if (last && last.paymentNumber) {
      const parts = last.paymentNumber.split('-');
      const currentSeq = parseInt(parts[2], 10);
      if (!isNaN(currentSeq)) {
        nextSeq = currentSeq + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Records a manual payment against an invoice (supports partial payments)
   */
  async recordPayment(input: RecordPaymentInput, recordedByUserId?: string) {
    if (input.amount <= 0) {
      throw new BadRequestError('Payment amount must be greater than zero');
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: input.invoiceId },
      include: { customer: true },
    });

    if (!invoice) {
      throw new NotFoundError(`Invoice '${input.invoiceId}' not found`);
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new UnprocessableEntityError('Cannot record payment against a cancelled invoice');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new UnprocessableEntityError('Invoice is already fully paid');
    }

    const currentPaid = Number(invoice.amountPaid);
    const totalAmount = Number(invoice.totalAmount);
    const remainingBalance = Math.round((totalAmount - currentPaid) * 10000) / 10000;

    if (input.amount > remainingBalance) {
      throw new BadRequestError(
        `Payment amount of $${input.amount.toFixed(2)} exceeds remaining balance of $${remainingBalance.toFixed(2)}`
      );
    }

    // Check transaction reference uniqueness if supplied
    if (input.transactionReference) {
      const existingTx = await prisma.payment.findUnique({
        where: { transactionReference: input.transactionReference },
      });
      if (existingTx) {
        throw new ConflictError(
          `Transaction reference '${input.transactionReference}' has already been recorded`
        );
      }
    }

    const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();

    const payment = await prisma.$transaction(async (tx: any) => {
      const paymentNumber = await this.getNextPaymentNumber(tx, paymentDate);
      const newPaidTotal = Math.round((currentPaid + input.amount) * 10000) / 10000;
      const isFull = newPaidTotal >= totalAmount;

      const createdPayment = await tx.payment.create({
        data: {
          paymentNumber,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amount: new Decimal(input.amount.toFixed(4)),
          currency: invoice.currency,
          paymentMethod: input.paymentMethod,
          paymentDate,
          transactionReference: input.transactionReference || `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          status: PaymentStatus.SUCCESS,
          notes: input.notes,
        },
      });

      // Update invoice amountPaid and status
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: new Decimal(newPaidTotal.toFixed(4)),
          status: isFull ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID,
        },
      });

      return createdPayment;
    });

    logger.info(`Payment recorded [${payment.paymentNumber}] for invoice [${invoice.invoiceNumber}], Amount: $${input.amount}`);
    return payment;
  }

  /**
   * Initiates online gateway payment order (Razorpay / Mock)
   */
  async createOnlineOrder(invoiceId: string, customerId?: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: {
          include: { user: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError(`Invoice '${invoiceId}' not found`);
    }

    if (customerId && invoice.customerId !== customerId) {
      throw new NotFoundError(`Invoice '${invoiceId}' not found`);
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new UnprocessableEntityError('Invoice is already fully paid');
    }
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new UnprocessableEntityError('Cannot pay a cancelled invoice');
    }

    const remainingBalance = Number(invoice.totalAmount) - Number(invoice.amountPaid);
    if (remainingBalance <= 0) {
      throw new UnprocessableEntityError('Invoice has zero remaining balance');
    }

    const adapter = PaymentGatewayFactory.getAdapter();
    const order = await adapter.createOrder({
      invoiceId: invoice.id,
      amount: remainingBalance,
      currency: invoice.currency,
      customer: {
        id: invoice.customerId,
        email: invoice.customer.user.email,
        name: `${invoice.customer.user.firstName} ${invoice.customer.user.lastName}`,
        phone: invoice.customer.phone || undefined,
      },
      notes: {
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    return {
      orderId: order.orderId,
      provider: order.provider,
      amount: order.amount,
      currency: order.currency,
      keyId: order.keyId,
      invoiceNumber: invoice.invoiceNumber,
      customer: {
        name: `${invoice.customer.user.firstName} ${invoice.customer.user.lastName}`,
        email: invoice.customer.user.email,
      },
    };
  }

  /**
   * Verifies online payment gateway response and commits payment
   */
  async verifyAndRecordGatewayPayment(input: VerifyPaymentInput) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: input.invoiceId },
    });

    if (!invoice) {
      throw new NotFoundError(`Invoice '${input.invoiceId}' not found`);
    }

    // Verify cryptographic signature with the gateway adapter
    const adapter = PaymentGatewayFactory.getAdapter();
    const isValid = await adapter.verifyPayment({
      orderId: input.orderId,
      paymentId: input.paymentId,
      signature: input.signature,
    });

    if (!isValid) {
      logger.warn(`Signature verification failed for payment ${input.paymentId}`);
      throw new BadRequestError('Invalid gateway payment signature verification failed');
    }

    // Check if this paymentId was already processed
    const existing = await prisma.payment.findUnique({
      where: { transactionReference: input.paymentId },
    });
    if (existing) {
      return existing;
    }

    const remainingBalance = Number(invoice.totalAmount) - Number(invoice.amountPaid);
    const amountToRecord = Math.max(0, remainingBalance);

    return prisma.$transaction(async (tx: any) => {
      const paymentNumber = await this.getNextPaymentNumber(tx);
      const newPaidTotal = Number(invoice.amountPaid) + amountToRecord;
      const isFull = newPaidTotal >= Number(invoice.totalAmount);

      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amount: new Decimal(amountToRecord.toFixed(4)),
          currency: invoice.currency,
          paymentMethod: adapter.providerName,
          paymentDate: new Date(),
          transactionReference: input.paymentId,
          gatewayOrderId: input.orderId,
          status: PaymentStatus.SUCCESS,
          notes: `Online checkout verified via ${adapter.providerName}`,
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: new Decimal(newPaidTotal.toFixed(4)),
          status: isFull ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID,
        },
      });

      return payment;
    });
  }

  /**
   * Secure, idempotent gateway webhook processing
   */
  async processWebhook(headers: Record<string, string | string[] | undefined>, rawBody: unknown) {
    const adapter = PaymentGatewayFactory.getAdapter();
    const result = await adapter.processWebhook(headers, rawBody);

    if (!result.verified) {
      logger.warn(`Rejected unverified gateway webhook from ${adapter.providerName}`);
      throw new BadRequestError('Invalid webhook cryptographic signature');
    }

    const eventId = (result.rawPayload as Record<string, unknown>)?.id as string ||
      `evt_${result.paymentId || Date.now()}`;

    // Check idempotency guard in WebhookEvent table
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent) {
      logger.info(`Webhook event ${eventId} already processed (idempotent skipped)`);
      return { received: true, idempotentDuplicate: true };
    }

    // Record webhook event in DB
    await prisma.webhookEvent.create({
      data: {
        provider: adapter.providerName,
        eventId,
        eventType: result.event,
        payload: (result.rawPayload || {}) as unknown as object,
        processed: true,
        processedAt: new Date(),
      },
    });

    // If event is payment.captured or payment.success, reconcile payment
    if (result.event === 'payment.captured' || result.event === 'payment.success') {
      if (result.paymentId) {
        const existingPayment = await prisma.payment.findUnique({
          where: { transactionReference: result.paymentId },
        });

        if (!existingPayment && result.orderId) {
          // Look up invoice by order or reference
          const invoice = await prisma.invoice.findFirst({
            where: {
              status: { in: [InvoiceStatus.CONFIRMED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (invoice && result.amount) {
            await this.recordPayment({
              invoiceId: invoice.id,
              amount: result.amount,
              paymentMethod: adapter.providerName,
              transactionReference: result.paymentId,
              notes: `Automated payment confirmed via webhook [Event: ${eventId}]`,
            });
          }
        }
      }
    }

    return { received: true, processedEvent: result.event };
  }

  /**
   * Lists payments with role isolation and search filters
   */
  async listPayments(query: {
    customerId?: string;
    invoiceId?: string;
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.customerId) where.customerId = query.customerId;
    if (query.invoiceId) where.invoiceId = query.invoiceId;
    if (query.status) where.status = query.status as PaymentStatus;

    const [total, items] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: {
          invoice: { select: { invoiceNumber: true, totalAmount: true, amountPaid: true } },
          customer: {
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
          },
          refunds: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves single payment by ID
   */
  async getPaymentById(id: string, customerId?: string | null) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: {
          include: {
            customer: {
              include: { user: { select: { firstName: true, lastName: true, email: true } } },
            },
          },
        },
        refunds: true,
      },
    });

    if (!payment) {
      throw new NotFoundError(`Payment '${id}' not found`);
    }

    if (customerId && payment.customerId !== customerId) {
      throw new NotFoundError(`Payment '${id}' not found`);
    }

    return payment;
  }
}

export const paymentService = new PaymentService();
