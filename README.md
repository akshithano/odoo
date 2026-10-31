# Subscription Operations & Billing Platform (OdooSub)

> **Enterprise Subscription Management System**  
> **Final Year B.Tech CSE Capstone Project**  
> **Architecture:** Modular Monolith with npm Workspaces  
> **Feature Allocation Blueprint:** [TEAM_FEATURE_ALLOCATION.md](TEAM_FEATURE_ALLOCATION.md)  
> **API Contracts:** [docs/API_CONTRACTS.md](docs/API_CONTRACTS.md)

---

## 1. Project Overview

The **Subscription Management System** is an enterprise-grade subscription operations, recurring billing, automated revenue management, and governance platform. Engineered to support high-volume subscriptions, it delivers:

- Strict Role-Based Access Control (Admin, Staff, Customer) with tenant customer data isolation.
- Comprehensive Product Catalog and Multi-Frequency Subscription Plan lifecycle management.
- Quotations with predefined line items and one-click conversion to confirmed subscriptions.
- Advanced Pricing Engines: Tiered (Graduated Slab and Volume-based) and Usage-Based consumption meters.
- Mid-Cycle Subscription Upgrades with day-count financial proration calculation.
- Automated Recurring Invoicing with duplicate billing locks and catch-up schedulers.
- Configurable Tax Rules and atomic, concurrency-safe Discount coupon enforcement.
- Payment Reconciliation (Manual and Gateway Sandbox) with automated smart dunning retries.
- Real-time Executive BI Dashboard (MRR, ARR, Cash flow, Aging receivables).
- 8-Vector Rule-Based Fraud Detection with an Admin investigation queue.
- Dynamic Customer Account Health Scoring (0–100 index) and Churn Risk flags.
- Immutable, append-only security Audit Logging and automated cancellation Exit Surveys.

---

## 2. Approved Technology Stack

| Layer                   | Technologies Selected                                                          |
| :---------------------- | :----------------------------------------------------------------------------- |
| **Frontend**            | React 18, Vite, TypeScript, Tailwind CSS, React Router v6, Lucide Icons, Axios |
| **Backend**             | Node.js v20+, Express.js, TypeScript, REST API Architecture, Helmet, CORS, Zod |
| **Database**            | PostgreSQL 16, Prisma ORM, strict `NUMERIC(14, 4)` monetary precision          |
| **Cache & Queues**      | Redis 7, BullMQ (Async background workers and retry scheduler)                 |
| **DevOps & Containers** | Docker, Docker Compose, Multi-stage alpine builds                              |
| **Testing**             | Vitest, Supertest, React Testing Library, jsdom                                |
| **Monorepo**            | npm workspaces (`apps/*`, `packages/*`)                                        |

---

## 3. Monorepo Repository Structure

```
odoo/
├── apps/
│   ├── frontend/                 # React 18 + Vite SPA Client
│   │   ├── src/
│   │   │   ├── api/              # Centralized Axios API client
│   │   │   ├── components/       # Shared UI design system & layout components
│   │   │   ├── pages/            # Application views (Home, NotFound, etc.)
│   │   │   ├── routes/           # React Router route registry
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── backend/                  # Node.js + Express REST API Server
│       ├── prisma/               # Prisma schema & client definition
│       ├── src/
│       │   ├── config/           # Validated environment & Redis configs
│       │   ├── core/             # Shared kernel (Database, Queue, Errors, Logging)
│       │   ├── routes/           # Route registries (Health, API v1 namespace)
│       │   ├── app.ts            # Express application bootstrapping
│       │   └── server.ts         # HTTP server entry point with graceful shutdown
│       ├── tests/                # Unit and integration test suites
│       └── package.json
│
├── packages/
│   └── shared/                   # Shared TypeScript contracts, enums & response types
│       ├── src/
│       │   ├── types/            # ApiResponse, ApiErrorResponse, PaginationMeta, Health
│       │   └── enums/            # Roles, SubscriptionStatus, InvoiceStatus, PaymentStatus
│       └── package.json
│
├── database/
│   ├── migrations/               # Coordinated SQL migrations partitioned by member
│   │   └── README.md             # Migration workflow instructions
│   └── seeds/                    # Mock data seeding infrastructure
│       └── index.ts
│
├── infrastructure/
│   └── docker/
│       ├── Dockerfile.frontend   # Multi-stage React + Nginx Alpine image
│       └── Dockerfile.backend    # Multi-stage Node + Express Alpine image
│
├── docs/
│   └── API_CONTRACTS.md          # Comprehensive REST API specifications & headers
│
├── docker-compose.yml            # Multi-service container orchestration (Postgres, Redis, API, Web)
├── .env.example                  # Environment configuration template
├── .gitignore                    # Version control exclusion rules
├── package.json                  # Root monorepo workspace configuration
├── README.md                     # Project master documentation
└── TEAM_FEATURE_ALLOCATION.md    # Master 4-member feature distribution & packaging blueprint
```

