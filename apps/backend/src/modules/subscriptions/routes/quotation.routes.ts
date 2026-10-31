import { Router } from 'express';
import { quotationController } from '../controllers/quotation.controller.js';
import {
  authenticateToken,
  requireRole,
} from '../../auth_catalog/middleware/auth.middleware.js';
import { UserRole } from '@odoo/shared';

const router = Router();

// Quotations listing (Filtered by customer for CUSTOMER role)
router.get('/', authenticateToken, quotationController.list);

// Create quotation
router.post('/', authenticateToken, quotationController.create);

// Get quotation details
router.get('/:id', authenticateToken, quotationController.getById);

// Update quotation
router.put(
  '/:id',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  quotationController.update
);

// Update quotation status (e.g. ACCEPTED, REJECTED, SENT, EXPIRED)
router.patch('/:id/status', authenticateToken, quotationController.updateStatus);

// Convert quotation to subscription
router.post('/:id/convert', authenticateToken, quotationController.convertToSubscription);

export { router as quotationRoutes };
