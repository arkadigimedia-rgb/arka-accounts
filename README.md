# ARKA Accounts Operations System

ARKA Accounts is a production-grade financial operations and accounts receivable platform engineered for agencies and growing businesses. It automates recurring billing schedules, generates legal vector PDF invoices, monitors payment aging, dispatches multi-window email reminders, securely stores proof-of-payment receipts, extracts transaction references using AI Vision OCR, reconciles payments deterministically, and enforces an atomic human approval gate before settling accounts.

The system uses **Neon PostgreSQL** as its operational source of truth. **Google Sheets** functions as a live operational input and collaborative synchronization source.

**Production Deployment:**
- **Host:** Vercel (Next.js Edge / Serverless)
- **Production Domain:** `accounts.arkadigitalmedia.in`
- **DNS Routing:** Hostinger CNAME -> `cname.vercel-dns.com`

---

## Key Capabilities

- **Zero Mockups & Zero Falsified States**: Every screen, metric, button, and API endpoint runs against live database records with real financial logic (`numeric(14,2)` precision).
- **Internal Automation Engine**: Standalone scheduler (`lib/automation-engine.ts`) with no third-party automation tools (no n8n). Runs invoice generation, payment lifecycle aging (`Asia/Kolkata`), multi-window reminders, and Google Sheets sync on demand or via cron.
- **Pure Vector PDF Invoicing**: High-performance, pure JavaScript PDF generator (`lib/invoice-pdf.ts` built on `pdf-lib`). Zero headless browsers (Puppeteer) or native binary dependencies. Fully compatible with Node.js and Cloudflare Workers.
- **Private Encrypted Storage**: Invoices and uploaded payment receipts are kept in private object storage (Cloudflare R2 in production, local in-memory buffer in development). Files are streamed exclusively via authenticated session endpoints; no public URLs are ever exposed.
- **AI OCR & Reconciliation Matrix**: Uploaded bank slips and transaction receipts are parsed via OpenAI Vision OCR (`lib/payment-proof-extraction.ts`). Extracted amounts, UTR numbers, and payment dates are matched against expected records with discrepancy tagging (`AMOUNT_MISMATCH`, `DATE_MISMATCH`, `DUPLICATE_UTR`).
- **Atomic Human Approval Gate**: By system design and regulatory policy, no payment or invoice can automatically transition to `PAID` from OCR extraction or proof upload. Settlement requires explicit human authorization by an Accounts Manager or Founder, executing an atomic transaction that marks the payment and invoice as `PAID`, records an immutable audit log, and notifies stakeholders.
- **Live Google Sheets Bidirectional Ingestion**: Comprehensive 19-column spreadsheet parser with header validation, currency cleaning (`₹`, `,`), and relational upserting into clients, billing schedules, and payments.

---

## Operational Desks & Navigation

The platform provides a unified operations console:

| Desk | Route | Purpose & Key Workflows |
| :--- | :--- | :--- |
| **Action Center** | [`/`](app/page.tsx) | Live receivables KPIs (Total Receivables, Overdue, Due Today, Pending Verification), priority alerts, and one-click triage navigation. |
| **Client Directory** | [`/clients`](app/clients/page.tsx) | Searchable client roster with GSTIN, billing terms, active schedules, and "Add Client" operational modal. |
| **Client 360° Profile** | [`/clients/[id]`](app/clients/[id]/page.tsx) | Financial lifetime metrics, itemized invoices, payment history, active billing schedules, collections follow-ups, and audit timeline. |
| **Billing Schedules** | [`/billing`](app/billing/page.tsx) | Recurring billing contracts (Monthly, Quarterly, Bi-annual, Annual, Milestone), next billing dates, and automated invoice triggers. |
| **Invoices Desk** | [`/invoices`](app/invoices/page.tsx) | Sequential invoice registry (`INV-YYYY-XXXX`), subtotal/GST breakdown, instant PDF download, and manual invoice generator. |
| **Invoice Detail** | [`/invoices/[id]`](app/invoices/[id]/page.tsx) | Itemized tax invoice breakdown, client tax info, settlement status, and embedded vector PDF viewer. |
| **Receivables Ledger** | [`/payments`](app/payments/page.tsx) | Master payment register with month and status filters (`OVERDUE`, `DUE_TODAY`, `UPCOMING`, `VERIFIED`, `PAID`). |
| **Payment 360° & Upload** | [`/payments/[id]`](app/payments/[id]/page.tsx) | Payment history, proof upload desk (drag-and-drop receipt upload), and OCR extraction inspection. |
| **Verification Queue** | [`/verification`](app/verification/page.tsx) | Queue of submitted payment proofs awaiting human review, complete with reconciliation status badges. |
| **Verification Workspace** | [`/verification/[id]`](app/verification/[id]/page.tsx) | Split-screen workspace: receipt preview alongside the reconciliation matrix, featuring atomic **Approve Payment**, **Reject Proof**, and **Request Re-upload** actions. |
| **Collections Follow-ups** | [`/follow-ups`](app/follow-ups/page.tsx) | Overdue communications log tracking channels (Phone, Email, WhatsApp), action dates, and collector assignments. |
| **Reminders Desk** | [`/reminders`](app/reminders/page.tsx) | Multi-window scheduled notification queue with batch dispatch trigger and single-item delivery retry. |
| **Financial Reports** | [`/reports`](app/reports/page.tsx) | Accounts aging analysis (0-30, 31-60, 61-90, 90+ days), client concentration analysis, and CSV export. |
| **System Settings** | [`/settings`](app/settings/page.tsx) | Real-time health diagnostic checks for Neon PostgreSQL, Google Sheets, Resend Email, OpenAI OCR, and R2 Storage. |

