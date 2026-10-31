import { Request, Response, NextFunction } from 'express';
import { ApiResponse, PlanStatus, BillingFrequency } from '@odoo/shared';
import { planService } from '../services/plan.service.js';
import { createPlanSchema, updatePlanSchema, renewPlanSchema } from '../validations/plan.validation.js';

export class PlanController {
  async createPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createPlanSchema.parse(req.body);
      const plan = await planService.createPlan(parsed);
      const response: ApiResponse<typeof plan> = {
        success: true,
        message: 'Subscription plan created successfully',
        data: plan,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  async listPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as PlanStatus | undefined;
      const billingFrequency = req.query.billingFrequency as BillingFrequency | undefined;
      const search = req.query.search as string | undefined;
      const isActiveOnly = req.query.isActiveOnly === 'true';
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const result = await planService.listPlans({ status, billingFrequency, search, isActiveOnly, page, limit });
      const response: ApiResponse<typeof result.plans> = {
        success: true,
        data: result.plans,
        meta: result.meta,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async getPlanById(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await planService.getPlanById(req.params.id);
      const response: ApiResponse<typeof plan> = {
        success: true,
        data: plan,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async updatePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = updatePlanSchema.parse(req.body);
      const updated = await planService.updatePlan(req.params.id, parsed);
      const response: ApiResponse<typeof updated> = {
        success: true,
        message: 'Subscription plan updated successfully',
        data: updated,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async pausePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await planService.pausePlan(req.params.id);
      const response: ApiResponse<typeof updated> = {
        success: true,
        message: 'Subscription plan paused successfully',
        data: updated,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async resumePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await planService.resumePlan(req.params.id);
      const response: ApiResponse<typeof updated> = {
        success: true,
        message: 'Subscription plan resumed successfully',
        data: updated,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async closePlanEarly(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await planService.closePlanEarly(req.params.id);
      const response: ApiResponse<typeof updated> = {
        success: true,
        message: 'Subscription plan closed early successfully',
        data: updated,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async renewPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = renewPlanSchema.parse(req.body);
      const updated = await planService.renewPlan(req.params.id, parsed.newValidUntil);
      const response: ApiResponse<typeof updated> = {
        success: true,
        message: 'Subscription plan renewed successfully',
        data: updated,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async togglePlanActive(req: Request, res: Response, next: NextFunction) {
    try {
      const isActive = req.body.isActive === true;
      const updated = await planService.togglePlanActive(req.params.id, isActive);
      const response: ApiResponse<typeof updated> = {
        success: true,
        message: `Subscription plan has been ${isActive ? 'activated' : 'deactivated'}`,
        data: updated,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async sweepExpiredPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await planService.autoCloseExpiredPlans();
      const response: ApiResponse<{ closedPlansCount: number }> = {
        success: true,
        message: `Plan expiry sweep complete: ${count} plans closed`,
        data: { closedPlansCount: count },
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}

export const planController = new PlanController();
