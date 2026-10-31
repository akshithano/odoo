import { Router } from 'express';
import { subscriptionController } from '../controllers/subscription.controller.js';
import {
  authenticateToken,
  requireRole,
} from '../../auth_catalog/middleware/auth.middleware.js';
import { UserRole } from '@odoo/shared';

const router = Router();

// Subscriptions listing (Filtered by customer for CUSTOMER role)
router.get('/', authenticateToken, subscriptionController.list);

// Create subscription
router.post(
  '/',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  subscriptionController.create
);

// Get subscription details
router.get('/:id', authenticateToken, subscriptionController.getById);

// Update subscription
router.put(
  '/:id',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  subscriptionController.update
);

// Lifecycle state transitions
router.post(
  '/:id/confirm',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  subscriptionController.confirm
);

router.post(
  '/:id/activate',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  subscriptionController.activate
);

router.post(
  '/:id/pause',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  subscriptionController.pause
);

router.post(
  '/:id/resume',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  subscriptionController.resume
);

router.post(
  '/:id/renew',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  subscriptionController.renew
);

router.post(
  '/:id/close',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  subscriptionController.close
);

// Mid-cycle upgrade and proration
router.post('/:id/preview-upgrade', authenticateToken, subscriptionController.previewUpgrade);
router.post('/:id/upgrade', authenticateToken, subscriptionController.upgrade);

// Change logs & Audit history
router.get('/:id/changes', authenticateToken, subscriptionController.getChanges);
router.get('/:id/history', authenticateToken, subscriptionController.getHistory);

export { router as subscriptionRoutes };