---

## 4. Prerequisites

Before running the project locally, ensure you have installed:

- **Node.js**: v20.x or higher (LTS recommended)
- **npm**: v10.x or higher
- **Docker & Docker Compose**: Docker Desktop or Docker Engine v24+
- **Git**

---

## 5. Local Setup Instructions

### Step 1: Clone and Enter Repository

```bash
git clone <repository-url> odoo
cd odoo
```

### Step 2: Environment Configuration

Copy `.env.example` to create your local `.env`:

```bash
cp .env.example .env
```

_(The defaults are pre-configured for local development)._

### Step 3: Install All Workspace Dependencies

```bash
npm install
```

### Step 4: Build Shared TypeScript Package

```bash
npm run build:shared
```

---

## 6. Running with Docker Compose (Recommended)

Docker Compose starts all four services (PostgreSQL 16, Redis 7, Backend API, Frontend Web) with automated health checks and persistent volumes without needing local database installations:

```bash
# Start all services in the background
npm run docker:up
# or: docker compose up -d

# View container logs
docker compose logs -f

# Verify service status
docker compose ps

# Tear down services
npm run docker:down
# or: docker compose down
```

Once started:

- **Frontend SPA**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:5001](http://localhost:5001)
- **Health Endpoint**: [http://localhost:5001/api/v1/health](http://localhost:5001/api/v1/health)

---

## 7. Local Development Workflow (Without Docker)

If running PostgreSQL and Redis directly on your host machine:

```bash
# Generate Prisma Client
npm run db:generate

# Start both Backend and Frontend concurrently
npm run dev

# Or start individually in separate terminals:
npm run dev:backend   # Express API server at http://localhost:5000
npm run dev:frontend  # React Vite dev server at http://localhost:3000
```

---

## 8. Development & NPM Workspace Commands

| Command                | Action                                                        |
| :--------------------- | :------------------------------------------------------------ |
| `npm run dev`          | Runs backend and frontend concurrently in development mode    |
| `npm run dev:backend`  | Starts backend with hot reloading via `tsx watch`             |
| `npm run dev:frontend` | Starts frontend Vite dev server                               |
| `npm run build`        | Compiles shared package, backend, and frontend for production |
| `npm run build:shared` | Builds TypeScript types in `packages/shared`                  |
| `npm run test`         | Executes all test suites across all workspaces using Vitest   |
| `npm run format`       | Runs Prettier across all `.ts`, `.tsx`, `.json`, `.md` files  |
| `npm run format:check` | Checks formatting without modifying files                     |
| `npm run db:generate`  | Generates `@prisma/client` from schema                        |
| `npm run db:migrate`   | Runs database migrations                                      |
| `npm run db:seed`      | Runs database seed scripts                                    |
| `npm run docker:up`    | Boots Postgres 16, Redis 7, Backend, and Frontend in Docker   |
| `npm run docker:down`  | Stops all Docker containers and network                       |

---

## 9. Testing & Quality Assurance

The foundation includes Vitest test runners configured in both workspaces:

```bash
# Run all tests across the monorepo
npm run test

# Run backend tests only
npm run test --workspace=@odoo/backend

# Run frontend tests only
npm run test --workspace=@odoo/frontend
```

---

## 10. Four-Member Development Conventions & Integration

To maintain clean separation for future individual ZIP packaging:

1. **Member 1 (Identity & Catalog):**
   - Frontend: `apps/frontend/src/modules/member1_auth/`
   - Backend: `apps/backend/src/modules/auth_catalog/`
   - Schema: `database/migrations/001_auth_catalog_schema.sql`
2. **Member 2 (Subscriptions & Pricing):**
   - Frontend: `apps/frontend/src/modules/member2_subs/`
   - Backend: `apps/backend/src/modules/subscriptions/`
   - Schema: `database/migrations/002_subscriptions_schema.sql`
3. **Member 3 (Invoicing & Payments):**
   - Frontend: `apps/frontend/src/modules/member3_billing/`
   - Backend: `apps/backend/src/modules/billing/`
   - Schema: `database/migrations/003_billing_schema.sql`
4. **Member 4 (Analytics & Operations):**
   - Frontend: `apps/frontend/src/modules/member4_ops/`
   - Backend: `apps/backend/src/modules/operations/`
   - Schema: `database/migrations/004_operations_schema.sql`

For complete sub-feature checklists, API payload contracts, and database relationship models, consult [TEAM_FEATURE_ALLOCATION.md](TEAM_FEATURE_ALLOCATION.md).
