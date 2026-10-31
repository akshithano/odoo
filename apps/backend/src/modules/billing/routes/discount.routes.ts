import { Router } from 'express';
import { discountController } from '../controllers/discount.controller.js';
import { authenticateToken, requireRole } from '../../auth_catalog/middleware/auth.middleware.js';
import { UserRole } from '@odoo/shared';

const router = Router();

router.get('/', authenticateToken, requireRole([UserRole.ADMIN, UserRole.STAFF]), discountController.listDiscounts);
router.post('/', authenticateToken, requireRole([UserRole.ADMIN]), discountController.createDiscount);
router.post('/validate', authenticateToken, discountController.validateDiscount);
router.get('/:id', authenticateToken, requireRole([UserRole.ADMIN, UserRole.STAFF]), discountController.getDiscount);
router.put('/:id', authenticateToken, requireRole([UserRole.ADMIN]), discountController.updateDiscount);
router.patch('/:id/toggle-active', authenticateToken, requireRole([UserRole.ADMIN]), discountController.toggleActive);

export { router as discountRoutes };
