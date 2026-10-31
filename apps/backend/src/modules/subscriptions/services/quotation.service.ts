import { prisma } from '../../../core/database/prisma.js';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
} from '../../../core/errors/appError.js';
import { QuotationStatus, SubscriptionStatus, PaymentTerms, BillingFrequency } from '@odoo/shared';
import { Decimal } from '@prisma/client/runtime/library';
import { subscriptionService } from './subscription.service.js';

export interface QuotationLineInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice?: number;
  taxRate?: number;
}

export interface CreateQuotationInput {
  customerId: string;
  planId?: string | null;
  templateId?: string | null;
  validFrom: string;
  validUntil: string;
  notes?: string | null;
  createdById?: string | null;
  lines?: QuotationLineInput[];
}

export class QuotationService {
  /**
   * Generates a deterministic, unique human-readable quotation number: QTN-YYYYMM-XXXX
   */
  async generateQuotationNumber(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `QTN-${yearMonth}-`;

    const latest = await prisma.quotation.findFirst({
      where: { quotationNumber: { startsWith: prefix } },
      orderBy: { quotationNumber: 'desc' },
      select: { quotationNumber: true },
    });

    let nextSeq = 1;
    if (latest && latest.quotationNumber) {
      const parts = latest.quotationNumber.split('-');
      if (parts.length === 3) {
        const lastNum = parseInt(parts[2], 10);
        if (!isNaN(lastNum)) {
          nextSeq = lastNum + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Create a quotation
   */
  async createQuotation(data: CreateQuotationInput) {
    // 1. Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
    });
    if (!customer) {
      throw new NotFoundError(`Customer with ID ${data.customerId} not found`);
    }

    // 2. Validate dates
    const validFromDate = new Date(data.validFrom);
    const validUntilDate = new Date(data.validUntil);
    if (isNaN(validFromDate.getTime()) || isNaN(validUntilDate.getTime())) {
      throw new BadRequestError('Invalid date format for validFrom or validUntil');
    }
    if (validUntilDate.getTime() < validFromDate.getTime()) {
      throw new BadRequestError('validUntil date cannot be earlier than validFrom date');
    }

    // 3. Verify plan if provided
    let planId = data.planId || null;
    if (planId) {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
      if (!plan) throw new NotFoundError(`Subscription plan with ID ${planId} not found`);
    }

    // 4. Handle template lines if lines are not explicitly provided
    let linesToProcess: QuotationLineInput[] = data.lines || [];
    if (linesToProcess.length === 0 && data.templateId) {
      const template = await prisma.quotationTemplate.findUnique({
        where: { id: data.templateId },
        include: { lines: true },
      });
      if (template) {
        if (!planId && template.planId) {
          planId = template.planId;
        }
        linesToProcess = template.lines.map((tl) => ({
          productId: tl.productId,
          variantId: tl.variantId,
          quantity: tl.quantity,
          unitPrice: Number(tl.unitPrice),
          taxRate: 0,
        }));
      }
    }

    // 5. Generate unique quotation number
    const quotationNumber = await this.generateQuotationNumber();

    return prisma.$transaction(async (tx) => {
      let validCreatedById: string | null = null;
      if (data.createdById) {
        const u = await tx.user.findUnique({ where: { id: data.createdById }, select: { id: true } });
        if (u) validCreatedById = u.id;
      }

      // Create quote header
      const quotation = await tx.quotation.create({
        data: {
          quotationNumber,
          customerId: data.customerId,
          planId,
          templateId: data.templateId || null,
          status: QuotationStatus.DRAFT,
          validFrom: validFromDate,
          validUntil: validUntilDate,
          notes: data.notes || null,
          createdById: validCreatedById,
          subtotal: new Decimal(0),
          taxAmount: new Decimal(0),
          totalAmount: new Decimal(0),
        },
      });

      let subtotal = 0;
      let totalTax = 0;

      for (const line of linesToProcess) {
        const prod = await tx.product.findUnique({ where: { id: line.productId } });
        if (!prod) throw new NotFoundError(`Product ${line.productId} not found`);

        let unitPrice = line.unitPrice !== undefined ? line.unitPrice : Number(prod.salesPrice);
        if (line.variantId) {
          const variant = await tx.productVariant.findUnique({ where: { id: line.variantId } });
          if (!variant) throw new NotFoundError(`Product variant ${line.variantId} not found`);
          if (line.unitPrice === undefined) {
            unitPrice += Number(variant.additionalPrice);
          }
        }

        const quantity = line.quantity || 1;
        const lineBase = quantity * unitPrice;
        const taxRate = line.taxRate || 0;
        const lineTax = lineBase * (taxRate / 100);
        const lineTotal = lineBase + lineTax;

        subtotal += lineBase;
        totalTax += lineTax;

        await tx.quotationLine.create({
          data: {
            quotationId: quotation.id,
            productId: line.productId,
            variantId: line.variantId || null,
            quantity,
            unitPrice: new Decimal(unitPrice),
            taxRate: new Decimal(taxRate),
            taxAmount: new Decimal(lineTax),
            lineTotal: new Decimal(lineTotal),
          },
        });
      }

      const finalTotal = subtotal + totalTax;

      // Update quote totals
      const updated = await tx.quotation.update({
        where: { id: quotation.id },
        data: {
          subtotal: new Decimal(subtotal.toFixed(4)),
          taxAmount: new Decimal(totalTax.toFixed(4)),
          totalAmount: new Decimal(finalTotal.toFixed(4)),
        },
        include: {
          customer: {
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
          },
          plan: true,
          template: true,
          lines: {
            include: {
              product: true,
              variant: true,
            },
          },
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });

      return updated;
    });
  }

  /**
   * Get quotation by ID
   */
  async getQuotationById(id: string, customerIdFilter?: string | null) {
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
        plan: true,
        template: true,
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
        subscription: {
          select: {
            id: true,
            subscriptionNumber: true,
            status: true,
          },
        },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    if (!quotation) {
      throw new NotFoundError(`Quotation ${id} not found`);
    }

    // Customer isolation check
    if (customerIdFilter && quotation.customerId !== customerIdFilter) {
      throw new NotFoundError(`Quotation ${id} not found`);
    }

    return quotation;
  }

  /**
   * List quotations with pagination, filtering and customer isolation
   */
  async listQuotations(params: {
    customerId?: string;
    status?: QuotationStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.customerId) {
      where.customerId = params.customerId;
    }
    if (params.status) {
      where.status = params.status;
    }
    if (params.search) {
      where.OR = [
        { quotationNumber: { contains: params.search, mode: 'insensitive' } },
        { customer: { companyName: { contains: params.search, mode: 'insensitive' } } },
        { customer: { user: { email: { contains: params.search, mode: 'insensitive' } } } },
      ];
    }

    const [totalRecords, items] = await Promise.all([
      prisma.quotation.count({ where }),
      prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: {
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
          },
          plan: { select: { id: true, name: true, code: true, basePrice: true } },
          template: { select: { id: true, name: true, code: true } },
          subscription: { select: { id: true, subscriptionNumber: true, status: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        hasNextPage: page * limit < totalRecords,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Update editable quotation information
   */
  async updateQuotation(id: string, data: Partial<CreateQuotationInput>, customerIdFilter?: string | null) {
    const existing = await this.getQuotationById(id, customerIdFilter);

    if (existing.status === QuotationStatus.CONVERTED) {
      throw new UnprocessableEntityError('Cannot edit a quotation that has already been converted into a subscription');
    }

    return prisma.$transaction(async (tx) => {
      let subtotal = Number(existing.subtotal);
      let taxAmount = Number(existing.taxAmount);
      let totalAmount = Number(existing.totalAmount);

      if (data.lines) {
        await tx.quotationLine.deleteMany({ where: { quotationId: id } });
        subtotal = 0;
        taxAmount = 0;

        for (const line of data.lines) {
          const prod = await tx.product.findUnique({ where: { id: line.productId } });
          if (!prod) throw new NotFoundError(`Product ${line.productId} not found`);

          let unitPrice = line.unitPrice !== undefined ? line.unitPrice : Number(prod.salesPrice);
          if (line.variantId) {
            const variant = await tx.productVariant.findUnique({ where: { id: line.variantId } });
            if (line.unitPrice === undefined && variant) {
              unitPrice += Number(variant.additionalPrice);
            }
          }

          const quantity = line.quantity || 1;
          const lineBase = quantity * unitPrice;
          const taxRate = line.taxRate || 0;
          const lineTax = lineBase * (taxRate / 100);
          const lineTotal = lineBase + lineTax;

          subtotal += lineBase;
          taxAmount += lineTax;

          await tx.quotationLine.create({
            data: {
              quotationId: id,
              productId: line.productId,
              variantId: line.variantId || null,
              quantity,
              unitPrice: new Decimal(unitPrice),
              taxRate: new Decimal(taxRate),
              taxAmount: new Decimal(lineTax),
              lineTotal: new Decimal(lineTotal),
            },
          });
        }
        totalAmount = subtotal + taxAmount;
      }

      const updateData: any = {
        subtotal: new Decimal(subtotal.toFixed(4)),
        taxAmount: new Decimal(taxAmount.toFixed(4)),
        totalAmount: new Decimal(totalAmount.toFixed(4)),
      };

      if (data.planId !== undefined) updateData.planId = data.planId;
      if (data.validFrom) updateData.validFrom = new Date(data.validFrom);
      if (data.validUntil) updateData.validUntil = new Date(data.validUntil);
      if (data.notes !== undefined) updateData.notes = data.notes;

      return tx.quotation.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          plan: true,
          lines: { include: { product: true, variant: true } },
        },
      });
    });
  }

  /**
   * Update quotation status (e.g. SENT, ACCEPTED, REJECTED, EXPIRED)
   */
  async updateQuotationStatus(id: string, status: QuotationStatus, customerIdFilter?: string | null) {
    const quotation = await this.getQuotationById(id, customerIdFilter);

    if (quotation.status === QuotationStatus.CONVERTED) {
      throw new UnprocessableEntityError('Cannot alter status of a quotation that has already been converted');
    }

    return prisma.quotation.update({
      where: { id },
      data: { status },
      include: {
        customer: true,
        plan: true,
        lines: { include: { product: true, variant: true } },
      },
    });
  }

  /**
   * One-Click Conversion: Convert an ACCEPTED quotation into an active/confirmed subscription.
   * Prevents double conversion and preserves original quote.
   */
  async convertToSubscription(id: string, customerIdFilter?: string | null, userId?: string | null) {
    const quotation = await this.getQuotationById(id, customerIdFilter);

    // 1. Prevent multiple conversions
    if (quotation.status === QuotationStatus.CONVERTED || quotation.subscription) {
      throw new ConflictError(
        `Quotation ${quotation.quotationNumber} has already been converted into subscription ${quotation.subscription?.subscriptionNumber || ''}`
      );
    }

    // 2. Must be ACCEPTED or DRAFT/SENT (allow converting accepted quotations; if not accepted, prompt or require ACCEPTED)
    if (quotation.status === QuotationStatus.REJECTED || quotation.status === QuotationStatus.EXPIRED) {
      throw new UnprocessableEntityError(`Cannot convert a quotation with status ${quotation.status}`);
    }

    // 3. Plan is required for a subscription
    if (!quotation.planId) {
      throw new BadRequestError('Quotation must have a selected subscription plan before conversion');
    }

    // Delegate creation to subscriptionService with atomic transaction
    const subscription = await subscriptionService.createFromQuotation(quotation, userId);

    // Mark quotation status as CONVERTED
    await prisma.quotation.update({
      where: { id: quotation.id },
      data: { status: QuotationStatus.CONVERTED },
    });

    return {
      quotation: await this.getQuotationById(id),
      subscription,
    };
  }
}

export const quotationService = new QuotationService();
