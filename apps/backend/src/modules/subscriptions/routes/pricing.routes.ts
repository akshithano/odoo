import { Router } from 'express';
import { pricingController } from '../controllers/pricing.controller.js';
import {
  authenticateToken,
  requireRole,
} from '../../auth_catalog/middleware/auth.middleware.js';
import { UserRole } from '@odoo/shared';

const router = Router();

// Calculate price using tiered brackets
router.post('/calculate', authenticateToken, pricingController.calculate);

// List pricing tiers
router.get('/tiers', authenticateToken, pricingController.listTiers);

// Bulk configure / replace tiers for a plan or product
router.post(
  '/tiers/bulk',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  pricingController.setBulkTiers
);

// Delete tier by ID
router.delete(
  '/tiers/:id',
  authenticateToken,
  requireRole([UserRole.ADMIN]),
  pricingController.deleteTier
);

export { router as pricingRoutes };
