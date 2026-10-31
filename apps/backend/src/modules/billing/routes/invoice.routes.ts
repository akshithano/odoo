import { Router } from 'express';
import { invoiceController } from '../controllers/invoice.controller.js';
import { authenticateToken, requireRole } from '../../auth_catalog/middleware/auth.middleware.js';
import { UserRole } from '@odoo/shared';

const router = Router();

// Cycle generation (Idempotent background billing run)
router.post(
  '/generate-cycle',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  invoiceController.generateCycle
);

// Overdue Invoices
router.get('/overdue', authenticateToken, invoiceController.getOverdueInvoices);
router.post(
  '/mark-overdue',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  invoiceController.markOverdue
);

// Invoices CRUD & queries
router.get('/', authenticateToken, invoiceController.listInvoices);
router.get('/:id', authenticateToken, invoiceController.getInvoiceById);
router.get('/:id/pdf', authenticateToken, invoiceController.getInvoicePdf);

router.post(
  '/:id/confirm',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  invoiceController.confirmInvoice
);

router.put(
  '/:id',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  invoiceController.updateDraftInvoice
);

router.post(
  '/:id/cancel',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  invoiceController.cancelInvoice
);

export { router as invoiceRoutes };
