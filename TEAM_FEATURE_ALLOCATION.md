# Subscription Management System – Four-Member Feature Allocation & Development Blueprint

> **Document Status:** Architectural Master Specification & Engineering Blueprint  
> **Target Audience:** Engineering Team (Members 1, 2, 3, 4), Academic Reviewers, Technical Evaluators, Project Lead  
> **Academic Context:** B.Tech Computer Science & Engineering Final Year Capstone Project  
> **Version:** 1.0.0-PROD-SPEC  
> **Repository Context:** Clean root initialization (`/Users/ridhir/Desktop/odoo`)

---

## 1. Project Overview & System Architecture

### 1.1 Executive Summary
The **Subscription Management System** is a mission-critical, enterprise-grade subscription operations, recurring billing, automated revenue management, and risk governance platform. Unlike consumer subscription checkout widgets, this platform serves as the single source of truth for end-to-end customer subscription lifecycles, complex multi-tier and usage-based pricing engines, automated recurring invoicing, transactional financial ledgering, dunning and payment retry workflows, rule-based fraud detection, customer account health scoring, and immutable audit compliance.

The system is engineered for a multi-tenant or role-partitioned organizational hierarchy supporting three primary actors:
1. **System Administrator (Admin):** Full operational, financial, catalog, pricing, audit, and user governance access.
2. **Internal Operations Staff (Staff):** Delegated operational capabilities (customer support, manual invoice generation, quotation drafting, payment recording, and fraud alert investigation) without access to sensitive system configurations or administrative user creation.
3. **Customer / Subscriber (Customer):** Strict single-tenant data isolation; access restricted entirely to personal subscription plans, usage consumption analytics, downloadable PDF invoices, payment method management, and account cancellation/feedback workflows.

### 1.2 Target System Architecture
The platform utilizes a **Modular Monolith** architecture with strict domain boundaries. This balances independent team member velocity with operational simplicity, eliminating premature microservice orchestration overhead while maintaining pristine separation of concerns for individual ZIP packaging.

```
                              +--------------------------------------------------+
                              |                  CLIENT LAYER                    |
                              |   React 18 + TypeScript + Tailwind CSS + Vite   |
                              +--------------------------------------------------+
                                                        |
                                                        | HTTPS / REST / JSON
                                                        v
+---------------------------------------------------------------------------------------------------------------+
|                                            API GATEWAY & RUNTIME CORE                                         |
|                                       (Node.js v20 LTS + Express.js)                                          |
|  - Request Normalization      - JWT Auth & RBAC Guard         - Correlation ID Injection                      |
|  - Rate Limiting (express-rate-limit) - Global Error Handler  - Structured JSON Logging (Winston)              |
+---------------------------------------------------------------------------------------------------------------+
       |                               |                                |                              |
       v                               v                                v                              v
+---------------+              +---------------+                +---------------+              +---------------+
|   MEMBER 1    |              |   MEMBER 2    |                |   MEMBER 3    |              |   MEMBER 4    |
| Auth, Users,  |              | Quotations,   |                | Invoicing,    |              | Analytics,    |
| Products,     |              | Subscriptions,|                | Taxes,        |              | Dashboards,   |
| Plans, Rates  |              | Pricing Engine|                | Discounts,    |              | Fraud & Audit |
|               |              | & Usage Meter |                | Payments, Webh|              | & Surveys     |
+---------------+              +---------------+                +---------------+              +---------------+
       |                               |                                |                              |
       +-------------------------------+--------------------------------+------------------------------+
                                       |
                   +-------------------+-------------------+
                   |                                       |
                   v                                       v
    +-----------------------------+         +-----------------------------+
    |   PERSISTENCE LAYER (DB)    |         | ASYNC TASK QUEUE & WORKERS  |
    |  PostgreSQL 16 (or MySQL 8) |         | BullMQ + Redis 7 (or Memory)|
    |  - ACID Compliant Engine    |         | - Scheduled Invoicing Job   |
    |  - NUMERIC(14,4) Currency   |         | - Smart Payment Retries     |
    |  - Append-Only Audit Trail  |         | - Usage Aggregator Job      |
    +-----------------------------+         | - Notification Email Worker |
                                            +-----------------------------+
```

### 1.3 Repository & Codebase Directory Structure
To facilitate independent development and automated file extraction into distinct member ZIP distributions, the repository enforces a modular directory blueprint:

```
odoo/
├── .github/
│   └── workflows/                # CI/CD Workflows (Shared - Lead: Member 4)
├── docker/
│   ├── Dockerfile.frontend       # Frontend container definition
│   ├── Dockerfile.backend        # Backend container definition
│   └── docker-compose.yml        # Multi-service local environment (DB, Redis, API, Web)
├── packages/                     # (Optional Monorepo workspaces or module folders)
├── client/                       # React 18 SPA Frontend
│   ├── public/                   # Static assets, logos, favicon
│   ├── src/
│   │   ├── assets/               # Shared icons, illustrations, styles
│   │   ├── components/           # Shared UI Design System (Buttons, Tables, Modals, Forms)
│   │   ├── context/              # Global Contexts (AuthContext, ThemeContext, CurrencyContext)
│   │   ├── hooks/                # Common Hooks (useAuth, useApi, useDebounce, useCurrency)
│   │   ├── layouts/              # AppLayout, AuthLayout, CustomerPortalLayout
│   │   ├── modules/
│   │   │   ├── member1_auth/     # Member 1 Frontend (Auth, Users, Products, Plans)
│   │   │   ├── member2_subs/     # Member 2 Frontend (Quotes, Subscriptions, Pricing, Usage)
│   │   │   ├── member3_billing/  # Member 3 Frontend (Invoices, Taxes, Discounts, Payments)
│   │   │   └── member4_ops/      # Member 4 Frontend (Dashboard, Fraud, Health, Audit, Surveys)
│   │   ├── routes/               # AppRoutes.tsx (Protected Route definitions by RBAC)
│   │   ├── services/             # Axios Base Client & Interceptors
│   │   ├── utils/                # Date formatting, Currency math, Validation schemas
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                       # Node.js + Express.js Backend
│   ├── src/
│   │   ├── config/               # Database, Redis, Mailer, JWT environment configs
│   │   ├── core/                 # Shared Kernel
│   │   │   ├── database/         # Connection pool, Transaction helper, Migration runner
│   │   │   ├── errors/           # AppError, BadRequestError, UnauthorizedError, NotFoundError
│   │   │   ├── middleware/       # authMiddleware, rbacMiddleware, auditMiddleware, rateLimiter
│   │   │   ├── utils/            # Decimal calculator, Logger (Winston), Crypto helpers
│   │   │   └── types/            # Global TypeScript definitions / JSDoc shared interfaces
│   │   ├── modules/
│   │   │   ├── auth_catalog/     # Member 1 Backend Module
│   │   │   ├── subscriptions/    # Member 2 Backend Module
│   │   │   ├── billing/          # Member 3 Backend Module
│   │   │   └── operations/       # Member 4 Backend Module
│   │   ├── queue/                # BullMQ queue definitions, schedulers, and workers
│   │   ├── app.ts                # Express application bootstrapping & middleware registration
│   │   └── server.ts             # HTTP listener, shutdown hooks
│   ├── database/
│   │   ├── migrations/           # Sequentially ordered DB migrations (001_..., 002_...)
│   │   └── seeds/                # Demo and mock seed scripts (Admin user, standard plans)
│   ├── tests/                    # Unit, Integration, and Contract tests
│   │   ├── member1/
│   │   ├── member2/
│   │   ├── member3/
│   │   └── member4/
│   ├── package.json
│   └── tsconfig.json
├── docs/                         # Architecture, API specifications, and member runbooks
├── .env.example                  # Consolidated environment variable template
├── TEAM_FEATURE_ALLOCATION.md    # This master document
└── README.md                     # Root project documentation
```

### 1.4 Core Role-Based Access Control (RBAC) Matrix

| Domain Feature | Admin | Internal Staff | Customer (Subscriber) | Guest / Public |
| :--- | :---: | :---: | :---: | :---: |
| **User Registration / Login** | Full | Full | Self Only | Register / Login / Reset |
| **Create Staff Accounts** | **Yes** | No | No | No |
| **Product & Plan Management** | Full CRUD | Read-Only | Read-Only (Active Plans) | Read-Only (Public Plans) |
| **Quotation Generation** | Full CRUD | Full CRUD | View Own / Accept | No |
| **Subscription Lifecycle** | Full CRUD | Create / Update | View Own / Cancel Own | No |
| **Usage Event Ingestion** | Full | Ingest / View | View Own Aggregates | No |
| **Invoice Generation & Edit** | Full CRUD | Generate / View | View Own / Download PDF | No |
| **Tax & Discount Configuration**| Full CRUD | View Only | View Applied Discounts | No |
| **Payment Recording (Manual)** | Full | Create / View | No | No |
| **Payment Gateway Checkout** | Test / Refund | View Trans. | Pay Own Invoices | No |
| **Dunning & Retry Config** | Full Config | View Status | View Retry Status | No |
| **Revenue & Executive Reports**| Full Access | Restricted | No | No |
| **Fraud Alerts & Score Mod.** | Full / Review | Investigate | No | No |
| **Audit Log Viewing** | **Yes (Full)** | No | No | No |
| **Exit Survey Administration** | Design / View | View Aggregate| Submit on Cancellation | No |

---

## 2. Complete Feature Inventory & Categorization

The platform encompasses **62 discrete engineering capabilities** across 12 functional domains (A through L). Below is the comprehensive classification into **Mandatory MVP Deliverables** (required for core operational viability) and **Advanced Enhancements** (sophisticated enterprise differentiators).

### 2.1 Complete Catalog & Classification Table

