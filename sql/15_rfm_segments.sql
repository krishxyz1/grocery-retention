-- RFM-style segmentation. Two honest substitutions:
--   R (recency)  -> the gap before the user's latest order. There is no "today"
--                   in the dataset, so this is the freshest recency signal we have.
--   M (monetary) -> average basket size in items. The dataset has no prices.
-- "Gap inflation" = latest gap / the user's own median gap. It flags people who
-- are drifting from *their* rhythm, which a global recency cut-off misses:
-- a 20-day gap is normal for a monthly shopper and alarming for a weekly one.
WITH scored AS (
  SELECT
    *,
    6 - NTILE(5) OVER (ORDER BY latest_gap)   AS r,   -- 5 = most recent
    NTILE(5) OVER (ORDER BY total_orders)     AS f,
    NTILE(5) OVER (ORDER BY avg_items)        AS m,
    latest_gap / NULLIF(median_gap, 0)        AS gap_inflation
  FROM users
),
segmented AS (
  SELECT
    *,
    CASE
      WHEN gap_inflation >= 2 AND f >= 3       THEN 'Slipping regulars'
      WHEN r >= 4 AND f >= 4                   THEN 'Champions'
      WHEN f >= 3 AND r >= 3                   THEN 'Loyal'
      WHEN f <= 2 AND r >= 4                   THEN 'Promising'
      WHEN r <= 2 AND f <= 2                   THEN 'Hibernating'
      ELSE                                          'Needs attention'
    END AS segment
  FROM scored
)
SELECT
  segment,
  COUNT(*)                                  AS users,
  COUNT(*)::DOUBLE / SUM(COUNT(*)) OVER ()  AS share_users,
  AVG(total_orders)                         AS avg_orders,
  MEDIAN(latest_gap)                        AS median_latest_gap,
  MEDIAN(median_gap)                        AS median_usual_gap,
  AVG(avg_items)                            AS avg_items,
  AVG(r)                                    AS avg_r,
  AVG(f)                                    AS avg_f,
  AVG(m)                                    AS avg_m
FROM segmented
GROUP BY segment
ORDER BY users DESC;
