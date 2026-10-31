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

### Member 2: Quotations, Subscriptions, Pricing & Usage (`/api/v1/quotation-templates`, `/api/v1/quotations`, `/api/v1/subscriptions`, `/api/v1/pricing`, `/api/v1/usage`)

#### 1. Quotation Templates
##### `GET /api/v1/quotation-templates`
- **Purpose:** List reusable quotation templates with bundled lines.
- **Access:** Private (`ADMIN`, `STAFF`).
- **Response `200 OK`:** Array of quotation template entities with `lines` populated.

##### `POST /api/v1/quotation-templates`
- **Purpose:** Create a reusable quotation template.
- **Access:** Private (`ADMIN`, `STAFF`).
- **Request Body:**
  ```json
  {
    "name": "Enterprise Cloud Bundle",
    "description": "Standard SaaS deployment with cloud backup",
    "defaultValidityDays": 30,
    "lines": [
      { "productId": "prod_uuid", "quantity": 1, "unitPrice": 1000.0, "taxRate": 18.0 }
    ]
  }
  ```
- **Response `201 Created`:** Created quotation template object.

##### `GET /api/v1/quotation-templates/:id`
- **Purpose:** Retrieve quotation template details by ID.
- **Access:** Private (`ADMIN`, `STAFF`).

#### 2. Quotation Lifecycles & Conversion
##### `GET /api/v1/quotations`
- **Purpose:** List quotations with customer isolation filtering.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER` for own).
- **Query Params:** `page`, `limit`, `status`, `customerId`.
- **Response `200 OK`:** Paginated quotation list with subtotal, tax amount, and validity dates.

##### `POST /api/v1/quotations`
- **Purpose:** Create custom quotation with line items and validity window.
- **Access:** Private (`ADMIN`, `STAFF`).
- **Request Body:**
  ```json
  {
    "customerId": "cust_uuid",
    "planId": "plan_uuid",
    "validDays": 30,
    "paymentTerms": "NET_30",
    "lines": [
      { "productId": "prod_uuid", "variantId": "var_uuid", "quantity": 2, "unitPrice": 500.0, "taxRate": 18.0 }
    ]
  }
  ```
- **Response `201 Created`:** Created quotation with auto-generated quotation number (e.g. `QTN-202610-0001`).

##### `GET /api/v1/quotations/:id`
- **Purpose:** Retrieve full quotation details with calculated subtotals, tax breakdown, and lines.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER` with data isolation).

##### `POST /api/v1/quotations/:id/send`
- **Purpose:** Mark quotation as `SENT` to customer.
- **Access:** Private (`ADMIN`, `STAFF`).

##### `POST /api/v1/quotations/:id/accept`
- **Purpose:** Accept quotation terms (`ACCEPTED`).
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER` own).

##### `POST /api/v1/quotations/:id/reject`
- **Purpose:** Reject or mark quote as declined.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER` own).

##### `POST /api/v1/quotations/:id/convert`
- **Purpose:** One-click conversion of accepted quotation into an active subscription.
- **Access:** Private (`ADMIN`, `STAFF`).
- **Response `201 Created`:** Returns created `subscription` entity and updates quotation status to `CONVERTED`.
- **Errors:** `409 Conflict` (Quotation already converted or invalid state).

#### 3. Subscription Lifecycles & State Machine
##### `GET /api/v1/subscriptions`
- **Purpose:** Query subscriptions with role-based filtering (Customers restricted to own).
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER`).
- **Query Params:** `status`, `customerId`, `page`, `limit`.

##### `POST /api/v1/subscriptions`
- **Purpose:** Create a new subscription contract.
- **Access:** Private (`ADMIN`, `STAFF`).
- **Request Body:**
  ```json
  {
    "customerId": "cust_uuid",
    "planId": "plan_uuid",
    "paymentTerms": "NET_30",
    "billingFrequency": "MONTHLY",
    "startDate": "2026-11-01T00:00:00Z",
    "lines": [
      { "productId": "prod_uuid", "quantity": 1, "unitPrice": 1000.0, "taxRate": 18.0 }
    ]
  }
  ```
- **Response `201 Created`:** Created subscription with formatted number (e.g. `SUB-202611-0001`).

##### `GET /api/v1/subscriptions/:id`
- **Purpose:** Get detailed subscription specification, active period timestamps, lines, and customer details.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER` own).

