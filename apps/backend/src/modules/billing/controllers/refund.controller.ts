import { Request, Response, NextFunction } from 'express';
import { refundService } from '../services/refund.service.js';
import { createRefundSchema } from '../validations/billing.validation.js';

export class RefundController {
  async processRefund(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createRefundSchema.parse(req.body);
      const refund = await refundService.processRefund(validated);
      res.status(201).json({ success: true, data: refund });
    } catch (err) {
      next(err);
    }
  }

  async listRefunds(req: Request, res: Response, next: NextFunction) {
    try {
      const refunds = await refundService.listRefunds({
        invoiceId: req.query.invoiceId as string,
        paymentId: req.query.paymentId as string,
      });
      res.status(200).json({ success: true, data: refunds });
    } catch (err) {
      next(err);
    }
  }
}

export const refundController = new RefundController();
