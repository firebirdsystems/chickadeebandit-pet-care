SELECT
  l.id,
  l.done_at,
  l.done_by,
  a.name  AS activity_name,
  a.icon  AS activity_icon,
  p.name  AS pet_name,
  p.emoji AS pet_emoji
FROM logs l
JOIN activities a
  ON a.id           = l.activity_id
  AND a.household_id = l.household_id
JOIN pets p
  ON p.id           = l.pet_id
  AND p.household_id = l.household_id
WHERE l.household_id = current_setting('app.household_id', true)::uuid
ORDER BY l.done_at DESC
LIMIT 100
