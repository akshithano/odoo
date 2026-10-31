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

### Member 1: Identity, Auth & Catalog (`/api/v1/auth`, `/api/v1/users`, `/api/v1/products`, `/api/v1/plans`, `/api/v1/currencies`)

#### 1. Authentication Endpoints

##### `POST /api/v1/auth/register`
- **Purpose:** Public self-registration for customer accounts and automatic Customer record creation.
- **Access:** Public (Rate-limited: 30 req / 15 min).
- **Authentication:** None.
- **Required Role:** None (Public).
- **Validation Rules:**
  - `email`: Valid email format, normalized to lowercase.
  - `password`: > 8 characters, >= 1 uppercase letter, >= 1 lowercase letter, >= 1 number, >= 1 special character (`(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])`).
  - `firstName`, `lastName`: Required non-empty strings.
  - `billingAddress.line1`, `city`, `postalCode`: Required strings.
  - `billingAddress.country`: 2-letter uppercase ISO code (e.g. `US`, `IN`).
- **Request Body:**
  ```json
  {
    "email": "customer@example.com",
    "password": "SecurePassword@123",
    "firstName": "Sarah",
    "lastName": "Connor",
    "companyName": "Cyberdyne Systems",
    "phone": "+1-555-0199",
    "billingAddress": {
      "line1": "100 Industrial Parkway",
      "city": "Los Angeles",
      "state": "CA",
      "postalCode": "90001",
      "country": "US"
    }
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "message": "Customer registered successfully",
    "data": {
      "user": {
        "id": "usr_92799726-08a6-432d-9d94-f136deea11eb",
        "email": "customer@example.com",
        "role": "CUSTOMER",
        "firstName": "Sarah",
        "lastName": "Connor"
      },
      "customer": {
        "id": "cust_82819034-71bc-40db-9174-88ea1203beef",
        "companyName": "Cyberdyne Systems",
        "billingCountry": "US"
      },
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```
- **Errors:** `400 Bad Request` (Validation failure), `409 Conflict` (Email already registered).

##### `POST /api/v1/auth/login`
- **Purpose:** Authenticates user credentials and issues signed JWT access token (15m validity).
- **Access:** Public (Rate-limited: 30 req / 15 min).
- **Authentication:** None.
- **Request Body:**
  ```json
  {
    "email": "customer@example.com",
    "password": "SecurePassword@123"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "user": {
        "id": "usr_92799726-08a6-432d-9d94-f136deea11eb",
        "email": "customer@example.com",
        "role": "CUSTOMER",
        "firstName": "Sarah",
        "lastName": "Connor"
      },
      "customerId": "cust_82819034-71bc-40db-9174-88ea1203beef",
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```
- **Errors:** `401 Unauthorized` (Invalid credentials), `403 Forbidden` (Account disabled).

##### `POST /api/v1/auth/logout`
- **Purpose:** Stateless logout client acknowledgment.
- **Access:** Public / Authenticated.
- **Response `200 OK`:** `{ "success": true, "message": "Logout successful" }`