| ID | Domain | Feature Name | Classification | Primary Owner | Secondary / Consumer |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A.1** | Auth & Users | Customer Registration (Email/Pass) | **Mandatory MVP** | **Member 1** | Member 2, 3, 4 |
| **A.2** | Auth & Users | Unique Email Validation | **Mandatory MVP** | **Member 1** | Member 4 (Fraud) |
| **A.3** | Auth & Users | Strict Password Complexity Rules | **Mandatory MVP** | **Member 1** | All |
| **A.4** | Auth & Users | Forgot Password Workflow | **Mandatory MVP** | **Member 1** | Member 4 (Notifications) |
| **A.5** | Auth & Users | Secure Email Password Reset Link | **Mandatory MVP** | **Member 1** | Member 4 (Notifications) |
| **A.6** | Auth & Users | RBAC Middleware (Admin/Staff/Cust) | **Mandatory MVP** | **Member 1** | Member 2, 3, 4 |
| **A.7** | Auth & Users | Full Admin Privileges Enforcement | **Mandatory MVP** | **Member 1** | All |
| **A.8** | Auth & Users | Restricted Staff Operational Access | **Mandatory MVP** | **Member 1** | Member 2, 3 |
| **A.9** | Auth & Users | Customer Self-Data Isolation Filter | **Mandatory MVP** | **Member 1** | Member 2, 3 |
| **A.10**| Auth & Users | Admin-Only Staff Account Creation | **Mandatory MVP** | **Member 1** | All |
| **B.1** | Products | Create & Manage Products | **Mandatory MVP** | **Member 1** | Member 2, 3 |
| **B.2** | Products | Product Name, Code, and Types | **Mandatory MVP** | **Member 1** | Member 2, 3 |
| **B.3** | Products | Sales Price and Cost Price Tracking | **Mandatory MVP** | **Member 1** | Member 4 (Margin Reports)|
| **B.4** | Products | Product Internal Notes & Specs | **Mandatory MVP** | **Member 1** | Member 2 |
| **B.5** | Products | Product Variants (Attributes/SKUs) | **Advanced** | **Member 1** | Member 2 (Line Items) |
| **B.6** | Products | Variant Differential Pricing | **Advanced** | **Member 1** | Member 2 (Pricing Engine)|
| **C.1** | Plans | Create Subscription Plans | **Mandatory MVP** | **Member 1** | Member 2, 3 |
| **C.2** | Plans | Base Plan Recurring Pricing | **Mandatory MVP** | **Member 1** | Member 2, 3 |
| **C.3** | Plans | Billing Frequencies (D/W/M/Y) | **Mandatory MVP** | **Member 1** | Member 2, 3 |
| **C.4** | Plans | Minimum Order Quantity (MOQ) | **Mandatory MVP** | **Member 1** | Member 2 (Validation) |
| **C.5** | Plans | Plan Availability Date Ranges | **Mandatory MVP** | **Member 1** | Member 2 |
| **C.6** | Plans | Auto-Closure on Expiry Setting | **Mandatory MVP** | **Member 1** | Member 2 (Lifecycle) |
| **C.7** | Plans | Early Closure Policy Rules | **Mandatory MVP** | **Member 1** | Member 2, 4 (Exit Survey) |
| **C.8** | Plans | Pause Plan Configuration | **Mandatory MVP** | **Member 1** | Member 2 (Lifecycle) |
| **C.9** | Plans | Plan Renewal Configuration | **Mandatory MVP** | **Member 1** | Member 2, 3 |
| **C.10**| Plans | Permitted Plan Operations Flags | **Advanced** | **Member 1** | Member 2 |
| **D.1** | Quotations | Quotation Template Management | **Mandatory MVP** | **Member 2** | Member 1 (Picks Products)|
| **D.2** | Quotations | Predefined Plans & Product Lines | **Mandatory MVP** | **Member 2** | Member 1 (Catalog) |
| **D.3** | Quotations | Quotation Validity & Expiry Engine | **Mandatory MVP** | **Member 2** | Customer Portal |
| **D.4** | Quotations | One-Click Quote to Subscription Conv.| **Mandatory MVP** | **Member 2** | Member 3 (Invoice Gen) |
| **E.1** | Subscriptions | Unique Human-Readable Sub ID Format| **Mandatory MVP** | **Member 2** | Member 3, 4 |
| **E.2** | Subscriptions | Customer Association & Isolation | **Mandatory MVP** | **Member 2** | Member 1 |
| **E.3** | Subscriptions | Plan & Variant Line Association | **Mandatory MVP** | **Member 2** | Member 1 |
| **E.4** | Subscriptions | Start, Billing Anchor & Expiry Dates| **Mandatory MVP** | **Member 2** | Member 3 (Billing Cycle) |
| **E.5** | Subscriptions | Payment Terms (Net 0, 15, 30) | **Mandatory MVP** | **Member 2** | Member 3 (Due Dates) |
| **E.6** | Subscriptions | Line Items (Prod, Qty, Price, Tax) | **Mandatory MVP** | **Member 2** | Member 3 (Invoicing) |
| **E.7** | Subscriptions | Lifecycle State Machine (Draft->Act)| **Mandatory MVP** | **Member 2** | Member 3, 4 |
| **E.8** | Subscriptions | Real-Time Subscription Tracking | **Mandatory MVP** | **Member 2** | Member 4 (Dashboard) |
| **F.1** | Invoicing | Recurring Auto-Invoice Generation | **Mandatory MVP** | **Member 3** | Member 2 (Reads Subs) |
| **F.2** | Invoicing | Customer Details Snapshot Storage | **Mandatory MVP** | **Member 3** | Member 1 |
| **F.3** | Invoicing | Product Line Snapshots & Totals | **Mandatory MVP** | **Member 3** | Member 2 |
| **F.4** | Invoicing | Automated Tax Engine Application | **Mandatory MVP** | **Member 3** | Member 1, 2 |
| **F.5** | Invoicing | Subtotal, Discount & Total Math | **Mandatory MVP** | **Member 3** | Member 4 (Revenue) |
| **F.6** | Invoicing | Invoice Confirmation Workflow | **Mandatory MVP** | **Member 3** | Member 4 (Audit) |
| **F.7** | Invoicing | Cancellation & Credit Note Workflow| **Mandatory MVP** | **Member 3** | Member 4 (Health) |
| **F.8** | Invoicing | Send Invoices (Email Notification) | **Mandatory MVP** | **Member 3** | Member 4 (Mailer) |
| **F.9** | Invoicing | Print & Dynamic PDF Generation | **Mandatory MVP** | **Member 3** | Customer Portal |
| **F.10**| Invoicing | Statuses (Draft/Confirmed/Paid/Over)| **Mandatory MVP** | **Member 3** | Member 4 (Reporting) |
| **F.11**| Invoicing | Idempotent Duplicate Billing Guard | **Mandatory MVP** | **Member 3** | System Integrity |
| **F.12**| Invoicing | Skip-Proof Scheduled Billing Tracker| **Mandatory MVP** | **Member 3** | System Integrity |
| **G.1** | Taxes | Admin Tax Rule Management | **Mandatory MVP** | **Member 3** | Member 2 |
| **G.2** | Taxes | Geographic/Compound Tax Calculation| **Mandatory MVP** | **Member 3** | Member 2 |
| **G.3** | Taxes | Line-Item Level Tax Application | **Mandatory MVP** | **Member 3** | Member 2 |
| **G.4** | Taxes | Final Tax Breakdown Storage | **Mandatory MVP** | **Member 3** | Member 4 (Tax Reports) |
| **H.1** | Discounts | Admin Discount Rule Builder | **Mandatory MVP** | **Member 3** | Member 2 |
| **H.2** | Discounts | Fixed & Percentage Discount Engine | **Mandatory MVP** | **Member 3** | Member 2 |
| **H.3** | Discounts | Min Order Value & Min Qty Criteria | **Mandatory MVP** | **Member 3** | Member 2 |
| **H.4** | Discounts | Start/End Dates & Active Schedules | **Mandatory MVP** | **Member 3** | Member 2 |
| **H.5** | Discounts | Max Redemption & Per-User Limits | **Mandatory MVP** | **Member 3** | Member 4 (Fraud Monitor) |
| **H.6** | Discounts | Product-Specific vs Global Discounts| **Mandatory MVP** | **Member 3** | Member 2 |
| **H.7** | Discounts | Atomic DB Discount Decrement Guard | **Mandatory MVP** | **Member 3** | System Integrity |
| **I.1** | Payments | Manual Payment Recording (Cash/Wire)| **Mandatory MVP** | **Member 3** | Member 4 (Reports) |
| **I.2** | Payments | Invoice-Payment Association Ledger | **Mandatory MVP** | **Member 3** | Member 4 |
| **I.3** | Payments | Payment Method, Reference & Metadata| **Mandatory MVP** | **Member 3** | Member 4 |
| **I.4** | Payments | Payment Receipt & Status Tracking | **Mandatory MVP** | **Member 3** | Customer Portal |
| **I.5** | Payments | Outstanding & Overdue Invoice Ledger| **Mandatory MVP** | **Member 3** | Member 4 (Risk Engine) |
| **I.6** | Payments | Automated Follow-Up Reminders | **Mandatory MVP** | **Member 3** | Member 4 (Notification) |
| **J.1** | Dashboard | Active Subscriptions & MRR Widget | **Mandatory MVP** | **Member 4** | Consumes Mem 2, 3 |
| **J.2** | Dashboard | Revenue Collected vs Outstanding Bar| **Mandatory MVP** | **Member 4** | Consumes Mem 3 |
| **J.3** | Dashboard | Overdue Receivables Aging Chart | **Mandatory MVP** | **Member 4** | Consumes Mem 3 |
| **J.4** | Dashboard | Consolidated Executive Dashboard | **Mandatory MVP** | **Member 4** | All Members |
| **J.5** | Dashboard | Dynamic Time & Segment Filter Engine| **Mandatory MVP** | **Member 4** | All Members |
| **K.1** | Usage Billing| Usage Ingestion API & Event Ledger | **Advanced** | **Member 2** | Member 3 (Invoice) |
| **K.2** | Usage Billing| Billing Window Usage Aggregator | **Advanced** | **Member 2** | Member 3 (Line Item) |
| **K.3** | Tiered Price | Graduated (Bracket) & Volume Pricing| **Advanced** | **Member 2** | Member 1, 3 |
| **K.4** | Proration | Mid-Cycle Upgrade & Credit Engine | **Advanced** | **Member 2** | Member 3 (Prorated Inv) |
| **K.5** | Exit Surveys | Automated Survey Trigger on Cancel | **Advanced** | **Member 4** | Member 2 (Cancel Event) |
| **K.6** | Exit Surveys | Churn Reason & Sentiment Analytics | **Advanced** | **Member 4** | Admin View |
| **K.7** | Multi-Curr | Multi-Currency Rates & Base Convers.| **Advanced** | **Member 1 (Rates)**| Mem 2, 3 (Trans/Inv) |
| **K.8** | Health/Risk | Account Health Scoring Algorithm | **Advanced** | **Member 4** | Consumes Mem 1, 2, 3 |
| **K.9** | Health/Risk | Churn Risk Indicator & Warning Flags| **Advanced** | **Member 4** | Admin View |
| **K.10**| Retries/Dunn| Smart Payment Retry & Dunning Engine| **Advanced** | **Member 3** | Member 4 (Health) |
| **K.11**| Gateway | Stripe/Razorpay Webhook Verification | **Advanced** | **Member 3** | Customer Portal |
| **K.12**| Audit Logs | Immutable System Audit Interceptor | **Advanced** | **Member 4** | Cross-Cutting All |
| **K.13**| Fraud Engine| 8-Point Fraud Rule Engine & Alerts | **Advanced** | **Member 4** | Cross-Cutting All |
| **K.14**| ML Fraud | Optional Python ML Risk Scoring Host| **Advanced** | **Member 4** | Ops Microservice |

---

## 3. Four-Member Responsibility Matrix & Ownership Overview

To ensure equitable distribution of B.Tech technical complexity, database concurrency, algorithmic challenge, and frontend-to-backend workload, the system is allocated across four functional pillars:

```
+-----------------------------------------------------------------------------------------------------------------------+
|                                              TEAM WORKLOAD EQUILIBRIUM                                                |
+--------------------+-----------------------------------+------------------------------------+-------------------------+
| MEMBER             | PRIMARY ARCHITECTURAL FOCUS       | ALGORITHMIC / BACKEND WEIGHT       | FRONTEND / UI WEIGHT    |
+--------------------+-----------------------------------+------------------------------------+-------------------------+
| **MEMBER 1**       | Security, Auth, Identity, Product | JWT, RBAC, Password Hash, Variant   | Auth flows, User CRUD,  |
| (Foundation Lead)  | Catalog & Plan Lifecycles         | Matrix, Multi-Currency Exchange    | Product/Plan Builder    |
+--------------------+-----------------------------------+------------------------------------+-------------------------+
| **MEMBER 2**       | Quotations, Subscriptions, Usage  | Complex Pricing Engine (Tiered,    | Subscription Lifecycle, |
| (Billing Logic)    | Metering & Mid-Cycle Proration    | Volume, Graduated), Proration Math | Usage Visualizer, Quotes|
+--------------------+-----------------------------------+------------------------------------+-------------------------+
| **MEMBER 3**       | Recurring Invoicing, Tax/Discount | BullMQ Recurring Job, Tax Ledger,  | Invoicing Portal, Cashier|
| (Financial Ledger) | Payments, Dunning & Webhooks      | Idempotency, Gateway Webhooks      | Tax/Discount Config     |
+--------------------+-----------------------------------+------------------------------------+-------------------------+
| **MEMBER 4**       | Executive BI, Fraud Detection,    | 8-Rule Fraud Engine, Account Health| Recharts Dashboards,    |
| (Operations Lead)  | Health Scoring, Audit & Surveys   | Composite Index, Audit Interceptor | Fraud Review Desk, Logs |
+--------------------+-----------------------------------+------------------------------------+-------------------------+
```

### Architectural Boundaries & Workload Balancing Justification
- **Member 1** delivers the base platform on which all other members authenticate, identify customers, define catalog items, and fetch exchange rates.
- **Member 2** owns the business logic that binds customers to plans, calculating exactly what is owed across dynamic billing periods, meters, and subscription changes.
- **Member 3** owns the financial ledger—turning subscription line items into legal, immutable, tax-calculated invoices and collecting money via manual entry or automated gateway webhooks.
- **Member 4** acts as the overarching intelligence, governance, and operational visibility layer, analyzing records generated by Members 1, 2, and 3 without interfering with transactional billing paths.

---

## 4. Member 1 – Detailed Feature Specification
**Domain:** Identity, Authentication, Role-Based Governance, Product Catalog, Plan Engineering & Currency Configuration

### 4.1 Features & Sub-Features Owned
1. **User Identity & Security:**
   - Customer self-registration with email and password.
   - Unique email validation with duplicate protection.
   - Strict password security validation: length > 8, at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special symbol (`(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}`).
   - Secure forgot password and password reset token generation (crypto-random, 1-hour expiration) with reset email dispatch.
   - JWT authentication: short-lived Access Token (15 min) + Refresh Token stored in HttpOnly, SameSite cookie with refresh rotation.
   - Role-Based Access Control (RBAC): `ADMIN`, `STAFF`, `CUSTOMER`.
   - Admin-exclusive endpoint for provisioning Internal Staff accounts.
   - Customer data boundary enforcement ensuring `CUSTOMER` role queries can only filter records matching `req.user.customerId`.
2. **Product Catalog Management:**
   - Create, update, view, and retire products.
   - Product attributes: Name, unique SKU/Code, Type (`SERVICE`, `PHYSICAL`, `DIGITAL`), Description, Internal Notes.
   - Financial baseline tracking: Sales Price (`NUMERIC(14,4)`) and Internal Cost Price (`NUMERIC(14,4)`).
   - Product Variants: Configurable attributes (e.g., storage capacity, seats, tier) with differential variant pricing.
3. **Plan Configuration & Lifecycles:**
   - Subscription plan builder: Name, Code, Description, Billing Frequencies (`DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`).
   - Minimum Order Quantity (MOQ) enforcement.
   - Plan availability windows: Effective start date and end date.
   - Lifecycle operational toggles: `auto_close_on_expiry` (boolean), `allow_early_closure` (boolean), `allow_pause` (boolean), `allow_renewal` (boolean).
   - Multi-Currency exchange rate table management (Base currency USD/INR with dynamic conversion rates for foreign billing).

