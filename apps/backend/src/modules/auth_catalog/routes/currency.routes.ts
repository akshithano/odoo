import { Router } from 'express';
import { UserRole } from '@odoo/shared';
import { currencyController } from '../controllers/currency.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', currencyController.listCurrencies);
router.post('/', authenticateToken, requireRole([UserRole.ADMIN]), currencyController.upsertCurrency);
router.post('/convert', currencyController.convertAmount);

export const currencyRoutes = router;
