# Member 1: Authentication, User Management, Products & Plans

> **Subscription Management System – Foundational Module Runbook**  
> **Assigned Member:** Member 1  
> **Status:** Fully Implemented, Verified, and Tested (63/63 Tests Passing)

---

## 1. Executive Summary

Member 1 delivers the identity, authentication, security governance, product catalog, variant differential pricing, multi-frequency subscription plan lifecycle management, and multi-currency foundational layer of the Subscription Management System.

All features are implemented within the existing npm workspaces monorepo architecture:
- **Backend:** Express.js + TypeScript + Prisma ORM + PostgreSQL 16 + Redis 7 + BullMQ.
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS.
- **Shared Kernel:** `@odoo/shared` (Roles, Catalog Types, API Envelopes).

---

## 2. Key Features Implemented

### A. Authentication & Security
1. **Customer Self-Registration (`POST /api/v1/auth/register`):**
   - Unique email validation and duplicate protection.
   - Strict password complexity: > 8 characters, >= 1 uppercase letter, >= 1 lowercase letter, >= 1 number, and >= 1 special character.
   - Atomic creation of `User` and linked `Customer` billing address records in a single database transaction.
   - Password hashing using `bcrypt` (12 salt rounds); password hashes are strictly omitted from all API responses.
2. **Session & Token Management (`POST /api/v1/auth/login`, `POST /api/v1/auth/logout`):**
   - JWT-based authentication with 15-minute access token validity containing user ID, email, role, and customer ID.
   - Account disabled checks (`isActive === true` enforced before granting tokens).
3. **Password Recovery Workflow (`POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`):**
   - Cryptographically random (crypto.randomBytes), SHA-256 hashed, expiring (1 hour), single-use reset tokens stored in `password_reset_tokens`.
   - Prevents email enumeration by returning a generic success notice.
   - Atomic token redemption and password update; expired or previously used tokens are rejected with HTTP 400.
4. **Current User Profile (`GET /api/v1/auth/me`):**
   - Returns the authenticated user's profile and linked customer profile.

### B. User Management & Role-Based Access Control (RBAC)
1. **Three-Tier Role Hierarchy (`ADMIN`, `STAFF`, `CUSTOMER`):**
   - **Admin:** Complete system authority (manage catalog, plans, users, currencies, provision staff).
   - **Internal Staff:** Catalog and user directory visibility; operational read-only permissions on products and plans.
   - **Customer:** Isolated access strictly limited to own account information.
2. **Customer Self-Data Isolation:**
   - Database and controller-level queries enforce that `CUSTOMER` role actors can only view and modify their own records. Cross-tenant access returns HTTP 403 Forbidden.
3. **Admin-Only Staff Account Provisioning (`POST /api/v1/users/staff`):**
   - Strict RBAC check ensuring only `ADMIN` can create operational `STAFF` users.
4. **User Directory & Account Status Management (`GET /api/v1/users`, `PATCH /api/v1/users/:id/status`):**
   - Paginated, filterable, and searchable user catalog.
   - Admin account status toggle (activate/deactivate) with confirmation guards and self-deactivation prevention.

### C. Product Management
1. **Full Product Lifecycle (`/api/v1/products`):**
   - Create, list, get details, edit, and toggle active status.
   - Tracks Product Name, Unique Code, Type (`SERVICE`, `PHYSICAL`, `DIGITAL`), Sales Price (`NUMERIC(14, 4)`), Cost Price (`NUMERIC(14, 4)`), Description, and Internal Engineering Notes.
   - Financial precision: Uses PostgreSQL `NUMERIC(14, 4)` for financial accuracy.

### D. Product Variants & Differential Pricing
1. **Configurable Product Variants (`/api/v1/products/:id/variants`):**
   - Support for multiple variants per product with unique SKUs.
   - Dynamic variant attributes (e.g. `Brand`, `Storage`, `Edition`).
   - Configurable additional price per variant.