### 4.2 Frontend Architecture (Member 1)
- **Directory:** `client/src/modules/member1_auth/`
- **Pages & Views:**
  - `LoginPage.tsx`: Email/password form, Remember Me, Forgot Password link.
  - `RegisterPage.tsx`: Real-time password complexity checklist and email validation.
  - `ForgotPasswordPage.tsx` & `ResetPasswordPage.tsx`: Token-validated password reset form.
  - `UsersListPage.tsx` (Admin only): Searchable/filterable list of customers and staff.
  - `CreateStaffModal.tsx` (Admin only): Modal to provision internal staff accounts.
  - `ProductCatalogPage.tsx`: Product table with active/archived tabs and search filters.
  - `ProductFormModal.tsx`: Product creation/edit modal with dynamic variant row builder.
  - `PlanManagementPage.tsx`: Card and table grid of available subscription plans.
  - `PlanFormModal.tsx`: Multi-step plan creator with billing frequency, MOQ, and policy switches.
  - `CurrencySettingsPage.tsx` (Admin only): Currency rate management interface.
- **State Management & Routing:**
  - `AuthContext.tsx`: Tracks `currentUser`, `token`, `isAuthenticated`, `role`, and `login()` / `logout()` actions.
  - Protected routes: `/login`, `/register`, `/forgot-password`, `/reset-password/:token`, `/admin/users`, `/admin/products`, `/admin/plans`, `/admin/currencies`.

### 4.3 Backend Architecture (Member 1)
- **Directory:** `server/src/modules/auth_catalog/`
- **Controllers & Services:**
  - `auth.controller.ts` & `auth.service.ts`: Handles password hashing (bcrypt, salt rounds 12), JWT generation, token verification, and refresh rotation.
  - `user.controller.ts` & `user.service.ts`: User retrieval, profile updates, and staff provisioning.
  - `product.controller.ts` & `product.service.ts`: Product and variant CRUD with SKU uniqueness checks.
  - `plan.controller.ts` & `plan.service.ts`: Plan lifecycle policies and validation.
  - `currency.controller.ts` & `currency.service.ts`: Currency pair rate CRUD.
- **Middlewares Exported for Team:**
  - `authenticateToken`: Verifies Authorization header `Bearer <token>` and attaches decoded user to `req.user`.
  - `requireRole(allowedRoles: Role[])`: Returns 403 Forbidden if `req.user.role` is not permitted.
  - `enforceCustomerIsolation`: Automatically overrides or checks `req.query.customerId` or `req.params.customerId` to match `req.user.customerId`.

### 4.4 Database Schema & Table Ownership (Member 1)

