import { Router } from 'express';
import { healthRoutes } from './health.routes.js';

const apiV1Router = Router();

// Core infrastructure routes
apiV1Router.use('/health', healthRoutes);

// =============================================================================
// Member Integration Extension Points (To be mounted during feature phases)
// =============================================================================
// Member 1: Identity, Auth, Products & Plans
// apiV1Router.use('/auth', authRouter);
// apiV1Router.use('/products', productsRouter);
// apiV1Router.use('/plans', plansRouter);

// Member 2: Quotations, Subscriptions, Pricing & Usage
// apiV1Router.use('/quotations', quotationsRouter);
// apiV1Router.use('/subscriptions', subscriptionsRouter);
// apiV1Router.use('/usage', usageRouter);

// Member 3: Invoicing, Taxes, Discounts & Payments
// apiV1Router.use('/invoices', invoicesRouter);
// apiV1Router.use('/taxes', taxRouter);
// apiV1Router.use('/discounts', discountRouter);
// apiV1Router.use('/payments', paymentsRouter);

// Member 4: Operations, Analytics, Fraud & Auditing
// apiV1Router.use('/analytics', analyticsRouter);
// apiV1Router.use('/fraud', fraudRouter);
// apiV1Router.use('/audit', auditRouter);
// apiV1Router.use('/surveys', surveysRouter);

export { apiV1Router };
