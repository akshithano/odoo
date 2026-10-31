import { Router } from 'express';
import { UserRole } from '@odoo/shared';
import { productController } from '../controllers/product.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// Public / Authenticated catalog browsing
router.get('/', productController.listProducts);
router.get('/:id', productController.getProductById);

// Admin-only product mutations
router.post('/', authenticateToken, requireRole([UserRole.ADMIN]), productController.createProduct);
router.put('/:id', authenticateToken, requireRole([UserRole.ADMIN]), productController.updateProduct);
router.patch('/:id/status', authenticateToken, requireRole([UserRole.ADMIN]), productController.toggleProductStatus);

// Product variant management
router.post('/:id/variants', authenticateToken, requireRole([UserRole.ADMIN]), productController.addVariant);
router.post('/:id/variants/:variantId/calculate', productController.calculateVariantPrice);

export const productRoutes = router;
