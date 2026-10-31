-- ==============================================================================
-- Migration: 003_billing_schema.sql
-- Domain: Member 3 - Invoicing, Taxes, Discounts, Payments, Gateways & Retries
-- ==============================================================================

-- Create Enums if not exist
DO $$ BEGIN
    CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Table: tax_rules
CREATE TABLE IF NOT EXISTS "tax_rules" (
    "id" VARCHAR(36) PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "rate_percentage" NUMERIC(6, 4) NOT NULL,
    "country" VARCHAR(2),
    "state" VARCHAR(100),
    "is_compound" BOOLEAN NOT NULL DEFAULT FALSE,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: discounts
CREATE TABLE IF NOT EXISTS "discounts" (
    "id" VARCHAR(36) PRIMARY KEY,
    "code" VARCHAR(50) UNIQUE NOT NULL,
    "type" VARCHAR(20) NOT NULL CHECK ("type" IN ('FIXED', 'PERCENTAGE')),
    "value" NUMERIC(14, 4) NOT NULL CHECK ("value" >= 0),
    "min_purchase_amount" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "min_quantity" INTEGER NOT NULL DEFAULT 0,
    "max_redemptions" INTEGER NOT NULL CHECK ("max_redemptions" > 0),
    "current_redemptions" INTEGER NOT NULL DEFAULT 0,
    "max_per_customer" INTEGER NOT NULL DEFAULT 1,
    "start_date" TIMESTAMP WITH TIME ZONE NOT NULL,
    "end_date" TIMESTAMP WITH TIME ZONE NOT NULL,
    "product_id" VARCHAR(36) REFERENCES "products"("id") ON DELETE SET NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_discounts_code" ON "discounts"("code");

-- Table: discount_usages
CREATE TABLE IF NOT EXISTS "discount_usages" (
    "id" VARCHAR(36) PRIMARY KEY,
    "discount_id" VARCHAR(36) NOT NULL REFERENCES "discounts"("id") ON DELETE CASCADE,
    "customer_id" VARCHAR(36) NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
    "invoice_id" VARCHAR(36),
    "redeemed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_discount_usages_cust" ON "discount_usages"("discount_id", "customer_id");

-- Table: invoices
CREATE TABLE IF NOT EXISTS "invoices" (
    "id" VARCHAR(36) PRIMARY KEY,
    "invoice_number" VARCHAR(50) UNIQUE NOT NULL,
    "subscription_id" VARCHAR(36) NOT NULL REFERENCES "subscriptions"("id") ON DELETE RESTRICT,
    "customer_id" VARCHAR(36) NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "billing_period_start" TIMESTAMP WITH TIME ZONE NOT NULL,
    "billing_period_end" TIMESTAMP WITH TIME ZONE NOT NULL,
    "issue_date" TIMESTAMP WITH TIME ZONE NOT NULL,
    "due_date" TIMESTAMP WITH TIME ZONE NOT NULL,
    "subtotal" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "tax_amount" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "discount_amount" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "total_amount" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "amount_paid" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "customer_snapshot" JSONB NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uq_sub_billing_cycle" UNIQUE ("subscription_id", "billing_period_start")
);
CREATE INDEX IF NOT EXISTS "idx_invoices_customer" ON "invoices"("customer_id");
CREATE INDEX IF NOT EXISTS "idx_invoices_status_due" ON "invoices"("status", "due_date");

-- Table: invoice_lines
CREATE TABLE IF NOT EXISTS "invoice_lines" (
    "id" VARCHAR(36) PRIMARY KEY,
    "invoice_id" VARCHAR(36) NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
    "product_id" VARCHAR(36) REFERENCES "products"("id") ON DELETE RESTRICT,
    "description" VARCHAR(255) NOT NULL,
    "quantity" NUMERIC(14, 4) NOT NULL DEFAULT 1.0000,
    "unit_price" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "tax_rate" NUMERIC(6, 4) NOT NULL DEFAULT 0.0000,
    "tax_amount" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "discount_amount" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "line_total" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000
);
CREATE INDEX IF NOT EXISTS "idx_invoice_lines_inv" ON "invoice_lines"("invoice_id");

-- Table: payments
CREATE TABLE IF NOT EXISTS "payments" (
    "id" VARCHAR(36) PRIMARY KEY,
    "payment_number" VARCHAR(50) UNIQUE NOT NULL,
    "invoice_id" VARCHAR(36) NOT NULL REFERENCES "invoices"("id") ON DELETE RESTRICT,
    "customer_id" VARCHAR(36) NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
    "amount" NUMERIC(14, 4) NOT NULL CHECK ("amount" > 0),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "payment_method" VARCHAR(50) NOT NULL,
    "payment_date" TIMESTAMP WITH TIME ZONE NOT NULL,
    "transaction_reference" VARCHAR(255) UNIQUE,
    "gateway_order_id" VARCHAR(255),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_payments_invoice" ON "payments"("invoice_id");
CREATE INDEX IF NOT EXISTS "idx_payments_customer" ON "payments"("customer_id");

-- Table: payment_retries
CREATE TABLE IF NOT EXISTS "payment_retries" (
    "id" VARCHAR(36) PRIMARY KEY,
    "invoice_id" VARCHAR(36) NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
    "attempt_number" INTEGER NOT NULL,
    "attempt_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_retry_date" TIMESTAMP WITH TIME ZONE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT
);
CREATE INDEX IF NOT EXISTS "idx_payment_retries_inv" ON "payment_retries"("invoice_id");

-- Table: refunds
CREATE TABLE IF NOT EXISTS "refunds" (
    "id" VARCHAR(36) PRIMARY KEY,
    "refund_number" VARCHAR(50) UNIQUE NOT NULL,
    "payment_id" VARCHAR(36) NOT NULL REFERENCES "payments"("id") ON DELETE RESTRICT,
    "invoice_id" VARCHAR(36) NOT NULL REFERENCES "invoices"("id") ON DELETE RESTRICT,
    "amount" NUMERIC(14, 4) NOT NULL CHECK ("amount" > 0),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "reason" TEXT NOT NULL,
    "transaction_reference" VARCHAR(255) UNIQUE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_refunds_payment" ON "refunds"("payment_id");
CREATE INDEX IF NOT EXISTS "idx_refunds_invoice" ON "refunds"("invoice_id");

-- Table: webhook_events
CREATE TABLE IF NOT EXISTS "webhook_events" (
    "id" VARCHAR(36) PRIMARY KEY,
    "provider" VARCHAR(50) NOT NULL,
    "event_id" VARCHAR(255) UNIQUE NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT FALSE,
    "processed_at" TIMESTAMP WITH TIME ZONE,
    "error_message" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
