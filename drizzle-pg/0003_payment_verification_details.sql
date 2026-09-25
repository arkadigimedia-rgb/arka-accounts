ALTER TABLE payment_verifications ADD COLUMN IF NOT EXISTS reference_number varchar(240);
ALTER TABLE payment_verifications ADD COLUMN IF NOT EXISTS sender_name varchar(240);
ALTER TABLE payment_verifications ADD COLUMN IF NOT EXISTS receiver_name varchar(240);
ALTER TABLE payment_verifications ADD COLUMN IF NOT EXISTS reupload_reason text;
ALTER TABLE payment_verifications ADD COLUMN IF NOT EXISTS reupload_requested_by integer REFERENCES users(id);
ALTER TABLE payment_verifications ADD COLUMN IF NOT EXISTS reupload_requested_at timestamptz;
