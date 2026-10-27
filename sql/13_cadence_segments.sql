-- Users bucketed by their own typical rhythm (median gap between orders).
WITH seg AS (
  SELECT
    *,
    CASE
      WHEN median_gap <= 8  THEN '1 Weekly'
      WHEN median_gap <= 16 THEN '2 Fortnightly'
      WHEN median_gap <= 29 THEN '3 Monthly'
      ELSE                       '4 Lapsing (30+)'
    END AS cadence
  FROM users
)
SELECT
  cadence,
  COUNT(*)                                                    AS users,
  COUNT(*)::DOUBLE / SUM(COUNT(*)) OVER ()                    AS share_users,
  AVG(total_orders)                                           AS avg_orders,
  AVG(avg_items)                                              AS avg_items,
  AVG(first_fresh_share)                                      AS avg_first_fresh_share,
  SUM(total_orders)::DOUBLE / SUM(SUM(total_orders)) OVER ()  AS share_orders
FROM seg
GROUP BY cadence
ORDER BY cadence;
