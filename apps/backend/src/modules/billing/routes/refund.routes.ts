import { Router } from 'express';
import { refundController } from '../controllers/refund.controller.js';
import { authenticateToken, requireRole } from '../../auth_catalog/middleware/auth.middleware.js';
import { UserRole } from '@odoo/shared';

const router = Router();

router.post(
  '/',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  refundController.processRefund
);
router.get(
  '/',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  refundController.listRefunds
);

export { router as refundRoutes };
