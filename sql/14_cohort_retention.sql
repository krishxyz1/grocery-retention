-- Monthly retention curves, cohorted by how "fresh" the first basket was.
-- There is no sign-up date, so the cohort is defined by first-order behaviour and
-- time is measured from each user's own first order (day_index, 30-day months).
-- Month 0 is 100% by definition. A user counts as retained in month m if they
-- placed at least one order whose day_index falls in that month.
WITH cohort AS (
  SELECT
    user_id,
    CASE
      WHEN first_fresh_share = 0     THEN '1 No fresh items'
      WHEN first_fresh_share < 0.34  THEN '2 Under a third fresh'
      WHEN first_fresh_share < 0.67  THEN '3 One to two thirds fresh'
      ELSE                                '4 Mostly fresh'
    END AS cohort
  FROM users
  WHERE first_fresh_share IS NOT NULL
),
activity AS (
  SELECT DISTINCT user_id, (day_index // 30)::INTEGER AS month
  FROM user_orders
),
sizes AS (SELECT cohort, COUNT(*) AS cohort_users FROM cohort GROUP BY cohort)
SELECT
  c.cohort,
  a.month,
  s.cohort_users,
  COUNT(DISTINCT a.user_id)::DOUBLE / s.cohort_users AS retained
FROM cohort c
JOIN activity a USING (user_id)
JOIN sizes s USING (cohort)
WHERE a.month <= 11
GROUP BY c.cohort, a.month, s.cohort_users
ORDER BY c.cohort, a.month;
