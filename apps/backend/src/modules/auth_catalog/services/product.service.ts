import { ProductType } from '@odoo/shared';
import { prisma } from '../../../core/database/prisma.js';
import { ConflictError, NotFoundError } from '../../../core/errors/appError.js';
import { logger } from '../../../core/logging/logger.js';
import { z } from 'zod';
import { createProductSchema, updateProductSchema, createVariantSchema } from '../validations/product.validation.js';

type CreateProductInput = z.infer<typeof createProductSchema>;
type UpdateProductInput = z.infer<typeof updateProductSchema>;
type CreateVariantInput = z.infer<typeof createVariantSchema>;

export class ProductService {
  /**
   * Creates a catalog product with optional initial variants
   */
  async createProduct(input: CreateProductInput) {
    const existing = await prisma.product.findUnique({
      where: { code: input.code.toUpperCase() },
    });

    if (existing) {
      throw new ConflictError(`A product with code '${input.code}' already exists`);
    }

    // Verify variant SKU uniqueness if variants provided
    if (input.variants && input.variants.length > 0) {
      const skus = input.variants.map((v) => v.sku.toUpperCase());
      const existingSku = await prisma.productVariant.findFirst({
        where: { sku: { in: skus } },
      });
      if (existingSku) {
        throw new ConflictError(`A product variant with SKU '${existingSku.sku}' already exists`);
      }
    }

    const product = await prisma.product.create({
      data: {
        name: input.name,
        code: input.code.toUpperCase(),
        type: input.type as ProductType,
        description: input.description,
        internalNotes: input.internalNotes,
        salesPrice: input.salesPrice,
        costPrice: input.costPrice,
        isActive: true,
        variants: {
          create: input.variants.map((v) => ({
            variantName: v.variantName,
            sku: v.sku.toUpperCase(),
            attributeName: v.attributeName,
            attributeValue: v.attributeValue,
            additionalPrice: v.additionalPrice,
            isActive: true,
          })),
        },
      },
      include: {
        variants: true,
      },
    });

    logger.info(`Product created [ID: ${product.id}, Code: ${product.code}] with ${product.variants.length} variants`);
    return this.serializeProduct(product);
  }

  /**
   * Updates an existing product
   */
  async updateProduct(id: string, input: UpdateProductInput) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundError(`Product with ID '${id}' not found`);
    }

    if (input.code && input.code.toUpperCase() !== product.code) {
      const existing = await prisma.product.findUnique({
        where: { code: input.code.toUpperCase() },
      });
      if (existing) {
        throw new ConflictError(`A product with code '${input.code}' already exists`);
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.code ? { code: input.code.toUpperCase() } : {}),
        ...(input.type ? { type: input.type as ProductType } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.internalNotes !== undefined ? { internalNotes: input.internalNotes } : {}),
        ...(input.salesPrice !== undefined ? { salesPrice: input.salesPrice } : {}),
        ...(input.costPrice !== undefined ? { costPrice: input.costPrice } : {}),
      },
      include: {
        variants: true,
      },
    });

    logger.info(`Product updated [ID: ${updated.id}, Code: ${updated.code}]`);
    return this.serializeProduct(updated);
  }

  /**
   * Lists catalog products with filters
   */
  async listProducts(options: { type?: ProductType; search?: string; isActive?: boolean; page?: number; limit?: number }) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (options.type) {
      where.type = options.type;
    }

    if (options.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { code: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [products, totalRecords] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          variants: {
            where: { isActive: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      products: products.map((p) => this.serializeProduct(p)),
      meta: {
        page,
        limit,
        totalRecords,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Retrieves single product by ID
   */
  async getProductById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
      },
    });

    if (!product) {
      throw new NotFoundError(`Product with ID '${id}' not found`);
    }

    return this.serializeProduct(product);
  }

  /**
   * Activates or deactivates product
   */
  async toggleProductStatus(id: string, isActive: boolean) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundError(`Product with ID '${id}' not found`);
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { isActive },
      include: { variants: true },
    });

    logger.info(`Product status toggled [ID: ${id}, Active: ${isActive}]`);
    return this.serializeProduct(updated);
  }

  /**
   * Adds a variant to an existing product
   */
  async addVariant(productId: string, input: CreateVariantInput) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundError(`Product with ID '${productId}' not found`);
    }

    const existingSku = await prisma.productVariant.findUnique({
      where: { sku: input.sku.toUpperCase() },
    });

    if (existingSku) {
      throw new ConflictError(`A variant with SKU '${input.sku}' already exists`);
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        variantName: input.variantName,
        sku: input.sku.toUpperCase(),
        attributeName: input.attributeName,
        attributeValue: input.attributeValue,
        additionalPrice: input.additionalPrice,
        isActive: true,
      },
    });

    logger.info(`Variant added [SKU: ${variant.sku}] to Product [ID: ${productId}]`);

    return {
      id: variant.id,
      productId: variant.productId,
      variantName: variant.variantName,
      sku: variant.sku,
      attributeName: variant.attributeName,
      attributeValue: variant.attributeValue,
      additionalPrice: Number(variant.additionalPrice),
      isActive: variant.isActive,
      createdAt: variant.createdAt.toISOString(),
    };
  }

  /**
   * Calculates final effective price combining product sales price and variant additional price.
   * Example: Base product sales price = ₹1000 + Odoo brand variant ₹560 = ₹1560.
   */
  async calculateVariantPrice(productId: string, variantId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundError(`Product with ID '${productId}' not found`);
    }

    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });

    if (!variant) {
      throw new NotFoundError(`Variant with ID '${variantId}' does not belong to product '${productId}'`);
    }

    const basePrice = Number(product.salesPrice);
    const additionalPrice = Number(variant.additionalPrice);
    const finalPrice = Number((basePrice + additionalPrice).toFixed(4));

    return {
      productId: product.id,
      productName: product.name,
      variantId: variant.id,
      variantName: variant.variantName,
      sku: variant.sku,
      attributeName: variant.attributeName,
      attributeValue: variant.attributeValue,
      baseSalesPrice: basePrice,
      variantAdditionalPrice: additionalPrice,
      finalCalculatedPrice: finalPrice,
    };
  }

  private serializeProduct(p: {
    id: string;
    name: string;
    code: string;
    type: string;
    description: string | null;
    internalNotes: string | null;
    salesPrice: unknown;
    costPrice: unknown;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    variants: Array<{
      id: string;
      productId: string;
      variantName: string;
      sku: string;
      attributeName: string | null;
      attributeValue: string | null;
      additionalPrice: unknown;
      isActive: boolean;
      createdAt: Date;
    }>;
  }) {
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      type: p.type as ProductType,
      description: p.description,
      internalNotes: p.internalNotes,
      salesPrice: Number(p.salesPrice),
      costPrice: Number(p.costPrice),
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      variants: p.variants.map((v) => ({
        id: v.id,
        productId: v.productId,
        variantName: v.variantName,
        sku: v.sku,
        attributeName: v.attributeName,
        attributeValue: v.attributeValue,
        additionalPrice: Number(v.additionalPrice),
        calculatedPrice: Number((Number(p.salesPrice) + Number(v.additionalPrice)).toFixed(4)),
        isActive: v.isActive,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  }
}

export const productService = new ProductService();
