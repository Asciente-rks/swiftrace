# SwiftRace

> A serverless logistics tracking platform — customers place sample orders, shippers progress them through a four-stage delivery lifecycle, admins verify status changes, and recipients track packages by tracking number.

SwiftRace is a portfolio-shaped logistics system that captures the moving parts of a real shipping platform without the operational weight: 15 independent AWS Lambdas behind API Gateway, DynamoDB single-table design, a React 19 + Vite frontend, and an immutable history timeline so every shipment has a paper trail.

---

## Live Demo

- **🌐 Live app:** [swiftrace.vercel.app](https://swiftrace.vercel.app)
- **🔧 Backend:** AWS API Gateway (`ap-southeast-1`)

---

## Table of Contents

1. [What It Does](#what-it-does)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Database Design](#database-design)
5. [Repository Layout](#repository-layout)
6. [API Reference](#api-reference)
7. [Authentication & Credentials](#authentication--credentials)
8. [Deployment](#deployment)
9. [Cost Breakdown](#cost-breakdown)
10. [Local Development](#local-development)
11. [Author](#author)

---

## What It Does

- **Place sample orders** — `placeSampleOrder` stands up a complete demo shipment in one call (useful for testing and onboarding).
- **Create real shipments** with origin, destination, customer, and a generated tracking number.
- **Update shipment status** through four lifecycle stages: `preparing → in_transit → out_for_delivery → delivered`.
- **Track by tracking number** — public-facing endpoint returns shipment metadata + sanitized history timeline.
- **Email tracking links** to recipients on demand.
- **Verify history events** as an admin — internal `admin_verified` flag is hidden from public history responses.
- **Filter shipments** by status (admin/shipper view) or by customer (customer view).
- **Three-role model** with verification gating — shippers and admins need approval before they can act.

---

## Architecture

```
┌────────────────────────────┐
│ Browser (React 19 + Vite)  │
│  • Vercel-hosted SPA       │
│  • react-router 7          │
└───────────┬────────────────┘
            │ REST + JWT (Bearer)
            │
            ▼
┌────────────────────────────┐
│  AWS API Gateway (REST)    │
│  ap-southeast-1            │
└───┬────────────────────────┘
    │ per-route HTTP integration
    │
    ▼
┌────────────────────────────────────────┐
│ 15 Lambda functions                    │
│  Users:                                │
│   • createUser, loginUser, updateUser, │
│     deleteUser, getUserByRole          │
│  Shipments:                            │
│   • createShipment, updateShipment,    │
│     getShipmentByTracking,             │
│     getShipmentByStatus,               │
│     getShipmentHistory,                │
│     placeSampleOrder,                  │
│     sendTrackingEmail                  │
│  Dev:                                  │
│   • seedDatabase, clearDatabase        │
└───────────────┬────────────────────────┘
                │
                ▼
        ┌───────────────────┐
        │ DynamoDB single   │
        │ table             │
        │  + 4 GSIs         │
        │ (role / status /  │
        │  shipmentId /     │
        │  trackingNumber)  │
        └───────────────────┘
                │
                ▼
        ┌───────────────────┐
        │ Nodemailer / SMTP │  (tracking email links)
        └───────────────────┘
```

**Notable architectural choices:**

- **15 independent Lambdas** rather than one router-Lambda — each function does one thing (`createShipment`, `getShipmentByTracking`, etc.). `serverless.yml` declares the route, IAM, and timeout per function. Rollbacks are per-function.
- **Single-table DynamoDB** with PK/SK prefixes. Four GSIs cover the read patterns the API needs.
- **Tracking number as the partition key** because every customer-facing read is "look up shipment X by tracking" — public reads need zero GSI hops.
- **History events sit under the same partition** as the parent shipment — a single `Query` returns the full timeline.
- **`status_` stored prefixed** (`STATUS#in_transit`) inside the GSI to avoid hot-partitioning. The service layer transparently strips the prefix on read.

---

## Tech Stack

### Backend

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js 20 + TypeScript 5 | Latest LTS on Lambda |
| Framework | **Serverless Framework v3** | Per-function HTTP events, idempotent deploys |
| HTTP | API Gateway REST | Built-in CORS, throttling, IAM |
| Database | **DynamoDB single-table** | 25 GB free perpetually, single-digit ms latency |
| Driver | `aws-sdk` v2 `DocumentClient` | Mature, batteries-included |
| Auth | JWT (`jsonwebtoken`) + custom hash | Stateless, simple |
| Validation | Yup | Tiny, ergonomic |
| Email | nodemailer + SMTP | Free with Gmail / any provider |
| Deploy plugin | `serverless-dotenv-plugin` | Inject `.env` into Lambda env |

### Frontend

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | React 19 + TypeScript 5 | Latest, concurrent features |
| Build | Vite 8 | Fast dev loop |
| Routing | react-router-dom 7 | Latest API |
| HTTP | `fetch` + `localStorage` for token | No axios needed |
| Styling | Plain CSS modules | No Tailwind — sometimes simpler is better |
| Hosting | **Vercel** | Hobby tier free, global CDN |

---

## Database Design

SwiftRace uses **DynamoDB single-table design**. One table stores users, shipments, and shipment history events; four global secondary indexes cover the read patterns.

### Table: `swiftrace-logistics-{stage}`

| Item type | PK | SK | What it holds |
|-----------|----|----|---------------|
| **USER** | `USER#<user_id>` | `METADATA` | account + role + verification |
| **SHIPMENT** | `SHIPMENT#<tracking_number>` | `METADATA` | shipment metadata + status |
| **HISTORY** | `SHIPMENT#<tracking_number>` | `EVENT#<historyId>` | one row per state transition |

### Global Secondary Indexes

| Index | Hash key | Range key | Purpose |
|-------|----------|-----------|---------|
| `role-createdAt-index` | `role` | `createdAt` | List users by role, newest-first |
| `status-updatedAt-index` | `status_` (prefixed) | `updatedAt` | List shipments by status |
| `shipmentId-index` | `shipment_id` | — | Update by shipment_id (SK lookup needs tracking#) |
| `trackingNumber-index` | `tracking_number` | — | Lookups by tracking outside SHIPMENT# scope |

### USER record

| Attribute | Type | Notes |
|-----------|------|-------|
| `user_id` | String | UUID |
| `name` | String | display name |
| `email` | String | login key (scan-by-email) |
| `phone` | String | optional |
| `role` | String | `'customer' \| 'shipper' \| 'admin'` |
| `verification_status` | String | `'pending' \| 'verified' \| 'rejected'` |
| `verifiedAt` | String | ISO, set when admin verifies |
| `verifiedBy` | String | user_id of admin who verified |
| `password_hash` | String | scrypt; **never returned via API** |
| `createdAt` / `updatedAt` | String | ISO |
| `rolePk` / `roleSk` | String | GSI projection keys |

### SHIPMENT record

| Attribute | Type | Notes |
|-----------|------|-------|
| `shipment_id` | String | UUID |
| `customer_id` | String | links to a USER |
| `customer_name` | String | denormalized for display |
| `product_name` | String | currently always `"sample"` (demo dataset) |
| `tracking_number` | String | unique, primary lookup key |
| `origin` | String | source location |
| `destination` | String | target location |
| `current_location` | String | optional, updated mid-transit |
| `status_` | String | `STATUS#<status>` in storage; plain `status` in API responses |
| `createdAt` / `updatedAt` | String | ISO |

### HISTORY record

Sortable by `historyId` within a shipment's partition.

| Attribute | Type | Notes |
|-----------|------|-------|
| `tracking_number` | String | parent shipment |
| `historyId` | String | UUID |
| `historyType` | String | `'created' \| 'picked_up' \| 'in_transit' \| 'out_for_delivery' \| 'delivered'` |
| `historyAt` | String | ISO |
| `status` | String | optional, snapshot of shipment status |
| `current_location` | String | optional |
| `details` | String | free-form note |
| `admin_verified` | Boolean | **internal — stripped from public history responses** |
| `verifiedAt` / `verifiedBy` | String | also stripped |

**Notable design choices:**

- **Public history responses use a stripped variant** (`ShipmentHistoryResponse`) that hides `admin_verified` / `verifiedAt` / `verifiedBy` so customers never see internal moderation metadata.
- **`PAY_PER_REQUEST` billing** keeps cost proportional to traffic — fine for portfolio traffic and predictable for production at low volume.

---

## Repository Layout

This is a **monorepo**: backend Lambdas and frontend SPA in one repository.

```
swiftrace/
├── backend/
│   ├── package.json                 # AWS SDK v2, JWT, nodemailer, yup
│   ├── serverless.yml               # 15 functions + 1 DynamoDB table + 4 GSIs
│   ├── tsconfig.json
│   ├── seed.ts                      # Local seeder
│   ├── clear.ts                     # Local DB clear
│   ├── config/
│   │   ├── config.ts
│   │   └── db.ts                    # DocumentClient
│   └── src/
│       ├── handler.ts               # Main entry (1-line stub - functions are direct)
│       ├── functions/
│       │   ├── user/                # createUser, loginUser, updateUser,
│       │   │                        # deleteUser, getUserByRole
│       │   ├── shipment/            # createShipment, updateShipment,
│       │   │                        # getShipmentByTracking, getShipmentByStatus,
│       │   │                        # getShipmentHistory, placeSampleOrder,
│       │   │                        # sendTrackingEmail
│       │   └── dev/                 # seedDatabase, clearDatabase (HTTP)
│       ├── service/
│       │   └── dynamodb.ts          # Single DynamoDBService class —
│       │                            # users + shipments + history
│       ├── types/                   # user, shipment, history
│       ├── utils/
│       │   ├── auth.ts, jwt.ts, password.ts
│       │   ├── email.ts
│       │   ├── env.ts
│       │   ├── error-handler.ts
│       │   ├── parse.ts, user.ts
│       └── validation/              # yup schemas (shipment, user)
└── frontend/
    ├── package.json                 # React 19, Vite 8, react-router 7
    ├── vite.config.js
    ├── vercel.json
    ├── public/                      # favicon, icons sprite sheet
    └── src/
        ├── App.tsx                  # Login → ProtectedRoute → Dashboard
        ├── App.css
        ├── main.tsx
        ├── index.css
        ├── assets/                  # Logo (light/dark), drone GIF, robot GIF
        ├── components/
        │   ├── LoginPage/
        │   ├── HeroSection/
        │   ├── AdminSection/
        │   ├── SampleOrderSection/
        │   ├── ShipmentUpdateSection/
        │   ├── UsersView/
        │   ├── Sidebar/
        │   ├── ConsoleSection.tsx, FlowSection.tsx
        │   ├── Dashboard.tsx, ShipmentsView.tsx
        │   ├── DevTools.tsx, Footer.tsx, Topbar.tsx
        │   ├── ThemeToggle.tsx, UserDropdown.tsx
        │   ├── ProtectedRoute.tsx, ErrorBoundary.tsx
        │   └── Logo.tsx, Illustration.tsx
        ├── contexts/                # ThemeContext + useTheme hook
        ├── types/api.ts
        └── utils/
            ├── auth.ts
            └── chartTheme.ts
```

---

## API Reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/users` | none | Register a user (default role `customer`) |
| `POST` | `/auth/login` | none | Email + password → JWT |
| `PUT` | `/users/{user_id}` | JWT | Update name / phone / role / verification |
| `DELETE` | `/users/{user_id}` | JWT | Remove a user |
| `GET` | `/users` | JWT | List users by role (`?role=customer\|shipper\|admin`) |
| `POST` | `/orders/sample` | JWT | Place a sample order (demo helper) |
| `POST` | `/shipments` | JWT | Create a real shipment |
| `PUT` | `/shipments/{shipment_id}` | JWT | Update status / current_location |
| `GET` | `/shipments/tracking/{tracking_number}` | JWT | Public lookup by tracking number |
| `GET` | `/shipments/{tracking_number}/history` | JWT | Sanitized event timeline (public) |
| `GET` | `/shipments/status/{status_}` | JWT | Internal: shipments at a given status |
| `POST` | `/shipments/tracking/email` | JWT | Email a tracking link to a customer |
| `POST` | `/dev/seed` | JWT | Bulk seed demo data |
| `POST` | `/dev/clear` | JWT | Wipe table contents |

Every endpoint enables CORS at the API Gateway level. Authorized routes expect `Authorization: Bearer <jwt>`.

---

## Authentication & Credentials

### Seeded accounts

`npm run seed` (run from `backend/`) creates these three pre-verified accounts:

| Email | Role | Password |
|---|---|---|
| `admin@swiftrace.com` | admin | `admin123` |
| `shipper@swiftrace.com` | shipper | `shipper123` |
| `customer@swiftrace.com` | customer | `customer123` |

Customers register publicly with `verification_status: 'verified'` (auto). Shippers and admins register as `'pending'` — an existing admin must promote them to `'verified'` before they can do most write actions.

### Self-registration

1. Visit the live demo, click **Register**.
2. Enter email + password — defaults to `customer` role with `verified` status.
3. Sign in.

To register as a shipper or admin, edit your role through an admin's user-management view (after they verify you).

### Dev Tools quick-login

The login page ships with a floating **⚙ Dev Tools** button in the bottom-right corner. Click it to one-shot sign in as Admin / Shipper / Customer using the seeded credentials — handy for portfolio reviewers who don't want to type anything. The button still goes through the rate-limited `/auth/login` endpoint; it just skips the typing.

---

## Hardening

Because the live demo is reachable by anyone on the public internet, the API and frontend ship a few defenses:

- **Per-IP login rate limiting** — `backend/src/utils/rate-limit.ts` keeps an in-memory bucket per client IP. `/auth/login` is capped at 5 attempts per 60-second window. Hitting the limit returns `429` with `Retry-After`, `X-RateLimit-Limit`, and `X-RateLimit-Remaining` headers so the frontend can show a friendly "slow down" message. State is per Lambda warm container; for a multi-container production deploy, swap the in-memory `Map` for DynamoDB or Redis.
- **Hardened security headers on every response** (set in `backend/src/utils/error-handler.ts`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `Cross-Origin-Resource-Policy: cross-origin`, plus a generic `Server: Swiftrace` header to mask the runtime fingerprint.
- **Generic 500s** — the global error handler no longer leaks `error.message` or stack traces; clients always see `{ status: 500, message: "Internal server error" }`.
- **Frontend bundle hardening** — `frontend/src/utils/security.ts` runs at boot in production builds:
  - Replaces every `console.*` method with a no-op and clears the console every 1.5s, so opening DevTools shows nothing useful.
  - Disables the React DevTools global hook so the React component tree isn't browsable.
  - **Does NOT block F12, right-click, or `Ctrl+Shift+I`** — the dev tools panel itself stays open-able. The defenses are about making what's inside opaque, not about pretending the user can't open it.
- **Vite production build** — `vite.config.js` drops every `console.*` call and `debugger` statement from the bundle, disables source maps, and rewrites entry / chunk / asset filenames as content hashes. Combined with esbuild's name mangling, the deployed JS reads as a wall of single-letter identifiers in DevTools.

---

## Deployment

### Backend → AWS Lambda via Serverless Framework

Defined in `backend/serverless.yml`:

- **Region:** `ap-southeast-1` (default; override with `--region`).
- **Stage:** `${opt:stage, 'dev'}` (override with `--stage prod`).
- **Runtime:** `nodejs20.x`.
- **Functions:** 15 — five user, seven shipment, two dev, plus the implicit handler.
- **DynamoDB:** the `LogisticsTable` resource is provisioned alongside the functions so a single `serverless deploy` brings up infrastructure and code together.
- **IAM:** scoped to DynamoDB CRUD on the table + all GSIs.
- **Per-function timeout:** 29 seconds (just under API Gateway's 30s limit).

Deploy:

```bash
cd backend
npm install
npm run build
npx serverless deploy --stage prod
```

`serverless-dotenv-plugin` injects `.env` values (or env vars) into Lambda environment.

### Frontend → Vercel

```bash
cd frontend
npm install
npm run build
# `vercel --prod` or auto-deploy on push to main
```

`vercel.json` covers SPA fallback routing.

---

## Cost Breakdown

> **Designed for $0/month forever.** Every layer of SwiftRace runs on a free tier with no expiry.

| Service | Free tier | We use | Headroom |
|---------|-----------|--------|----------|
| **AWS Lambda** | 1M invocations/mo + 400K GB-s | ~5K invocations/mo | **99.5%** |
| **API Gateway REST** | 1M requests/mo (12 months) | ~5K requests/mo | **99.5%** |
| **DynamoDB (PAY_PER_REQUEST)** | 25 GB storage + 25 R/W units (perpetual) | <100 MB | **99%+** |
| **CloudWatch Logs** | 5 GB ingestion/mo | <50 MB | **99%** |
| **Vercel Hobby** | 100 GB bandwidth, unlimited deploys | <500 MB/mo | **99.5%** |
| **GitHub Actions** (public repo) | unlimited minutes | n/a (manual deploy) | unlimited |
| **SMTP (Gmail / similar)** | 500/day | <10/day | **98%** |

**Total: $0/month**, with massive headroom on every line.

> Note: API Gateway's 1M req/mo free tier is for the first 12 months; after that it's **$3.50 per million** — still effectively free at portfolio scale.

**Why each free tier was chosen:**

- **DynamoDB over RDS** — 25 GB free perpetually, single-digit ms latency, no cold start.
- **Per-function Lambdas over a router-Lambda** — granular cold starts, isolated failures, IAM scoped per route.
- **Vercel over self-hosting** — global CDN + free SSL + automatic deploys on push.
- **Serverless Framework over CDK / SAM** — simpler YAML, mature ecosystem, faster onboarding.

---

## Local Development

### Backend

```bash
cd backend
npm install
# Build TypeScript
npm run build

# Seed local DynamoDB (e.g. dynamodb-local) with demo data
npm run seed

# Wipe demo data
npm run clear
```

Local Lambda execution can be done via `serverless invoke local --function createShipment --path event.json` or Serverless Offline.

### Frontend

```bash
cd frontend
npm install
npm run dev          # Vite + HMR on port 5173 by default
npm run lint         # ESLint
npm run build        # Production bundle
npm run preview      # Serve dist/ locally
```

Set `VITE_API_BASE` in `frontend/.env` to your API Gateway URL.

### Environment Variables

**Backend** (`.env` consumed by `serverless-dotenv-plugin`):

```env
LOGISTICS_DYNAMO_TABLE=swiftrace-logistics-dev
SHIPMENT_DYNAMO_TABLE=swiftrace-logistics-dev   # defaults to LOGISTICS_DYNAMO_TABLE

JWT_SECRET=...
JWT_EXPIRES_IN=7d

EMAIL_USER=...
EMAIL_PASS=...

DEFAULT_ORIGIN=Warehouse
```

**Frontend** (`frontend/.env`):

```env
VITE_API_BASE=https://<api-id>.execute-api.ap-southeast-1.amazonaws.com/dev
```

---

## Author

Built by **Ralph Kenneth F. Sonio** ([@Asciente-rks](https://github.com/Asciente-rks)). Live at **[swiftrace.vercel.app](https://swiftrace.vercel.app)**.
