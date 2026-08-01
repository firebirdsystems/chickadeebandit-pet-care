-- retain_days sweep key for logs. The table has no row policy — any member logs
-- a feeding — so the expiry is declared in the manifest's top-level `retention`
-- map. See plant-care 004.
CREATE INDEX IF NOT EXISTS app_pet_care__logs_retention_idx
  ON app_pet_care__logs (done_at, id);
