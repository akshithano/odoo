import { Request, Response, NextFunction } from 'express';
import { quotationTemplateService } from '../services/quotationTemplate.service.js';
import {
  createQuotationTemplateSchema,
  updateQuotationTemplateSchema,
} from '../validations/quotationTemplate.validation.js';

export class QuotationTemplateController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createQuotationTemplateSchema.parse(req.body);
      const template = await quotationTemplateService.createTemplate(validated);
      res.status(201).json({
        success: true,
        message: 'Quotation template created successfully',
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const template = await quotationTemplateService.getTemplateById(req.params.id);
      res.status(200).json({
        success: true,
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const search = req.query.search as string | undefined;

      const templates = await quotationTemplateService.listTemplates({ isActive, search });
      res.status(200).json({
        success: true,
        data: templates,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateQuotationTemplateSchema.parse(req.body);
      const template = await quotationTemplateService.updateTemplate(req.params.id, validated);
      res.status(200).json({
        success: true,
        message: 'Quotation template updated successfully',
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await quotationTemplateService.deleteTemplate(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Quotation template deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const quotationTemplateController = new QuotationTemplateController();
