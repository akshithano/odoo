-- ==============================================================================
-- Migration: 002_subscriptions_schema.sql
-- Domain: Member 2 - Quotations, Subscriptions, Pricing Models, Usage & Proration
-- ==============================================================================

-- Create Enums if not exist
DO $$ BEGIN
    CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PricingModel" AS ENUM ('FLAT', 'GRADUATED', 'VOLUME', 'USAGE_BASED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TierType" AS ENUM ('QUANTITY_BASED', 'USAGE_BASED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Table: quotation_templates
CREATE TABLE IF NOT EXISTS "quotation_templates" (
    "id" VARCHAR(36) PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) UNIQUE NOT NULL,
    "description" TEXT,
    "plan_id" VARCHAR(36) REFERENCES "plans"("id") ON DELETE SET NULL,
    "default_validity_days" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: quotation_template_lines
CREATE TABLE IF NOT EXISTS "quotation_template_lines" (
    "id" VARCHAR(36) PRIMARY KEY,
    "template_id" VARCHAR(36) NOT NULL REFERENCES "quotation_templates"("id") ON DELETE CASCADE,
    "product_id" VARCHAR(36) NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
    "variant_id" VARCHAR(36) REFERENCES "product_variants"("id") ON DELETE SET NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1 CHECK ("quantity" > 0),
    "unit_price" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000
);

-- Table: quotations
CREATE TABLE IF NOT EXISTS "quotations" (
    "id" VARCHAR(36) PRIMARY KEY,
    "quotation_number" VARCHAR(50) UNIQUE NOT NULL,
    "customer_id" VARCHAR(36) NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
    "plan_id" VARCHAR(36) REFERENCES "plans"("id") ON DELETE SET NULL,
    "template_id" VARCHAR(36) REFERENCES "quotation_templates"("id") ON DELETE SET NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "valid_from" TIMESTAMP WITH TIME ZONE NOT NULL,
    "valid_until" TIMESTAMP WITH TIME ZONE NOT NULL,
    "subtotal" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "tax_amount" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "total_amount" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "notes" TEXT,
    "created_by_id" VARCHAR(36) REFERENCES "users"("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_quotations_customer" ON "quotations"("customer_id");
CREATE INDEX IF NOT EXISTS "idx_quotations_status" ON "quotations"("status");

-- Table: quotation_lines
CREATE TABLE IF NOT EXISTS "quotation_lines" (
    "id" VARCHAR(36) PRIMARY KEY,
    "quotation_id" VARCHAR(36) NOT NULL REFERENCES "quotations"("id") ON DELETE CASCADE,
    "product_id" VARCHAR(36) NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
    "variant_id" VARCHAR(36) REFERENCES "product_variants"("id") ON DELETE SET NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1 CHECK ("quantity" > 0),
    "unit_price" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "tax_rate" NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    "tax_amount" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "line_total" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000
);

CREATE INDEX IF NOT EXISTS "idx_quotation_lines_quote" ON "quotation_lines"("quotation_id");

-- Table: subscriptions
CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" VARCHAR(36) PRIMARY KEY,
    "subscription_number" VARCHAR(50) UNIQUE NOT NULL,
    "customer_id" VARCHAR(36) NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
    "plan_id" VARCHAR(36) NOT NULL REFERENCES "plans"("id") ON DELETE RESTRICT,
    "quotation_id" VARCHAR(36) UNIQUE REFERENCES "quotations"("id") ON DELETE SET NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "payment_terms" VARCHAR(50) NOT NULL DEFAULT 'DUE_ON_RECEIPT',
    "billing_frequency" "BillingFrequency" NOT NULL DEFAULT 'MONTHLY',
    "current_period_start" TIMESTAMP WITH TIME ZONE NOT NULL,
    "current_period_end" TIMESTAMP WITH TIME ZONE NOT NULL,
    "start_date" TIMESTAMP WITH TIME ZONE NOT NULL,
    "expiry_date" TIMESTAMP WITH TIME ZONE,
    "auto_renew" BOOLEAN NOT NULL DEFAULT TRUE,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "subtotal" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "tax_amount" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "total_amount" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_subscriptions_customer" ON "subscriptions"("customer_id");
CREATE INDEX IF NOT EXISTS "idx_subscriptions_status" ON "subscriptions"("status");

-- Table: subscription_lines
CREATE TABLE IF NOT EXISTS "subscription_lines" (
    "id" VARCHAR(36) PRIMARY KEY,
    "subscription_id" VARCHAR(36) NOT NULL REFERENCES "subscriptions"("id") ON DELETE CASCADE,
    "product_id" VARCHAR(36) NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
    "variant_id" VARCHAR(36) REFERENCES "product_variants"("id") ON DELETE SET NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1 CHECK ("quantity" > 0),
    "unit_price" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "tax_rate" NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    "tax_amount" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "line_total" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000
);

CREATE INDEX IF NOT EXISTS "idx_subscription_lines_sub" ON "subscription_lines"("subscription_id");

-- Table: pricing_tiers
CREATE TABLE IF NOT EXISTS "pricing_tiers" (
    "id" VARCHAR(36) PRIMARY KEY,
    "plan_id" VARCHAR(36) REFERENCES "plans"("id") ON DELETE CASCADE,
    "product_id" VARCHAR(36) REFERENCES "products"("id") ON DELETE CASCADE,
    "tier_type" "TierType" NOT NULL DEFAULT 'QUANTITY_BASED',
    "model_type" "PricingModel" NOT NULL DEFAULT 'GRADUATED',
    "min_quantity" INTEGER NOT NULL DEFAULT 0 CHECK ("min_quantity" >= 0),
    "max_quantity" INTEGER,
    "unit_price" NUMERIC(14, 4) NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_pricing_tiers_plan" ON "pricing_tiers"("plan_id");
CREATE INDEX IF NOT EXISTS "idx_pricing_tiers_product" ON "pricing_tiers"("product_id");

-- Table: usage_records
CREATE TABLE IF NOT EXISTS "usage_records" (
    "id" VARCHAR(36) PRIMARY KEY,
    "subscription_id" VARCHAR(36) NOT NULL REFERENCES "subscriptions"("id") ON DELETE CASCADE,
    "customer_id" VARCHAR(36) NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
    "usage_type" VARCHAR(100) NOT NULL,
    "quantity" NUMERIC(14, 4) NOT NULL,
    "unit_of_measure" VARCHAR(50) NOT NULL DEFAULT 'units',
    "notes" TEXT,
    "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
    "idempotency_key" VARCHAR(100) UNIQUE NOT NULL,
    "billed" BOOLEAN NOT NULL DEFAULT FALSE,
    "invoice_id" VARCHAR(36),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_usage_sub_period" ON "usage_records"("subscription_id", "timestamp", "billed");
CREATE INDEX IF NOT EXISTS "idx_usage_customer" ON "usage_records"("customer_id");

-- Table: subscription_changes
CREATE TABLE IF NOT EXISTS "subscription_changes" (
    "id" VARCHAR(36) PRIMARY KEY,
    "subscription_id" VARCHAR(36) NOT NULL REFERENCES "subscriptions"("id") ON DELETE CASCADE,
    "change_type" VARCHAR(50) NOT NULL DEFAULT 'UPGRADE',
    "previous_plan_id" VARCHAR(36) NOT NULL REFERENCES "plans"("id") ON DELETE RESTRICT,
    "new_plan_id" VARCHAR(36) NOT NULL REFERENCES "plans"("id") ON DELETE RESTRICT,
    "prorated_credit" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "prorated_debit" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "net_adjustment" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "days_remaining" INTEGER NOT NULL,
    "total_days_in_cycle" INTEGER NOT NULL,
    "effective_date" TIMESTAMP WITH TIME ZONE NOT NULL,
    "created_by_id" VARCHAR(36) REFERENCES "users"("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_subscription_changes_sub" ON "subscription_changes"("subscription_id");

-- Table: subscription_histories
CREATE TABLE IF NOT EXISTS "subscription_histories" (
    "id" VARCHAR(36) PRIMARY KEY,
    "subscription_id" VARCHAR(36) NOT NULL REFERENCES "subscriptions"("id") ON DELETE CASCADE,
    "action" VARCHAR(100) NOT NULL,
    "previous_value" TEXT,
    "new_value" TEXT,
    "performed_by_id" VARCHAR(36) REFERENCES "users"("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_subscription_histories_sub" ON "subscription_histories"("subscription_id");
