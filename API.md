# ARKA Operations: Complete API Reference & Contract

All endpoints require authentication (session cookie `arka_session` or header `Authorization: Bearer <token>`). Internal scheduled automation tasks accept `Authorization: Bearer <CRON_SECRET>`.

---

## 1. Authentication & Identity
- `POST /api/auth/login`: Authenticate with email/password; sets HTTP-only secure cookie.
- `GET /api/auth/me`: Returns current active authenticated user and RBAC permissions.
- `POST /api/auth/logout`: Clears session cookie and invalidates token.

---

## 2. Dashboard & Action Intelligence
- `GET /api/dashboard/summary`: Real-time receivables metrics, collection totals, overdue totals, and active queue counts.
- `GET /api/dashboard/action-required`: Filtered list of accounts requiring operational intervention today.
- `GET /api/action-intelligence`: Structured intelligence feed prioritizing verification items, overdue follow-ups, and upcoming collections.

---

## 3. Clients Directory & 360° Profiles
- `GET /api/clients`: List clients with search (`search`), status filtering (`status`), and pagination.
- `POST /api/clients`: Create a new client account (`name`, `companyName`, `clientCode`, `contactPerson`, `email`, `phone`, `gstNumber`, `address`, `city`, `state`).
- `GET /api/clients/:id`: Full 360° client record including linked services, billing schedules, invoices, payments, follow-ups, and audit timeline.
- `PATCH /api/clients/:id`: Update client metadata and tax registration details.

---

## 4. Billing Schedules & Auto-Invoicing
- `GET /api/billing`: List contracted billing schedules with client and service joins.
- `POST /api/billing`: Create a recurring or one-time schedule (`clientId`, `expectedAmount`, `billingFrequency`, `invoiceGenerationDay`, `paymentTermsDays`, `autoGenerateInvoice`, `autoSendInvoice`).
- `POST /api/automation/run`: Execute automated billing jobs (`jobType: "invoice.generate"`, `payment.lifecycle.refresh`, `reminder.process`, `sheet.sync`).

---

## 5. Invoices & Vector PDF Generation
- `GET /api/invoices`: List tax invoices with client joins, status filter, and search.
- `POST /api/invoices`: Manually generate an invoice from an active billing schedule for a target billing period.
- `GET /api/invoices/:id`: Detailed itemized invoice metadata with linked payment reference.
- `GET /api/invoices/:id/pdf`: Streams true vector PDF with `Content-Type: application/pdf` and `Content-Disposition: inline`.

---

## 6. Payments Ledger & Proof Vault
- `GET /api/payments`: List payments with search, date status, and verification state.
- `PATCH /api/payments`: Update payment state machine status with actor audit tracking.
- `GET /api/payments/:id`: Payment 360° record with client, invoice, proofs, verifications, reminders, and follow-ups.
- `POST /api/payments/:id/proof`: Upload bank transfer receipt (PNG, JPG, PDF up to 10MB) to private encrypted storage. Automatically queues OCR extraction.
- `GET /api/payments/:id/proof/:proofId`: Authenticated streaming endpoint for private receipts. Never returns public URLs.

---

## 7. OCR Extraction & Verification Desk
- `GET /api/payments/:id/verification`: Retrieve verification extraction and comparison status.
- `POST /api/payments/:id/verification`: Trigger OCR extraction on an uploaded proof.
- `POST /api/verifications/:id/approve`: Atomic approval transaction. Sets verification to `APPROVED`, payment to `PAID`, linked invoice to `PAID`, logs audit entry, and generates notification.
- `POST /api/verifications/:id/reject`: Rejects proof with mandatory `reason`. Payment transitions to `REJECTED`.
- `POST /api/verifications/:id/request-reupload`: Requests clearer receipt from client with instructions.

---

## 8. Follow-up Communications
- `GET /api/follow-ups`: List follow-up communications filtered by `paymentId` or `status`.
- `POST /api/follow-ups`: Log collection activity (`paymentId`, `action`, `followUpDate`, `notes`).
- `PATCH /api/follow-ups`: Mark follow-up as `COMPLETED` or `CANCELLED`.

---

## 9. Automated Reminders & Dispatcher
- `GET /api/reminders`: List scheduled and delivered notification records.
- `GET /api/reminders/pending`: List reminders due for delivery on the current date.
- `POST /api/reminders/process`: Process and dispatch all eligible email reminders for due and overdue payments.
- `POST /api/reminders/:id/retry`: Retry dispatching a failed reminder.

---

## 10. Financial Reporting & System Settings
- `GET /api/reports`: Financial report with receivables aging brackets (Current, 1-30d, 31-60d, 61+d), client concentration table, and collection KPIs.
- `GET /api/settings`: Integration health matrix (Neon DB latency, Google Sheets connection status, Email provider, OCR engine, Storage vault).
- `POST /api/sheets/sync`: Triggers live synchronization with Google Sheets.
- `GET /api/sheets/status`: Returns current Google Sheets connection health and last sync timestamp.
- `GET /api/health`: Basic uptime and database liveness ping.
