import { Request, Response, NextFunction } from 'express';
import { ApiResponse, ProductType } from '@odoo/shared';
import { productService } from '../services/product.service.js';
import { createProductSchema, updateProductSchema, createVariantSchema } from '../validations/product.validation.js';

export class ProductController {
  async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createProductSchema.parse(req.body);
      const product = await productService.createProduct(parsed);
      const response: ApiResponse<typeof product> = {
        success: true,
        message: 'Product created successfully',
        data: product,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  async listProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const type = req.query.type as ProductType | undefined;
      const search = req.query.search as string | undefined;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const result = await productService.listProducts({ type, search, isActive, page, limit });
      const response: ApiResponse<typeof result.products> = {
        success: true,
        data: result.products,
        meta: result.meta,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await productService.getProductById(req.params.id);
      const response: ApiResponse<typeof product> = {
        success: true,
        data: product,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = updateProductSchema.parse(req.body);
      const updated = await productService.updateProduct(req.params.id, parsed);
      const response: ApiResponse<typeof updated> = {
        success: true,
        message: 'Product updated successfully',
        data: updated,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async toggleProductStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const isActive = req.body.isActive === true;
      const updated = await productService.toggleProductStatus(req.params.id, isActive);
      const response: ApiResponse<typeof updated> = {
        success: true,
        message: `Product has been ${isActive ? 'activated' : 'deactivated'}`,
        data: updated,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async addVariant(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createVariantSchema.parse(req.body);
      const variant = await productService.addVariant(req.params.id, parsed);
      const response: ApiResponse<typeof variant> = {
        success: true,
        message: 'Product variant added successfully',
        data: variant,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  async calculateVariantPrice(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await productService.calculateVariantPrice(req.params.id, req.params.variantId);
      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}

export const productController = new ProductController();
