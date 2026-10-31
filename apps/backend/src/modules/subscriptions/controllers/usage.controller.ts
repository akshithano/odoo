import { Request, Response, NextFunction } from 'express';
import { usageService } from '../services/usage.service.js';
import {
  ingestUsageEventSchema,
  queryUsageSummarySchema,
} from '../validations/usage.validation.js';
import { UserRole } from '@odoo/shared';

export class UsageController {
  async ingestEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = ingestUsageEventSchema.parse(req.body);
      const event = await usageService.recordUsageEvent(validated);

      res.status(202).json({
        success: true,
        message: 'Usage event ingested successfully',
        data: event,
      });
    } catch (error) {
      next(error);
    }
  }

  async listEvents(req: Request, res: Response, next: NextFunction) {
    try {
      let customerId = req.query.customerId as string | undefined;
      if (req.user?.role === UserRole.CUSTOMER) {
        customerId = req.user.customerId || undefined;
      }

      const subscriptionId = req.query.subscriptionId as string | undefined;
      const usageType = req.query.usageType as string | undefined;
      const billed = req.query.billed !== undefined ? req.query.billed === 'true' : undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const result = await usageService.listUsageRecords({
        subscriptionId,
        customerId,
        usageType,
        billed,
        startDate,
        endDate,
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

  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = queryUsageSummarySchema.parse(req.query);
      const customerIdFilter =
        req.user?.role === UserRole.CUSTOMER ? req.user.customerId : null;

      const summary = await usageService.getSubscriptionUsageSummary(
        req.params.id,
        startDate,
        endDate,
        customerIdFilter
      );

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const usageController = new UsageController();
