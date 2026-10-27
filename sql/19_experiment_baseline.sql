-- Baselines for the experiment plan. Target population = users in the
-- "habit window" (orders 4-10), where the habit ladder is steepest.
-- Primary metric   = the next order arrives within 14 days.
-- Secondary metric = the user eventually reaches order 11.
WITH window_orders AS (
  SELECT
    user_id,
    order_number,
    total_orders,
    LEAD(days_since_prior_order) OVER (PARTITION BY user_id ORDER BY order_number) AS next_gap
  FROM user_orders
)
-- A user whose history ends at this order has no next gap. The data can't tell
-- "churned" from "sample ended", so those rows are left out of the 14-day rate
-- (the AVG skips NULLs) but kept in the reach-order-11 rate.
SELECT
  order_number,
  COUNT(*)                                                     AS users_at_step,
  AVG(CASE WHEN next_gap IS NOT NULL THEN (next_gap <= 14)::INTEGER END) AS p_next_within_14d,
  AVG((total_orders >= 11)::INTEGER)                           AS p_reach_order_11
FROM window_orders
WHERE order_number BETWEEN 4 AND 10
GROUP BY order_number
ORDER BY order_number;
