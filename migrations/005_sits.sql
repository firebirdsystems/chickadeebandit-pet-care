-- A sit: the household hands its pets to a sitter, who gets a share link
-- (manifest.shareable.sit) listing the chosen pets' tasks to tick off. Each tick
-- lands in logs like a member's tap, so the overdue badge, digest and reminders
-- see it.
CREATE TABLE IF NOT EXISTS app_pet_care__sits (
  id           TEXT NOT NULL,
  title        TEXT NOT NULL,              -- "Rex & Mochi, Oct 3–10"
  instructions TEXT NOT NULL DEFAULT '',   -- feeding amounts, vet, door notes
  starts_on    TEXT NOT NULL DEFAULT '',   -- household-local yyyy-mm-dd
  ends_on      TEXT NOT NULL DEFAULT '',
  pet_ids      TEXT NOT NULL DEFAULT '[]', -- JSON array: the pets this sit covers
  archived     INTEGER NOT NULL DEFAULT 0,
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- The sit's checklist, one row per activity of a chosen pet, rebuilt by the app
-- whenever it drifts from the pets' activities. The share page lists these in
-- insertion order, so the app writes them in display order.
CREATE TABLE IF NOT EXISTS app_pet_care__sit_tasks (
  id          TEXT NOT NULL,
  sit_id      TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  pet_id      TEXT NOT NULL,
  label       TEXT NOT NULL,              -- "Rex · Breakfast"
  detail      TEXT NOT NULL DEFAULT '',   -- "08:00, 18:00" / "Every 12h" (schedLabel)
  sort_order  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS app_pet_care__sit_tasks_sit_activity
  ON app_pet_care__sit_tasks (sit_id, activity_id);
-- delete_cascades from pets and activities.
CREATE INDEX IF NOT EXISTS app_pet_care__sit_tasks_pet
  ON app_pet_care__sit_tasks (pet_id);
CREATE INDEX IF NOT EXISTS app_pet_care__sit_tasks_activity
  ON app_pet_care__sit_tasks (activity_id);

-- A sitter's tick: sit_id names the sit, done_by is 'sitter' and the name is
-- the one they typed. task_label keeps what the task was called at the time.
ALTER TABLE app_pet_care__logs ADD COLUMN sit_id      TEXT NOT NULL DEFAULT '';
ALTER TABLE app_pet_care__logs ADD COLUMN sitter_name TEXT NOT NULL DEFAULT '';
ALTER TABLE app_pet_care__logs ADD COLUMN task_label  TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS app_pet_care__logs_sit
  ON app_pet_care__logs (sit_id, done_at);
