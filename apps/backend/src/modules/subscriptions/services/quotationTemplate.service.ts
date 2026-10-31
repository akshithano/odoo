import { prisma } from '../../../core/database/prisma.js';
import { BadRequestError, NotFoundError, ConflictError } from '../../../core/errors/appError.js';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateQuotationTemplateInput {
  name: string;
  code: string;
  description?: string | null;
  planId?: string | null;
  defaultValidityDays?: number;
  isActive?: boolean;
  lines?: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
    unitPrice?: number;
  }>;
}

export class QuotationTemplateService {
  async createTemplate(data: CreateQuotationTemplateInput) {
    const existing = await prisma.quotationTemplate.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      throw new ConflictError(`Quotation template with code '${data.code}' already exists`);
    }

    if (data.planId) {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: data.planId } });
      if (!plan) throw new NotFoundError(`Subscription plan ${data.planId} not found`);
    }

    return prisma.$transaction(async (tx) => {
      const template = await tx.quotationTemplate.create({
        data: {
          name: data.name,
          code: data.code,
          description: data.description,
          planId: data.planId || null,
          defaultValidityDays: data.defaultValidityDays ?? 30,
          isActive: data.isActive ?? true,
        },
      });

      if (data.lines && data.lines.length > 0) {
        for (const line of data.lines) {
          // Verify product exists
          const prod = await tx.product.findUnique({ where: { id: line.productId } });
          if (!prod) throw new NotFoundError(`Product ${line.productId} not found`);

          let unitPrice = line.unitPrice ?? Number(prod.salesPrice);
          if (line.variantId) {
            const variant = await tx.productVariant.findUnique({ where: { id: line.variantId } });
            if (!variant) throw new NotFoundError(`Variant ${line.variantId} not found`);
            if (line.unitPrice === undefined) {
              unitPrice += Number(variant.additionalPrice);
            }
          }

          await tx.quotationTemplateLine.create({
            data: {
              templateId: template.id,
              productId: line.productId,
              variantId: line.variantId || null,
              quantity: line.quantity,
              unitPrice: new Decimal(unitPrice),
            },
          });
        }
      }

      return tx.quotationTemplate.findUnique({
        where: { id: template.id },
        include: {
          plan: true,
          lines: {
            include: {
              product: true,
              variant: true,
            },
          },
        },
      });
    });
  }

  async getTemplateById(id: string) {
    const template = await prisma.quotationTemplate.findUnique({
      where: { id },
      include: {
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundError(`Quotation template ${id} not found`);
    }
    return template;
  }

  async listTemplates(query: { isActive?: boolean; search?: string }) {
    const where: any = {};
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return prisma.quotationTemplate.findMany({
      where,
      include: {
        plan: { select: { id: true, name: true, code: true, basePrice: true } },
        lines: {
          include: {
            product: { select: { id: true, name: true, code: true, salesPrice: true } },
            variant: { select: { id: true, variantName: true, sku: true, additionalPrice: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTemplate(id: string, data: Partial<CreateQuotationTemplateInput>) {
    await this.getTemplateById(id);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.quotationTemplate.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          planId: data.planId !== undefined ? data.planId : undefined,
          defaultValidityDays: data.defaultValidityDays,
          isActive: data.isActive,
        },
      });

      if (data.lines) {
        await tx.quotationTemplateLine.deleteMany({ where: { templateId: id } });
        for (const line of data.lines) {
          const prod = await tx.product.findUnique({ where: { id: line.productId } });
          if (!prod) throw new NotFoundError(`Product ${line.productId} not found`);

          let unitPrice = line.unitPrice ?? Number(prod.salesPrice);
          if (line.variantId) {
            const variant = await tx.productVariant.findUnique({ where: { id: line.variantId } });
            if (line.unitPrice === undefined && variant) {
              unitPrice += Number(variant.additionalPrice);
            }
          }

          await tx.quotationTemplateLine.create({
            data: {
              templateId: id,
              productId: line.productId,
              variantId: line.variantId || null,
              quantity: line.quantity,
              unitPrice: new Decimal(unitPrice),
            },
          });
        }
      }

      return tx.quotationTemplate.findUnique({
        where: { id },
        include: {
          plan: true,
          lines: {
            include: {
              product: true,
              variant: true,
            },
          },
        },
      });
    });
  }

  async deleteTemplate(id: string) {
    await this.getTemplateById(id);
    return prisma.quotationTemplate.delete({ where: { id } });
  }
}

export const quotationTemplateService = new QuotationTemplateService();
