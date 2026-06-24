CREATE INDEX IF NOT EXISTS idx_pet_care_logs_activity  ON app_pet_care__logs(activity_id);
CREATE INDEX IF NOT EXISTS idx_pet_care_logs_pet       ON app_pet_care__logs(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_care_activities_pet ON app_pet_care__activities(pet_id);
