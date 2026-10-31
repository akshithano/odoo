# Member 3: Invoicing, Taxes, Discounts & Payment Management

> **Subscription Management System – Financial Ledger & Payment Infrastructure Runbook**  
> **Assigned Member:** Member 3  
> **Status:** Fully Implemented, Verified, and Tested (116 Backend Tests & 20 Frontend Tests Passing)

---

## 1. Executive Summary

Member 3 delivers the automated recurring invoicing engine, tax calculation framework, admin-controlled promotional discount mechanisms, multi-method payment recording ledger, adapter-based online payment gateway integration with Razorpay and Mock providers, automated smart dunning with BullMQ retries, overdue account management, and refund processing.

All components adhere strictly to the modular monolith architecture:
- **Backend:** Express.js + TypeScript + Prisma ORM + PostgreSQL 16 + Redis 7 + BullMQ.
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + Lucide Icons.
- **Shared Kernel:** `@odoo/shared` (Enums: `InvoiceStatus`, `PaymentStatus`, `PaymentMethod`, `DiscountType`, `RetryStatus`, Interfaces, and Unified Response Envelopes).
- **Persistence Layer:** Sequentially ordered database migration `database/migrations/003_billing_schema.sql` and comprehensive seed data in `database/seeds/index.ts` and `003_billing_seed.sql`.

---

## 2. Key Features Implemented

### A. Invoice Management & Recurring Billing
1. **Automated Billing Engine (`POST /api/v1/invoices/generate-cycle`):**
   - Evaluates active subscriptions according to their billing frequency (`DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`).
   - Idempotency Guarantee: Unique database constraint `uq_sub_billing_cycle (subscription_id, billing_period_start)` strictly prevents double-billing for the same cycle.
   - Sequential Numbering: Human-readable format `INV-YYYYMM-XXXX` (e.g. `INV-202610-0001`).
   - Multi-Product Line Items: Quantities, unit prices, taxes, discounts, and line totals.
   - Usage-Based Ingestion: Integrates unbilled usage consumption records from Member 2, calculates tiered charges, and marks records as billed with `invoiceId`.
   - Proration Ingestion: Integrates mid-cycle plan upgrade adjustments (`SubscriptionChange`) from Member 2 as credit/debit adjustment lines.
2. **Invoicing Lifecycle:**
   - Formal state machine: `DRAFT` -> `CONFIRMED` -> `PAID` / `PARTIALLY_PAID` / `OVERDUE` / `CANCELLED`.
   - Snapshot Preservation: Freezes customer name, email, billing address, and country in an immutable JSON snapshot upon confirmation.
   - Dynamic Printable Document: `GET /api/v1/invoices/:id/pdf` generates a styled, printable invoice document.
3. **Draft Editing & Cancellation:**
   - Permitted fields (due date, notes, custom line items) can be updated in `DRAFT` status.
   - Non-paid invoices can be cancelled.

### B. Tax Management & Calculation Engine
1. **Dynamic Tax Rules (`/api/v1/tax-rules`):**
   - Admin CRUD for percentage-based tax rules (e.g. GST 18%, VAT 20%, US State Sales Tax 7.5%).
   - Multi-tax calculation support: Non-compound taxes apply to base amounts; compound taxes apply sequentially to base + prior taxes.
   - Applied tax rates and amounts frozen on invoice line items so future tax rule updates do not alter historical invoices.
   - Live backend calculation simulator endpoint (`POST /api/v1/tax-rules/calculate`).

### C. Discount Management & Atomic Redemption
1. **Promotional Coupons (`/api/v1/discounts`):**
   - Admin CRUD for fixed-cash and percentage-based discounts.
   - Eligibility constraints: Minimum order purchase amount, minimum line item quantity, start and end validity dates.
   - Usage limits: Global maximum redemptions and maximum redemptions per customer.
   - High-Concurrency Atomic Redemption: Uses database-level conditional increment (`current_redemptions = current_redemptions + 1 WHERE current_redemptions < max_redemptions`) inside a Prisma transaction, preventing race-condition overselling.
   - Non-negative Total Guard: Mathematical guarantee that discounts can never produce a negative invoice total.
   - Redemption Ledger: Records every usage in `discount_usages` table.

### D. Payment Recording & Settlement Ledger
1. **Manual Offline Payments (`POST /api/v1/payments`):**
   - Record payments via Bank Wire, Credit Card Terminal, Cash, or Check.
   - Sequential Numbering: `PAY-YYYYMM-XXXX`.
   - Partial Payment Support: Multiple payments can be allocated against a single invoice.
   - Automatic Status Transitions: Updates invoice `amountPaid`. Transitions to `PARTIALLY_PAID` if partial, or `PAID` once balance reaches zero.
   - Overpayment Protection: Rejects payments exceeding remaining invoice balance with `400 Bad Request`.

### E. Online Payment Gateway Integration
1. **Adapter-Based Architecture (`IPaymentGatewayAdapter`):**
   - Provider-independent design allowing gateways to be swapped or configured via environment variable (`PAYMENT_GATEWAY_PROVIDER`).
   - **Razorpay Adapter:** Order creation, HMAC SHA-256 signature verification, and webhook handling.
   - **Mock Gateway Adapter:** Zero-dependency offline adapter for automated CI/CD tests and sandbox demonstrations.
2. **Online Checkout Window (`PaymentCheckoutModal.tsx`):**
   - Customer checkout dialog supporting simulated test cards and gateway orders.
