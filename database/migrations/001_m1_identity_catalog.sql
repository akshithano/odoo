-- ==============================================================================
-- Migration: 001_m1_identity_catalog.sql
-- Domain: Member 1 - Authentication, Users, Products, Variants, Plans, Currencies
-- ==============================================================================

-- Create Enums
DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF', 'CUSTOMER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ProductType" AS ENUM ('SERVICE', 'PHYSICAL', 'DIGITAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "BillingFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Table: users
CREATE TABLE IF NOT EXISTS "users" (
    "id" VARCHAR(36) PRIMARY KEY,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users"("email");
CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users"("role");

-- Table: customers
CREATE TABLE IF NOT EXISTS "customers" (
    "id" VARCHAR(36) PRIMARY KEY,
    "user_id" VARCHAR(36) UNIQUE NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
    "company_name" VARCHAR(255),
    "phone" VARCHAR(50),
    "billing_address_line1" VARCHAR(255) NOT NULL,
    "billing_city" VARCHAR(100) NOT NULL,
    "billing_state" VARCHAR(100),
    "billing_postal_code" VARCHAR(20) NOT NULL,
    "billing_country" VARCHAR(2) NOT NULL,
    "default_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: password_reset_tokens
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" VARCHAR(36) PRIMARY KEY,
    "user_id" VARCHAR(36) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "token_hash" VARCHAR(255) UNIQUE NOT NULL,
    "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "used_at" TIMESTAMP WITH TIME ZONE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_pwd_reset_user_exp" ON "password_reset_tokens"("user_id", "expires_at");

-- Table: products
CREATE TABLE IF NOT EXISTS "products" (
    "id" VARCHAR(36) PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) UNIQUE NOT NULL,
    "type" "ProductType" NOT NULL DEFAULT 'SERVICE',
    "description" TEXT,
    "internal_notes" TEXT,
    "sales_price" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "cost_price" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: product_variants
CREATE TABLE IF NOT EXISTS "product_variants" (
    "id" VARCHAR(36) PRIMARY KEY,
    "product_id" VARCHAR(36) NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "variant_name" VARCHAR(100) NOT NULL,
    "sku" VARCHAR(100) UNIQUE NOT NULL,
    "attribute_name" VARCHAR(100),
    "attribute_value" VARCHAR(100),
    "additional_price" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: plans
CREATE TABLE IF NOT EXISTS "plans" (
    "id" VARCHAR(36) PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) UNIQUE NOT NULL,
    "description" TEXT,
    "billing_frequency" "BillingFrequency" NOT NULL,
    "base_price" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "minimum_quantity" INTEGER NOT NULL DEFAULT 1,
    "valid_from" TIMESTAMP WITH TIME ZONE,
    "valid_until" TIMESTAMP WITH TIME ZONE,
    "auto_close_on_expiry" BOOLEAN NOT NULL DEFAULT TRUE,
    "allow_early_closure" BOOLEAN NOT NULL DEFAULT TRUE,
    "allow_pause" BOOLEAN NOT NULL DEFAULT TRUE,
    "allow_renewal" BOOLEAN NOT NULL DEFAULT TRUE,
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: currencies
CREATE TABLE IF NOT EXISTS "currencies" (
    "code" VARCHAR(3) PRIMARY KEY,
    "name" VARCHAR(50) NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "exchange_rate_to_base" NUMERIC(14, 6) NOT NULL DEFAULT 1.000000,
    "is_base_currency" BOOLEAN NOT NULL DEFAULT FALSE,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
