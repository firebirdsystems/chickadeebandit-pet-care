CREATE TABLE IF NOT EXISTS app_pet_care__pets (
  id           TEXT NOT NULL,
  name         TEXT NOT NULL,
  species      TEXT NOT NULL DEFAULT '',
  emoji        TEXT NOT NULL DEFAULT '🐾',
  created_at   TEXT NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS app_pet_care__activities (
  id             TEXT NOT NULL,
  pet_id         TEXT NOT NULL,
  name           TEXT NOT NULL,
  icon           TEXT NOT NULL DEFAULT '🐾',
  schedule_type  TEXT NOT NULL DEFAULT 'interval',
  interval_hours REAL,
  times          TEXT NOT NULL DEFAULT '[]',
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS app_pet_care__logs (
  id           TEXT NOT NULL,
  activity_id  TEXT NOT NULL,
  pet_id       TEXT NOT NULL,
  done_by      TEXT NOT NULL,
  done_at      TEXT NOT NULL,
  PRIMARY KEY (id)
);
