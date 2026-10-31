import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller.js';
import { authenticateToken, requireRole } from '../../auth_catalog/middleware/auth.middleware.js';
import { UserRole } from '@odoo/shared';

const router = Router();

// Webhook endpoint: Public endpoint guarded by Cryptographic Signature Header
router.post('/webhook', paymentController.handleWebhook);

// Online payment integration
router.post('/create-order', authenticateToken, paymentController.createOnlineOrder);
router.post('/verify', authenticateToken, paymentController.verifyPayment);

// Dunning retries
router.get(
  '/retries',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  paymentController.listRetries
);
router.post(
  '/retries/:invoiceId/manual',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  paymentController.manualRetry
);

// Manual recording & listing
router.post(
  '/',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  paymentController.recordPayment
);
router.get('/', authenticateToken, paymentController.listPayments);
router.get('/:id', authenticateToken, paymentController.getPaymentById);

export { router as paymentRoutes };
