import { Router } from 'express';
import { taxController } from '../controllers/tax.controller.js';
import { authenticateToken, requireRole } from '../../auth_catalog/middleware/auth.middleware.js';
import { UserRole } from '@odoo/shared';

const router = Router();

router.get('/', authenticateToken, taxController.listTaxRules);
router.post('/', authenticateToken, requireRole([UserRole.ADMIN]), taxController.createTaxRule);
router.post('/calculate', authenticateToken, taxController.calculateTax);
router.get('/:id', authenticateToken, taxController.getTaxRuleById);
router.put('/:id', authenticateToken, requireRole([UserRole.ADMIN]), taxController.updateTaxRule);
router.patch('/:id/toggle-active', authenticateToken, requireRole([UserRole.ADMIN]), taxController.toggleActive);
router.delete('/:id', authenticateToken, requireRole([UserRole.ADMIN]), taxController.deleteTaxRule);

export { router as taxRoutes };
