-- ==============================================================================
-- Seed: 003_billing_seed.sql
-- Domain: Member 3 - Invoicing, Tax Rules, Discount Mechanisms & Payments
-- ==============================================================================

-- 1. Default Tax Rules
INSERT INTO "tax_rules" ("id", "name", "rate_percentage", "country", "is_compound", "is_active", "created_at", "updated_at")
VALUES
  ('tax-gst-18', 'GST 18% (Standard)', 18.0000, 'IN', FALSE, TRUE, NOW(), NOW()),
  ('tax-vat-20', 'VAT 20% (UK Standard)', 20.0000, 'GB', FALSE, TRUE, NOW(), NOW()),
  ('tax-sales-75', 'State Sales Tax (US)', 7.5000, 'US', FALSE, TRUE, NOW(), NOW())
ON CONFLICT ("id") DO UPDATE
SET "rate_percentage" = EXCLUDED."rate_percentage",
    "name" = EXCLUDED."name";

-- 2. Default Discount Rules
INSERT INTO "discounts" ("id", "code", "type", "value", "min_purchase_amount", "min_quantity", "max_redemptions", "current_redemptions", "max_per_customer", "start_date", "end_date", "is_active", "created_at", "updated_at")
VALUES
  ('disc-welcome-20', 'WELCOME20', 'PERCENTAGE', 20.0000, 50.0000, 1, 100, 0, 1, NOW(), NOW() + INTERVAL '60 days', TRUE, NOW(), NOW()),
  ('disc-flat-50', 'FLAT50', 'FIXED', 50.0000, 200.0000, 1, 50, 0, 2, NOW(), NOW() + INTERVAL '60 days', TRUE, NOW(), NOW())
ON CONFLICT ("code") DO UPDATE
SET "value" = EXCLUDED."value",
    "type" = EXCLUDED."type",
    "min_purchase_amount" = EXCLUDED."min_purchase_amount";
