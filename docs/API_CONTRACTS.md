# API Contracts & Integration Guide

> **Subscription Management System – REST API Architecture**  
> **Base Path:** `/api/v1`  
> **Format:** Standard JSON over HTTPS

---

## 1. Unified Response Envelope Standard

Every API response follows a deterministic contract shared across frontend and backend through the `@odoo/shared` package.

### 1.1 Success Response (`ApiResponse<T>`)

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "totalRecords": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### 1.2 Error Response (`ApiErrorResponse`)

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Validation failed for one or more fields",
    "details": [
      {
        "field": "password",
        "message": "Password must contain at least 1 uppercase letter and 1 special symbol"
      }
    ],
    "timestamp": "2026-10-31T11:45:00.000Z",
    "path": "/api/v1/auth/register"
  }
}
```

---

## 2. Standard HTTP Status Codes & Error Codes

| HTTP Status           | Error Code (`code`)     | Trigger Condition                                                           |
| :-------------------- | :---------------------- | :-------------------------------------------------------------------------- |
| `200 OK`              | N/A                     | Successful read or non-creation update                                      |
| `201 Created`         | N/A                     | Successful creation of a new entity                                         |
| `202 Accepted`        | N/A                     | Asynchronous processing accepted (e.g. usage ingestion)                     |
| `400 Bad Request`     | `BAD_REQUEST`           | Validation error, malformed JSON, or missing required fields                |
| `401 Unauthorized`    | `UNAUTHORIZED`          | Missing, expired, or invalid JWT Bearer token                               |
| `403 Forbidden`       | `FORBIDDEN`             | Authenticated actor lacks required RBAC role                                |
| `404 Not Found`       | `NOT_FOUND`             | Requested entity or route does not exist                                    |
| `409 Conflict`        | `CONFLICT`              | Unique constraint violation (e.g. duplicate email, billing cycle locked)    |
| `422 Unprocessable`   | `UNPROCESSABLE_ENTITY`  | Domain violation (e.g. attempting to cancel an already closed subscription) |
| `500 Server Error`    | `INTERNAL_SERVER_ERROR` | Uncaught server exception (logged with stack trace)                         |
| `503 Service Unavail` | `SERVICE_UNAVAILABLE`   | Database or critical infrastructure offline during readiness check          |

---

## 3. Core Foundation Endpoints (Active in Foundation Phase)

### `GET /health`

- **Purpose:** Lightweight liveness check for Docker / load balancers.
- **Access:** Public.
- **Response `200 OK`:**
  ```json
  {
    "status": "ok",
    "service": "subscription-management-backend",
    "timestamp": "2026-10-31T11:45:00.000Z",
    "uptimeSeconds": 142
  }
  ```

### `GET /api/v1/health/live`

- **Purpose:** Kubernetes / orchestrator liveness probe.
- **Access:** Public.
- **Response `200 OK`:** `{ "status": "ok", "uptime": 142, "timestamp": "..." }`

### `GET /api/v1/health`

- **Purpose:** Comprehensive readiness check verifying PostgreSQL, Redis, and BullMQ status.
- **Access:** Public.
- **Response `200 OK` (All healthy) or `503 Service Unavailable` (Any critical dependency failed):**
  ```json
  {
    "success": true,
    "data": {
      "status": "healthy",
      "timestamp": "2026-10-31T11:45:00.000Z",
      "uptimeSeconds": 142,
      "environment": "development",
      "version": "1.0.0",
      "services": {
        "database": {
          "status": "healthy",
          "responseTimeMs": 12,
          "message": "PostgreSQL connection active"
        },
        "redis": {
          "status": "healthy",
          "responseTimeMs": 4,
          "message": "Redis 7 server reachable"
        },
        "queue": {
          "status": "healthy",
          "responseTimeMs": 8,
          "message": "BullMQ active (0 waiting, 0 active)"
        }
      }
    }
  }
  ```

---

## 4. Four-Member Domain Route Namespaces

When implementing business logic in future phases, each member mounts routes strictly within their designated namespace:

### Member 1: Identity, Auth & Catalog (`/api/v1/auth`, `/api/v1/users`, `/api/v1/products`, `/api/v1/plans`)

- `POST /api/v1/auth/register` (Public registration)
- `POST /api/v1/auth/login` (JWT token issue)
- `POST /api/v1/auth/forgot-password` (Reset email dispatch)
- `POST /api/v1/auth/reset-password` (Token verification & reset)
- `POST /api/v1/users/staff` (`ADMIN` only staff provisioning)
- `GET/POST /api/v1/products` (Catalog management)
- `GET/POST /api/v1/plans` (Subscription plan configuration)

### Member 2: Quotations, Subscriptions, Pricing & Usage (`/api/v1/quotations`, `/api/v1/subscriptions`, `/api/v1/usage`)

- `GET/POST /api/v1/quotations` (Quotation templates and validity)
- `POST /api/v1/quotations/:id/convert` (One-click quote-to-subscription)
- `GET/POST /api/v1/subscriptions` (Subscription state machine)
- `POST /api/v1/subscriptions/:id/upgrade` (Mid-cycle proration calculation & plan switch)
- `POST /api/v1/subscriptions/:id/pause` / `resume` / `cancel`
- `POST /api/v1/usage/events` (Usage consumption ingestion with `Idempotency-Key`)

### Member 3: Invoicing, Taxes, Discounts & Payments (`/api/v1/invoices`, `/api/v1/tax-rules`, `/api/v1/discounts`, `/api/v1/payments`)

- `POST /api/v1/invoices/generate-cycle` (Idempotent recurring billing run)
- `GET /api/v1/invoices` & `GET /api/v1/invoices/:id`
- `GET /api/v1/invoices/:id/pdf` (Dynamic PDF generator)
- `POST /api/v1/invoices/:id/confirm` (Freeze snapshot & tax application)
- `POST /api/v1/tax-rules` (Admin tax configuration)
- `POST /api/v1/discounts` (Admin coupon builder with concurrency limits)
- `POST /api/v1/payments` (Manual payment recording)
- `POST /api/v1/payments/webhook` (Stripe/Razorpay webhook with HMAC signature verification)

### Member 4: Operations, Analytics, Fraud & Audits (`/api/v1/analytics`, `/api/v1/fraud`, `/api/v1/health-scores`, `/api/v1/audit`, `/api/v1/surveys`)

- `GET /api/v1/analytics/dashboard-summary` (Executive MRR/ARR/cash metrics)
- `GET /api/v1/analytics/aging-report` (Receivables aging brackets)
- `GET /api/v1/fraud/alerts` (Fraud monitoring queue)
- `POST /api/v1/fraud/alerts/:id/resolve` (Admin fraud investigation)
- `GET /api/v1/health-scores` (Customer account health algorithm breakdown)
- `GET /api/v1/audit/logs` (Immutable audit log inspection)
- `POST /api/v1/surveys/exit` (Cancellation exit survey ingestion)

---

## 5. Security Headers & Idempotency Standard

- **Authentication Header:**
  `Authorization: Bearer <jwt_access_token>`
- **Idempotency Header:**
  `Idempotency-Key: <unique_client_uuid>` (Mandatory on payment processing and usage event ingestion to guarantee zero duplicate execution).
- **Webhook Signature:**
  `Stripe-Signature: t=<timestamp>,v1=<hmac_sha256>`