2. **Variant Price Calculation Engine (`POST /api/v1/products/:id/variants/:variantId/calculate`):**
   - Dynamic API endpoint and UI widget calculating the final effective price (`baseSalesPrice + variantAdditionalPrice`).
   - **Supported Specific Example:** Base product at ₹1,000 + selecting the **Odoo Brand** variant (+₹560) calculates the final unit price of **₹1,560**.

### E. Subscription Plan Management & Lifecycles
1. **Multi-Cadence Plan Configuration (`/api/v1/plans`):**
   - Supports Billing Frequencies: `DAILY`, `WEEKLY`, `MONTHLY`, and `YEARLY`.
   - Minimum Order Quantity (MOQ) configuration.
   - Plan availability windows (`validFrom` and `validUntil`) with date order validation.
2. **Granular Operational Permission Toggles:**
   - `autoCloseOnExpiry`: Controls automatic closure when validity ends.
   - `allowEarlyClosure`: Controls whether administrators can terminate a plan early.
   - `allowPause`: Controls whether the plan can be paused and resumed.
   - `allowRenewal`: Controls whether the plan's validity date can be extended.
3. **Plan Lifecycle Transitions:**
   - **Pause Plan (`POST /api/v1/plans/:id/pause`):** Sets plan status to `PAUSED`.
   - **Resume Plan (`POST /api/v1/plans/:id/resume`):** Restores plan status to `ACTIVE`.
   - **Close Plan Early (`POST /api/v1/plans/:id/close`):** Terminates plan availability before its expiration date.
   - **Renew Plan (`POST /api/v1/plans/:id/renew`):** Extends plan validity with a future timestamp and reactivates it.
   - **Automatic Expiry Sweep (`POST /api/v1/plans/sweep-expiry`):** BullMQ-integrated background task that sweeps expired plans and sets status to `CLOSED`.
   - **Catalog Visibility (`PATCH /api/v1/plans/:id/status`):** Soft activate/deactivate toggle.

### F. Multi-Currency Foundation
1. **Exchange Rate Table (`/api/v1/currencies`):**
   - Supports `USD` (base), `EUR`, `INR`, `GBP` with exchange rates and currency symbols.
   - Dynamic conversion utility (`POST /api/v1/currencies/convert`).

---

## 3. Database Schema & Tables Owned by Member 1

1. **`users`:** Core user entity with `email`, `password_hash`, `role` (`ADMIN`, `STAFF`, `CUSTOMER`), `first_name`, `last_name`, `is_active`, and timestamps.
2. **`customers`:** 1-to-1 customer profile containing billing address line 1, city, state, postal code, ISO-2 country, and default currency.
3. **`password_reset_tokens`:** Secure hashed tokens with expiration and single-use `used_at` timestamps.
4. **`products`:** Catalog products with unique `code`, `type`, `sales_price`, `cost_price`, `description`, `internal_notes`, and active flag.
5. **`product_variants`:** Sub-attributes with unique `sku`, `attribute_name`, `attribute_value`, and `additional_price`.
6. **`plans`:** Subscription plans with unique `code`, `billing_frequency`, `base_price`, `minimum_quantity`, validity ranges, policy flags, and status (`ACTIVE`, `PAUSED`, `CLOSED`).
7. **`currencies`:** Currency codes, symbols, and exchange rates to base currency.

---

## 4. Frontend Application Pages

- **Authentication:**
  - `/login`: Email & password sign-in with quick-fill demo buttons (Admin, Staff, Customer).
  - `/register`: Customer sign-up with real-time password complexity checklist and billing address form.
  - `/forgot-password`: Password reset link dispatcher with simulated dev link.
  - `/reset-password/:token`: Password reset form with real-time checklist.
- **User Management:**
  - `/users`: Paginated, filterable user list with role badges and account status toggle.
  - `/users/staff/create`: Admin-only form to provision operational staff.
  - `/users/:id`: Detailed view of user and customer billing profile with account status control.