3. **Cryptographic Webhook Ingestion (`POST /api/v1/payments/webhook`):**
   - Verifies gateway signatures using HMAC SHA-256 secret.
   - Idempotent Webhook Guard: Uses `webhook_events` table to deduplicate incoming gateway events and prevent double-crediting.

### F. Smart Dunning & Automated Payment Retries
1. **Configurable Dunning Schedule:**
   - Retries failed card payments on configurable schedule (Day 1, Day 3, Day 5, Day 7; max 4 attempts).
   - Attempt Ledger: Records attempt count, timestamp, outcome, and gateway error message in `payment_retries`.
   - Escalation: Automatically sets subscription status to `PAUSED` when maximum retries are exhausted, and creates risk notification for Member 4.
   - Manual Retry: Authorized admins can trigger manual retries on demand.

### G. Overdue Invoices Management
1. **Overdue Evaluation (`POST /api/v1/invoices/mark-overdue`):**
   - Sweep identifying confirmed invoices whose due dates have passed and remaining balance > 0, marking status `OVERDUE`.
2. **Aging Queue (`GET /api/v1/invoices/overdue`):**
   - Provides total overdue count, total outstanding debt, overdue duration in days, and retry telemetry.

### H. Refund Management
1. **Full & Partial Refunds (`POST /api/v1/refunds`):**
   - Sequential numbering: `REF-YYYYMM-XXXX`.
   - Validates that refund amount does not exceed available refundable balance (`payment.amount - sum(existing_refunds)`).
   - Recalculates payment status (`PARTIALLY_REFUNDED` or `REFUNDED`) and adjusts invoice `amountPaid` and invoice status.
   - Gateway refund dispatch through the adapter architecture.

---

## 3. Database Schema Updates (`database/migrations/003_billing_schema.sql`)

Member 3 adds 8 relational tables and 2 enums to the persistence layer:
1. `InvoiceStatus` enum: `DRAFT`, `CONFIRMED`, `PAID`, `PARTIALLY_PAID`, `OVERDUE`, `CANCELLED`.
2. `PaymentStatus` enum: `PENDING`, `SUCCESS`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED`.
3. `tax_rules`: Stores dynamic percentage rates and compound rules.
4. `discounts`: Stores coupon codes, percentage/fixed values, redemption limits, and validity windows.
5. `discount_usages`: Concurrency-safe audit trail of customer coupon redemptions.
6. `invoices`: Core financial billing ledger with `uq_sub_billing_cycle` constraint and frozen customer snapshots.
7. `invoice_lines`: Detailed line items with taxes, discounts, and amounts.
8. `payments`: Payment settlement ledger with transaction references and methods.
9. `payment_retries`: Dunning attempt history and next retry timestamps.
10. `refunds`: Refund audit trail and original payment linkages.
11. `webhook_events`: Idempotent ledger of processed gateway webhook payloads.

---

## 4. Sandbox Gateway Setup & Configuration

### Environment Variables
Configure the following in your `.env` file (see `.env.example`):
```env
# Payment Gateway Provider ('mock' or 'razorpay')
PAYMENT_GATEWAY_PROVIDER=mock

# Razorpay Test Sandbox Credentials
RAZORPAY_KEY_ID=rzp_test_placeholder_id
RAZORPAY_KEY_SECRET=placeholder_secret
RAZORPAY_WEBHOOK_SECRET=placeholder_webhook_secret
```

### Switching to Live Razorpay Sandbox:
1. Register for a free account at [dashboard.razorpay.com](https://dashboard.razorpay.com).
2. Generate API Keys in Test Mode under Settings -> API Keys.
3. Configure Webhook URL `https://your-domain/api/v1/payments/webhook` with event `payment.captured`.
4. Set `PAYMENT_GATEWAY_PROVIDER=razorpay` in `.env`.

---

## 5. Verification & Testing

### Running Tests
```bash
# Run all backend tests (Member 1, 2, and 3 suites)
npm test --workspace=@odoo/backend

# Run only Member 3 backend tests
npx vitest run apps/backend/tests/member3/

# Run frontend tests
npm test --workspace=@odoo/frontend
```

### Test Suite Summary:
- **Backend Member 3 Tests:** 29 tests across `invoices.test.ts`, `taxes_discounts.test.ts`, and `payments_gateway.test.ts`.
- **Frontend Member 3 Tests:** 5 integration suites in `member3.test.tsx`.
- **Total Passing Tests:** 116 Backend Tests (100% pass) + 20 Frontend Tests (100% pass).

---

## 6. Integration Instructions for Member 4

Member 3 provides the following interfaces and data streams for Member 4:
1. **Executive BI Dashboard:** Query `GET /api/v1/invoices` with `status=PAID` to calculate Recognized Revenue, MRR, ARR, and cash collections.
2. **Receivables Aging Report:** Query `GET /api/v1/invoices/overdue` to retrieve overdue durations, aging brackets (0-30, 31-60, 61-90, 90+ days), and outstanding customer liabilities.
3. **Account Health Scoring:** When 4 consecutive dunning retries fail, Member 3 marks the subscription as `PAUSED` and logs an escalation event. Member 4 can consume this to deduct points from customer health scores.
4. **Fraud Detection Engine:** `GET /api/v1/refunds` and `GET /api/v1/payments` supply transaction timestamps, transaction references, amounts, and customer IDs to evaluate refund frequency anomalies and rapid payment retries.
