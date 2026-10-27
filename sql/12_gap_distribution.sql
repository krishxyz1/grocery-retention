-- Days between consecutive orders. 30 is a ceiling in the source data ("30+").
SELECT
  days_since_prior_order                                AS gap_days,
  COUNT(*)                                              AS orders,
  COUNT(*)::DOUBLE / SUM(COUNT(*)) OVER ()              AS share
FROM orders
WHERE days_since_prior_order IS NOT NULL
GROUP BY 1
ORDER BY 1;