- **Product Management:**
  - `/products`: Catalog listing with type & status filters and variant counts.
  - `/products/new`: Multi-variant creation form with dynamic row builder.
  - `/products/:id`: Detailed specs, margin analysis, variant table, and interactive **Variant Price Calculator Widget**.
  - `/products/:id/edit`: Product modification form.
- **Plan Management:**
  - `/plans`: Subscription plan cards with frequency, price, MOQ, and validity dates.
  - `/plans/new`: Plan builder with frequency select, availability window, and policy switches.
  - `/plans/:id`: Plan overview and **Lifecycle Control Center** (Pause, Resume, Close Early, Renew).
  - `/plans/:id/edit`: Plan configuration editor.

---

## 5. Integration Interfaces for Members 2, 3, and 4

Member 1 exports the following contracts for upcoming members:

1. **Authentication & Authorization Middleware (`apps/backend/src/modules/auth_catalog/middleware/auth.middleware.ts`):**
   - `authenticateToken`: Verifies JWT bearer tokens, attaches `req.user` (`id`, `email`, `role`, `customerId`).
   - `requireRole(allowedRoles: UserRole[])`: Enforces RBAC permissions with HTTP 403.
   - `enforceCustomerIsolation`: Restricts customer queries to their own tenant record.
2. **Foreign Key Targets in PostgreSQL:**
   - `users.id` and `customers.id`: For Member 2 quotations & subscriptions, Member 3 invoices, Member 4 audit logs.
   - `products.id` and `product_variants.id`: For Member 2 subscription line items and Member 3 invoice line items.
   - `plans.id`: For Member 2 subscription plan linkage.
3. **Pricing Calculators:**
   - `productService.calculateVariantPrice(productId, variantId)`: Computes base price + variant delta.
   - `currencyService.convertAmount(amount, fromCurrency, toCurrency)`: Multi-currency conversion helper.

---

## 6. Verification and Test Results

All 63 automated tests pass cleanly across backend and frontend:

- **Backend Test Suites (Vitest + Supertest):** 6 test files, 53 tests passed.
  - `apps/backend/tests/member1/auth.test.ts`: Registration, password complexity regex, duplicate email rejection, login, incorrect password, forgot password, token expiration, invalid JWT, `/me` profile. (13 tests)
  - `apps/backend/tests/member1/rbac.test.ts`: Admin access, staff creation, staff restrictions, customer access isolation, unauthorized access attempts. (9 tests)
  - `apps/backend/tests/member1/product.test.ts`: Product CRUD, variant differential pricing, **Odoo Brand +₹560 example test**, negative price rejection, invalid type rejection. (13 tests)
  - `apps/backend/tests/member1/plan.test.ts`: Plan CRUD, billing frequency validation, date range validation, pause, resume, early closure, renewal, policy enforcement, auto-expiry sweep. (14 tests)
  - `apps/backend/tests/health.test.ts`: Liveness and dependency readiness probes. (3 tests)
  - `apps/backend/tests/error.test.ts`: Central error normalization handler. (1 test)
- **Frontend Test Suites (Vitest + React Testing Library):** 2 test files, 10 tests passed.
  - `apps/frontend/src/tests/member1.test.tsx`: Password strength checklist validation, confirmation modal interactions, auth page render tests. (8 tests)
  - `apps/frontend/src/tests/App.test.tsx`: Application shell and layout sanity. (2 tests)

---

## 7. Setup & Execution Commands

```bash
# 1. Start Database & Redis Infrastructure
npm run docker:up

# 2. Install Dependencies & Build Packages
npm install
npm run build

# 3. Seed Database with Baseline & Member 1 Data
npm run db:seed

# 4. Run Automated Test Suites
npm test

# 5. Start Development Servers (Backend on :5001, Frontend on :3000)
npm run dev
```

### Pre-Seeded Demo Credentials
- **Admin:** `admin@odoo.local` / `AdminPass@1234`
- **Internal Staff:** `staff@odoo.local` / `StaffPass@1234`
- **Customer:** `customer@odoo.local` / `CustomerPass@1234`
