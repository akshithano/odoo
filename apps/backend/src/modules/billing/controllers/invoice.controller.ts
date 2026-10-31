import { Request, Response, NextFunction } from 'express';
import { invoiceService } from '../services/invoice.service.js';
import {
  generateCycleSchema,
  confirmInvoiceSchema,
  updateDraftInvoiceSchema,
} from '../validations/billing.validation.js';
import { UserRole } from '@odoo/shared';

export class InvoiceController {
  async generateCycle(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = generateCycleSchema.parse(req.body);
      const result = await invoiceService.generateBillingCycle(validated);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async listInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const isCustomer = req.user?.role === UserRole.CUSTOMER;
      const customerId = isCustomer ? req.user?.customerId || '__invalid_customer__' : (req.query.customerId as string);

      const result = await invoiceService.listInvoices({
        status: req.query.status as string,
        customerId,
        subscriptionId: req.query.subscriptionId as string,
        search: req.query.search as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      });

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getInvoiceById(req: Request, res: Response, next: NextFunction) {
    try {
      const isCustomer = req.user?.role === UserRole.CUSTOMER;
      const customerId = isCustomer ? req.user?.customerId || null : null;

      const invoice = await invoiceService.getInvoiceById(req.params.id, customerId);
      res.status(200).json({ success: true, data: invoice });
    } catch (err) {
      next(err);
    }
  }

  async confirmInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = confirmInvoiceSchema.parse(req.body);
      const confirmed = await invoiceService.confirmInvoice(req.params.id, validated.discountCode);
      res.status(200).json({ success: true, data: confirmed });
    } catch (err) {
      next(err);
    }
  }

  async updateDraftInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateDraftInvoiceSchema.parse(req.body);
      const updated = await invoiceService.updateDraftInvoice(req.params.id, validated);
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async cancelInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const cancelled = await invoiceService.cancelInvoice(req.params.id);
      res.status(200).json({ success: true, data: cancelled });
    } catch (err) {
      next(err);
    }
  }

  async markOverdue(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await invoiceService.markOverdueInvoices();
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getOverdueInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const isCustomer = req.user?.role === UserRole.CUSTOMER;
      const customerId = isCustomer ? req.user?.customerId || '__invalid__' : undefined;

      const result = await invoiceService.getOverdueInvoices(customerId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getInvoicePdf(req: Request, res: Response, next: NextFunction) {
    try {
      const isCustomer = req.user?.role === UserRole.CUSTOMER;
      const customerId = isCustomer ? req.user?.customerId || null : null;
      const invoice = await invoiceService.getInvoiceById(req.params.id, customerId);

      // Return structured printable HTML view of the invoice
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
    .title { font-size: 28px; font-weight: bold; color: #4338ca; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-weight: 600; font-size: 14px; background: #e0e7ff; color: #4338ca; }
    .meta { display: flex; justify-content: space-between; margin: 30px 0; }
    table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    th { background: #f8fafc; text-align: left; padding: 12px; border-bottom: 1px solid #cbd5e1; }
    td { padding: 12px; border-bottom: 1px solid #f1f5f9; }
    .totals { width: 350px; margin-left: auto; margin-top: 20px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .grand-total { font-weight: bold; font-size: 18px; color: #0f172a; border-top: 2px solid #cbd5e1; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">INVOICE</div>
      <div style="font-size: 18px; color: #64748b; margin-top: 4px;">#${invoice.invoiceNumber}</div>
    </div>
    <div style="text-align: right;">
      <span class="status-badge">${invoice.status}</span>
    </div>
  </div>

  <div class="meta">
    <div>
      <strong>Billed To:</strong><br>
      ${(invoice.customerSnapshot as any)?.name || 'Valued Customer'}<br>
      ${(invoice.customerSnapshot as any)?.companyName ? `${(invoice.customerSnapshot as any).companyName}<br>` : ''}
      ${(invoice.customerSnapshot as any)?.email}<br>
      ${(invoice.customerSnapshot as any)?.billingAddressLine1}<br>
      ${(invoice.customerSnapshot as any)?.billingCity}, ${(invoice.customerSnapshot as any)?.billingCountry}
    </div>
    <div style="text-align: right;">
      <strong>Issue Date:</strong> ${new Date(invoice.issueDate).toLocaleDateString()}<br>
      <strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}<br>
      <strong>Currency:</strong> ${invoice.currency}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: right;">Quantity</th>
        <th style="text-align: right;">Unit Price</th>
        <th style="text-align: right;">Tax</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.lines
        .map(
          (l: any) => `
        <tr>
          <td>${l.description}</td>
          <td style="text-align: right;">${Number(l.quantity)}</td>
          <td style="text-align: right;">$${Number(l.unitPrice).toFixed(2)}</td>
          <td style="text-align: right;">$${Number(l.taxAmount).toFixed(2)}</td>
          <td style="text-align: right;">$${Number(l.lineTotal).toFixed(2)}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Subtotal:</span>
      <span>$${Number(invoice.subtotal).toFixed(2)}</span>
    </div>
    ${
      Number(invoice.discountAmount) > 0
        ? `
    <div class="totals-row" style="color: #059669;">
      <span>Discount:</span>
      <span>-$${Number(invoice.discountAmount).toFixed(2)}</span>
    </div>`
        : ''
    }
    <div class="totals-row">
      <span>Tax:</span>
      <span>$${Number(invoice.taxAmount).toFixed(2)}</span>
    </div>
    <div class="totals-row grand-total">
      <span>Total Amount:</span>
      <span>$${Number(invoice.totalAmount).toFixed(2)}</span>
    </div>
    <div class="totals-row" style="font-weight: 600;">
      <span>Amount Paid:</span>
      <span>$${Number(invoice.amountPaid).toFixed(2)}</span>
    </div>
    <div class="totals-row" style="color: #e11d48; font-weight: bold;">
      <span>Remaining Balance:</span>
      <span>$${Math.max(0, Number(invoice.totalAmount) - Number(invoice.amountPaid)).toFixed(2)}</span>
    </div>
  </div>
</body>
</html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (err) {
      next(err);
    }
  }
}

export const invoiceController = new InvoiceController();