##### `PUT /api/v1/subscriptions/:id`
- **Purpose:** Update editable subscription attributes (payment terms, auto-renew, line quantities).
- **Access:** Private (`ADMIN`, `STAFF`).

##### `POST /api/v1/subscriptions/:id/confirm`
- **Purpose:** Transition subscription from `DRAFT` / `QUOTATION` to `CONFIRMED`.
- **Access:** Private (`ADMIN`, `STAFF`).

##### `POST /api/v1/subscriptions/:id/activate`
- **Purpose:** Activate subscription (`ACTIVE`).
- **Access:** Private (`ADMIN`, `STAFF`).

##### `POST /api/v1/subscriptions/:id/pause`
- **Purpose:** Pause active subscription, suspending recurring usage billing (`PAUSED`).
- **Access:** Private (`ADMIN`, `STAFF`).

##### `POST /api/v1/subscriptions/:id/resume`
- **Purpose:** Resume paused subscription back to `ACTIVE`.
- **Access:** Private (`ADMIN`, `STAFF`).

##### `POST /api/v1/subscriptions/:id/renew`
- **Purpose:** Advance subscription period dates by billing frequency interval.
- **Access:** Private (`ADMIN`, `STAFF`).

##### `POST /api/v1/subscriptions/:id/close`
- **Purpose:** Early termination / closure of subscription (`CLOSED`). Dispatches asynchronous trigger to Member 4 exit survey.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER` own).
- **Errors:** `422 Unprocessable` (Subscription already closed).

##### `POST /api/v1/subscriptions/:id/preview-upgrade`
- **Purpose:** Real-time proration calculator previewing unused credit and new plan debit.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER` own).
- **Request Body:** `{ "newPlanId": "plan_pro_uuid", "effectiveDate": "2026-10-16T00:00:00Z" }`
- **Response `200 OK`:**
  ```json
  {
    "subscriptionId": "sub_uuid",
    "currentPlan": { "id": "p1", "name": "Basic", "basePrice": 1000.0 },
    "newPlan": { "id": "p2", "name": "Pro", "basePrice": 2000.0 },
    "daysRemaining": 15,
    "totalDaysInCycle": 30,
    "unusedCredit": 500.0,
    "newCharge": 1000.0,
    "netAdjustment": 500.0
  }
  ```

##### `POST /api/v1/subscriptions/:id/upgrade`
- **Purpose:** Execute mid-cycle plan switch, record immutable subscription change audit, and adjust billing.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER` own).
- **Response `200 OK`:** Updated subscription entity and created `subscriptionChange` audit record.

##### `GET /api/v1/subscriptions/:id/history`
- **Purpose:** Immutable audit timeline of lifecycle transitions and manual updates.
- **Access:** Private (`ADMIN`, `STAFF`).

##### `GET /api/v1/subscriptions/:id/changes`
- **Purpose:** Query mid-cycle upgrade/downgrade change logs and proration financial balances.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER` own).

#### 4. Advanced Tiered & Graduated Pricing Engine
##### `GET /api/v1/pricing/tiers`
- **Purpose:** Fetch configured pricing brackets for a plan or product.
- **Access:** Authenticated (`ADMIN`, `STAFF`).
- **Query Params:** `planId`, `productId`, `tierType` (`QUANTITY_BASED` | `USAGE_BASED`).

##### `POST /api/v1/pricing/tiers`
- **Purpose:** Create single pricing tier bracket.
- **Access:** Private (`ADMIN` only).

##### `POST /api/v1/pricing/tiers/bulk`
- **Purpose:** Atomically replace and configure bracket slabs for graduated/volume pricing.
- **Access:** Private (`ADMIN` only).
- **Request Body:**
  ```json
  {
    "planId": "plan_uuid",
    "tierType": "QUANTITY_BASED",
    "modelType": "GRADUATED",
    "tiers": [
      { "minQuantity": 1, "maxQuantity": 10, "unitPrice": 100.0 },
      { "minQuantity": 11, "maxQuantity": 50, "unitPrice": 80.0 },
      { "minQuantity": 51, "maxQuantity": null, "unitPrice": 50.0 }
    ]
  }
  ```

