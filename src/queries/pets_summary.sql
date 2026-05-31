SELECT
  p.id,
  p.name,
  p.species,
  p.emoji,
  MAX(l.done_at) AS last_activity_at,
  COUNT(l.id)    AS total_logs
FROM pets p
LEFT JOIN logs l
  ON l.pet_id      = p.id
  AND l.household_id = p.household_id
WHERE p.household_id = current_setting('app.household_id', true)::uuid
GROUP BY p.id, p.name, p.species, p.emoji
ORDER BY p.name
LIMIT 50
