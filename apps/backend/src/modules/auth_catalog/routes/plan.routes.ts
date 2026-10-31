import { Router } from 'express';
import { UserRole } from '@odoo/shared';
import { planController } from '../controllers/plan.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// Public / Authenticated plan browsing
router.get('/', planController.listPlans);
router.get('/:id', planController.getPlanById);

// Admin-only plan configuration
router.post('/', authenticateToken, requireRole([UserRole.ADMIN]), planController.createPlan);
router.put('/:id', authenticateToken, requireRole([UserRole.ADMIN]), planController.updatePlan);
router.patch('/:id/status', authenticateToken, requireRole([UserRole.ADMIN]), planController.togglePlanActive);

// Plan Lifecycle Operations
router.post('/:id/pause', authenticateToken, requireRole([UserRole.ADMIN]), planController.pausePlan);
router.post('/:id/resume', authenticateToken, requireRole([UserRole.ADMIN]), planController.resumePlan);
router.post('/:id/close', authenticateToken, requireRole([UserRole.ADMIN]), planController.closePlanEarly);
router.post('/:id/renew', authenticateToken, requireRole([UserRole.ADMIN]), planController.renewPlan);

// Automated Expiry Trigger
router.post('/sweep-expiry', authenticateToken, requireRole([UserRole.ADMIN]), planController.sweepExpiredPlans);

export const planRoutes = router;