##### `POST /api/v1/pricing/calculate`
- **Purpose:** Simulate or compute exact charge based on quantity and graduated/volume models.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER`).
- **Request Body:** `{ "quantity": 25, "modelType": "GRADUATED", "tiers": [...] }`
- **Response `200 OK`:**
  ```json
  {
    "modelType": "GRADUATED",
    "totalQuantity": 25,
    "totalCalculatedPrice": 2200.0,
    "effectiveUnitPrice": 88.0,
    "brackets": [
      { "tierNumber": 1, "applicableQuantity": 10, "unitPrice": 100.0, "bracketTotal": 1000.0 },
      { "tierNumber": 2, "applicableQuantity": 15, "unitPrice": 80.0, "bracketTotal": 1200.0 }
    ]
  }
  ```

#### 5. Usage-Based Metering & Consumption Ledger
##### `POST /api/v1/usage/events`
- **Purpose:** High-throughput consumption event ingestion with atomic idempotency deduplication.
- **Access:** Private (`ADMIN`, `STAFF`, API Service Keys).
- **Request Body:**
  ```json
  {
    "subscriptionId": "sub_uuid",
    "usageType": "api_calls",
    "quantity": 1500,
    "unitOfMeasure": "calls",
    "timestamp": "2026-10-31T12:00:00Z",
    "idempotencyKey": "evt_20261031_001",
    "notes": "Query batch run"
  }
  ```
- **Response `202 Accepted`:** Event accepted and committed to ledger.
- **Errors:** `409 Conflict` (Duplicate `idempotencyKey`), `404 Not Found` (Unknown subscription).

##### `GET /api/v1/usage/events`
- **Purpose:** Query raw consumption event history with pagination and date range filtering.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER` own).

##### `GET /api/v1/usage/subscriptions/:id/summary`
- **Purpose:** Aggregates consumption metrics across billing window and computes tiered charges for Member 3 recurring invoicing.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER` own).
- **Response `200 OK`:** Summary of all unbilled metrics grouped by `usageType` with pricing tier calculations.

### Member 3: Invoicing, Taxes, Discounts & Payments (`/api/v1/invoices`, `/api/v1/tax-rules`, `/api/v1/discounts`, `/api/v1/payments`, `/api/v1/refunds`)

#### 1. Invoices Lifecycle & Scheduled Billing Engine

##### `POST /api/v1/invoices/generate-cycle`
- **Purpose:** Idempotent recurring billing engine evaluating active subscriptions due for billing up to `asOfDate`. Enforces `UNIQUE(subscription_id, billing_period_start)`.
- **Access:** Private (`ADMIN`, `STAFF`, Background Worker Token).
- **Request Body:**
  ```json
  {
    "asOfDate": "2026-11-01T00:00:00Z",
    "subscriptionId": "sub_uuid_optional"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "subscriptionsEvaluated": 142,
      "invoicesCreated": 38,
      "invoicesSkippedAlreadyBilled": 104,
      "totalBilledAmount": 18450.00,
      "invoiceIds": ["inv_uuid_1", "inv_uuid_2"]
    }
  }
  ```

##### `GET /api/v1/invoices`
- **Purpose:** Query invoices with pagination, status filters, date range, and customer tenant isolation.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER` restricted to own).
- **Query Params:** `status`, `customerId`, `subscriptionId`, `search`, `page`, `limit`, `startDate`, `endDate`.
- **Response `200 OK`:** Paginated invoices list with totals, amount paid, and status.

##### `GET /api/v1/invoices/:id`
- **Purpose:** Retrieve invoice details with lines, frozen customer snapshot, taxes, applied discounts, and payment history.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER` own).

##### `GET /api/v1/invoices/:id/pdf`
- **Purpose:** Dynamic printable HTML / document representation of the invoice.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER` own).
- **Response `200 OK`:** `text/html` document formatted for print/export.

