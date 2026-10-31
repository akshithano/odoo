import { Router } from 'express';
import { quotationTemplateController } from '../controllers/quotationTemplate.controller.js';
import {
  authenticateToken,
  requireRole,
} from '../../auth_catalog/middleware/auth.middleware.js';
import { UserRole } from '@odoo/shared';

const router = Router();

// Templates can be viewed by all internal roles
router.get(
  '/',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  quotationTemplateController.list
);

router.get(
  '/:id',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  quotationTemplateController.getById
);

router.post(
  '/',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  quotationTemplateController.create
);

router.put(
  '/:id',
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.STAFF]),
  quotationTemplateController.update
);

router.delete(
  '/:id',
  authenticateToken,
  requireRole([UserRole.ADMIN]),
  quotationTemplateController.delete
);

export { router as quotationTemplateRoutes };