```sql
-- Table: users (Owned by Member 1)
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'STAFF', 'CUSTOMER')),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Table: customers (Owned by Member 1, 1-to-1 with users where role='CUSTOMER')
CREATE TABLE customers (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    company_name VARCHAR(255),
    phone VARCHAR(50),
    billing_address_line1 VARCHAR(255) NOT NULL,
    billing_city VARCHAR(100) NOT NULL,
    billing_state VARCHAR(100),
    billing_postal_code VARCHAR(20) NOT NULL,
    billing_country VARCHAR(2) NOT NULL, -- ISO 3166-1 alpha-2
    default_currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: products (Owned by Member 1)
CREATE TABLE products (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('SERVICE', 'PHYSICAL', 'DIGITAL')),
    description TEXT,
    internal_notes TEXT,
    sales_price NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    cost_price NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: product_variants (Owned by Member 1)
CREATE TABLE product_variants (
    id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_name VARCHAR(100) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    additional_price NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: plans (Owned by Member 1)
CREATE TABLE plans (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    billing_frequency VARCHAR(20) NOT NULL CHECK (billing_frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
    base_price NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    currency VARCHAR(3) DEFAULT 'USD',
    minimum_quantity INTEGER NOT NULL DEFAULT 1,
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    auto_close_on_expiry BOOLEAN DEFAULT TRUE,
    allow_early_closure BOOLEAN DEFAULT TRUE,
    allow_pause BOOLEAN DEFAULT TRUE,
    allow_renewal BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: currencies (Owned by Member 1)
CREATE TABLE currencies (
    code VARCHAR(3) PRIMARY KEY, -- USD, EUR, INR, GBP
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    exchange_rate_to_base NUMERIC(14, 6) NOT NULL DEFAULT 1.000000,
    is_base_currency BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 4.5 REST API Specifications (Member 1)

#### `POST /api/v1/auth/register`
- **Purpose:** Public registration for new customer accounts.
- **Access:** Public.
- **Request Body:**
  ```json
  {
    "email": "sarah.connor@example.com",
    "password": "StrongPassword@123",
    "firstName": "Sarah",
    "lastName": "Connor",
    "companyName": "Cyberdyne Systems",
    "phone": "+14155552671",
    "billingAddress": {
      "line1": "742 Evergreen Terrace",
      "city": "Springfield",
      "postalCode": "97477",
      "country": "US"
    }
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "message": "Registration successful",
    "data": {
      "user": { "id": "usr_abc123", "email": "sarah.connor@example.com", "role": "CUSTOMER" },
      "customer": { "id": "cust_xyz789", "companyName": "Cyberdyne Systems" },
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```
- **Errors:** `400 Bad Request` (Password fails regex, email missing), `409 Conflict` (Email already registered).

#### `POST /api/v1/auth/login`
- **Purpose:** User authentication for all roles.
- **Access:** Public.
- **Request Body:**
  ```json
  {
    "email": "sarah.connor@example.com",
    "password": "StrongPassword@123"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": "usr_abc123", "email": "sarah.connor@example.com", "role": "CUSTOMER", "firstName": "Sarah" },
      "customerId": "cust_xyz789",
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```
- **Errors:** `401 Unauthorized` (Invalid credentials), `403 Forbidden` (Account disabled).

#### `POST /api/v1/users/staff`
- **Purpose:** Admin-only provisioning of internal staff accounts.
- **Access:** Private (`ADMIN` only).
- **Request Body:**
  ```json
  {
    "email": "john.ops@company.com",
    "password": "TempStaffPassword@2026",
    "firstName": "John",
    "lastName": "Operator"
  }
  ```
- **Response `201 Created`:** User record created with role `STAFF`.
- **Errors:** `403 Forbidden` (Caller is not ADMIN).

#### `GET /api/v1/products` & `POST /api/v1/products`
- **Purpose:** List products / Create new catalog product.
- **Access:** `GET` (All authenticated); `POST` (`ADMIN` only).
- **POST Request Body:**
  ```json
  {
    "name": "Cloud Storage Dedicated GB",
    "code": "PRD-STORAGE-01",
    "type": "DIGITAL",
    "salesPrice": 0.1500,
    "costPrice": 0.0500,
    "variants": [
      { "variantName": "High IOPS NVMe", "sku": "PRD-STRG-NVME", "additionalPrice": 0.0500 },
      { "variantName": "Standard S3 Cold", "sku": "PRD-STRG-COLD", "additionalPrice": 0.0000 }
    ]
  }
  ```
- **Response `201 Created`:** Returns created product with populated variant array.

#### `GET /api/v1/plans` & `POST /api/v1/plans`
- **Purpose:** List subscription plans / Create new subscription plan.
- **Access:** `GET` (All authenticated); `POST` (`ADMIN` only).
- **POST Request Body:**
  ```json
  {
    "name": "Enterprise Cloud Monthly",
    "code": "PLAN-ENT-M",
    "billingFrequency": "MONTHLY",
    "basePrice": 499.0000,
    "currency": "USD",
    "minimumQuantity": 1,
    "validFrom": "2026-01-01T00:00:00Z",
    "validUntil": "2028-12-31T23:59:59Z",
    "autoCloseOnExpiry": true,
    "allowEarlyClosure": true,
    "allowPause": true,
    "allowRenewal": true
  }
  ```
- **Response `201 Created`:** Returns created plan entity.

### 4.6 Inter-Module Dependencies & Mocking Strategy
- **Outputs Provided to Others:**
  - `authenticateToken` and `requireRole` middleware used across all Express routes.
  - Foreign key target `users(id)` and `customers(id)` for Members 2, 3, 4.
  - Foreign key target `products(id)` and `plans(id)` for Members 2 and 3.
  - Currency conversion utility `convertCurrency(amount, from, to)`.
- **Local Mocking Strategy for Other Members:**
  - Member 1 provides a static mock middleware `mockAuthMiddleware.js` in `server/src/core/middleware/mockAuth.ts` that automatically injects a dummy `req.user = { id: 'usr_mock_admin', role: 'ADMIN', customerId: 'cust_mock_1' }` when `MOCK_AUTH=true` is set in `.env`.

### 4.7 Testing & Quality Assurance (Member 1)
- Unit tests for password regex validation and bcrypt salt hashing.
- Integration tests for JWT sign and verify lifecycle, ensuring expired tokens return 401.
- RBAC boundary tests ensuring `CUSTOMER` cannot hit `POST /api/v1/products` or `POST /api/v1/users/staff`.
- Data isolation tests ensuring `GET /api/v1/users` denies non-admin actors.

### 4.8 Acceptance Criteria (Member 1)
- [ ] User cannot register with password violating uppercase, lowercase, number, or special character requirements.
- [ ] Customer cannot view or modify another customer's records.
- [ ] Only users with role `ADMIN` can create `STAFF` users and create/edit `products` and `plans`.
- [ ] Product variants can be created with independent differential prices.
- [ ] Plans correctly enforce billing frequency enum constraints (`DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`).

### 4.9 Expected Deliverables & Future ZIP Packaging Structure
- Future ZIP: `MEMBER_1_AUTH_CATALOG.zip`
- Contents:
  - `client/src/modules/member1_auth/`
  - `client/src/context/AuthContext.tsx`
  - `server/src/modules/auth_catalog/`
  - `server/src/core/middleware/auth.middleware.ts`
  - `database/migrations/001_auth_catalog_schema.sql`
  - `database/seeds/001_auth_catalog_seed.sql`
  - `tests/member1/`
  - `README_MEMBER1.md` (Module runbook, standalone startup instructions)

---

## 5. Member 2 – Detailed Feature Specification
**Domain:** Quotation Management, Subscription Lifecycles, Tiered Pricing Algorithms, Usage Ingestion & Mid-Cycle Proration

### 5.1 Features & Sub-Features Owned
1. **Quotation Workflow & Conversion:**
   - Quotation templates with predefined line items and products.
   - Quote validity tracking: Start date, expiry date, status (`DRAFT`, `SENT`, `ACCEPTED`, `EXPIRED`, `CONVERTED`).
   - One-click quote-to-subscription conversion: Freezes quoted terms and creates active subscription record.
2. **Subscription Management & State Machine:**
   - Unique, human-readable subscription numbering (e.g., `SUB-202610-0042`).
   - Association with Customer, Plan, start date, end date, trial period, and payment terms (`DUE_ON_RECEIPT`, `NET_15`, `NET_30`).
   - Subscription line items: Product, Variant, Quantity, Base Unit Price, Final Line Amount.
   - Formal subscription state machine:
     - `DRAFT` -> `QUOTATION` -> `CONFIRMED` -> `ACTIVE` -> `PAUSED` -> `EXPIRED` / `CLOSED`.
   - Subscription lifecycle operations:
     - **Pause:** Halts usage billing and suspends recurring generation.
     - **Resume:** Reactivates billing anchor dates.
     - **Renew:** Extends expiry date and appends renewal contract terms.
     - **Early Close:** Immediate termination with trigger to Member 4 exit survey.
3. **Advanced Pricing Engine:**
   - **Tiered Pricing:**
     - Graduated / Slab pricing (e.g., units 1-10 @ $10/ea, units 11-50 @ $8/ea).
     - Volume / Flat-tier pricing (e.g., purchasing 25 units puts all units at $8/ea).
4. **Usage-Based Ingestion & Aggregation:**
   - Ingest timestamped consumption events: `{ subscriptionId, metricName, quantity, timestamp, idempotencyKey }`.
   - Ingestion deduplication via `idempotencyKey`.
   - Usage aggregation by billing cycle: Sum, Max, or Last value across start and end billing timestamps.
   - Delivery of finalized consumption charges to Member 3 for invoice inclusion.
5. **Mid-Cycle Subscription Upgrades & Proration Engine:**
   - Upgrading from Plan A to Plan B before the cycle renewal date.
   - Formula:
     $$\text{Credit (Unused Plan A)} = \text{Base Price}_A \times \left( \frac{\text{Days Remaining}}{\text{Total Days in Period}} \right)$$
     $$\text{Debit (New Plan B)} = \text{Base Price}_B \times \left( \frac{\text{Days Remaining}}{\text{Total Days in Period}} \right)$$
     $$\text{Prorated Adjustment Due} = \text{Debit} - \text{Credit}$$
   - Generation of explicit subscription change log and prorated line items.

### 5.2 Frontend Architecture (Member 2)
- **Directory:** `client/src/modules/member2_subs/`
- **Pages & Views:**
  - `QuotationsListPage.tsx`: Filterable list of quotations (Draft, Sent, Converted).
  - `QuotationBuilderPage.tsx`: Interactive quote builder with dynamic product picker and validity calendar.
  - `SubscriptionsListPage.tsx`: Grid with real-time status badges (`ACTIVE`, `PAUSED`, etc.).
  - `SubscriptionDetailPage.tsx`: Detailed view with line items, current billing cycle dates, pause/resume buttons, and upgrade trigger.
  - `SubscriptionUpgradeModal.tsx`: Real-time proration preview calculator showing credit, debit, and immediate balance due.
  - `UsageDashboardView.tsx`: Line and bar chart of customer usage consumption events over current cycle.
  - `TieredPricingConfigModal.tsx`: Visual bracket builder for graduated and volume pricing.
- **State Management & Hooks:**
  - `useSubscriptionLifecycle`: Hook encapsulating transitions (`pause`, `resume`, `cancel`, `upgrade`).
  - `useProrationPreview`: Hook invoking calculation endpoint for instant UI updates during plan selection.

### 5.3 Backend Architecture (Member 2)
- **Directory:** `server/src/modules/subscriptions/`
- **Controllers & Services:**
  - `quotation.controller.ts` & `quotation.service.ts`: Quote generation and conversion logic.
  - `subscription.controller.ts` & `subscription.service.ts`: Core lifecycle and state transitions.
  - `pricing.service.ts`: Tiered and graduated pricing calculator.
  - `usage.controller.ts` & `usage.service.ts`: Consumption event ingestion with atomic insertion.
  - `proration.service.ts`: Exact day-count proration financial math with integer/cents rounding guards.
- **Queue Handlers (BullMQ / Cron):**
  - `usageAggregationJob.ts`: Scheduled worker aggregating cycle consumption at midnight on cycle close.

### 5.4 Database Schema & Table Ownership (Member 2)

```sql
-- Table: quotations (Owned by Member 2)
CREATE TABLE quotations (
    id VARCHAR(36) PRIMARY KEY,
    quotation_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id VARCHAR(36) NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED', 'CONVERTED')),
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    subtotal NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    created_by VARCHAR(36) REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: quotation_lines (Owned by Member 2)
CREATE TABLE quotation_lines (
    id VARCHAR(36) PRIMARY KEY,
    quotation_id VARCHAR(36) NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id VARCHAR(36) NOT NULL REFERENCES products(id),
    variant_id VARCHAR(36) REFERENCES product_variants(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(14, 4) NOT NULL,
    total_amount NUMERIC(14, 4) NOT NULL
);

-- Table: subscriptions (Owned by Member 2)
CREATE TABLE subscriptions (
    id VARCHAR(36) PRIMARY KEY,
    subscription_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. SUB-202610-0001
    customer_id VARCHAR(36) NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    plan_id VARCHAR(36) NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CLOSED')),
    payment_terms VARCHAR(50) DEFAULT 'DUE_ON_RECEIPT', -- DUE_ON_RECEIPT, NET_15, NET_30
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    expiry_date TIMESTAMP WITH TIME ZONE,
    auto_renew BOOLEAN DEFAULT TRUE,
    currency VARCHAR(3) DEFAULT 'USD',
    quotation_id VARCHAR(36) REFERENCES quotations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Table: subscription_lines (Owned by Member 2)
CREATE TABLE subscription_lines (
    id VARCHAR(36) PRIMARY KEY,
    subscription_id VARCHAR(36) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    product_id VARCHAR(36) NOT NULL REFERENCES products(id),
    variant_id VARCHAR(36) REFERENCES product_variants(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(14, 4) NOT NULL,
    line_total NUMERIC(14, 4) NOT NULL
);

-- Table: pricing_tiers (Owned by Member 2)
CREATE TABLE pricing_tiers (
    id VARCHAR(36) PRIMARY KEY,
    plan_id VARCHAR(36) REFERENCES plans(id) ON DELETE CASCADE,
    product_id VARCHAR(36) REFERENCES products(id) ON DELETE CASCADE,
    model_type VARCHAR(20) NOT NULL CHECK (model_type IN ('GRADUATED', 'VOLUME')),
    min_quantity INTEGER NOT NULL DEFAULT 0,
    max_quantity INTEGER, -- NULL represents infinity
    unit_price NUMERIC(14, 4) NOT NULL
);

-- Table: usage_records (Owned by Member 2)
CREATE TABLE usage_records (
    id VARCHAR(36) PRIMARY KEY,
    subscription_id VARCHAR(36) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    billed BOOLEAN DEFAULT FALSE,
    invoice_id VARCHAR(36), -- Attached by Member 3 upon invoicing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_usage_sub_period ON usage_records(subscription_id, timestamp, billed);

-- Table: subscription_changes (Owned by Member 2)
CREATE TABLE subscription_changes (
    id VARCHAR(36) PRIMARY KEY,
    subscription_id VARCHAR(36) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL, -- UPGRADE, DOWNGRADE, PAUSE, RESUME
    previous_plan_id VARCHAR(36) REFERENCES plans(id),
    new_plan_id VARCHAR(36) REFERENCES plans(id),
    prorated_credit NUMERIC(14, 4) DEFAULT 0.0000,
    prorated_debit NUMERIC(14, 4) DEFAULT 0.0000,
    net_adjustment NUMERIC(14, 4) DEFAULT 0.0000,
    effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 5.5 REST API Specifications (Member 2)

#### `POST /api/v1/subscriptions`
- **Purpose:** Create a confirmed subscription.
- **Access:** Private (`ADMIN`, `STAFF`).
- **Request Body:**
  ```json
  {
    "customerId": "cust_xyz789",
    "planId": "plan_cloud_01",
    "paymentTerms": "NET_30",
    "startDate": "2026-11-01T00:00:00Z",
    "lines": [
      { "productId": "prd_storage_01", "variantId": "var_nvme", "quantity": 10 }
    ]
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "data": {
      "subscription": {
        "id": "sub_99a88b",
        "subscriptionNumber": "SUB-202611-0001",
        "status": "CONFIRMED",
        "currentPeriodStart": "2026-11-01T00:00:00Z",
        "currentPeriodEnd": "2026-12-01T00:00:00Z"
      }
    }
  }
  ```

#### `POST /api/v1/subscriptions/:id/upgrade`
- **Purpose:** Execute a mid-cycle plan upgrade with automated proration math.
- **Access:** Private (`ADMIN`, `STAFF`, `CUSTOMER` for own sub).
- **Request Body:**
  ```json
  {
    "newPlanId": "plan_cloud_enterprise",
    "effectiveImmediately": true
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "subscriptionId": "sub_99a88b",
      "status": "ACTIVE",
      "proration": {
        "daysRemaining": 15,
        "totalDaysInCycle": 30,
        "previousPlanCredit": 249.5000,
        "newPlanDebit": 499.0000,
        "netAmountDue": 249.5000,
        "proratedAdjustmentId": "sub_chg_7761"
      }
    }
  }
  ```

#### `POST /api/v1/usage/events`
- **Purpose:** Ingest raw consumption events for usage-based billing.
- **Access:** Private (`ADMIN`, `STAFF`, API Integration Keys).
- **Request Body:**
  ```json
  {
    "subscriptionId": "sub_99a88b",
    "metricName": "api_calls_count",
    "quantity": 1500,
    "timestamp": "2026-11-15T14:32:00Z",
    "idempotencyKey": "evt_20261115_api_00129"
  }
  ```
- **Response `202 Accepted`:** `{ "success": true, "message": "Usage event ingested" }`.

### 5.6 Inter-Module Dependencies & Mocking Strategy
- **Depends on:**
  - Member 1: User & Customer identity (`customers.id`), Product & Plan records (`products.id`, `plans.id`), Auth middleware.
- **Provides to Others:**
  - Active subscription feeds to Member 3 for invoice generation.
  - Prorated adjustment lines to Member 3 for debit/credit invoicing.
  - Subscription cancellation events to Member 4 for exit survey triggering.
  - Active subscription count and metrics to Member 4 dashboard.
- **Mock Interfaces for Member 2:**
  - Can run completely detached from Member 3 by outputting mock subscription objects and asserting proration formulas against predefined unit test vectors.

### 5.7 Testing & Quality Assurance (Member 2)
- Unit tests validating Graduated vs Volume pricing calculations against rigorous test vectors.
- Mathematical assertion tests on proration day counts, leap years, and month-end date transitions.
- Idempotency test verifying that submitting the same `idempotencyKey` on usage ingestion rejects duplicates with 409 or silently ignores.
- State machine transition tests verifying that a `CLOSED` subscription cannot transition to `ACTIVE`.

### 5.8 Acceptance Criteria (Member 2)
- [ ] Subscription numbering is strictly unique, immutable, and formatted correctly.
- [ ] Tiered pricing correctly computes graduated brackets without rounding discrepancies.
- [ ] Mid-month upgrade calculates unspent credit and charges debit with day-accurate precision.
- [ ] Duplicate usage event submissions with identical idempotency keys are prevented.
- [ ] Subscription lifecycle operations (`PAUSE`, `RESUME`, `CLOSE`) enforce valid states.

### 5.9 Expected Deliverables & Future ZIP Packaging Structure
- Future ZIP: `MEMBER_2_SUBSCRIPTIONS.zip`
- Contents:
  - `client/src/modules/member2_subs/`
  - `server/src/modules/subscriptions/`
  - `database/migrations/002_subscriptions_schema.sql`
  - `database/seeds/002_subscriptions_seed.sql`
  - `tests/member2/`
  - `README_MEMBER2.md`

---

## 6. Member 3 – Detailed Feature Specification
**Domain:** Recurring Billing Engine, Invoicing Lifecycle, Tax Rules, Discount Mechanisms, Gateway Integration & Dunning Retries

### 6.1 Features & Sub-Features Owned
1. **Recurring Billing Engine & Invoicing:**
   - Automated recurring invoice generation triggered by subscription billing anchor dates.
   - Idempotent Billing Engine: Unique billing run locks preventing double invoices for the same cycle (`UNIQUE(subscription_id, billing_period_start)`).
   - Skip-Proof Scheduler: Catch-up worker identifying and billing any past-due subscription schedules missed during system downtime.
   - Invoicing lifecycle state machine:
     - `DRAFT` -> `CONFIRMED` -> `PAID` / `OVERDUE` / `CANCELLED`.
   - Snapshot preservation: Freezes customer billing address, tax rates, and product prices at the exact moment of invoice confirmation.
   - Dynamic Invoice PDF generation and email delivery.
2. **Tax Engine:**
   - Admin-configurable tax rules (e.g., GST 18%, VAT 20%, State Sales Tax 6.5%).
   - Calculation engine supporting percentage, compound, and exempt rules.
   - Application of taxes at line-item level with aggregated tax summary on final invoice.
3. **Discount Management & Atomic Validation:**
   - Admin-only discount creation: Fixed cash discount or percentage discount.
   - Eligibility rules: Minimum order purchase amount, minimum line item quantity, effective date range.
   - Usage limits: Maximum global redemptions and maximum redemptions per customer.
   - Scope: Product-specific discounts vs global subscription-wide discounts.
   - Concurrency-safe, atomic discount redemption decrementing (`UPDATE discounts SET current_redemptions = current_redemptions + 1 WHERE id = $1 AND current_redemptions < max_redemptions`).
4. **Payment Processing & Gateway Webhooks:**
   - Manual payment recording (cash, bank wire, check) with transaction reference and notes.
   - Payment-to-invoice reconciliation ledger: supports partial payments and multi-payment allocations.
   - Online Payment Gateway Integration: Stripe / Razorpay simulated or test API.
   - Secure webhook processing with cryptographic HMAC SHA-256 signature verification.
   - Idempotency guard on webhook transactions to prevent double credit.
5. **Automated Smart Dunning & Retry Engine:**
   - Dunning schedule: Automated retry attempts on failed card charges (e.g., Day 1, Day 3, Day 5, Day 7).
   - Retry tracking: Logs attempt count, gateway error code, and outcome.
   - Customer notification dispatch on failure with dynamic payment update link.
   - Escalation trigger: Automatically marks subscription as `SUSPENDED` and triggers Member 4 risk alert after 4 consecutive failures.

### 6.2 Frontend Architecture (Member 3)
- **Directory:** `client/src/modules/member3_billing/`
- **Pages & Views:**
  - `InvoicesListPage.tsx`: Invoice register with status filters (`PAID`, `OVERDUE`, `DRAFT`), date ranges, and PDF download buttons.
  - `InvoiceDetailPage.tsx`: Detailed invoice view with line items, tax breakdowns, discount tags, payment history, and manual payment modal.
  - `TaxRulesConfigPage.tsx` (Admin only): Tax rule builder and rate manager.
  - `DiscountsConfigPage.tsx` (Admin only): Discount coupon creator with usage limits and eligibility rules.
  - `PaymentsHistoryPage.tsx`: Transaction audit trail with payment methods, gateway refs, and reconciliation statuses.
  - `PaymentCheckoutModal.tsx`: Customer payment window with test card input / simulated gateway gateway flow.
- **State Management & Utilities:**
  - `useInvoiceManager`: Invoicing state, confirmation, cancellation, and download actions.
  - `formatCurrency`: Monetary display utility honoring ISO codes.

### 6.3 Backend Architecture (Member 3)
- **Directory:** `server/src/modules/billing/`
- **Controllers & Services:**
  - `invoice.controller.ts` & `invoice.service.ts`: Invoicing CRUD, lifecycle transitions, and PDF generation (using `pdfkit` or `puppeteer`).
  - `tax.service.ts`: Tax rule matcher and calculation engine.
  - `discount.service.ts`: Coupon validator and atomic redemption processor.
  - `payment.controller.ts` & `payment.service.ts`: Manual recording and allocation ledger.
  - `gateway.controller.ts` & `gateway.service.ts`: Stripe/Razorpay charge initiation and signature-verified webhook handler.
- **Background Workers (BullMQ / Redis):**
  - `recurringBillingWorker.ts`: Nightly cron / interval queue evaluating active subscriptions due for billing.
  - `dunningRetryWorker.ts`: Scheduled worker retrying failed invoices based on exponential backoff intervals.

### 6.4 Database Schema & Table Ownership (Member 3)

```sql
-- Table: tax_rules (Owned by Member 3)
CREATE TABLE tax_rules (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL, -- e.g. VAT Standard, GST 18
    rate_percentage NUMERIC(6, 4) NOT NULL, -- e.g. 18.0000
    country VARCHAR(2), -- Optional geographic constraint
    state VARCHAR(100),
    is_compound BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: discounts (Owned by Member 3)
CREATE TABLE discounts (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('FIXED', 'PERCENTAGE')),
    value NUMERIC(14, 4) NOT NULL, -- Dollar value or Percentage
    min_purchase_amount NUMERIC(14, 4) DEFAULT 0.0000,
    min_quantity INTEGER DEFAULT 0,
    max_redemptions INTEGER NOT NULL,
    current_redemptions INTEGER NOT NULL DEFAULT 0,
    max_per_customer INTEGER DEFAULT 1,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    product_id VARCHAR(36) REFERENCES products(id), -- Nullable for global discounts
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_discounts_code ON discounts(code);

-- Table: invoices (Owned by Member 3)
CREATE TABLE invoices (
    id VARCHAR(36) PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. INV-202611-0001
    subscription_id VARCHAR(36) NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
    customer_id VARCHAR(36) NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'CONFIRMED', 'PAID', 'OVERDUE', 'CANCELLED')),
    billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    tax_amount NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    discount_amount NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    total_amount NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    amount_paid NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    currency VARCHAR(3) DEFAULT 'USD',
    customer_snapshot JSONB NOT NULL, -- Frozen name, address, tax ID at invoice time
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sub_billing_cycle UNIQUE(subscription_id, billing_period_start) -- Duplicate Billing Prevention
);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status_due ON invoices(status, due_date);

-- Table: invoice_lines (Owned by Member 3)
CREATE TABLE invoice_lines (
    id VARCHAR(36) PRIMARY KEY,
    invoice_id VARCHAR(36) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id VARCHAR(36) NOT NULL REFERENCES products(id),
    description VARCHAR(255) NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL,
    unit_price NUMERIC(14, 4) NOT NULL,
    tax_rate NUMERIC(6, 4) DEFAULT 0.0000,
    tax_amount NUMERIC(14, 4) DEFAULT 0.0000,
    discount_amount NUMERIC(14, 4) DEFAULT 0.0000,
    line_total NUMERIC(14, 4) NOT NULL
);

-- Table: payments (Owned by Member 3)
CREATE TABLE payments (
    id VARCHAR(36) PRIMARY KEY,
    payment_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. PAY-202611-0001
    invoice_id VARCHAR(36) NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    customer_id VARCHAR(36) NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    amount NUMERIC(14, 4) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50) NOT NULL, -- CREDIT_CARD, BANK_WIRE, CASH, STRIPE
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    transaction_reference VARCHAR(255) UNIQUE, -- Gateway Transaction ID or Bank Reference
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);

-- Table: payment_retries (Owned by Member 3 - Dunning)
CREATE TABLE payment_retries (
    id VARCHAR(36) PRIMARY KEY,
    invoice_id VARCHAR(36) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    attempt_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    next_retry_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'ABANDONED')),
    error_message TEXT
);
```

### 6.5 REST API Specifications (Member 3)

#### `POST /api/v1/invoices/generate-cycle`
- **Purpose:** Idempotent billing runner that processes all active subscriptions due for invoicing.
- **Access:** Private (`ADMIN` or Internal Worker Token).
- **Request Body:** `{ "asOfDate": "2026-11-01T00:00:00Z" }`
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "subscriptionsEvaluated": 142,
      "invoicesCreated": 38,
      "invoicesSkippedAlreadyBilled": 104,
      "totalBilledAmount": 18450.0000
    }
  }
  ```

#### `POST /api/v1/invoices/:id/confirm`
- **Purpose:** Freezes draft invoice, applies taxes/discounts, locks customer snapshot, and transitions status to `CONFIRMED`.
- **Access:** Private (`ADMIN`, `STAFF`).
- **Response `200 OK`:** Returns confirmed invoice object ready for dispatch.

#### `POST /api/v1/payments`
- **Purpose:** Record manual payment against an invoice.
- **Access:** Private (`ADMIN`, `STAFF`).
- **Request Body:**
  ```json
  {
    "invoiceId": "inv_12345",
    "amount": 499.0000,
    "paymentMethod": "BANK_WIRE",
    "paymentDate": "2026-11-05T10:15:00Z",
    "transactionReference": "WIRE-REF-998877",
    "notes": "Payment confirmed in Chase operating account"
  }
  ```
- **Response `201 Created`:** Returns created payment record and updates `invoice.amount_paid` and sets status to `PAID` if balance is zero.

#### `POST /api/v1/payments/webhook`
- **Purpose:** Asynchronous payment gateway notification (Stripe/Razorpay).
- **Access:** Public endpoint guarded by Cryptographic Signature Header (`Stripe-Signature`).
- **Headers:** `Stripe-Signature: t=1614555,v1=abc123hash...`
- **Request Body:** Raw Gateway Event JSON.
- **Response `200 OK`:** `{ "received": true }`.
- **Errors:** `400 Bad Request` (Signature mismatch or invalid timestamp).

### 6.6 Inter-Module Dependencies & Mocking Strategy
- **Depends on:**
  - Member 1: User & Customer records, Base Auth & RBAC middleware.
  - Member 2: Active subscriptions, line items, and usage records to bill.
- **Provides to Others:**
  - Invoice status changes (`PAID`, `OVERDUE`) and payment counts to Member 4 for reports and fraud monitoring.
  - Failed payment attempt events to Member 4 for account health score degradation.
- **Mock Interfaces for Member 3:**
  - Includes a `mockSubscriptionsProvider.ts` in tests that provides predefined mock subscription line items, allowing invoice generation to be tested without running Member 2's subscription service.

### 6.7 Testing & Quality Assurance (Member 3)
- Duplicate billing prevention tests: Assert that calling the billing generator multiple times in a row never produces duplicate invoices for the same cycle.
- Financial accuracy tests: Multi-item invoices with combination percentage discounts and compound taxes tested for exact cent precision.
- Webhook signature security tests: Invalid signatures immediately rejected with 400/401.
- Concurrency test: 10 parallel threads attempting to redeem a discount coupon with only 1 redemption remaining; exactly 1 succeeds and 9 fail with `400 Discount Limit Reached`.

### 6.8 Acceptance Criteria (Member 3)
- [ ] Database constraint `uq_sub_billing_cycle` strictly prevents duplicate cycle invoices.
- [ ] Confirmed invoices freeze an immutable JSON snapshot of customer name and billing address.
- [ ] Discount redemption is atomic and cannot exceed defined usage limits under high concurrency.
- [ ] Gateway webhooks verify HMAC signatures before updating any payment status.
- [ ] Dunning worker retries failed payments according to the configured schedule and records all attempts.

### 6.9 Expected Deliverables & Future ZIP Packaging Structure
- Future ZIP: `MEMBER_3_BILLING_PAYMENTS.zip`
- Contents:
  - `client/src/modules/member3_billing/`
  - `server/src/modules/billing/`
  - `database/migrations/003_billing_schema.sql`
  - `database/seeds/003_billing_seed.sql`
  - `tests/member3/`
  - `README_MEMBER3.md`

---

## 7. Member 4 – Detailed Feature Specification
**Domain:** Executive Analytics, Revenue BI, Rule-Based Fraud Detection, Customer Health Scoring, Audit Logs & Automated Exit Surveys

### 7.1 Features & Sub-Features Owned
1. **Executive Dashboard & Revenue Reporting:**
   - Real-time KPI widgets:
     - Active Subscriptions count & net churn rate.
     - Monthly Recurring Revenue (MRR) and Annual Recurring Revenue (ARR).
     - Total Cash Collected vs Total Receivables Outstanding.
     - Aging Overdue Receivables Breakdown (0-30 days, 31-60 days, 60+ days).
   - Dynamic Multi-Dimensional Filtering: Date range picker (Today, 7D, 30D, YTD, Custom), currency selector, plan filters.
   - Export reports to CSV and Excel format.
2. **Account Health Scoring & Churn Risk Engine:**
   - Composite Health Score (0 to 100) computed dynamically per customer:
     $$\text{Health Score} = 100 - (w_1 \cdot \text{Failed Payments}) - (w_2 \cdot \text{Overdue Days}) - (w_3 \cdot \text{Usage Decline \%}) - (w_4 \cdot \text{Ticket Escalations})$$
   - Risk categorization:
     - **Healthy** (80 - 100): Green status.
     - **Warning** (60 - 79): Yellow status; automated retention alert.
     - **At-Risk** (40 - 59): Orange status; operations team alert.
     - **Critical** (0 - 39): Red status; automated account manager escalation.
   - Detailed explanatory breakdown explaining the score rationale to the admin.
3. **Multi-Vector Fraud Detection Engine:**
   - Real-time transaction and behavioral rule-based fraud evaluator analyzing 8 distinct risk vectors:
     1. *Multiple Account Abuse:* Same IP address or credit card fingerprint registering multiple accounts within a 24-hour window.
     2. *Discount Code Abuse:* Repeated registration and discount coupon application from similar sub-addressed emails (e.g. `user+1@gmail.com`).
     3. *Velocity Card Testing:* > 3 failed card authorization attempts within 10 minutes.
     4. *Subscription Creation/Churn Cycling:* Creation and immediate cancellation within < 2 hours repeatedly.
     5. *Account Takeover Anomalies:* Login from novel geolocation or rapid IP switching.
     6. *Duplicate Transaction Floods:* Identical payment submissions within a 60-second window.
     7. *Refund & Chargeback Abuse:* Customer historical refund ratio exceeding 20% of gross purchases.
     8. *Unauthorized Status Tampering:* Non-admin attempts to bypass payment steps or modify invoice balances.
   - Risk Scoring & Action: Evaluates events to `LOW`, `MEDIUM`, or `HIGH` risk; raises high-priority fraud alerts with dedicated Admin review queue.
   - Optional ML Microservice Integration: Defines clean REST hook for Python/FastAPI ML container.
4. **Immutable Enterprise Audit Logging:**
   - Centralized Express audit interceptor tracking all mutating operations (`POST`, `PUT`, `PATCH`, `DELETE`).
   - Captures Actor (`userId`, `role`, `ipAddress`), Action, Entity Type, Entity ID, Timestamp, Previous State, and New State.
   - Security: Database permissions restrict `audit_logs` table to `INSERT` and `SELECT` only; no updates or deletions permitted.
   - Admin Audit Log Viewer with JSON diff inspection.
5. **Automated Exit Surveys & Churn Insights:**
   - Automated survey modal triggered upon subscription cancellation or early closure.
   - Collects structured cancellation reasons (e.g., *Too expensive*, *Missing features*, *Switching to competitor*, *Poor support*) and optional qualitative feedback.
   - Aggregated Churn Intelligence dashboard showing top cancellation drivers over time.
6. **Shared Notification Infrastructure:**
   - Shared mailer abstraction (`sendEmail(to, template, context)`) and notification event ledger consumed by all members.

### 7.2 Frontend Architecture (Member 4)
- **Directory:** `client/src/modules/member4_ops/`
- **Pages & Views:**
  - `AdminDashboardPage.tsx`: Executive command center with Recharts / Chart.js widgets for MRR, active subs, cash flow, and aging debt.
  - `FraudMonitoringDesk.tsx`: List of active fraud alerts with severity badges (`CRITICAL`, `WARNING`), investigation drawer, and action buttons (`Dismiss`, `Suspend Account`).
  - `AccountHealthPage.tsx`: Searchable customer list sorted by health score with visual risk indicators and score breakdown modal.
  - `AuditLogViewerPage.tsx`: Filterable security ledger with date range, actor, entity type, and expandable JSON delta viewer.
  - `ExitSurveyModal.tsx`: Clean customer-facing survey rendered during cancellation workflow.
  - `ChurnAnalyticsPage.tsx`: Visual breakdown of cancellation reasons and customer sentiment trends.
- **Components & Widgets:**
  - `MetricCard.tsx`: Metric widget with percentage trend indicators.
  - `JsonDiffViewer.tsx`: Component highlighting before/after state changes in audit logs.

### 7.3 Backend Architecture (Member 4)
- **Directory:** `server/src/modules/operations/`
- **Controllers & Services:**
  - `dashboard.controller.ts` & `dashboard.service.ts`: Optimized SQL aggregation queries for MRR, ARR, and cash collections.
  - `fraud.controller.ts` & `fraud.service.ts`: 8-rule evaluation engine and alert dispatcher.
  - `health.service.ts`: Account health calculator and batch evaluation cron.
  - `audit.controller.ts` & `audit.service.ts`: Query interface for immutable audit logs.
  - `survey.controller.ts` & `survey.service.ts`: Exit survey submission and churn analytics aggregator.
- **Middleware Exported for Team:**
  - `auditLogger`: Global Express middleware intercepting controller responses and logging mutations to the database.

### 7.4 Database Schema & Table Ownership (Member 4)

```sql
-- Table: audit_logs (Owned by Member 4 - Strictly Append-Only)
CREATE TABLE audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    actor_id VARCHAR(36), -- references users(id), NULL for system background jobs
    actor_role VARCHAR(20),
    ip_address VARCHAR(45),
    action VARCHAR(100) NOT NULL, -- e.g. PRODUCT_UPDATE, INVOICE_CONFIRM
    entity_type VARCHAR(50) NOT NULL, -- e.g. invoices, subscriptions, products
    entity_id VARCHAR(36) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- Table: fraud_alerts (Owned by Member 4)
CREATE TABLE fraud_alerts (
    id VARCHAR(36) PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    risk_score INTEGER NOT NULL, -- 0 to 100
    target_user_id VARCHAR(36) REFERENCES users(id),
    target_customer_id VARCHAR(36) REFERENCES customers(id),
    details JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED')),
    reviewed_by VARCHAR(36) REFERENCES users(id),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_fraud_status_risk ON fraud_alerts(status, risk_level);

-- Table: account_health_scores (Owned by Member 4)
CREATE TABLE account_health_scores (
    id VARCHAR(36) PRIMARY KEY,
    customer_id VARCHAR(36) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    health_score INTEGER NOT NULL CHECK (health_score BETWEEN 0 AND 100),
    risk_category VARCHAR(20) NOT NULL CHECK (risk_category IN ('HEALTHY', 'WARNING', 'AT_RISK', 'CRITICAL')),
    score_breakdown JSONB NOT NULL, -- Detailed sub-scores for payments, usage, overdue
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_health_customer ON account_health_scores(customer_id);

-- Table: exit_surveys (Owned by Member 4)
CREATE TABLE exit_surveys (
    id VARCHAR(36) PRIMARY KEY,
    subscription_id VARCHAR(36) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    customer_id VARCHAR(36) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    cancellation_reason VARCHAR(100) NOT NULL,
    competitor_name VARCHAR(100),
    feedback_text TEXT,
    satisfaction_score INTEGER CHECK (satisfaction_score BETWEEN 1 AND 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: system_notifications (Owned by Member 4 - Shared Mailer Ledger)
CREATE TABLE system_notifications (
    id VARCHAR(36) PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SENT' CHECK (status IN ('QUEUED', 'SENT', 'FAILED')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 7.5 REST API Specifications (Member 4)

#### `GET /api/v1/analytics/dashboard-summary`
- **Purpose:** Consolidated KPI metrics for admin executive dashboard.
- **Access:** Private (`ADMIN` only).
- **Query Params:** `?startDate=2026-10-01&endDate=2026-10-31&currency=USD`
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "activeSubscriptions": 1420,
      "mrr": 58490.00,
      "arr": 701880.00,
      "cashCollected": 54200.00,
      "outstandingReceivables": 4290.00,
      "overdueReceivables": 1150.00,
      "churnRatePercentage": 1.45
    }
  }
  ```

#### `GET /api/v1/fraud/alerts` & `POST /api/v1/fraud/alerts/:id/resolve`
- **Purpose:** Retrieve fraud alerts / Review and resolve a flagged incident.
- **Access:** Private (`ADMIN`, `STAFF`).
- **Resolve Request Body:**
  ```json
  {
    "action": "RESOLVED",
    "notes": "Verified billing address with customer via phone call. Legitimate order."
  }
  ```

#### `GET /api/v1/audit/logs`
- **Purpose:** Security audit log viewer.
- **Access:** Private (`ADMIN` only).
- **Query Params:** `?entityType=invoices&actorId=usr_123&page=1&limit=20`

#### `POST /api/v1/surveys/exit`
- **Purpose:** Ingest customer exit survey upon subscription cancellation.
- **Access:** Private (`CUSTOMER` owning subscription, or `ADMIN`).
- **Request Body:**
  ```json
  {
    "subscriptionId": "sub_99a88b",
    "cancellationReason": "Switching to alternative",
    "competitorName": "Chargebee",
    "feedbackText": "Needed automated tax integration for Latin America.",
    "satisfactionScore": 3
  }
  ```
- **Response `201 Created`:** `{ "success": true, "message": "Exit survey recorded" }`.

### 7.6 Inter-Module Dependencies & Mocking Strategy
- **Depends on:**
  - Member 1: User authentication, customer metadata, and activity events.
  - Member 2: Subscription status changes and cancellation events.
  - Member 3: Invoice records, overdue statuses, and payment failure events.
- **Provides to Others:**
  - Shared `auditLogger` middleware to record data mutations across all modules.
  - Shared `notificationService` to dispatch emails.
  - Fraud check hook `evaluateTransactionFraud(payload)` that Member 3 can call before processing payments.
- **Mock Interfaces for Member 4:**
  - Member 4 creates database seed scripts populated with 50 fake subscriptions, 100 fake invoices, and 200 usage logs, enabling complete analytics and health score development without waiting for live production traffic.

### 7.7 Testing & Quality Assurance (Member 4)
- Unit tests for each of the 8 fraud detection rules, validating boundary triggers.
- Analytics calculation verification comparing raw SQL sums with dashboard output.
- Security tests proving that database user grants block `DELETE` or `UPDATE` queries on `audit_logs`.
- Exit survey submission tests asserting customer ownership constraints.

### 7.8 Acceptance Criteria (Member 4)
- [ ] Admin dashboard renders all key financial widgets (MRR, ARR, Cash, Overdue) with sub-second query response.
- [ ] Fraud engine accurately catches rapid failed card attempts and raises high-severity alerts.
- [ ] Audit logs record actor, timestamp, and accurate JSON before/after state diffs for all data mutations.
- [ ] Account health algorithm produces consistent scores and accurately categorizes risk levels.
- [ ] Exit surveys are recorded and aggregated into churn analytics charts.

### 7.9 Expected Deliverables & Future ZIP Packaging Structure
- Future ZIP: `MEMBER_4_OPERATIONS_ANALYTICS.zip`
- Contents:
  - `client/src/modules/member4_ops/`
  - `server/src/modules/operations/`
  - `server/src/core/middleware/audit.middleware.ts`
  - `database/migrations/004_operations_schema.sql`
  - `database/seeds/004_operations_seed.sql`
  - `tests/member4/`
  - `README_MEMBER4.md`

---

## 8. Frontend Architecture & Shared UI Design System

To ensure UI visual cohesion while preserving module independence, the frontend implements a strict Design System and Layout hierarchy:

```
client/src/
├── components/ui/              # Pure Shared Components (Owned: Member 1, Contributed: All)
│   ├── Button.tsx              # Primary, Secondary, Danger, Ghost variants
│   ├── Input.tsx               # Text, Number, Password with error states
│   ├── Select.tsx              # Accessible searchable select dropdown
│   ├── Modal.tsx               # Accessible dialog with overlay and focus trap
│   ├── DataTable.tsx           # Sortable, paginated table with empty states
│   ├── Badge.tsx               # Status badges (Green, Yellow, Red, Blue, Gray)
│   └── Card.tsx                # Standard container with header and shadow
├── layouts/
│   ├── AppLayout.tsx           # Admin/Staff portal frame with sidebar and header
│   ├── AuthLayout.tsx          # Centered card layout for login/register
│   └── CustomerLayout.tsx      # Simplified self-service portal for subscribers
```

### Shared UI Rules & Boundaries:
1. **Component Immutability:** Shared UI components in `components/ui/` cannot be modified by individual members without team consensus.
2. **Isolation:** Member-specific components (e.g., `QuotationBuilder`, `InvoiceDetail`) must remain inside their dedicated module folder (`client/src/modules/memberX_*/`).
3. **State Management:**
   - Global authentication state is maintained via `AuthContext.tsx`.
   - Server state caching and invalidation is handled via standard Axios wrappers or TanStack Query.
   - Form state is managed via React Hook Form with Zod validation schemas.

---

## 9. Backend Architecture & Modular Monolith Standards

The Express backend strictly enforces the **Service-Repository Pattern** with uniform response envelopes and centralized error handling:

### 9.1 Standard API Response Envelope
Every endpoint returns a consistent JSON payload:

```json
// Success Response
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "totalRecords": 100,
    "totalPages": 5
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Subscription with ID sub_123 does not exist",
    "details": [ ... ]
  }
}
```

### 9.2 Centralized Error Hierarchy
All errors inherit from a custom `AppError` base class:
- `BadRequestError` (400) - Validation and malformed inputs.
- `UnauthorizedError` (401) - Missing or invalid JWT.
- `ForbiddenError` (403) - Insufficient RBAC role permissions.
- `NotFoundError` (404) - Resource does not exist.
- `ConflictError` (409) - Unique constraint violation (e.g. duplicate email, idempotency collision).
- `UnprocessableEntityError` (422) - Domain rule violations (e.g. insufficient quota).

---

## 10. Complete Database Ownership & Schema Matrix

### 10.1 Global Database Ownership Table

| Table Name | Owning Member | Reading / Consuming Members | Primary Key | Critical Foreign Keys | High-Impact Constraints & Indexes |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `users` | **Member 1** | Mem 2, 3, 4 | `id (UUID)` | None | `UNIQUE(email)`, Index on `role` |
| `customers` | **Member 1** | Mem 2, 3, 4 | `id (UUID)` | `user_id -> users(id)` | `UNIQUE(user_id)` |
| `products` | **Member 1** | Mem 2, 3, 4 | `id (UUID)` | None | `UNIQUE(code)` |
| `product_variants` | **Member 1** | Mem 2, 3 | `id (UUID)` | `product_id -> products(id)` | `UNIQUE(sku)` |
| `plans` | **Member 1** | Mem 2, 3, 4 | `id (UUID)` | None | `UNIQUE(code)` |
| `currencies` | **Member 1** | Mem 2, 3 | `code (CHAR 3)` | None | `CHECK (exchange_rate_to_base > 0)` |
| `quotations` | **Member 2** | Mem 1, 3 | `id (UUID)` | `customer_id -> customers(id)` | `UNIQUE(quotation_number)` |
| `quotation_lines`| **Member 2** | Mem 3 | `id (UUID)` | `quotation_id`, `product_id` | Foreign Key cascade |
| `subscriptions` | **Member 2** | Mem 3, 4 | `id (UUID)` | `customer_id`, `plan_id` | `UNIQUE(subscription_number)` |
| `subscription_lines`|**Member 2** | Mem 3 | `id (UUID)` | `subscription_id`, `product_id`| Line item references |
| `pricing_tiers` | **Member 2** | Mem 1, 3 | `id (UUID)` | `plan_id`, `product_id` | `CHECK (min_quantity >= 0)` |
| `usage_records` | **Member 2** | Mem 3, 4 | `id (UUID)` | `subscription_id` | `UNIQUE(idempotency_key)` |
| `subscription_changes`|**Member 2**| Mem 3, 4 | `id (UUID)` | `subscription_id`, `plans` | Change audit tracking |
| `tax_rules` | **Member 3** | Mem 2 | `id (UUID)` | None | `CHECK (rate_percentage >= 0)` |
| `discounts` | **Member 3** | Mem 2 | `id (UUID)` | `product_id` (nullable) | `UNIQUE(code)`, Atomic decrement |
| `invoices` | **Member 3** | Mem 2, 4 | `id (UUID)` | `subscription_id`, `customer_id`| `UNIQUE(subscription_id, billing_period_start)` |
| `invoice_lines` | **Member 3** | Mem 4 | `id (UUID)` | `invoice_id`, `product_id` | Historical snapshot integrity |
| `payments` | **Member 3** | Mem 4 | `id (UUID)` | `invoice_id`, `customer_id` | `UNIQUE(transaction_reference)` |
| `payment_retries`| **Member 3**| Mem 4 | `id (UUID)` | `invoice_id` | Dunning schedule index |
| `audit_logs` | **Member 4** | None (Admin view)| `id (UUID)` | `actor_id -> users(id)` | Append-only, indexed on `entity_id` |
| `fraud_alerts` | **Member 4** | None (Admin view)| `id (UUID)` | `target_user_id` | Status index |
| `account_health_scores`|**Member 4**| None (Admin view)| `id (UUID)` | `customer_id` | Composite score breakdown |
| `exit_surveys` | **Member 4** | None (Admin view)| `id (UUID)` | `subscription_id`, `customer_id`| Churn reporting index |
| `system_notifications`|**Member 4**| Mem 1, 2, 3 | `id (UUID)`| None | Delivery tracking |

### 10.2 Financial Integrity & Precision Rules
1. **No Floating Point for Currency:** All financial figures (`sales_price`, `unit_price`, `subtotal`, `tax_amount`, `discount_amount`, `total_amount`) must be stored as `NUMERIC(14, 4)` in database schemas.
2. **Intermediate vs Display Rounding:** Calculations preserve 4 decimal places during intermediate multiplication (e.g. tax and proration math); final values are rounded to 2 decimal places using Banker's Rounding (Round Half to Even) when presented on invoices or charged to gateways.
3. **Idempotency Keys:** Mandatory on payment attempts and usage ingestion to prevent double processing in case of network retries.
4. **Historical Immutability:** Once an invoice moves to `CONFIRMED` or `PAID`, its line items and totals cannot be updated; modifications require an explicit Credit Note or Cancellation invoice.

---

## 11. Unified API Contract & Integration Matrix

Below is the master HTTP API routing contract showing ownership, authorization requirements, and cross-module interactions:

```
+-------------------------------------------------------------------------------------------------------------------------+
|                                                   UNIFIED API CONTRACT                                                  |
+--------+---------------------------------------+--------+------------------+-------------------+------------------------+
| METHOD | ENDPOINT                              | OWNER  | AUTH / ROLES     | INPUT PAYLOAD     | PURPOSE                |
+--------+---------------------------------------+--------+------------------+-------------------+------------------------+
| POST   | /api/v1/auth/register                 | Mem 1  | Public           | RegisterDTO       | Customer registration  |
| POST   | /api/v1/auth/login                    | Mem 1  | Public           | LoginDTO          | JWT authentication     |
| POST   | /api/v1/auth/forgot-password          | Mem 1  | Public           | EmailDTO          | Password reset request |
| POST   | /api/v1/auth/reset-password           | Mem 1  | Public           | ResetPasswordDTO  | Token password update  |
| POST   | /api/v1/users/staff                   | Mem 1  | ADMIN            | CreateStaffDTO    | Provision staff account|
| GET    | /api/v1/products                      | Mem 1  | Authenticated    | QueryParams       | Catalog retrieval      |
| POST   | /api/v1/products                      | Mem 1  | ADMIN            | ProductCreateDTO  | Catalog creation       |
| GET    | /api/v1/plans                         | Mem 1  | Authenticated    | QueryParams       | Plan retrieval         |
| POST   | /api/v1/plans                         | Mem 1  | ADMIN            | PlanCreateDTO     | Plan configuration     |
| GET    | /api/v1/currencies                    | Mem 1  | Authenticated    | None              | Exchange rates list    |
+--------+---------------------------------------+--------+------------------+-------------------+------------------------+
| GET    | /api/v1/quotations                    | Mem 2  | ADMIN, STAFF     | QueryParams       | Quotation register     |
| POST   | /api/v1/quotations                    | Mem 2  | ADMIN, STAFF     | QuotationDTO      | Quotation builder      |
| POST   | /api/v1/quotations/:id/convert        | Mem 2  | ADMIN, STAFF     | None              | Convert to subscription|
| GET    | /api/v1/subscriptions                 | Mem 2  | Authenticated    | FilterParams      | Subscription register  |
| POST   | /api/v1/subscriptions                 | Mem 2  | ADMIN, STAFF     | CreateSubDTO      | Subscription creation  |
| POST   | /api/v1/subscriptions/:id/pause       | Mem 2  | ADMIN, STAFF     | None              | Pause subscription     |
| POST   | /api/v1/subscriptions/:id/resume      | Mem 2  | ADMIN, STAFF     | None              | Resume subscription    |
| POST   | /api/v1/subscriptions/:id/upgrade     | Mem 2  | ADMIN, STAFF, CUS| UpgradeSubDTO     | Prorated plan change   |
| POST   | /api/v1/subscriptions/:id/cancel      | Mem 2  | ADMIN, STAFF, CUS| CancelSubDTO      | Terminate & trigger sur|
| POST   | /api/v1/usage/events                  | Mem 2  | ADMIN, STAFF, API| UsageEventDTO     | Ingest consumption data|
+--------+---------------------------------------+--------+------------------+-------------------+------------------------+
| POST   | /api/v1/invoices/generate-cycle       | Mem 3  | ADMIN, Worker    | BillingRunDTO     | Idempotent billing run |
| GET    | /api/v1/invoices                      | Mem 3  | Authenticated    | QueryParams       | Invoicing register     |
| GET    | /api/v1/invoices/:id                  | Mem 3  | Authenticated    | None              | Invoice details view   |
| GET    | /api/v1/invoices/:id/pdf              | Mem 3  | Authenticated    | None              | Download invoice PDF   |
| POST   | /api/v1/invoices/:id/confirm          | Mem 3  | ADMIN, STAFF     | None              | Freeze draft invoice   |
| POST   | /api/v1/invoices/:id/cancel           | Mem 3  | ADMIN            | CancelReasonDTO   | Void invoice & balance |
| POST   | /api/v1/tax-rules                     | Mem 3  | ADMIN            | TaxRuleDTO        | Configure tax rates    |
| POST   | /api/v1/discounts                     | Mem 3  | ADMIN            | DiscountDTO       | Configure coupons      |
| POST   | /api/v1/payments                      | Mem 3  | ADMIN, STAFF     | RecordPaymentDTO  | Record manual payment  |
| POST   | /api/v1/payments/webhook              | Mem 3  | Public (HMAC)    | GatewayWebhookDTO | Stripe/Razorpay webhook|
+--------+---------------------------------------+--------+------------------+-------------------+------------------------+
| GET    | /api/v1/analytics/dashboard-summary   | Mem 4  | ADMIN            | DateRangeFilter   | Executive BI widgets   |
| GET    | /api/v1/analytics/aging-report        | Mem 4  | ADMIN            | None              | Overdue aging brackets |
| GET    | /api/v1/fraud/alerts                  | Mem 4  | ADMIN, STAFF     | FilterParams      | Fraud monitoring queue |
| POST   | /api/v1/fraud/alerts/:id/resolve      | Mem 4  | ADMIN, STAFF     | ResolutionDTO     | Close fraud alert      |
| GET    | /api/v1/health/scores                 | Mem 4  | ADMIN, STAFF     | QueryParams       | Customer health scores |
| GET    | /api/v1/audit/logs                    | Mem 4  | ADMIN            | AuditFilterDTO    | Security log viewer    |
| POST   | /api/v1/surveys/exit                  | Mem 4  | Authenticated    | ExitSurveyDTO     | Ingest churn feedback  |
| GET    | /api/v1/analytics/churn-insights      | Mem 4  | ADMIN            | None              | Churn analytics report |
+--------+---------------------------------------+--------+------------------+-------------------+------------------------+
```

---

## 12. Shared Infrastructure Ownership Matrix

To avoid conflicting changes in shared configuration files, ownership is explicitly designated below:

| Infrastructure Component | Primary Owner | Secondary Contributors | Responsibilities & Boundary Rules |
| :--- | :---: | :---: | :--- |
| **Git Repository & Branching Strategy** | **Member 4** | Members 1, 2, 3 | Branch protection rules, PR templates, commit linting setup |
| **Docker & Docker Compose** | **Member 4** | Members 1, 3 | Orchestration of PostgreSQL, Redis, API server, and Vite dev server |
| **Database Pool & Migration Runner** | **Member 1** | Members 2, 3, 4 | PostgreSQL `pg` pool initialization, migration execution harness |
| **Core Auth & RBAC Middleware** | **Member 1** | Members 2, 3 | `authenticateToken`, `requireRole`, `enforceCustomerIsolation` |
| **Express Bootstrapping & Routing Hub** | **Member 1** | Members 2, 3, 4 | `app.ts` module mounting and top-level middleware registration |
| **Shared UI Component Library** | **Member 1** | Members 2, 3, 4 | Base Button, Input, Modal, Table, Badge, Card components |
| **Background Queue (BullMQ / Redis)** | **Member 3** | Members 2, 4 | Redis connection, BullMQ queue instances, worker process setup |
| **Audit Logger & Interceptor** | **Member 4** | All Members | Request/response mutation interception, JSON delta logger |
| **Shared Notification / Mailer Hub** | **Member 4** | Members 1, 3 | Nodemailer SMTP setup, HTML email templates, delivery logging |
| **GitHub Actions CI/CD Pipeline** | **Member 4** | All Members | Automated linting, test runners, build verifiers on PR merge |
| **Prometheus & Grafana Monitoring** | **Member 4** | All Members | Express metrics instrumentation (`express-prom-bundle`), dashboards |

---

## 13. Cross-Member Dependencies & Data Flow Choreography

The diagram below illustrates the end-to-end data lifecycle across all four team modules:

```
[CUSTOMER / ADMIN]
       |
       | 1. Register & Authenticate (JWT)
       v
+------------------+
|     MEMBER 1     | ---- Products & Plans Available ----+
|  Auth & Catalog  |                                     |
+------------------+                                     |
       |                                                 v
       |                                       +------------------+
       | 2. Selects Plan & Generates Quote --> |     MEMBER 2     |
       |    or Activates Subscription          |  Subscriptions   |
       |                                       +------------------+
       |                                                 |
       |                                                 | 3. Active Subscription Due
       |                                                 |    + Aggregate Usage Records
       |                                                 v
       |                                       +------------------+
       | <--- 4. Dispatches Invoices & ------  |     MEMBER 3     |
       |         Collects Payment / Webhook    | Billing & Pay    |
       |                                       +------------------+
       |                                                 |
       +-------------------+-----------------------------+
                           |
                           | 5. Emits Data: Transactions, Usage,
                           |    Failures, Cancellations, Mutations
                           v
               +-----------------------+
               |       MEMBER 4        |
               | Operations & BI Layer |
               +-----------------------+
               | - Financial BI Dashboard (MRR, ARR, Cash)
               | - Fraud Risk Rule Evaluation (8 Vectors)
               | - Customer Health Scoring (0 - 100 Index)
               | - Immutable Audit Trail Logging
               | - Exit Surveys & Churn Insights
```

---

## 14. Independent Development Strategy & Local Mocking

To enable all four members to build and test their modules completely in parallel without blocking each other:

### 14.1 Mocking Strategy for Member 1 Consumers (Members 2, 3, 4)
- **Problem:** Members 2, 3, and 4 need authentication and customer records before Member 1 finishes the auth API.
- **Solution:** 
  - Set `MOCK_AUTH=true` in `server/.env`.
  - The shared `auth.middleware.ts` automatically attaches:
    ```json
    req.user = {
      "id": "usr_dev_admin_01",
      "email": "dev.admin@enterprise.local",
      "role": "ADMIN",
      "customerId": "cust_dev_01"
    }
    ```
  - Pre-seeded database records in `database/seeds/000_mock_core.sql` supply baseline customers, products, and plans.

### 14.2 Mocking Strategy for Member 2 Consumers (Member 3)
- **Problem:** Member 3 needs active subscriptions to test recurring invoice generation before Member 2 completes subscription lifecycles.
- **Solution:**
  - Member 3 utilizes static SQL fixtures in `003_billing_seed.sql` that insert 5 pre-configured subscriptions in `ACTIVE` state with known start dates, cycle windows, and line items.

### 14.3 Mocking Strategy for Member 3 Consumers (Member 4)
- **Problem:** Member 4 needs hundreds of invoices, payments, and failed retry records to test executive dashboards and fraud detection.
- **Solution:**
  - Member 4 creates a synthetic data generator script `server/src/modules/operations/utils/seedOpsFixtures.ts` that populates historical monthly revenue, failed payments, and dunning logs into the database without requiring live payment gateway webhooks.

---

## 15. Future Individual ZIP Packaging Specification

When requested in a subsequent project milestone, the project will be split into four standalone, production-ready ZIP packages. Each package will adhere to the following file layout:

```
+--------------------------------------------------------------------------------------------------------------------+
|                                      FUTURE ZIP ARCHIVE STRUCTURE & CONTENTS                                       |
+------------------------------------+-------------------------------------------------------------------------------+
| ZIP PACKAGE NAME                   | MANDATORY DIRECTORY CONTENTS                                                  |
+------------------------------------+-------------------------------------------------------------------------------+
| **MEMBER_1_AUTH_CATALOG.zip**      | - `client/src/modules/member1_auth/`                                          |
|                                    | - `client/src/context/AuthContext.tsx`                                        |
|                                    | - `server/src/modules/auth_catalog/`                                          |
|                                    | - `server/src/core/middleware/auth.middleware.ts`                             |
|                                    | - `database/migrations/001_auth_catalog_schema.sql`                           |
|                                    | - `tests/member1/`                                                            |
|                                    | - `README_MEMBER1.md` (Self-contained execution & API runbook)                |
+------------------------------------+-------------------------------------------------------------------------------+
| **MEMBER_2_SUBSCRIPTIONS.zip**     | - `client/src/modules/member2_subs/`                                          |
|                                    | - `server/src/modules/subscriptions/`                                         |
|                                    | - `database/migrations/002_subscriptions_schema.sql`                          |
|                                    | - `tests/member2/`                                                            |
|                                    | - `README_MEMBER2.md` (Self-contained execution & API runbook)                |
+------------------------------------+-------------------------------------------------------------------------------+
| **MEMBER_3_BILLING_PAYMENTS.zip**  | - `client/src/modules/member3_billing/`                                       |
|                                    | - `server/src/modules/billing/`                                               |
|                                    | - `server/src/queue/recurringBillingWorker.ts`                                |
|                                    | - `database/migrations/003_billing_schema.sql`                                |
|                                    | - `tests/member3/`                                                            |
|                                    | - `README_MEMBER3.md` (Self-contained execution & API runbook)                |
+------------------------------------+-------------------------------------------------------------------------------+
| **MEMBER_4_OPERATIONS_ANALYTICS.zip| - `client/src/modules/member4_ops/`                                           |
|                                    | - `server/src/modules/operations/`                                            |
|                                    | - `server/src/core/middleware/audit.middleware.ts`                            |
|                                    | - `database/migrations/004_operations_schema.sql`                             |
|                                    | - `tests/member4/`                                                            |
|                                    | - `README_MEMBER4.md` (Self-contained execution & API runbook)                |
+------------------------------------+-------------------------------------------------------------------------------+
```

### Shared Kernel Integration:
Each ZIP package will also include a copy of `server/src/core/` (shared database connection, base error classes, response wrappers) and `client/src/components/ui/` (shared design system components) to guarantee that each package can be executed and tested independently by an academic evaluator.

---

## 16. Git Branching, Version Control & CI/CD Strategy

### 16.1 Git Branching Model (Gitflow Adapted)
- `main`: Production-ready code; protected branch; direct commits strictly forbidden.
- `develop`: Integration staging branch for merged features.
- Feature branches naming convention:
  - `feat/m1-auth-jwt`
  - `feat/m1-product-variants`
  - `feat/m2-subscription-lifecycle`
  - `feat/m2-proration-engine`
  - `feat/m3-recurring-billing-worker`
  - `feat/m3-gateway-webhooks`
  - `feat/m4-admin-dashboard-bi`
  - `feat/m4-fraud-detection-rules`

### 16.2 Pull Request & Merge Policies
1. Every Pull Request (PR) must target `develop`.
2. PR title must follow Conventional Commits: `feat(m2): implement tiered pricing graduated bracket calculation`.
3. CI automated checks must pass:
   - Backend unit and integration tests (`npm test`).
   - TypeScript compilation check (`npm run build`).
   - ESLint and Prettier validation.
4. Peer review requirement: At least 1 other team member must review and approve before merge.

---

## 17. Comprehensive Testing Strategy & Acceptance Criteria Matrix

| Module | Test Level | Test Suite Focus & Scenarios | Success Benchmark |
| :--- | :--- | :--- | :--- |
| **Member 1** | Unit | Password complexity regex, bcrypt hashing, JWT token expiration | 100% pass on edge cases |
| **Member 1** | Integration | Registration -> Login -> Protected Route access by Role | 401 on bad token, 403 on role mismatch |
| **Member 2** | Unit | Graduated vs Volume tiered math, Proration day-count accuracy | Exactly matches financial test vectors |
| **Member 2** | Integration | Ingest usage events -> Deduplicate idempotency -> Aggregate | Duplicate events ignored, totals exact |
| **Member 3** | Integration | Recurring billing run -> Verify DB lock prevents duplicate cycle invoice | Exactly 1 invoice per cycle created |
| **Member 3** | Stress / Concur | 10 parallel requests to claim single remaining discount coupon | Exactly 1 succeeds, 9 fail with 400 |
| **Member 3** | Security | Stripe/Razorpay webhook HMAC signature verification | Tampered payloads rejected with 400 |
| **Member 4** | Unit | 8 Fraud detection rules triggered against synthetic event logs | All 8 rules flag expected risk levels |
| **Member 4** | Integration | Admin mutation -> Audit log table captures JSON delta correctly | Before/after state accurately recorded |
| **Member 4** | Performance | Dashboard aggregation queries against 10,000 active subscriptions | Response time < 500ms |

---

## 18. Suggested 12-Week Development Timeline & Milestones

```
+--------------------------------------------------------------------------------------------------------------------------+
|                                           12-WEEK DEVELOPMENT TIMELINE ROADMAP                                           |
+------+-----------------------+-------------------------+----------------------------+------------------------------------+
| WEEK | MEMBER 1              | MEMBER 2                | MEMBER 3                   | MEMBER 4                           |
+------+-----------------------+-------------------------+----------------------------+------------------------------------+
| W01  | Repo init, DB Pool,   | Mock seed analysis,     | DB Schema definition,      | Git setup, Docker Compose, CI/CD   |
|      | Users & Auth Schema   | Quotes & Sub Schema     | Tax & Discount Schema      | Audit Schema & Logging middleware  |
+------+-----------------------+-------------------------+----------------------------+------------------------------------+
| W02  | JWT Auth, Bcrypt,     | Quotation CRUD APIs &   | Tax Engine & Admin         | Centralized Winston Logging,       |
|      | Register & Login APIs | Builder UI View         | Discount Rule APIs         | Prometheus instrumentation setup   |
+------+-----------------------+-------------------------+----------------------------+------------------------------------+
| W03  | RBAC Middleware,      | Subscription State Mach.| Invoice Entity Schema &    | Shared Notification Hub (Mailer),  |
|      | Password Reset Token  | Lifecycle APIs (Draft)  | Manual Creation Endpoints  | Base Metric Card Components        |
+------+-----------------------+-------------------------+----------------------------+------------------------------------+
| W04  | Product & Variant     | Sub Line Items &        | BullMQ Background Queue    | Dashboard Mock Data Generator,     |
|      | Models & CRUD APIs    | Renewal/Pause Handlers  | Recurring Billing Runner   | Executive KPI Backend Queries      |
+------+-----------------------+-------------------------+----------------------------+------------------------------------+
| W05  | Plan Management APIs, | Tiered Pricing Engine   | Duplicate Billing Lock,    | Executive Dashboard UI (Recharts), |
|      | Billing Frequencies   | (Graduated & Volume)    | Frozen Customer Snapshot   | MRR, ARR, Cash Flow Charts         |
+------+-----------------------+-------------------------+----------------------------+------------------------------------+
| W06  | Multi-Currency Rates  | Usage Ingestion API &   | Invoice Confirmation Flow, | Fraud Engine Architecture &        |
|      | & Conversion Service  | Idempotency Key Guard   | PDF Generation Service     | Rules 1 to 4 (Velocity, Card tests)|
+------+-----------------------+-------------------------+----------------------------+------------------------------------+
| W07  | Customer Isolation    | Usage Cycle Aggregation | Payment Ledger & Manual    | Fraud Rules 5 to 8 (Account churn),|
|      | & Staff Creation View | Scheduled Job           | Payment Recording APIs     | Fraud Monitoring Review Desk UI    |
+------+-----------------------+-------------------------+----------------------------+------------------------------------+
| W08  | Auth & Catalog UI     | Mid-Cycle Plan Upgrade  | Payment Gateway Sandbox    | Account Health Algorithm (0-100),  |
|      | Complete (React)      | Proration Math Engine   | Integration (Stripe/Razor) | Health Score Visualizer UI         |
+------+-----------------------+-------------------------+----------------------------+------------------------------------+
| W09  | Currency Config UI,   | Proration Preview UI &  | Webhook Handler with HMAC  | Audit Log Viewer with JSON Diff,   |
|      | Admin User Desk       | Upgrade Modal Component | Signature Verification     | Exit Survey Model & Trigger Hook   |
+------+-----------------------+-------------------------+----------------------------+------------------------------------+
| W10  | Member 1 & 2 Contract | Member 2 & 3 Contract   | Dunning & Payment Retry    | Churn Insights Analytics Dashboard,|
|      | Integration & Testing | Integration & Testing   | Worker with Exp. Backoff   | System Health Dashboard View       |
+------+-----------------------+-------------------------+----------------------------+------------------------------------+
| W11  | End-to-End System Integration Testing, Cross-Module Regression, Concurrency & Security Hardening (All Members)    |
+------+--------------------------------------------------------------------------------------------------------------------+
| W12  | Standalone ZIP Extraction Verification, Comprehensive Academic Documentation, Final Project Presentation Prep     |
+------+--------------------------------------------------------------------------------------------------------------------+
```

---

## 19. Unresolved Decisions, Trade-Offs & Strategic Assumptions

The following engineering decisions are documented with explicit evaluation criteria and default fallbacks:

### 19.1 Database Engine: PostgreSQL 16 vs MySQL 8.0
- **Architectural Trade-Off:**
  - *PostgreSQL 16 (Recommended):* First-class `JSONB` indexing for audit log diffs and customer snapshots; robust transactional DDL (migrations wrap cleanly in transactions); strict `NUMERIC(14,4)` precision; native `FOR UPDATE SKIP LOCKED` for concurrent BullMQ billing queue jobs.
  - *MySQL 8.0:* Widespread student familiarity, but weaker JSON manipulation and potential schema lock friction during large migrations.
- **Decision Path:** Default to **PostgreSQL 16**. If MySQL is chosen by team vote, Member 1 and Member 4 will replace `JSONB` columns with standard `JSON` or text serialized strings.

### 19.2 Caching & Job Queue: Redis 7 vs In-Memory Queue
- **Architectural Trade-Off:**
  - *Redis 7 + BullMQ (Recommended):* Reliable distributed job queues for scheduled recurring billing runs and payment retries that survive server restarts.
  - *In-Memory Queue (`better-queue` / `node-cron`):* Zero external infrastructure overhead, but active jobs are lost if the Node.js process crashes.
- **Decision Path:** Use Redis via Docker Compose for local and staging environments; implement an in-memory fallback adapter for environments without Redis.

### 19.3 Cloud Hosting: AWS vs Azure
- **Architectural Trade-Off:**
  - *AWS:* ECS Fargate for backend containers, S3 + CloudFront for React SPA, RDS for PostgreSQL.
  - *Azure:* Azure App Service (Linux) + Azure Database for PostgreSQL.
- **Decision Path:** Both options support containerized Docker deployments cleanly. Cloud deployment decision is deferred to Week 10 without affecting core application code.

### 19.4 Payment Gateway Provider: Stripe vs Razorpay
- **Architectural Trade-Off:**
  - *Stripe:* Superior developer documentation, native CLI for local webhook forwarding (`stripe listen`), robust sandbox cards.
  - *Razorpay:* Strong multi-currency and regional support in India/Asia.
- **Decision Path:** Member 3 designs the gateway service using an **Adapter Pattern** (`PaymentGatewayInterface`). The initial implementation provides a `StripeGatewayAdapter` and a `MockGatewayAdapter` for offline automated testing.

### 19.5 Optional ML-Based Fraud Detection
- **Architectural Strategy:** The primary fraud detection engine (Member 4) is implemented using deterministic, rule-based heuristics. An optional Python/FastAPI microservice container (`ml-fraud-service`) can be plugged into the Docker network in Week 11 via a REST webhook if team bandwidth permits.

---

## 20. Definition of Done (DoD) for Each Member

A member's module is formally certified as **Done** only when it satisfies all of the following criteria:

### Member 1: Definition of Done
- [ ] User registration, login, logout, and password reset flows are fully functional.
- [ ] Strict password complexity validation is verified with automated tests.
- [ ] JWT authentication with role-based authorization (`ADMIN`, `STAFF`, `CUSTOMER`) protects all routes.
- [ ] Customer self-data isolation is enforced at the database query level.
- [ ] Products, variants, and plans can be created, updated, and queried via REST APIs and UI.
- [ ] Multi-currency rate table is configurable by Admin.
- [ ] Unit and integration tests achieve >= 80% code coverage.
- [ ] Standalone ZIP package builds, runs with mock seed, and passes independent evaluation.

### Member 2: Definition of Done
- [ ] Quotations can be drafted, expired, and converted to confirmed subscriptions.
- [ ] Subscriptions enforce unique numbering and execute state machine transitions (`DRAFT` to `CLOSED`).
- [ ] Tiered pricing engine accurately calculates Graduated and Volume pricing scenarios.
- [ ] Usage events are ingested, deduplicated via idempotency keys, and aggregated by cycle.
- [ ] Mid-cycle upgrade proration accurately calculates unspent credit and charges new plan debit.
- [ ] All pricing and proration math passes financial edge-case unit test vectors.
- [ ] Standalone ZIP package builds, runs with mock seed, and passes independent evaluation.

### Member 3: Definition of Done
- [ ] Recurring billing engine generates cycle invoices idempotently without duplicate risk.
- [ ] Confirmed invoices freeze an immutable JSON snapshot of customer and billing data.
- [ ] Taxes and discounts calculate accurately with atomic concurrency-safe discount redemption.
- [ ] Manual payments record against invoices and update balances to `PAID`.
- [ ] Payment gateway test charges and webhook HMAC signature verifications succeed.
- [ ] Smart dunning retry worker executes scheduled attempts with exponential backoff on failed charges.
- [ ] Standalone ZIP package builds, runs with mock seed, and passes independent evaluation.

### Member 4: Definition of Done
- [ ] Executive dashboard displays accurate real-time MRR, ARR, Cash, and Overdue debt metrics.
- [ ] All 8 fraud detection rules evaluate correctly and flag actionable incidents in the review queue.
- [ ] Customer account health algorithm computes composite scores (0-100) and risk categories.
- [ ] Global audit interceptor logs all mutating operations to the immutable `audit_logs` table.
- [ ] Exit surveys are triggered upon cancellation and aggregated into churn analytics views.
- [ ] Shared notification mailer successfully delivers transaction emails.
- [ ] Standalone ZIP package builds, runs with mock seed, and passes independent evaluation.

---

> **Architect's Sign-Off:**  
> This specification document serves as the binding engineering contract for all four project members. Proceeding with feature development requires adherence to the boundaries, schemas, and API contracts defined herein.
