import { Request, Response, NextFunction } from 'express';
import { taxService } from '../services/tax.service.js';
import { createTaxRuleSchema, updateTaxRuleSchema } from '../validations/billing.validation.js';

export class TaxController {
  async listTaxRules(req: Request, res: Response, next: NextFunction) {
    try {
      const onlyActive = req.query.active === 'true';
      const rules = await taxService.listTaxRules(onlyActive);
      res.status(200).json({ success: true, data: rules });
    } catch (err) {
      next(err);
    }
  }

  async getTaxRuleById(req: Request, res: Response, next: NextFunction) {
    try {
      const rule = await taxService.getTaxRuleById(req.params.id);
      res.status(200).json({ success: true, data: rule });
    } catch (err) {
      next(err);
    }
  }

  async createTaxRule(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createTaxRuleSchema.parse(req.body);
      const created = await taxService.createTaxRule(validated);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }

  async updateTaxRule(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateTaxRuleSchema.parse(req.body);
      const updated = await taxService.updateTaxRule(req.params.id, validated);
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await taxService.toggleActive(req.params.id);
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async deleteTaxRule(req: Request, res: Response, next: NextFunction) {
    try {
      await taxService.deleteTaxRule(req.params.id);
      res.status(200).json({ success: true, message: 'Tax rule deactivated successfully' });
    } catch (err) {
      next(err);
    }
  }

  async calculateTax(req: Request, res: Response, next: NextFunction) {
    try {
      const { amount, taxRuleIds, country } = req.body;
      const result = await taxService.calculateTaxForAmount(Number(amount), taxRuleIds, country);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const taxController = new TaxController();
