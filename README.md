# SwiftRace

> A serverless logistics tracking platform — customers place sample orders, shippers progress them through a four-stage delivery lifecycle, admins verify status changes, and recipients track packages by tracking number.

SwiftRace is a portfolio-shaped logistics system that captures the moving parts of a real shipping platform without the operational weight: **a single AWS Lambda exposed via Lambda Function URL**, an internal router fan-out to 14 handler functions, DynamoDB single-table design, a React 19 + Vite frontend, and an immutable history timeline so every shipment has a paper trail.

The infrastructure is deployed by **GitHub Actions** straight to AWS — **no Serverless Framework, no API Gateway, no S3 bucket for code, no CloudFormation stack**. Just `aws lambda update-function-code` from CI.

---

## Live Demo

- **🌐 Live app:** [swiftrace.vercel.app](https://swiftrace.vercel.app)
- **🔧 Backend:** AWS Lambda Function URL (`ap-southeast-1`)

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
11. [Conversion Notice](#conversion-notice)
12. [Author](#author)

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
┌────────────────────────────────┐
│ Browser (React 19 + Vite)      │
│  • Vercel-hosted SPA           │
│  • react-router 7              │
└──────────────┬─────────────────┘
               │  fetch() + JWT (Bearer)
               │  HTTPS, CORS open
               ▼
┌────────────────────────────────────────────────────────────┐
│  AWS Lambda Function URL                                   │
│  https://<id>.lambda-url.ap-southeast-1.on.aws/            │
│  (no API Gateway — direct, free forever)                   │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│  swiftrace-api · single Lambda (Node.js 20)                │
│  ──────────────────────────────────────────                │
│  router.ts                                                 │
│   ├─ adaptEvent(v2 → v1)   ← keeps existing handlers as-is │
│   └─ pattern-match → 14 handlers:                          │
│        users      · createUser, loginUser, updateUser,     │
│                     deleteUser, getUserByRole              │
│        shipments  · createShipment, updateShipment,        │
│                     getShipmentByTracking,                 │
│                     getShipmentByStatus,                   │
│                     getShipmentHistory,                    │
│                     placeSampleOrder, sendTrackingEmail    │
│        dev        · seedDatabase, clearDatabase            │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
        ┌──────────────────────────┐
        │ DynamoDB single table    │
        │  swiftrace-logistics     │
        │  PK · SK + 4 GSIs:       │
        │   role-createdAt-index   │
        │   status-updatedAt-index │
        │   shipmentId-index       │
        │   trackingNumber-index   │
        │  PAY_PER_REQUEST         │
        └──────────┬───────────────┘
                   │
                   ▼
        ┌──────────────────────────┐
        │ Nodemailer / SMTP        │  (tracking email links)
        └──────────────────────────┘

         ▲
         │  deploy on push to main
         │
┌────────┴──────────────────────────────────────┐
│  GitHub Actions · .github/workflows/          │
│   deploy-backend.yml                          │
│   ├─ esbuild bundle → function.zip            │
│   ├─ aws dynamodb create-table  (idempotent)  │
│   ├─ aws iam create-role        (idempotent)  │
│   ├─ aws lambda create/update-function-code   │
│   └─ aws lambda create-function-url-config    │
└───────────────────────────────────────────────┘
```

**Notable architectural choices:**

- **Single-Lambda router fan-out, not 14 separate Lambdas.** The original Serverless Framework setup deployed each handler as its own Lambda behind a per-route API Gateway integration. After the conversion, **one** Lambda receives every request via its Function URL and dispatches internally. Cold-start cost is paid once per warm container, not 14 times. Each handler file under `src/functions/**` is unchanged — the router uses `adaptEvent()` to translate Function URL events (payload v2.0) into the `APIGatewayProxyEvent` shape every handler was originally written against.
- **Lambda Function URL, not API Gateway.** Eliminates the API Gateway HTTP request charge that kicks in after the 12-month free tier. Function URLs are billed strictly as Lambda invocations.
- **Single-table DynamoDB** with PK/SK prefixes. Four GSIs cover the read patterns the API needs.
- **Tracking number as the partition key** because every customer-facing read is "look up shipment X by tracking" — public reads need zero GSI hops.
- **History events sit under the same partition** as the parent shipment — a single `Query` returns the full timeline.
- **`status_` stored prefixed** (`STATUS#in_transit`) inside the GSI to avoid hot-partitioning. The service layer transparently strips the prefix on read.

---

## Tech Stack

### Backend

| Layer       | Technology                                    | Why                                                                |
| ----------- | --------------------------------------------- | ------------------------------------------------------------------ |
| Runtime     | Node.js 20 + TypeScript 5                     | Latest LTS on Lambda                                               |
| Bundler     | **esbuild**                                   | One-shot CJS bundle, ~80 ms cold start, replaces `serverless deploy` |
| Compute     | **AWS Lambda + Function URL**                 | No API Gateway = no per-request fee after free tier                |
| Database    | **DynamoDB single-table** (`PAY_PER_REQUEST`) | 25 GB free perpetually, single-digit ms latency                    |
| Driver      | `aws-sdk` v2 `DocumentClient`                 | Mature, batteries-included — bundled into the function zip         |
| Auth        | JWT (`jsonwebtoken`) + scrypt password hash   | Stateless, simple                                                  |
| Validation  | Yup                                           | Tiny, ergonomic                                                    |
| Email       | nodemailer + SMTP                             | Free with Gmail / any provider                                     |
| Deploy      | **GitHub Actions** + `aws-cli`                | One workflow; no Serverless Framework, no CloudFormation, no S3    |

### Frontend

| Layer     | Technology               | Why                                          |
| --------- | ------------------------ | -------------------------------------------- |
| Framework | React 19 + TypeScript 5  | Latest, concurrent features                  |
| Build     | Vite 8                   | Fast dev loop                                |
| Routing   | react-router-dom 7       | Latest API                                   |
| HTTP      | `fetch` + `localStorage` | No axios needed                              |
| Styling   | Plain CSS modules        | No Tailwind — sometimes simpler is better    |
| Hosting   | **Vercel**               | Hobby tier free, global CDN                  |

---

## Database Design

SwiftRace uses **DynamoDB single-table design**. One table stores users, shipments, and shipment history events; four global secondary indexes cover the read patterns.

### Table: `swiftrace-logistics`

| Item type    | PK                            | SK                       | What it holds                       |
| ------------ | ----------------------------- | ------------------------ | ----------------------------------- |
| **USER**     | `USER#<user_id>`              | `METADATA`               | account + role + verification       |
| **SHIPMENT** | `SHIPMENT#<tracking_number>`  | `METADATA`               | shipment metadata + status          |
| **HISTORY**  | `SHIPMENT#<tracking_number>`  | `EVENT#<historyId>`      | one row per state transition        |

### Global Secondary Indexes

| Index                  | Hash key             | Range key   | Purpose                                                      |
| ---------------------- | -------------------- | ----------- | ------------------------------------------------------------ |
| `role-createdAt-index` | `role`               | `createdAt` | List users by role, newest-first                             |
| `status-updatedAt-index` | `status_` (prefixed) | `updatedAt` | List shipments by status                                     |
| `shipmentId-index`     | `shipment_id`        | —           | Update by shipment_id (SK lookup needs tracking#)            |
| `trackingNumber-index` | `tracking_number`    | —           | Lookups by tracking outside SHIPMENT# scope                  |

The exact same schema is recreated by `backend/scripts/deploy.sh` on first run via `aws dynamodb create-table` — no Serverless / CloudFormation involvement.

### USER record

| Attribute             | Type    | Notes                                          |
| --------------------- | ------- | ---------------------------------------------- |
| `user_id`             | String  | UUID                                           |
| `name`                | String  | display name                                   |
| `email`               | String  | login key (scan-by-email)                      |
| `phone`               | String  | optional                                       |
| `role`                | String  | `'customer' \| 'shipper' \| 'admin'`           |
| `verification_status` | String  | `'pending' \| 'verified' \| 'rejected'`        |
| `verifiedAt`          | String  | ISO, set when admin verifies                   |
| `verifiedBy`          | String  | user_id of admin who verified                  |
| `password_hash`       | String  | scrypt; **never returned via API**             |
| `createdAt` / `updatedAt` | String | ISO                                          |
| `rolePk` / `roleSk`   | String  | GSI projection keys                            |

### SHIPMENT record

| Attribute           | Type    | Notes                                                            |
| ------------------- | ------- | ---------------------------------------------------------------- |
| `shipment_id`       | String  | UUID                                                             |
| `customer_id`       | String  | links to a USER                                                  |
| `customer_name`     | String  | denormalized for display                                         |
| `product_name`      | String  | currently always `"sample"` (demo dataset)                       |
| `tracking_number`   | String  | unique, primary lookup key                                       |
| `origin`            | String  | source location                                                  |
| `destination`       | String  | target location                                                  |
| `current_location`  | String  | optional, updated mid-transit                                    |
| `status_`           | String  | `STATUS#<status>` in storage; plain `status` in API responses    |
| `createdAt` / `updatedAt` | String | ISO                                                          |

### HISTORY record

| Attribute            | Type    | Notes                                                                            |
| -------------------- | ------- | -------------------------------------------------------------------------------- |
| `tracking_number`    | String  | parent shipment                                                                  |
| `historyId`          | String  | UUID                                                                             |
| `historyType`        | String  | `'created' \| 'picked_up' \| 'in_transit' \| 'out_for_delivery' \| 'delivered'`  |
| `historyAt`          | String  | ISO                                                                              |
| `status`             | String  | optional, snapshot of shipment status                                            |
| `current_location`   | String  | optional                                                                         |
| `details`            | String  | free-form note                                                                   |
| `admin_verified`     | Boolean | **internal — stripped from public history responses**                            |
| `verifiedAt` / `verifiedBy` | String | also stripped                                                                |

**Notable design choices:**

- **Public history responses use a stripped variant** (`ShipmentHistoryResponse`) that hides `admin_verified` / `verifiedAt` / `verifiedBy` so customers never see internal moderation metadata.
- **`PAY_PER_REQUEST` billing** keeps cost proportional to traffic — fine for portfolio traffic and predictable for production at low volume.

---

## Repository Layout

This is a **monorepo**: backend Lambdas and frontend SPA in one repository.

```
swiftrace/
├── .github/workflows/
│   └── deploy-backend.yml        # GitHub Actions → AWS Lambda
├── backend/
│   ├── package.json              # AWS SDK v2, JWT, nodemailer, yup, esbuild
│   ├── build.mjs                 # esbuild → dist/index.js
│   ├── tsconfig.json
│   ├── seed.ts                   # Local seeder (calls DynamoDBService directly)
│   ├── clear.ts                  # Local DB clear
│   ├── .env.example              # Local env template
│   ├── scripts/
│   │   └── deploy.sh             # Idempotent: provision DDB + IAM + Lambda + URL
│   ├── config/
│   │   ├── config.ts
│   │   └── db.ts                 # DocumentClient
│   └── src/
│       ├── router.ts             # Function URL entry — pattern-matches and dispatches
│       ├── functions/
│       │   ├── user/             # createUser, loginUser, updateUser,
│       │   │                     # deleteUser, getUserByRole
│       │   ├── shipment/         # createShipment, updateShipment,
│       │   │                     # getShipmentByTracking, getShipmentByStatus,
│       │   │                     # getShipmentHistory, placeSampleOrder,
│       │   │                     # sendTrackingEmail
│       │   └── dev/              # seedDatabase, clearDatabase
│       ├── service/
│       │   └── dynamodb.ts       # Single DynamoDBService class —
│       │                         # users + shipments + history
│       ├── types/                # user, shipment, history
│       ├── utils/
│       │   ├── auth.ts, jwt.ts, password.ts
│       │   ├── email.ts
│       │   ├── env.ts
│       │   ├── error-handler.ts
│       │   ├── event-adapter.ts  # NEW · v2 (Function URL) → v1 event shape
│       │   ├── parse.ts, user.ts
│       │   └── rate-limit.ts
│       └── validation/           # yup schemas (shipment, user)
└── frontend/
    ├── package.json              # React 19, Vite 8, react-router 7
    ├── vite.config.js
    ├── vercel.json
    ├── public/                   # favicon, icons sprite sheet
    └── src/                      # … unchanged …
```

---

## API Reference

All endpoints sit under the Lambda Function URL — set `VITE_API_BASE` in the frontend to the URL printed by the deploy workflow.

| Method    | Path                                       | Auth | Purpose                                                  |
| --------- | ------------------------------------------ | ---- | -------------------------------------------------------- |
| `POST`    | `/users`                                   | none | Register a user (default role `customer`)                |
| `POST`    | `/auth/login`                              | none | Email + password → JWT                                   |
| `PUT`     | `/users/{user_id}`                         | JWT  | Update name / phone / role / verification                |
| `DELETE`  | `/users/{user_id}`                         | JWT  | Remove a user                                            |
| `GET`     | `/users`                                   | JWT  | List users by role (`?role=customer\|shipper\|admin`)    |
| `POST`    | `/orders/sample`                           | JWT  | Place a sample order (demo helper)                       |
| `POST`    | `/shipments`                               | JWT  | Create a real shipment                                   |
| `PUT`     | `/shipments/{shipment_id}`                 | JWT  | Update status / current_location                         |
| `GET`     | `/shipments/tracking/{tracking_number}`    | JWT  | Public lookup by tracking number                         |
| `GET`     | `/shipments/{tracking_number}/history`     | JWT  | Sanitized event timeline (public)                        |
| `GET`     | `/shipments/status/{status_}`              | JWT  | Internal: shipments at a given status                    |
| `POST`    | `/shipments/tracking/email`                | JWT  | Email a tracking link to a customer                      |
| `POST`    | `/dev/seed`                                | JWT  | Bulk seed demo data                                      |
| `POST`    | `/dev/clear`                               | JWT  | Wipe table contents                                      |
| `GET`     | `/` or `/health`                           | none | Liveness probe (returns `{status: 200, service: "swiftrace-api"}`) |

CORS is opened at the Function URL config (`AllowOrigins: *`, all methods, all headers). Authorized routes expect `Authorization: Bearer <jwt>`.

---

## Authentication & Credentials

### Seeded accounts

`npm run seed` (run from `backend/`) creates these three pre-verified accounts:

| Email                     | Role     | Password      |
| ------------------------- | -------- | ------------- |
| `admin@swiftrace.com`     | admin    | `admin123`    |
| `shipper@swiftrace.com`   | shipper  | `shipper123`  |
| `customer@swiftrace.com`  | customer | `customer123` |

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

### Backend → AWS Lambda via GitHub Actions

The whole pipeline lives in **`.github/workflows/deploy-backend.yml`** plus **`backend/scripts/deploy.sh`**. Pushing to `main` (with changes under `backend/**`) triggers:

1. Checkout + Node 20 + `npm install` inside `backend/`.
2. `node build.mjs` — esbuild bundles `src/router.ts` and all 14 handlers (plus `aws-sdk` v2) into a single minified `dist/index.js`.
3. `zip -j function.zip dist/index.js`.
4. `scripts/deploy.sh`:
   - **DynamoDB** — `aws dynamodb describe-table` first; create with the four GSIs only if it does not already exist.
   - **IAM role** — `aws iam create-role` (idempotent) + always re-apply the inline policy scoped to the table + GSIs + CloudWatch Logs.
   - **Lambda** — `create-function` on first run, otherwise `update-function-code` then `update-function-configuration` (handler / role / env / memory / timeout).
   - **Function URL** — `create-function-url-config` (or update) with `AuthType=NONE` and CORS `*`.
   - **Public invoke permission** — `lambda:InvokeFunctionUrl` with principal `*`.
5. Print the Function URL into the workflow's job summary so you can copy it into Vercel as `VITE_API_BASE`.

The runner uses **only the AWS CLI**. There is no Serverless Framework, no CloudFormation stack, and no S3 bucket holding the function code — `update-function-code --zip-file fileb://...` uploads bytes directly to Lambda.

### Required GitHub Secrets

Add these in the repo's **Settings → Secrets and variables → Actions → Secrets**:

| Secret                 | Notes                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| `AWS_ACCESS_KEY_ID`    | IAM user with permissions: Lambda full + IAM role create + DynamoDB create/describe. See policy below. |
| `AWS_SECRET_ACCESS_KEY`| Pair for the access key above.                                        |
| `JWT_SECRET`           | Long random string (e.g. `openssl rand -base64 48`).                  |
| `EMAIL_USER`           | SMTP username (e.g. Gmail address used for tracking emails).          |
| `EMAIL_PASS`           | SMTP password / app password (Gmail app passwords work).              |

### Optional GitHub Variables (non-secret defaults)

Add these in **Settings → Secrets and variables → Actions → Variables** to override defaults:

| Variable             | Default              | What it controls                              |
| -------------------- | -------------------- | --------------------------------------------- |
| `AWS_REGION`         | `ap-southeast-1`     | Region for DynamoDB + Lambda                  |
| `LAMBDA_NAME`        | `swiftrace-api`      | Lambda function name                          |
| `DYNAMODB_TABLE`     | `swiftrace-logistics`| Table name                                    |
| `LAMBDA_ROLE_NAME`   | `swiftrace-lambda-role` | Execution role name                        |
| `JWT_EXPIRES_IN`     | `7d`                 | Passed through to `signJwt`                   |
| `DEFAULT_ORIGIN`     | `Warehouse`          | Default `origin` for sample orders            |

### Minimum IAM permissions for the deploy user

Attach this inline policy to the IAM user whose keys live in the secrets above:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Lambda",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration",
        "lambda:CreateFunctionUrlConfig",
        "lambda:UpdateFunctionUrlConfig",
        "lambda:GetFunctionUrlConfig",
        "lambda:AddPermission"
      ],
      "Resource": "*"
    },
    {
      "Sid": "IAMForLambdaRole",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:GetRole",
        "iam:PutRolePolicy",
        "iam:PassRole"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DynamoDB",
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DescribeTable"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Sts",
      "Effect": "Allow",
      "Action": "sts:GetCallerIdentity",
      "Resource": "*"
    }
  ]
}
```

### Lambda environment variables (set automatically by the workflow)

| Variable                  | Source              |
| ------------------------- | ------------------- |
| `LOGISTICS_DYNAMO_TABLE`  | `vars.DYNAMODB_TABLE` |
| `SHIPMENT_DYNAMO_TABLE`   | same as above       |
| `JWT_SECRET`              | `secrets.JWT_SECRET`|
| `JWT_EXPIRES_IN`          | `vars.JWT_EXPIRES_IN`|
| `EMAIL_USER`              | `secrets.EMAIL_USER`|
| `EMAIL_PASS`              | `secrets.EMAIL_PASS`|
| `DEFAULT_ORIGIN`          | `vars.DEFAULT_ORIGIN`|

`AWS_REGION` is set automatically by the Lambda runtime.

### Frontend → Vercel

```bash
cd frontend
npm install
npm run build
# `vercel --prod` or auto-deploy on push to main
```

`vercel.json` covers SPA fallback routing.

After the first backend deploy, copy the Function URL from the GitHub Actions job summary and set it as `VITE_API_BASE` in Vercel's environment variables.

---

## Cost Breakdown

> **Designed for $0/month forever.** Every layer of SwiftRace runs on a free tier with no expiry. The conversion from API Gateway + Serverless Framework + S3 to Lambda Function URL + GitHub Actions + DynamoDB removes every line that had a 12-month-only free tier.

| Service                       | Free tier                                  | We use                  | Headroom  |
| ----------------------------- | ------------------------------------------ | ----------------------- | --------- |
| **AWS Lambda**                | 1M invocations/mo + 400K GB-s (perpetual)  | ~5K invocations/mo      | **99.5%** |
| **Lambda Function URL**       | included with Lambda invocations           | same                    | **99.5%** |
| **DynamoDB (PAY_PER_REQUEST)**| 25 GB storage + 25 R/W units (perpetual)   | <100 MB                 | **99%+**  |
| **CloudWatch Logs**           | 5 GB ingestion/mo (perpetual)              | <50 MB                  | **99%**   |
| **GitHub Actions** (public repo) | unlimited minutes                       | <2 min/deploy           | unlimited |
| **Vercel Hobby**              | 100 GB bandwidth, unlimited deploys        | <500 MB/mo              | **99.5%** |
| **SMTP (Gmail / similar)**    | 500/day                                    | <10/day                 | **98%**   |

**Total: $0/month**, with no expiry on any line.

**What this conversion eliminates (vs the original Serverless + API Gateway design):**

- ❌ **API Gateway** — was $3.50/M requests after the 12-month free tier; now zero (Function URL).
- ❌ **S3 bucket for Lambda code** — Serverless Framework auto-creates one and after 12 months it bills storage; now zero (`update-function-code --zip-file` ships bytes straight to Lambda).
- ❌ **CloudFormation stack** — Serverless deploys via CloudFormation; the conversion uses raw `aws-cli` calls, so there's no CloudFormation drift / churn / S3 template storage.

---

## Local Development

### Backend

```bash
cd backend
cp .env.example .env        # then fill in JWT_SECRET, EMAIL_*, etc.
npm install

# Build the Lambda bundle locally (sanity check)
npm run build

# Seed local DynamoDB (e.g. dynamodb-local) with demo data
npm run seed

# Wipe demo data
npm run clear

# Type-check without emitting
npm run typecheck
```

For end-to-end local invocation of the router against an event, you can run a quick Node REPL:

```bash
node -e '
  const { handler } = require("./dist/index.js");
  handler({
    rawPath: "/health",
    requestContext: { http: { method: "GET" } },
    headers: {},
  }).then(r => console.log(r));
'
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # Vite + HMR on port 5173 by default
npm run lint         # ESLint
npm run build        # Production bundle
npm run preview      # Serve dist/ locally
```

Set `VITE_API_BASE` in `frontend/.env` to your Lambda Function URL.

### Environment Variables

**Backend** (`.env` consumed locally for `seed` / `clear`; CI uses GitHub Secrets):

```env
LOGISTICS_DYNAMO_TABLE=swiftrace-logistics
SHIPMENT_DYNAMO_TABLE=swiftrace-logistics

JWT_SECRET=...
JWT_EXPIRES_IN=7d

EMAIL_USER=...
EMAIL_PASS=...

DEFAULT_ORIGIN=Warehouse
```

**Frontend** (`frontend/.env`):

```env
VITE_API_BASE=https://<id>.lambda-url.ap-southeast-1.on.aws
```

---

## Conversion Notice

> SwiftRace was originally deployed via **Serverless Framework v3** + **AWS API Gateway (REST)** + a Serverless-managed S3 bucket holding the function zip + a CloudFormation stack tying everything together. As of this commit, that infrastructure has been swapped out for **GitHub Actions → AWS Lambda Function URL + DynamoDB**, with no S3, no API Gateway, and no CloudFormation. **The handler code under `src/functions/**` is unchanged.**

### What changed

| Before                                              | After                                                  |
| --------------------------------------------------- | ------------------------------------------------------ |
| `serverless.yml` declared 14 separate Lambdas       | One Lambda (`swiftrace-api`) with an internal router   |
| AWS API Gateway REST routed each path to its Lambda | Lambda **Function URL** receives every request         |
| `serverless deploy` → CloudFormation → S3 → Lambda  | GitHub Actions → `aws lambda update-function-code`     |
| Per-route IAM scoping in `serverless.yml`           | One inline policy on `swiftrace-lambda-role`           |
| `serverless-dotenv-plugin` injected `.env`          | GitHub Secrets/Variables → workflow env → Lambda env   |
| Handlers consumed v1 `APIGatewayProxyEvent`         | Same handlers — `event-adapter.ts` translates v2 → v1  |
| 12-month free tiers on API Gateway + S3             | All-perpetual free tiers (Lambda + DynamoDB + Logs)    |

### Conversion flow

```
   ┌──────────────────────────────────────┐
   │           BEFORE (Serverless)         │
   ├──────────────────────────────────────┤
   │  Browser                              │
   │     │                                 │
   │     ▼                                 │
   │  API Gateway (REST, per-route)        │  ← billed/M after 12 mo
   │     │                                 │
   │     ▼                                 │
   │  14 × Lambda                          │
   │     │                                 │
   │     ▼                                 │
   │  DynamoDB single table                │
   │                                       │
   │  Deploy: serverless deploy            │
   │   ├── CloudFormation stack            │
   │   ├── S3 bucket (function zips) ──── ←  free 12 mo only
   │   └── 14 × Lambda + 14 × API GW route │
   └──────────────────────────────────────┘
                     │
                     │  npm uninstall serverless serverless-dotenv-plugin
                     │  + add esbuild, src/router.ts, scripts/deploy.sh
                     ▼
   ┌──────────────────────────────────────┐
   │         AFTER (this commit)           │
   ├──────────────────────────────────────┤
   │  Browser                              │
   │     │                                 │
   │     ▼                                 │
   │  Lambda Function URL                  │  ← perpetual free tier
   │     │                                 │
   │     ▼                                 │
   │  1 × Lambda  ──→ router.ts ──→ 14 hdl │
   │     │                                 │
   │     ▼                                 │
   │  DynamoDB single table                │
   │                                       │
   │  Deploy: git push origin main         │
   │   └── GitHub Actions                  │
   │        └── aws lambda update-function-code
   │           (no CloudFormation, no S3)  │
   └──────────────────────────────────────┘
```

### Why the change

- **API Gateway's 1M-req free tier expires after 12 months** — at portfolio scale the bill would be cents, but cents on a "free forever" portfolio is the wrong shape.
- **Serverless Framework's S3 bucket** holding deploy artifacts was also free-for-12-months only.
- **CloudFormation drift** caused two avoidable incidents during development. Provisioning the same four-resource stack via raw `aws-cli` is faster, more legible, and easier to debug.
- **`event-adapter.ts`** keeps the conversion zero-risk on the application side: every handler under `src/functions/**` still receives the exact `APIGatewayProxyEvent` shape it was written for. The router pattern-matches on `rawPath` + HTTP method and adapts the v2 event before delegating.

### What you need to do once

1. Add the **GitHub Secrets** listed in [Deployment](#required-github-secrets).
2. (Optional) override the **GitHub Variables** if you want non-default region / table / Lambda names.
3. Push to `main`. The workflow provisions everything on the first run.
4. Copy the printed Function URL into Vercel as `VITE_API_BASE`.

That's it. No more `serverless deploy`, no more CloudFormation drift, no more 12-month timer.

---

## Author

Built by **Ralph Kenneth F. Sonio** ([@Asciente-rks](https://github.com/Asciente-rks)). Live at **[swiftrace.vercel.app](https://swiftrace.vercel.app)**.
