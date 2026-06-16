SELECT
  l.id,
  l.done_at,
  l.done_by,
  a.name  AS activity_name,
  a.icon  AS activity_icon,
  p.name  AS pet_name,
  p.emoji AS pet_emoji
FROM app_pet_care__logs l
JOIN app_pet_care__activities a
  ON a.id = l.activity_id
JOIN app_pet_care__pets p
  ON p.id = l.pet_id
ORDER BY l.done_at DESC
LIMIT 100