##### `POST /api/v1/auth/forgot-password`
- **Purpose:** Generates secure, crypto-random, expiring (1 hour) password reset token.
- **Access:** Public (Rate-limited: 30 req / 15 min).
- **Request Body:** `{ "email": "customer@example.com" }`
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "message": "If this email is registered, a password reset link has been dispatched",
      "devResetToken": "834225a43bdf57199d681dc36dba44c8daf0ca6d921f4dded7543e6d04ddd002"
    }
  }
  ```

##### `POST /api/v1/auth/reset-password`
- **Purpose:** Verifies single-use reset token and atomically updates user password.
- **Access:** Public (Rate-limited: 30 req / 15 min).
- **Request Body:**
  ```json
  {
    "token": "834225a43bdf57199d681dc36dba44c8daf0ca6d921f4dded7543e6d04ddd002",
    "newPassword": "NewSecurePassword@456"
  }
  ```
- **Response `200 OK`:** `{ "success": true, "data": { "message": "Password has been successfully updated. You may now log in." } }`
- **Errors:** `400 Bad Request` (Token invalid, expired, or already used; password fails complexity).

##### `GET /api/v1/auth/me`
- **Purpose:** Fetches the currently authenticated user's profile and linked customer profile.
- **Access:** Authenticated.
- **Header:** `Authorization: Bearer <token>`
- **Response `200 OK`:** User entity with linked customer record.
- **Errors:** `401 Unauthorized`.

---

#### 2. User Management Endpoints

##### `POST /api/v1/users/staff`
- **Purpose:** Admin-only provisioning of Internal Staff accounts.
- **Access:** Private (`ADMIN` role strictly enforced).
- **Request Body:**
  ```json
  {
    "email": "operator@company.com",
    "password": "StaffPassword@123",
    "firstName": "John",
    "lastName": "Operator"
  }
  ```
- **Response `201 Created`:** User record created with role `STAFF`.
- **Errors:** `400 Bad Request`, `403 Forbidden` (Caller is not ADMIN), `409 Conflict` (Email taken).

##### `GET /api/v1/users`
- **Purpose:** Searchable, filterable, paginated user list.
- **Access:** Private (`ADMIN` and `STAFF`).
- **Query Parameters:** `role` (`ADMIN`, `STAFF`, `CUSTOMER`), `search`, `page`, `limit`.
- **Response `200 OK`:** Array of users with pagination metadata (`meta: { page, limit, totalRecords, totalPages }`).
- **Errors:** `403 Forbidden` (Caller is Customer).

##### `GET /api/v1/users/:id`
- **Purpose:** Retrieves user details with role-aware customer data isolation.
- **Access:** Authenticated.
- **Rule:** Customers can only fetch their own user ID (`req.user.id === params.id`). Admins and Staff can view any user.
- **Response `200 OK`:** User details with linked customer profile.
- **Errors:** `403 Forbidden` (Customer accessing another user), `404 Not Found`.

##### `PATCH /api/v1/users/:id/status`
- **Purpose:** Admin-only account activation/deactivation.
- **Access:** Private (`ADMIN` only).
- **Request Body:** `{ "isActive": false }`
- **Response `200 OK`:** `{ "success": true, "message": "User account has been deactivated", "data": { "id": "...", "isActive": false } }`
- **Errors:** `400 Bad Request` (Admin cannot deactivate self), `403 Forbidden`.

---

#### 3. Product Catalog & Variants Endpoints

##### `GET /api/v1/products`
- **Purpose:** List catalog products with active/type filters.
- **Access:** Public / Authenticated.
- **Query Parameters:** `type` (`SERVICE`, `PHYSICAL`, `DIGITAL`), `search`, `isActive` (`true`/`false`), `page`, `limit`.
- **Response `200 OK`:** Array of products with populated variants array.

##### `POST /api/v1/products`
- **Purpose:** Create new catalog product with optional initial variants.
- **Access:** Private (`ADMIN` only).
- **Request Body:**
  ```json
  {
    "name": "Odoo Enterprise ERP Core",
    "code": "PRD-ODOO-CORE",
    "type": "SERVICE",
    "description": "Enterprise ERP Suite",
    "internalNotes": "Requires SLA",
    "salesPrice": 1000.0000,
    "costPrice": 400.0000,
    "variants": [
      {
        "variantName": "Community Edition",
        "sku": "SKU-ODOO-COMM",
        "attributeName": "Brand",
        "attributeValue": "Community",
        "additionalPrice": 0.0000
      },
      {
        "variantName": "Odoo Certified Enterprise Brand",
        "sku": "SKU-ODOO-BRAND",
        "attributeName": "Brand",
        "attributeValue": "Odoo",
        "additionalPrice": 560.0000
      }
    ]
  }
  ```
- **Response `201 Created`:** Created product entity with variants.
- **Errors:** `400 Bad Request` (Invalid price or type), `403 Forbidden`, `409 Conflict` (Duplicate code or SKU).

##### `GET /api/v1/products/:id`
- **Purpose:** Get product specifications and variant lineup.
- **Access:** Public / Authenticated.
- **Response `200 OK`:** Product entity with all variants and calculated prices.

##### `PUT /api/v1/products/:id`
- **Purpose:** Update product specifications and base pricing.
- **Access:** Private (`ADMIN` only).
- **Request Body:** Partial product fields.
- **Response `200 OK`:** Updated product entity.

##### `PATCH /api/v1/products/:id/status`
- **Purpose:** Toggle product active status (catalog archive).
- **Access:** Private (`ADMIN` only).
- **Request Body:** `{ "isActive": false }`
- **Response `200 OK`:** Updated product status.

##### `POST /api/v1/products/:id/variants`
- **Purpose:** Add new variant to existing product.
- **Access:** Private (`ADMIN` only).
- **Request Body:**
  ```json
  {
    "variantName": "Odoo Certified Enterprise Brand Edition",
    "sku": "SKU-ODOO-BRAND",
    "attributeName": "Brand",
    "attributeValue": "Odoo",
    "additionalPrice": 560.0000
  }
  ```
- **Response `201 Created`:** Created variant entity.
- **Errors:** `409 Conflict` (SKU already exists).

##### `POST /api/v1/products/:id/variants/:variantId/calculate`
- **Purpose:** Calculates final effective unit price by combining base product sales price and variant additional price.
- **Access:** Public / Authenticated.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "productId": "86810094-111d-4454-b1c8-6136ca4120ba",
      "productName": "Odoo Enterprise ERP Core",
      "variantId": "2c90812b-...",
      "variantName": "Odoo Certified Enterprise Brand Edition",
      "sku": "SKU-ODOO-BRAND",
      "attributeName": "Brand",
      "attributeValue": "Odoo",
      "baseSalesPrice": 1000.0000,
      "variantAdditionalPrice": 560.0000,
      "finalCalculatedPrice": 1560.0000
    }
  }
  ```