##### `POST /api/v1/invoices/:id/confirm`
- **Purpose:** Freezes draft invoice, applies discounts and taxes, locks immutable customer snapshot, and transitions status to `CONFIRMED`.
- **Access:** Private (`ADMIN`, `STAFF`).
- **Request Body:** `{ "discountCode": "PROMO20" }` (optional).
- **Response `200 OK`:** Returns confirmed invoice object.
- **Errors:** `422 Unprocessable` (Invoice is not in `DRAFT` status).

##### `PUT /api/v1/invoices/:id`
- **Purpose:** Edit draft invoice notes, due dates, or line items.
- **Access:** Private (`ADMIN`, `STAFF`).
- **Errors:** `422 Unprocessable` (Only `DRAFT` invoices can be edited).

##### `POST /api/v1/invoices/:id/cancel`
- **Purpose:** Cancel an invoice.
- **Access:** Private (`ADMIN`, `STAFF`).
- **Errors:** `422 Unprocessable` (Paid invoices cannot be cancelled).

##### `GET /api/v1/invoices/overdue`
- **Purpose:** List overdue invoices with aging breakdown and dunning status (integration endpoint for Member 4 aging report).
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER` own).
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "totalOverdueCount": 12,
      "totalOutstandingAmount": 4850.00,
      "invoices": [
        {
          "id": "inv_uuid",
          "invoiceNumber": "INV-202610-0015",
          "customerName": "Acme Corp",
          "dueDate": "2026-10-15T00:00:00Z",
          "overdueDays": 16,
          "outstandingBalance": 500.00
        }
      ]
    }
  }
  ```

##### `POST /api/v1/invoices/mark-overdue`
- **Purpose:** Sweep worker identifying invoices past due with balance > 0 and transitioning status to `OVERDUE`.
- **Access:** Private (`ADMIN`, `STAFF`).

#### 2. Tax Configuration & Calculation Engine

##### `GET /api/v1/tax-rules`
- **Purpose:** List active or all tax rules.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER`).

##### `POST /api/v1/tax-rules`
- **Purpose:** Create percentage-based or compound tax rule.
- **Access:** Private (`ADMIN` only).
- **Request Body:**
  ```json
  {
    "name": "GST 18%",
    "ratePercentage": 18.00,
    "country": "IN",
    "state": null,
    "isCompound": false
  }
  ```
- **Response `201 Created`:** Created tax rule entity.

##### `PUT /api/v1/tax-rules/:id`
- **Purpose:** Update tax rule configuration.
- **Access:** Private (`ADMIN` only).

##### `PATCH /api/v1/tax-rules/:id/toggle-active`
- **Purpose:** Toggle active/inactive state of a tax rule.
- **Access:** Private (`ADMIN` only).

##### `POST /api/v1/tax-rules/calculate`
- **Purpose:** Simulate or compute exact tax for an amount, taking compound rules into account.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER`).

#### 3. Discount Management & Atomic Redemption

##### `GET /api/v1/discounts`
- **Purpose:** List configured discount rules and redemption statistics.
- **Access:** Private (`ADMIN`, `STAFF`).

##### `POST /api/v1/discounts`
- **Purpose:** Create discount coupon with eligibility requirements and redemption bounds.
- **Access:** Private (`ADMIN` only).
- **Request Body:**
  ```json
  {
    "code": "SUMMER25",
    "type": "PERCENTAGE",
    "value": 25.00,
    "minPurchaseAmount": 100.00,
    "minQuantity": 1,
    "maxRedemptions": 100,
    "maxPerCustomer": 1,
    "startDate": "2026-06-01T00:00:00Z",
    "endDate": "2026-08-31T23:59:59Z"
  }
  ```
- **Response `201 Created`:** Created discount rule.

