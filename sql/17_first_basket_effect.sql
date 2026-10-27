-- Does what's in the first basket predict how the relationship goes?
-- Correlational only: people who buy produce first may simply be different people.
-- The point is to find a lever worth testing, not to claim causation.
SELECT
  CASE WHEN first_has_produce THEN 'First basket had produce'
       ELSE 'No produce in first basket' END       AS first_basket,
  COUNT(*)                                          AS users,
  AVG(total_orders)                                 AS avg_orders,
  MEDIAN(median_gap)                                AS median_usual_gap,
  AVG((total_orders >= 10)::INTEGER)                AS share_reaching_10,
  AVG((total_orders >= 20)::INTEGER)                AS share_reaching_20,
  AVG(share_30plus_gaps)                            AS share_gaps_30plus
FROM users
WHERE first_has_produce IS NOT NULL
GROUP BY 1
ORDER BY 1;
