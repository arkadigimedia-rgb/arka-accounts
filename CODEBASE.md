# ARKA Finance Operations — Source Handoff

This package is the maintainable ARKA application source. It intentionally excludes local dependencies, build artifacts, local secrets, and historical D1/SQLite examples.

## Run locally

1. Copy `.env.example` to `.env` and provide the required values when using Neon.
2. Run `npm install`.
3. For the non-persistent visual demo, run `npm run dev:demo`.
4. For normal development, run `npm run dev`.

## Source map

- `app/` — pages and API endpoints.
- `lib/` — business rules: lifecycle, reconciliation, verification, auth, reminders, storage, and demo mode.
- `db/` — Neon PostgreSQL Drizzle schema and database access.
- `drizzle-pg/` — PostgreSQL migrations only.
- `tests/` — automated business-rule tests.
- `public/` — static assets.

## Important runtime modes

- `DATABASE_URL` configured: Neon PostgreSQL is the source of truth.
- `NODE_ENV=development` and `DEMO_MODE=true` without `DATABASE_URL`: exactly two non-persistent demo payment records are displayed.
- Production never enables demo mode.

## Deliberate limitations

Neon and an OCR provider must be configured before real payment verification, uploads, authentication, and persistence can operate in production. The demo does not write payments, proofs, or approvals to a database.