##### `POST /api/v1/discounts/validate`
- **Purpose:** Test and validate discount eligibility before redemption.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER`).
- **Request Body:**
  ```json
  {
    "code": "SUMMER25",
    "customerId": "cust_uuid",
    "purchaseAmount": 200.00
  }
  ```
- **Response `200 OK`:** `{ "discountAmount": 50.00, "newTotal": 150.00 }`.

#### 4. Payment Processing & Gateway Webhooks

##### `POST /api/v1/payments`
- **Purpose:** Record manual offline payment (bank wire, card, cash, check).
- **Access:** Private (`ADMIN`, `STAFF`).
- **Request Body:**
  ```json
  {
    "invoiceId": "inv_uuid",
    "amount": 250.00,
    "paymentMethod": "BANK_WIRE",
    "paymentDate": "2026-10-31T12:00:00Z",
    "transactionReference": "WIRE-REF-998877",
    "notes": "Verified in bank statement"
  }
  ```
- **Response `201 Created`:** Payment record. Updates invoice `amountPaid` and marks `PAID` or `PARTIALLY_PAID`.

##### `POST /api/v1/payments/create-order`
- **Purpose:** Initiate online checkout order with payment gateway (Razorpay / Mock).
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER` own).
- **Request Body:** `{ "invoiceId": "inv_uuid" }`
- **Response `200 OK`:** `{ "orderId": "order_rzp_12345", "amount": 250.00, "currency": "USD", "keyId": "rzp_test_..." }`

##### `POST /api/v1/payments/verify`
- **Purpose:** Verify cryptographic HMAC signature from gateway and record payment.
- **Access:** Authenticated (`ADMIN`, `STAFF`, `CUSTOMER` own).
- **Request Body:**
  ```json
  {
    "invoiceId": "inv_uuid",
    "orderId": "order_rzp_12345",
    "paymentId": "pay_rzp_998877",
    "signature": "hmac_sha256_signature_hex"
  }
  ```
- **Response `200 OK`:** Verified payment record.

##### `POST /api/v1/payments/webhook`
- **Purpose:** Asynchronous payment notification from gateway.
- **Access:** Public endpoint guarded by Cryptographic Signature Header (`X-Razorpay-Signature`).
- **Headers:** `X-Razorpay-Signature: <hmac_hex>`
- **Request Body:** Gateway webhook event payload.
- **Response `200 OK`:** `{ "received": true }` (Idempotently handles duplicate webhooks via `webhook_events` table).

#### 5. Smart Dunning Retries & Refund Management

##### `GET /api/v1/payments/retries`
- **Purpose:** Query retry history across invoices.
- **Access:** Private (`ADMIN`, `STAFF`).

##### `POST /api/v1/payments/retries/:invoiceId/manual`
- **Purpose:** Manually trigger dunning card retry. Escalates and pauses subscription after 4 consecutive failures.
- **Access:** Private (`ADMIN`, `STAFF`).

##### `POST /api/v1/refunds`
- **Purpose:** Process full or partial refund against recorded payment.
- **Access:** Private (`ADMIN`, `STAFF`).
- **Request Body:**
  ```json
  {
    "paymentId": "pay_uuid",
    "amount": 100.00,
    "reason": "Overcharge refund"
  }
  ```
- **Response `201 Created`:** Refund record. Updates payment status to `PARTIALLY_REFUNDED` or `REFUNDED` and recalculates invoice balance.

##### `GET /api/v1/refunds`
- **Purpose:** Query refund transaction ledger.
- **Access:** Private (`ADMIN`, `STAFF`).

---

#### 6. Cross-Member Integration Contracts for Member 4

Member 3 exposes the following integration endpoints and data structures for Member 4's analytics, dashboard, fraud detection, and audit modules:
1. **Financial MRR / ARR Metrics:** `GET /api/v1/invoices` with `status=PAID` aggregates recognized revenue.
2. **Receivables Aging Report:** `GET /api/v1/invoices/overdue` returns grouped aging brackets (0-30, 31-60, 61-90, 90+ days) and outstanding debt.
3. **Account Health Degradation Trigger:** When dunning retries fail 4 consecutive times, Member 3 triggers BullMQ job `subscription-paused` with reason `DUNNING_EXHAUSTED` so Member 4 can degrade account health score.
4. **Refund & Chargeback Fraud Telemetry:** `GET /api/v1/refunds` supplies transaction timestamps, payment IDs, and customer IDs to Member 4's 8-rule fraud engine.
5. **Customer Isolation Standard:** All customer queries enforce tenant isolation checking `req.user.customerId`. Unauthorized cross-tenant queries return `404 Not Found`.

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
