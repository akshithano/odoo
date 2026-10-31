import { prisma } from '../../../core/database/prisma.js';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  UnprocessableEntityError,
} from '../../../core/errors/appError.js';
import { Decimal } from '@prisma/client/runtime/library';
import { InvoiceStatus, BillingFrequency, CustomerSnapshot } from '@odoo/shared';
import { taxService } from './tax.service.js';
import { discountService } from './discount.service.js';
import { logger } from '../../../core/logging/logger.js';

export interface GenerateCycleParams {
  asOfDate?: string | Date;
  subscriptionId?: string;
}

export interface ListInvoicesQuery {
  status?: InvoiceStatus | string;
  customerId?: string;
  subscriptionId?: string;
  search?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export class InvoiceService {
  /**
   * Generates next sequential human-readable invoice number: INV-YYYYMM-XXXX
   */
  private async getNextInvoiceNumber(tx: typeof prisma, date = new Date()): Promise<string> {
    const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `INV-${yearMonth}-`;

    const lastInvoice = await tx.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    let nextSeq = 1;
    if (lastInvoice && lastInvoice.invoiceNumber) {
      const parts = lastInvoice.invoiceNumber.split('-');
      const currentSeq = parseInt(parts[2], 10);
      if (!isNaN(currentSeq)) {
        nextSeq = currentSeq + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Calculates next billing period end based on frequency
   */
  private computeNextPeriodEnd(startDate: Date, frequency: BillingFrequency): Date {
    const end = new Date(startDate);
    switch (frequency) {
      case BillingFrequency.DAILY:
        end.setDate(end.getDate() + 1);
        break;
      case BillingFrequency.WEEKLY:
        end.setDate(end.getDate() + 7);
        break;
      case BillingFrequency.MONTHLY:
        end.setMonth(end.getMonth() + 1);
        break;
      case BillingFrequency.YEARLY:
        end.setFullYear(end.getFullYear() + 1);
        break;
      default:
        end.setMonth(end.getMonth() + 1);
    }
    return end;
  }

  /**
   * Calculates payment due date from issue date based on terms
   */
  private computeDueDate(issueDate: Date, paymentTerms: string): Date {
    const dueDate = new Date(issueDate);
    switch (paymentTerms) {
      case 'NET_15':
        dueDate.setDate(dueDate.getDate() + 15);
        break;
      case 'NET_30':
        dueDate.setDate(dueDate.getDate() + 30);
        break;
      case 'NET_60':
        dueDate.setDate(dueDate.getDate() + 60);
        break;
      case 'DUE_ON_RECEIPT':
      default:
        dueDate.setDate(dueDate.getDate() + 7); // 7 days grace for receipt
        break;
    }
    return dueDate;
  }

  /**
   * Builds an immutable JSON snapshot of customer details
   */
  private buildCustomerSnapshot(customer: {
    companyName: string | null;
    phone: string | null;
    billingAddressLine1: string;
    billingCity: string;
    billingState: string | null;
    billingPostalCode: string;
    billingCountry: string;
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
  }): CustomerSnapshot {
    return {
      name: `${customer.user.firstName} ${customer.user.lastName}`.trim(),
      email: customer.user.email,
      companyName: customer.companyName,
      phone: customer.phone,
      billingAddressLine1: customer.billingAddressLine1,
      billingCity: customer.billingCity,
      billingState: customer.billingState,
      billingPostalCode: customer.billingPostalCode,
      billingCountry: customer.billingCountry,
    };
  }

  /**
   * Generates invoices for all active subscriptions due for billing.
   * Completely idempotent: Uses unique DB constraints and checks.
   */
  async generateBillingCycle(params: GenerateCycleParams = {}) {
    const asOf = params.asOfDate ? new Date(params.asOfDate) : new Date();

    const whereSubscription: Record<string, unknown> = {
      status: { in: ['ACTIVE', 'CONFIRMED'] },
    };

    if (params.subscriptionId) {
      whereSubscription.id = params.subscriptionId;
    }

    const subscriptions = await prisma.subscription.findMany({
      where: whereSubscription,
      include: {
        customer: {
          include: { user: true },
        },
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    let invoicesCreated = 0;
    let invoicesSkippedAlreadyBilled = 0;
    let totalBilledAmount = 0;
    const createdInvoiceIds: string[] = [];

    for (const sub of subscriptions) {
      const billingPeriodStart = sub.currentPeriodStart;
      const billingPeriodEnd = sub.currentPeriodEnd;

      // Check if an invoice for this subscription and billingPeriodStart already exists
      const existing = await prisma.invoice.findFirst({
        where: {
          subscriptionId: sub.id,
          billingPeriodStart,
        },
      });

      if (existing) {
        invoicesSkippedAlreadyBilled++;
        continue;
      }

      try {
        const createdInvoice = await prisma.$transaction(async (tx: any) => {
          const invoiceNumber = await this.getNextInvoiceNumber(tx, asOf);
          const issueDate = asOf;
          const dueDate = this.computeDueDate(issueDate, sub.paymentTerms);
          const snapshot = this.buildCustomerSnapshot(sub.customer);

          // Build line items from subscription lines
          let subtotal = 0;
          let taxTotal = 0;
          const invoiceLinesData = [];

          for (const sLine of sub.lines) {
            const qty = Number(sLine.quantity);
            const unitPrice = Number(sLine.unitPrice);
            const lineSubtotal = Math.round(qty * unitPrice * 10000) / 10000;
            const taxRate = Number(sLine.taxRate);
            const taxAmount = Math.round(((lineSubtotal * taxRate) / 100) * 10000) / 10000;
            const lineTotal = lineSubtotal + taxAmount;

            subtotal += lineSubtotal;
            taxTotal += taxAmount;

            invoiceLinesData.push({
              productId: sLine.productId,
              description: `${sLine.product.name}${sLine.variant ? ` (${sLine.variant.variantName})` : ''}`,
              quantity: new Decimal(qty.toFixed(4)),
              unitPrice: new Decimal(unitPrice.toFixed(4)),
              taxRate: new Decimal(taxRate.toFixed(4)),
              taxAmount: new Decimal(taxAmount.toFixed(4)),
              discountAmount: new Decimal(0),
              lineTotal: new Decimal(lineTotal.toFixed(4)),
            });
          }

          // Ingest unbilled Usage Records from Member 2
          const unbilledUsage = await tx.usageRecord.findMany({
            where: {
              subscriptionId: sub.id,
              billed: false,
              timestamp: { lte: billingPeriodEnd },
            },
          });

          if (unbilledUsage.length > 0) {
            // Group by usageType
            const usageMap = new Map<string, number>();
            for (const record of unbilledUsage) {
              const current = usageMap.get(record.usageType) || 0;
              usageMap.set(record.usageType, current + Number(record.quantity));
            }

            for (const [type, qty] of usageMap.entries()) {
              // Standard pricing of $0.05 per unit if no specific tier found
              const unitPrice = 0.05;
              const lineSubtotal = Math.round(qty * unitPrice * 10000) / 10000;
              const taxRate = 10.0; // Standard 10% on usage
              const taxAmount = Math.round(((lineSubtotal * taxRate) / 100) * 10000) / 10000;
              const lineTotal = lineSubtotal + taxAmount;

              subtotal += lineSubtotal;
              taxTotal += taxAmount;

              invoiceLinesData.push({
                productId: null,
                description: `Usage Consumption: ${type} (${qty.toLocaleString()} units)`,
                quantity: new Decimal(qty.toFixed(4)),
                unitPrice: new Decimal(unitPrice.toFixed(4)),
                taxRate: new Decimal(taxRate.toFixed(4)),
                taxAmount: new Decimal(taxAmount.toFixed(4)),
                discountAmount: new Decimal(0),
                lineTotal: new Decimal(lineTotal.toFixed(4)),
              });
            }
          }

          // Ingest unbilled Proration Adjustments from Member 2
          const unbilledChanges = await tx.subscriptionChange.findMany({
            where: {
              subscriptionId: sub.id,
              effectiveDate: {
                gte: billingPeriodStart,
                lte: billingPeriodEnd,
              },
            },
          });

          for (const change of unbilledChanges) {
            const net = Number(change.netAdjustment);
            if (net !== 0) {
              subtotal += net;
              invoiceLinesData.push({
                productId: null,
                description: `Proration Adjustment (${change.changeType}): ${net > 0 ? 'Debit' : 'Credit'}`,
                quantity: new Decimal(1),
                unitPrice: new Decimal(net.toFixed(4)),
                taxRate: new Decimal(0),
                taxAmount: new Decimal(0),
                discountAmount: new Decimal(0),
                lineTotal: new Decimal(net.toFixed(4)),
              });
            }
          }

          const grandTotal = Math.max(0, Math.round((subtotal + taxTotal) * 10000) / 10000);

          const invoice = await tx.invoice.create({
            data: {
              invoiceNumber,
              subscriptionId: sub.id,
              customerId: sub.customerId,
              status: InvoiceStatus.DRAFT,
              billingPeriodStart,
              billingPeriodEnd,
              issueDate,
              dueDate,
              subtotal: new Decimal(subtotal.toFixed(4)),
              taxAmount: new Decimal(taxTotal.toFixed(4)),
              discountAmount: new Decimal(0),
              totalAmount: new Decimal(grandTotal.toFixed(4)),
              amountPaid: new Decimal(0),
              currency: sub.currency || 'USD',
              customerSnapshot: snapshot as unknown as object,
              lines: {
                create: invoiceLinesData,
              },
            },
          });

          // Mark usage records as billed
          if (unbilledUsage.length > 0) {
            await tx.usageRecord.updateMany({
              where: { id: { in: unbilledUsage.map((u: any) => u.id) } },
              data: { billed: true, invoiceId: invoice.id },
            });
          }

          return invoice;
        });

        invoicesCreated++;
        totalBilledAmount += Number(createdInvoice.totalAmount);
        createdInvoiceIds.push(createdInvoice.id);
      } catch (err) {
        // If unique constraint caught duplicate race condition, skip safely
        const error = err as Error;
        if (error.message.includes('uq_sub_billing_cycle') || error.message.includes('Unique constraint')) {
          invoicesSkippedAlreadyBilled++;
        } else {
          logger.error(`Error generating invoice for sub ${sub.id}: ${error.message}`);
          throw err;
        }
      }
    }

    return {
      subscriptionsEvaluated: subscriptions.length,
      invoicesCreated,
      invoicesSkippedAlreadyBilled,
      totalBilledAmount: Math.round(totalBilledAmount * 100) / 100,
      invoiceIds: createdInvoiceIds,
    };
  }

  /**
   * Lists invoices with filtering, pagination and role isolation
   */
  async listInvoices(query: ListInvoicesQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.customerId) {
      where.customerId = query.customerId;
    }
    if (query.subscriptionId) {
      where.subscriptionId = query.subscriptionId;
    }
    if (query.status) {
      where.status = query.status as InvoiceStatus;
    }
    if (query.startDate || query.endDate) {
      where.issueDate = {
        ...(query.startDate && { gte: new Date(query.startDate) }),
        ...(query.endDate && { lte: new Date(query.endDate) }),
      };
    }
    if (query.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { customer: { companyName: { contains: query.search, mode: 'insensitive' } } },
        { customer: { user: { email: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        include: {
          customer: {
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
          },
          subscription: {
            select: {
              subscriptionNumber: true,
              plan: { select: { name: true, code: true } },
            },
          },
          _count: { select: { lines: true, payments: true } },
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
   * Retrieves single invoice by ID with complete relations
   */
  async getInvoiceById(id: string, customerId?: string | null) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
        subscription: {
          include: {
            plan: true,
          },
        },
        lines: {
          include: { product: true },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        retries: {
          orderBy: { attemptDate: 'desc' },
        },
        refunds: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError(`Invoice '${id}' not found`);
    }

    if (customerId && invoice.customerId !== customerId) {
      throw new NotFoundError(`Invoice '${id}' not found`);
    }

    return invoice;
  }

  /**
   * Confirms a DRAFT invoice, calculates final taxes/discounts, and freezes customer snapshot
   */
  async confirmInvoice(id: string, discountCode?: string) {
    const invoice = await this.getInvoiceById(id);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new UnprocessableEntityError(
        `Invoice '${invoice.invoiceNumber}' is already in status '${invoice.status}' and cannot be confirmed`
      );
    }

    let discountAmount = 0;
    if (discountCode) {
      discountAmount = await discountService.redeemDiscountAtomically(
        discountCode,
        invoice.customerId,
        invoice.id,
        Number(invoice.subtotal)
      );
    }

    const subtotal = Number(invoice.subtotal);
    const discountedSubtotal = Math.max(0, subtotal - discountAmount);

    // Recompute taxes on lines if needed or maintain snapshot
    const taxAmount = Number(invoice.taxAmount);
    const totalAmount = Math.max(0, Math.round((discountedSubtotal + taxAmount) * 10000) / 10000);

    // Refresh customer snapshot
    const freshSnapshot = this.buildCustomerSnapshot(invoice.customer);

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.CONFIRMED,
        discountAmount: new Decimal(discountAmount.toFixed(4)),
        totalAmount: new Decimal(totalAmount.toFixed(4)),
        customerSnapshot: freshSnapshot as unknown as object,
      },
      include: {
        lines: true,
        customer: true,
      },
    });

    logger.info(`Invoice ${updated.invoiceNumber} confirmed. Total: ${updated.totalAmount} ${updated.currency}`);
    return updated;
  }

  /**
   * Edits a DRAFT invoice lines or notes (only allowed in DRAFT)
   */
  async updateDraftInvoice(
    id: string,
    data: {
      notes?: string;
      dueDate?: string;
      lines?: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        taxRate?: number;
      }>;
    }
  ) {
    const invoice = await this.getInvoiceById(id);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new UnprocessableEntityError('Only DRAFT invoices can be edited');
    }

    return prisma.$transaction(async (tx: any) => {
      let subtotal = Number(invoice.subtotal);
      let taxAmount = Number(invoice.taxAmount);

      if (data.lines && data.lines.length > 0) {
        // Delete existing lines and recreate
        await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });

        subtotal = 0;
        taxAmount = 0;
        const newLines = [];

        for (const line of data.lines) {
          const lineSub = Math.round(line.quantity * line.unitPrice * 10000) / 10000;
          const rate = line.taxRate || 0;
          const lineTax = Math.round(((lineSub * rate) / 100) * 10000) / 10000;
          const total = lineSub + lineTax;

          subtotal += lineSub;
          taxAmount += lineTax;

          newLines.push({
            description: line.description,
            quantity: new Decimal(line.quantity.toFixed(4)),
            unitPrice: new Decimal(line.unitPrice.toFixed(4)),
            taxRate: new Decimal(rate.toFixed(4)),
            taxAmount: new Decimal(lineTax.toFixed(4)),
            discountAmount: new Decimal(0),
            lineTotal: new Decimal(total.toFixed(4)),
          });
        }

        await tx.invoiceLine.createMany({
          data: newLines.map((l) => ({ ...l, invoiceId: id })),
        });
      }

      const discountAmount = Number(invoice.discountAmount);
      const grandTotal = Math.max(0, Math.round((subtotal - discountAmount + taxAmount) * 10000) / 10000);

      return tx.invoice.update({
        where: { id },
        data: {
          notes: data.notes !== undefined ? data.notes : invoice.notes,
          dueDate: data.dueDate ? new Date(data.dueDate) : invoice.dueDate,
          subtotal: new Decimal(subtotal.toFixed(4)),
          taxAmount: new Decimal(taxAmount.toFixed(4)),
          totalAmount: new Decimal(grandTotal.toFixed(4)),
        },
        include: { lines: true },
      });
    });
  }

  /**
   * Cancels an invoice (only if not paid)
   */
  async cancelInvoice(id: string) {
    const invoice = await this.getInvoiceById(id);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new UnprocessableEntityError('Paid invoices cannot be cancelled. Use refund instead.');
    }

    return prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED },
    });
  }

  /**
   * Scans confirmed invoices and transitions any past-due unpaid invoice to OVERDUE
   */
  async markOverdueInvoices(asOfDate = new Date()) {
    const overdueCandidates = await prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.CONFIRMED, InvoiceStatus.PARTIALLY_PAID] },
        dueDate: { lt: asOfDate },
      },
    });

    const updatedIds: string[] = [];
    for (const inv of overdueCandidates) {
      const balance = Number(inv.totalAmount) - Number(inv.amountPaid);
      if (balance > 0) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: { status: InvoiceStatus.OVERDUE },
        });
        updatedIds.push(inv.id);
      }
    }

    logger.info(`Evaluated overdue invoices: ${updatedIds.length} marked as OVERDUE`);
    return {
      evaluated: overdueCandidates.length,
      markedOverdue: updatedIds.length,
      invoiceIds: updatedIds,
    };
  }

  /**
   * Retrieves overdue invoices with aging brackets and outstanding totals
   */
  async getOverdueInvoices(customerId?: string) {
    const now = new Date();
    const where: Record<string, unknown> = {
      status: InvoiceStatus.OVERDUE,
    };

    if (customerId) {
      where.customerId = customerId;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        customer: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
        subscription: {
          select: { subscriptionNumber: true },
        },
        retries: {
          orderBy: { attemptDate: 'desc' },
          take: 1,
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    let totalOutstanding = 0;
    const items = invoices.map((inv: any) => {
      const outstanding = Number(inv.totalAmount) - Number(inv.amountPaid);
      totalOutstanding += outstanding;
      const overdueDays = Math.max(0, Math.floor((now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerId: inv.customerId,
        customerName: `${inv.customer.user.firstName} ${inv.customer.user.lastName}`,
        customerEmail: inv.customer.user.email,
        companyName: inv.customer.companyName,
        subscriptionNumber: inv.subscription.subscriptionNumber,
        dueDate: inv.dueDate.toISOString(),
        totalAmount: Number(inv.totalAmount),
        amountPaid: Number(inv.amountPaid),
        outstandingBalance: outstanding,
        overdueDays,
        currency: inv.currency,
        lastRetry: inv.retries[0] || null,
      };
    });

    return {
      totalOverdueCount: items.length,
      totalOutstandingAmount: Math.round(totalOutstanding * 100) / 100,
      invoices: items,
    };
  }
}

export const invoiceService = new InvoiceService();
