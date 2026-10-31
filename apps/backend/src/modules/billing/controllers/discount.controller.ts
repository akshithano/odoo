import { Request, Response, NextFunction } from 'express';
import { discountService } from '../services/discount.service.js';
import {
  createDiscountSchema,
  updateDiscountSchema,
  validateDiscountSchema,
} from '../validations/billing.validation.js';

export class DiscountController {
  async listDiscounts(req: Request, res: Response, next: NextFunction) {
    try {
      const onlyActive = req.query.active === 'true';
      const discounts = await discountService.listDiscounts(onlyActive);
      res.status(200).json({ success: true, data: discounts });
    } catch (err) {
      next(err);
    }
  }

  async getDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      const discount = await discountService.getDiscount(req.params.id);
      res.status(200).json({ success: true, data: discount });
    } catch (err) {
      next(err);
    }
  }

  async createDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createDiscountSchema.parse(req.body);
      const created = await discountService.createDiscount(validated);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }

  async updateDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateDiscountSchema.parse(req.body);
      const updated = await discountService.updateDiscount(req.params.id, validated);
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await discountService.toggleActive(req.params.id);
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async validateDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = validateDiscountSchema.parse(req.body);
      const result = await discountService.validateDiscount(validated);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const discountController = new DiscountController();
