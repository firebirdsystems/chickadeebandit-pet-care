-- The recurring_due glance and digest both ask for the most recent log per
-- activity. logs(activity_id) alone made that a scan of every log ever written
-- for the activity; the trailing done_at lets SQLite stop at the first row.
CREATE INDEX IF NOT EXISTS app_pet_care__idx_logs_activity_done
  ON app_pet_care__logs (activity_id, done_at);
