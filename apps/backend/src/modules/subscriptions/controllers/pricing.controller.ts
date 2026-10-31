import { Request, Response, NextFunction } from 'express';
import { pricingService } from '../services/pricing.service.js';
import {
  calculatePriceSchema,
  bulkPricingTiersSchema,
} from '../validations/pricing.validation.js';
import { PricingModel, TierType } from '@odoo/shared';

export class PricingController {
  async calculate(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = calculatePriceSchema.parse(req.body);
      const result = await pricingService.calculateForEntity({
        planId: validated.planId,
        productId: validated.productId,
        quantity: validated.quantity,
        tierType: validated.tierType,
        modelType: validated.modelType,
        customTiers: validated.customTiers,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async listTiers(req: Request, res: Response, next: NextFunction) {
    try {
      const planId = req.query.planId as string | undefined;
      const productId = req.query.productId as string | undefined;
      const tierType = req.query.tierType as TierType | undefined;
      const modelType = req.query.modelType as PricingModel | undefined;

      const tiers = await pricingService.listTiers({
        planId,
        productId,
        tierType,
        modelType,
      });

      res.status(200).json({
        success: true,
        data: tiers,
      });
    } catch (error) {
      next(error);
    }
  }

  async setBulkTiers(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = bulkPricingTiersSchema.parse(req.body);
      const tiers = await pricingService.setBulkPricingTiers(validated);

      res.status(200).json({
        success: true,
        message: 'Pricing tiers saved successfully',
        data: tiers,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteTier(req: Request, res: Response, next: NextFunction) {
    try {
      await pricingService.deleteTier(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Pricing tier deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const pricingController = new PricingController();
