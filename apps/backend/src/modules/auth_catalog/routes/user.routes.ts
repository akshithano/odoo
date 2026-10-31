import { Router } from 'express';
import { UserRole } from '@odoo/shared';
import { userController } from '../controllers/user.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// Only ADMIN can create staff accounts
router.post('/staff', authenticateToken, requireRole([UserRole.ADMIN]), userController.createStaff);

// ADMIN and STAFF can list users
router.get('/', authenticateToken, requireRole([UserRole.ADMIN, UserRole.STAFF]), userController.listUsers);

// Individual user details (Customer isolated)
router.get('/:id', authenticateToken, userController.getUserById);

// Admin can activate/deactivate accounts
router.patch('/:id/status', authenticateToken, requireRole([UserRole.ADMIN]), userController.updateUserStatus);

export const userRoutes = router;
