ALTER TABLE payment_reminders ADD COLUMN error_message text;
DROP INDEX IF EXISTS reminder_once;
CREATE UNIQUE INDEX reminder_window_once ON payment_reminders(payment_id,type,scheduled_for);