---

## Technical Architecture

```
Google Sheets (External Roster)
        │ (Scheduled / Manual Ingestion)
        ▼
ARKA Sync Engine (lib/sheet-sync.ts)
        │ (Header Validation & Relational Upsert)
        ▼
Neon PostgreSQL (Operational Source of Truth)
   ├── clients
   ├── billing_schedules
   ├── invoices
   ├── payments
   ├── payment_proofs
   ├── reminders
   ├── client_follow_ups
   └── audit_logs
        │
        ├──► Automation Engine (lib/automation-engine.ts)
        │       ├── Billing Scheduler (Invoice & PDF Generation)
        │       ├── Lifecycle Aging (Asia/Kolkata TZ)
        │       └── Reminder Dispatch (Resend Email API)
        │
        └──► Verification & Settlement Pipeline
                ├── Private Storage Upload (Cloudflare R2 / In-Memory Local)
                ├── Vision OCR Extraction (OpenAI GPT-4o-mini)
                ├── Reconciliation Engine (Expected vs Extracted Matrix)
                └── Atomic Human Approval Gate (Payment & Invoice -> PAID)
```

For full architectural blueprints, see [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Documentation Index

- **[`ARCHITECTURE.md`](ARCHITECTURE.md)**: System topology, internal automation engine, data flow, and security model.
- **[`DATABASE.md`](DATABASE.md)**: Neon PostgreSQL schema definitions, table relations, constraints, and migration history.
- **[`API.md`](API.md)**: Comprehensive catalog of all 35 operational REST endpoints, payloads, and RBAC requirements.
- **[`WORKFLOWS.md`](WORKFLOWS.md)**: Step-by-step business workflows (Billing, Reminders, Verification, Follow-ups).
- **[`GOOGLE_SHEETS.md`](GOOGLE_SHEETS.md)**: 19-column operational spreadsheet structure, Google Service Account setup, and sync specifications.
- **[`DEPLOYMENT.md`](DEPLOYMENT.md)**: Production deployment instructions, Neon migrations, environment variables, cron scheduling, and founder bootstrap.

---

## Quickstart & Local Development

### 1. Prerequisites
- **Node.js**: `>=22.13.0` (tested on Node v24.21.0)
- **Database**: Neon PostgreSQL connection string (`DATABASE_URL`)
- **Package Manager**: npm

### 2. Installation
```sh
npm install
```

### 3. Environment Configuration
Create a `.env` or `.env.local` file in the project root:

```env
# Operational Database (Required)
DATABASE_URL="postgresql://user:password@ep-xyz.neon.tech/arka_db?sslmode=require"

# Automation Engine Protection (Required)
CRON_SECRET="your-secure-internal-cron-secret-32-chars-min"

# Session Security (Required)
SESSION_SECRET="your-strong-random-session-secret-key"

# Outbound Email (Resend)
RESEND_API_KEY="re_123456789"
REMINDER_FROM_EMAIL="accounts@arkafinance.com"

# Payment Proof AI Extraction (OpenAI Vision)
OPENAI_API_KEY="sk-proj-xyz..."

# Google Sheets Operational Synchronization
GOOGLE_SERVICE_ACCOUNT_EMAIL="arka-ops@project.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgk...-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"

# Storage Provider (Default: in-memory local; Production: r2)
STORAGE_PROVIDER="local"
```

### 4. Database Setup & Founder Bootstrap
Apply the Neon schema migrations and create the first administrator/founder:

```sh
# Push schema directly to Neon
npm run db:push

# Bootstrap Founder Account
npm run db:create-founder
```

### 5. Running the Application
Start the development server with Hot Module Reloading:

```sh
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) in your browser.

---

## Quality Verification & Tests

The ARKA codebase is tested and verified with zero compiler, type, or lint errors:

```sh
# Run the full test suite (Core validation, math precision, PDF generation, reconciliation)
npm test

# Run TypeScript typechecker
npm run typecheck

# Run linter
npm run lint

# Compile production build
npm run build
```

---

## License & Operational Usage
Proprietary software built for ARKA Finance & Accounts Operations. All rights reserved.
