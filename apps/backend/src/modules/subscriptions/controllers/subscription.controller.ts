import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from '../services/subscription.service.js';
import { historyService } from '../services/history.service.js';
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  upgradeSubscriptionSchema,
} from '../validations/subscription.validation.js';
import { UserRole, SubscriptionStatus } from '@odoo/shared';

export class SubscriptionController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createSubscriptionSchema.parse(req.body);
      const subscription = await subscriptionService.createSubscription(
        validated,
        req.user?.id || null
      );

      res.status(201).json({
        success: true,
        message: 'Subscription created successfully',
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const customerIdFilter =
        req.user?.role === UserRole.CUSTOMER ? req.user.customerId : null;

      const subscription = await subscriptionService.getSubscriptionById(
        req.params.id,
        customerIdFilter
      );

      res.status(200).json({
        success: true,
        data: subscription,
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

      const status = req.query.status as SubscriptionStatus | undefined;
      const planId = req.query.planId as string | undefined;
      const search = req.query.search as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await subscriptionService.listSubscriptions({
        customerId,
        status,
        planId,
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
      const validated = updateSubscriptionSchema.parse(req.body);
      const customerIdFilter =
        req.user?.role === UserRole.CUSTOMER ? req.user.customerId : null;

      const subscription = await subscriptionService.updateSubscription(
        req.params.id,
        validated,
        customerIdFilter,
        req.user?.id || null
      );

      res.status(200).json({
        success: true,
        message: 'Subscription updated successfully',
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  async confirm(req: Request, res: Response, next: NextFunction) {
    try {
      const customerIdFilter =
        req.user?.role === UserRole.CUSTOMER ? req.user.customerId : null;

      const subscription = await subscriptionService.confirmSubscription(
        req.params.id,
        customerIdFilter,
        req.user?.id || null
      );

      res.status(200).json({
        success: true,
        message: 'Subscription confirmed successfully',
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  async activate(req: Request, res: Response, next: NextFunction) {
    try {
      const customerIdFilter =
        req.user?.role === UserRole.CUSTOMER ? req.user.customerId : null;

      const subscription = await subscriptionService.activateSubscription(
        req.params.id,
        customerIdFilter,
        req.user?.id || null
      );

      res.status(200).json({
        success: true,
        message: 'Subscription activated successfully',
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  async pause(req: Request, res: Response, next: NextFunction) {
    try {
      const customerIdFilter =
        req.user?.role === UserRole.CUSTOMER ? req.user.customerId : null;

      const subscription = await subscriptionService.pauseSubscription(
        req.params.id,
        customerIdFilter,
        req.user?.id || null
      );

      res.status(200).json({
        success: true,
        message: 'Subscription paused successfully',
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  async resume(req: Request, res: Response, next: NextFunction) {
    try {
      const customerIdFilter =
        req.user?.role === UserRole.CUSTOMER ? req.user.customerId : null;

      const subscription = await subscriptionService.resumeSubscription(
        req.params.id,
        customerIdFilter,
        req.user?.id || null
      );

      res.status(200).json({
        success: true,
        message: 'Subscription resumed successfully',
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  async renew(req: Request, res: Response, next: NextFunction) {
    try {
      const customerIdFilter =
        req.user?.role === UserRole.CUSTOMER ? req.user.customerId : null;

      const subscription = await subscriptionService.renewSubscription(
        req.params.id,
        customerIdFilter,
        req.user?.id || null
      );

      res.status(200).json({
        success: true,
        message: 'Subscription renewed successfully',
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  async close(req: Request, res: Response, next: NextFunction) {
    try {
      const customerIdFilter =
        req.user?.role === UserRole.CUSTOMER ? req.user.customerId : null;

      const subscription = await subscriptionService.closeSubscription(
        req.params.id,
        customerIdFilter,
        req.user?.id || null
      );

      res.status(200).json({
        success: true,
        message: 'Subscription closed successfully',
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  async previewUpgrade(req: Request, res: Response, next: NextFunction) {
    try {
      const { newPlanId, effectiveDate } = upgradeSubscriptionSchema.parse(req.body);
      const customerIdFilter =
        req.user?.role === UserRole.CUSTOMER ? req.user.customerId : null;

      const preview = await subscriptionService.previewUpgrade(
        req.params.id,
        newPlanId,
        effectiveDate,
        customerIdFilter
      );

      res.status(200).json({
        success: true,
        data: preview,
      });
    } catch (error) {
      next(error);
    }
  }

  async upgrade(req: Request, res: Response, next: NextFunction) {
    try {
      const { newPlanId, effectiveDate } = upgradeSubscriptionSchema.parse(req.body);
      const customerIdFilter =
        req.user?.role === UserRole.CUSTOMER ? req.user.customerId : null;

      const result = await subscriptionService.upgradeSubscription(
        req.params.id,
        newPlanId,
        effectiveDate,
        customerIdFilter,
        req.user?.id || null
      );

      res.status(200).json({
        success: true,
        message: 'Subscription upgraded successfully with mid-cycle proration adjustment',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getChanges(req: Request, res: Response, next: NextFunction) {
    try {
      const customerIdFilter =
        req.user?.role === UserRole.CUSTOMER ? req.user.customerId : null;

      const changes = await subscriptionService.getSubscriptionChanges(
        req.params.id,
        customerIdFilter
      );

      res.status(200).json({
        success: true,
        data: changes,
      });
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const customerIdFilter =
        req.user?.role === UserRole.CUSTOMER ? req.user.customerId : null;

      // Verify access to subscription first
      await subscriptionService.getSubscriptionById(req.params.id, customerIdFilter);

      const history = await historyService.getBySubscription(req.params.id);

      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const subscriptionController = new SubscriptionController();
