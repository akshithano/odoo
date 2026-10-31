# Database Migrations & Four-Member Coordination Strategy

This directory coordinates database schema changes and migrations across all four engineering team members.

## 1. Migration File Naming Convention

All migrations are sequentially versioned and tagged by member domain:

- `001_m1_identity_catalog.sql` – Owned by **Member 1** (Users, Customers, Products, Plans, Currencies)
- `002_m2_subscriptions_pricing.sql` – Owned by **Member 2** (Quotations, Subscriptions, Pricing Tiers, Usage Records)
- `003_m3_invoicing_payments.sql` – Owned by **Member 3** (Invoices, Tax Rules, Discounts, Payments, Retries)
- `004_m4_operations_governance.sql` – Owned by **Member 4** (Audit Logs, Fraud Alerts, Health Scores, Exit Surveys)

## 2. Coordination & Pull Request Rules

1. **No Out-of-Order Migration Editing:** Never modify a previously merged migration file. If a column change or index addition is required, append a new forward migration (e.g., `005_m3_add_payment_idx.sql`).
2. **Strict Foreign Key Ordering:**
   - Member 2 tables reference Member 1 tables (`customers.id`, `plans.id`, `products.id`).
   - Member 3 tables reference Member 2 (`subscriptions.id`) and Member 1 (`customers.id`).
   - Member 4 tables reference records across all prior members.
3. **Prisma ORM Workflow:**
   - Run `npm run db:generate` in the backend workspace to update `@prisma/client`.
   - In development mode, use `npm run db:migrate` or `npm run db:push` to apply schema updates to the PostgreSQL instance.
4. **Monetary Precision Standard:**
   - All financial numbers must be created with `NUMERIC(14, 4)` precision.
   - Do not use floating-point types (`FLOAT`, `DOUBLE`, `REAL`).
