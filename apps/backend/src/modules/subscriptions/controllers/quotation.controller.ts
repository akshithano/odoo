import { Request, Response, NextFunction } from 'express';
import { quotationService } from '../services/quotation.service.js';
import {
  createQuotationSchema,
  updateQuotationSchema,
  updateQuotationStatusSchema,
} from '../validations/quotation.validation.js';
import { UserRole, QuotationStatus } from '@odoo/shared';

export class QuotationController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createQuotationSchema.parse(req.body);
      const customerId =
        req.user?.role === UserRole.CUSTOMER
          ? req.user.customerId || validated.customerId
          : validated.customerId;

      const quotation = await quotationService.createQuotation({
        ...validated,
        customerId,
        createdById: req.user?.id || null,
      });

      res.status(201).json({
        success: true,
        message: 'Quotation created successfully',
        data: quotation,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const customerIdFilter =
        req.user?.role === UserRole.CUSTOMER ? req.user.customerId : null;

      const quotation = await quotationService.getQuotationById(req.params.id, customerIdFilter);
      res.status(200).json({
        success: true,
        data: quotation,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      let customerId = req.query.customerId as string | undefined;
      if (req.user?.role === UserRole.CUSTOMER) {
        customerId = req.user.customerId || undefined;
      }

      const status = req.query.status as QuotationStatus | undefined;
      const search = req.query.search as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await quotationService.listQuotations({
        customerId,
        status,
        search,
        page,
        limit,
      });

      res.status(200).json({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateQuotationSchema.parse(req.body);
      const customerIdFilter =
        req.user?.role === UserRole.CUSTOMER ? req.user.customerId : null;

      const quotation = await quotationService.updateQuotation(
        req.params.id,
        validated,
        customerIdFilter
      );

      res.status(200).json({
        success: true,
        message: 'Quotation updated successfully',
        data: quotation,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = updateQuotationStatusSchema.parse(req.body);
      const customerIdFilter =
        req.user?.role === UserRole.CUSTOMER ? req.user.customerId : null;

      const quotation = await quotationService.updateQuotationStatus(
        req.params.id,
        status,
        customerIdFilter
      );

      res.status(200).json({
        success: true,
        message: `Quotation status updated to ${status}`,
        data: quotation,
      });
    } catch (error) {
      next(error);
    }
  }

  async convertToSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const customerIdFilter =
        req.user?.role === UserRole.CUSTOMER ? req.user.customerId : null;

      const result = await quotationService.convertToSubscription(
        req.params.id,
        customerIdFilter,
        req.user?.id || null
      );

      res.status(201).json({
        success: true,
        message: 'Quotation successfully converted to active subscription',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const quotationController = new QuotationController();
