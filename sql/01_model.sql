-- Modelled tables every analysis builds on.
--
-- The dataset has no calendar dates, only days_since_prior_order (capped at 30).
-- day_index rebuilds a per-user timeline: day 0 = first order. Because of the cap,
-- any gap of 30 really means "30 or more", so day_index is a lower bound once a
-- user has had a long break. Analyses that depend on it say so.

-- "Fresh" = the perishable departments a shopper judges with their eyes and nose.
CREATE OR REPLACE TABLE fresh_departments AS
SELECT department_id
FROM departments
WHERE department IN ('produce', 'dairy eggs', 'bakery', 'meat seafood', 'deli');

CREATE OR REPLACE TABLE user_orders AS
SELECT
  o.*,
  SUM(COALESCE(o.days_since_prior_order, 0)) OVER (
    PARTITION BY o.user_id ORDER BY o.order_number
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  )                                                    AS day_index,
  MAX(o.order_number) OVER (PARTITION BY o.user_id)    AS total_orders
FROM orders o;

CREATE OR REPLACE TABLE order_lines AS
SELECT
  op.order_id,
  op.product_id,
  op.reordered,
  p.aisle_id,
  p.department_id,
  (fd.department_id IS NOT NULL) AS is_fresh
FROM order_products op
JOIN products p USING (product_id)
LEFT JOIN fresh_departments fd USING (department_id);

CREATE OR REPLACE TABLE baskets AS
SELECT
  order_id,
  COUNT(*)                                        AS items,
  SUM(reordered)                                  AS reordered_items,
  AVG(CASE WHEN is_fresh THEN 1.0 ELSE 0.0 END)   AS fresh_share,
  BOOL_OR(department_id = 4)                      AS has_produce   -- 4 = produce
FROM order_lines
GROUP BY order_id;

-- One row per user. first_* columns describe the very first basket, which is the
-- only "acquisition" signal this dataset has (there is no sign-up date or channel).
CREATE OR REPLACE TABLE users AS
WITH ordered AS (
  SELECT uo.*, b.items, b.fresh_share, b.has_produce
  FROM user_orders uo
  LEFT JOIN baskets b USING (order_id)
)
SELECT
  user_id,
  MAX(total_orders)                                                        AS total_orders,
  MAX(day_index)                                                           AS span_days,
  MEDIAN(days_since_prior_order)                                           AS median_gap,
  ARG_MAX(days_since_prior_order, order_number)                            AS latest_gap,
  AVG(items)                                                               AS avg_items,
  MAX(CASE WHEN order_number = 1 THEN items END)                           AS first_items,
  MAX(CASE WHEN order_number = 1 THEN fresh_share END)                     AS first_fresh_share,
  BOOL_OR(CASE WHEN order_number = 1 THEN has_produce END)                 AS first_has_produce,
  AVG((days_since_prior_order = 30)::INTEGER)                              AS share_30plus_gaps
FROM ordered
GROUP BY user_id;
