import { Router } from 'express';
import { usageController } from '../controllers/usage.controller.js';
import {
  authenticateToken,
  requireRole,
} from '../../auth_catalog/middleware/auth.middleware.js';
import { UserRole } from '@odoo/shared';

const router = Router();

// Ingest raw consumption events (Admin, Staff, or API systems)
router.post(
  '/events',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  usageController.ingestEvent
);

// Query usage history (Filtered by customer for CUSTOMER role)
router.get('/events', authenticateToken, usageController.listEvents);

// Get aggregated cycle usage and charges for a subscription
router.get(
  '/subscriptions/:id/summary',
  authenticateToken,
  usageController.getSummary
);

export { router as usageRoutes };
