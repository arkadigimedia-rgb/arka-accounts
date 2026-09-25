-- Expansion migration for ARKA Accounts Operations
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_code varchar(64);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_name varchar(240);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS city varchar(120);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS state varchar(120);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gst_number varchar(32);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS source_reference varchar(240);

ALTER TABLE services ADD COLUMN IF NOT EXISTS client_id integer REFERENCES clients(id);
ALTER TABLE services ADD COLUMN IF NOT EXISTS billing_amount numeric(14,2);
ALTER TABLE services ADD COLUMN IF NOT EXISTS currency varchar(16) NOT NULL DEFAULT 'INR';
ALTER TABLE services ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE services ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Alias payment_schedules to billing_schedules
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'billing_schedules') THEN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payment_schedules') THEN
      ALTER TABLE payment_schedules RENAME TO billing_schedules;
    END IF;
  END IF;
END $$;

ALTER TABLE billing_schedules ADD COLUMN IF NOT EXISTS amount numeric(14,2);
ALTER TABLE billing_schedules ADD COLUMN IF NOT EXISTS currency varchar(16) NOT NULL DEFAULT 'INR';
ALTER TABLE billing_schedules ADD COLUMN IF NOT EXISTS billing_frequency varchar(64) NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE billing_schedules ADD COLUMN IF NOT EXISTS invoice_generation_day integer DEFAULT 1;
ALTER TABLE billing_schedules ADD COLUMN IF NOT EXISTS payment_terms_days integer DEFAULT 7;
ALTER TABLE billing_schedules ADD COLUMN IF NOT EXISTS billing_start_date date;
ALTER TABLE billing_schedules ADD COLUMN IF NOT EXISTS billing_end_date date;
ALTER TABLE billing_schedules ADD COLUMN IF NOT EXISTS auto_generate_invoice boolean NOT NULL DEFAULT true;
ALTER TABLE billing_schedules ADD COLUMN IF NOT EXISTS auto_send_invoice boolean NOT NULL DEFAULT false;
ALTER TABLE billing_schedules ADD COLUMN IF NOT EXISTS next_invoice_date date;
ALTER TABLE billing_schedules ADD COLUMN IF NOT EXISTS next_due_date date;
ALTER TABLE billing_schedules ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE billing_schedules ADD COLUMN IF NOT EXISTS source_reference varchar(240);

CREATE TABLE IF NOT EXISTS invoices (
  id serial PRIMARY KEY,
  invoice_number varchar(64) NOT NULL UNIQUE,
  client_id integer NOT NULL REFERENCES clients(id),
  service_id integer REFERENCES services(id),
  billing_schedule_id integer REFERENCES billing_schedules(id),
  issue_date date NOT NULL,
  due_date date NOT NULL,
  billing_period_start date,
  billing_period_end date,
  subtotal numeric(14,2) NOT NULL,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL,
  currency varchar(16) NOT NULL DEFAULT 'INR',
  status varchar(32) NOT NULL DEFAULT 'GENERATED',
  pdf_storage_key text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_schedule_period ON invoices(billing_schedule_id, billing_period_start, billing_period_end);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_id integer REFERENCES invoices(id);

ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'PENDING';

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS invoice_id integer REFERENCES invoices(id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS invoice_id integer REFERENCES invoices(id);

CREATE TABLE IF NOT EXISTS automation_jobs (
  id serial PRIMARY KEY,
  type varchar(64) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'SCHEDULED',
  scheduled_for timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  payload jsonb,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
