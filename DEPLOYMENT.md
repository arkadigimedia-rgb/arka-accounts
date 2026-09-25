# ARKA Accounts Operations: Production Deployment Runbook

This guide covers deploying the end-to-end ARKA Accounts Operations System to production with **Neon PostgreSQL**, **Google Sheets sync**, **Resend email delivery**, **OpenAI Vision OCR**, **Cloudflare R2 storage**, and **Internal Automation**.

---

## 1. Prerequisites

- **Node.js**: `v22.13.0` or higher (`v24.x` supported)
- **Database**: [Neon](https://neon.tech/) Serverless PostgreSQL
- **Private Storage**: Cloudflare R2 bucket (or S3-compatible private bucket)
- **Email Delivery**: Resend account (or SMTP)
- **AI OCR Engine**: OpenAI Vision API key (GPT-4o / GPT-4o-mini)
- **Operational Input**: Google Sheet with Service Account credentials

---

## 2. Environment Variables Checklist

Set the following variables in your hosting environment (Cloudflare Pages/Workers, Vercel, Railway, or VPS):

```env
# ------------------------------------------------------------------------------
# CORE APPLICATION & AUTHENTICATION
# ------------------------------------------------------------------------------
NODE_ENV="production"
APP_URL="https://accounts.arkaoperations.com"
JWT_SECRET="<generate-high-entropy-64-char-random-secret>"
CRON_SECRET="<generate-high-entropy-32-char-random-secret>"

# ------------------------------------------------------------------------------
# DATABASE (NEON POSTGRESQL)
# ------------------------------------------------------------------------------
DATABASE_URL="postgres://<user>:<password>@<neon-host>.neon.tech/<dbname>?sslmode=require"

# ------------------------------------------------------------------------------
# GOOGLE SHEETS LIVE OPERATIONAL SYNC
# ------------------------------------------------------------------------------
GOOGLE_SHEET_ID="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
GOOGLE_SHEET_TAB="" # Optional: Leave empty to scan all monthly tabs
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"arka-accounts-ops","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"arka-sync@arka-accounts-ops.iam.gserviceaccount.com"}'

# ------------------------------------------------------------------------------
# INVOICE PDF & RECEIPT STORAGE (CLOUDFLARE R2)
# ------------------------------------------------------------------------------
STORAGE_PROVIDER="r2"
R2_ACCOUNT_ID="<your-cloudflare-account-id>"
R2_ACCESS_KEY_ID="<your-r2-access-key-id>"
R2_SECRET_ACCESS_KEY="<your-r2-secret-access-key>"
R2_BUCKET_NAME="arka-accounts-vault"

# ------------------------------------------------------------------------------
# TRANSACTIONAL EMAIL (RESEND)
# ------------------------------------------------------------------------------
EMAIL_PROVIDER="resend"
RESEND_API_KEY="re_1234567890abcdef"
EMAIL_FROM="ARKA Accounts <billing@arkaoperations.com>"

# ------------------------------------------------------------------------------
# AI OCR PROOF EXTRACTION (OPENAI VISION)
# ------------------------------------------------------------------------------
AI_PROVIDER="openai"
AI_API_KEY="sk-proj-1234567890abcdef"
AI_MODEL="gpt-4o-mini"
```

---

## 3. Database Migration Runbook

ARKA uses Drizzle ORM migrations targeting Neon PostgreSQL. Migrations are located under `drizzle-pg/`.

1. To apply all SQL migrations up to the complete accounts expansion:
   ```bash
   npm run db:migrate
   ```
2. Or apply the SQL migrations in order via `psql` or the Neon SQL Editor:
   - `drizzle-pg/0000_arka_init.sql`
   - `drizzle-pg/0001_security_and_indexes.sql`
   - `drizzle-pg/0002_reminder_windows.sql`
   - `drizzle-pg/0003_verification_reupload.sql`
   - `drizzle-pg/0004_arka_accounts_expansion.sql`

---

## 4. Bootstrapping the Initial Founder Account

In a fresh production database, create the primary administrator/founder:

```bash
npm run db:create-founder -- --email "founder@arkaoperations.com" --name "Operations Lead"
```
Or execute the bootstrap script:
```bash
node scripts/create-founder.mjs founder@arkaoperations.com "Founder Name"
```
The script will output the secure login link and initial session parameters.

---

## 5. Setting up Daily Automation Cron

ARKA includes a self-contained automation engine (`lib/automation-engine.ts`) that runs:
1. **Invoice Generation**: Generates invoices and vector PDFs for schedules due today.
2. **Payment Lifecycle**: Evaluates date transitions (`UPCOMING` -> `DUE_TODAY` -> `OVERDUE`) in `Asia/Kolkata` timezone.
3. **Payment Reminders**: Dispatches due-date and overdue email reminders.
4. **Google Sheets Sync**: Synchronizes any new rows from Google Sheets.
5. **Follow-up Escalations**: Evaluates overdue accounts requiring communication.

### Automated Trigger (Cloudflare Cron Trigger / GitHub Actions / Crontab)

Set up a scheduled HTTP task daily at **09:00 IST (03:30 UTC)**:

```bash
curl -X POST https://accounts.arkaoperations.com/api/automation/run \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json"
```

---

## 6. Verification & Health Monitoring

1. Open `https://accounts.arkaoperations.com/settings` to review the live integration health matrix:
   - Neon PostgreSQL: `CONNECTED` (shows query latency in ms)
   - Google Sheets: `CONNECTED` (shows target sheet ID and tab)
   - Email Dispatcher: `CONFIGURED`
   - AI OCR Engine: `CONFIGURED`
   - Storage Vault: `AVAILABLE`
2. Perform a test Google Sheets sync:
   Click **Sync Google Sheet** in the sidebar. Verify the success toast indicates rows created/updated.
3. Verify Invoice Generation:
   Open `/billing`, click **Run Due Invoicing Now**, and confirm invoices appear on `/invoices` with downloadable PDFs.
4. Verify Verification Desk:
   Open `/payments`, click on any pending payment to upload a proof receipt, and inspect the split-screen comparison on `/verification`.
