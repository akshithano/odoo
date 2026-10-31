import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service.js';
import { dunningService } from '../services/dunning.service.js';
import {
  recordPaymentSchema,
  createOnlineOrderSchema,
  verifyPaymentSchema,
} from '../validations/billing.validation.js';
import { UserRole } from '@odoo/shared';

export class PaymentController {
  async recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = recordPaymentSchema.parse(req.body);
      const payment = await paymentService.recordPayment(validated, req.user?.id);
      res.status(201).json({ success: true, data: payment });
    } catch (err) {
      next(err);
    }
  }

  async createOnlineOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createOnlineOrderSchema.parse(req.body);
      const isCustomer = req.user?.role === UserRole.CUSTOMER;
      const customerId = isCustomer ? req.user?.customerId || undefined : undefined;

      const order = await paymentService.createOnlineOrder(validated.invoiceId, customerId);
      res.status(200).json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }

  async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = verifyPaymentSchema.parse(req.body);
      const payment = await paymentService.verifyAndRecordGatewayPayment(validated);
      res.status(200).json({ success: true, data: payment });
    } catch (err) {
      next(err);
    }
  }

  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await paymentService.processWebhook(req.headers as any, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async listPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const isCustomer = req.user?.role === UserRole.CUSTOMER;
      const customerId = isCustomer ? req.user?.customerId || '__invalid__' : (req.query.customerId as string);

      const result = await paymentService.listPayments({
        customerId,
        invoiceId: req.query.invoiceId as string,
        status: req.query.status as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
      });

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getPaymentById(req: Request, res: Response, next: NextFunction) {
    try {
      const isCustomer = req.user?.role === UserRole.CUSTOMER;
      const customerId = isCustomer ? req.user?.customerId || null : null;

      const payment = await paymentService.getPaymentById(req.params.id, customerId);
      res.status(200).json({ success: true, data: payment });
    } catch (err) {
      next(err);
    }
  }

  async listRetries(req: Request, res: Response, next: NextFunction) {
    try {
      const retries = await dunningService.listRetries(req.query.invoiceId as string);
      res.status(200).json({ success: true, data: retries });
    } catch (err) {
      next(err);
    }
  }

  async manualRetry(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await dunningService.scheduleOrExecuteRetry(req.params.invoiceId, true);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const paymentController = new PaymentController();