---

#### 4. Subscription Plan Management Endpoints

##### `GET /api/v1/plans`
- **Purpose:** List subscription plans.
- **Access:** Public / Authenticated.
- **Query Parameters:** `status` (`ACTIVE`, `PAUSED`, `CLOSED`), `billingFrequency` (`DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`), `search`, `page`, `limit`.
- **Response `200 OK`:** Array of plans.

##### `POST /api/v1/plans`
- **Purpose:** Create new subscription plan with lifecycle policy flags.
- **Access:** Private (`ADMIN` only).
- **Request Body:**
  ```json
  {
    "name": "Professional Monthly Tier",
    "code": "PLAN-MONTHLY-PRO",
    "description": "Standard recurring enterprise plan",
    "billingFrequency": "MONTHLY",
    "basePrice": 99.0000,
    "currency": "USD",
    "minimumQuantity": 1,
    "validFrom": "2026-01-01T00:00:00.000Z",
    "validUntil": "2027-12-31T23:59:59.000Z",
    "autoCloseOnExpiry": true,
    "allowEarlyClosure": true,
    "allowPause": true,
    "allowRenewal": true
  }
  ```
- **Response `201 Created`:** Created plan entity.
- **Errors:** `400 Bad Request` (Invalid frequency or `validUntil` <= `validFrom`), `409 Conflict` (Code taken).

##### `GET /api/v1/plans/:id`
- **Purpose:** Get full subscription plan details and policy settings.
- **Access:** Public / Authenticated.
- **Response `200 OK`:** Plan entity.

##### `PUT /api/v1/plans/:id`
- **Purpose:** Update plan configuration and policy switches.
- **Access:** Private (`ADMIN` only).
- **Request Body:** Partial plan schema.
- **Response `200 OK`:** Updated plan.

##### `POST /api/v1/plans/:id/pause`
- **Purpose:** Pauses an active plan (sets status to `PAUSED`).
- **Access:** Private (`ADMIN` only).
- **Validation:** Plan must have `allowPause: true` and status must be `ACTIVE`.
- **Response `200 OK`:** Plan with status `PAUSED`.

##### `POST /api/v1/plans/:id/resume`
- **Purpose:** Resumes a paused plan (sets status to `ACTIVE`).
- **Access:** Private (`ADMIN` only).
- **Validation:** Plan status must be `PAUSED`.
- **Response `200 OK`:** Plan with status `ACTIVE`.

##### `POST /api/v1/plans/:id/close`
- **Purpose:** Closes a plan early before validity ends (sets status to `CLOSED`).
- **Access:** Private (`ADMIN` only).
- **Validation:** Plan must have `allowEarlyClosure: true` and not already be `CLOSED`.
- **Response `200 OK`:** Plan with status `CLOSED`.

##### `POST /api/v1/plans/:id/renew`
- **Purpose:** Extends plan validity and reactivates it.
- **Access:** Private (`ADMIN` only).
- **Validation:** Plan must have `allowRenewal: true`; `newValidUntil` must be a future timestamp.
- **Request Body:** `{ "newValidUntil": "2028-12-31T23:59:59.000Z" }`
- **Response `200 OK`:** Plan with new validity date and status `ACTIVE`.

##### `PATCH /api/v1/plans/:id/status`
- **Purpose:** Toggle plan active visibility (`isActive: boolean`).
- **Access:** Private (`ADMIN` only).

##### `POST /api/v1/plans/sweep-expiry`
- **Purpose:** Triggers the auto-close expiry sweep, closing plans past `validUntil` date where `autoCloseOnExpiry: true`.
- **Access:** Private (`ADMIN` only).
- **Response `200 OK`:** `{ "success": true, "data": { "closedPlansCount": 2 } }`

---

#### 5. Multi-Currency Endpoints

##### `GET /api/v1/currencies`
- **Purpose:** List supported currencies and exchange rates to base.
- **Access:** Public / Authenticated.
- **Response `200 OK`:** Array of currencies (`USD`, `EUR`, `INR`, `GBP`).

##### `POST /api/v1/currencies`
- **Purpose:** Upsert currency and exchange rate.
- **Access:** Private (`ADMIN` only).
- **Request Body:** `{ "code": "INR", "name": "Indian Rupee", "symbol": "₹", "exchangeRateToBase": 86.5 }`

##### `POST /api/v1/currencies/convert`
- **Purpose:** Convert monetary amount between currencies.
- **Access:** Public / Authenticated.
- **Request Body:** `{ "amount": 100, "fromCurrency": "USD", "toCurrency": "INR" }`
- **Response `200 OK`:** `{ "convertedAmount": 8650.00 }`

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
