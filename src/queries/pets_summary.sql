SELECT
  p.id,
  p.name,
  p.species,
  p.emoji,
  MAX(l.done_at) AS last_activity_at,
  COUNT(l.id)    AS total_logs
FROM app_pet_care__pets p
LEFT JOIN app_pet_care__logs l
  ON l.pet_id = p.id
GROUP BY p.id, p.name, p.species, p.emoji
ORDER BY p.name
LIMIT 50
