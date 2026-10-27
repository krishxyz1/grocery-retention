-- Which aisles bring people back? For each aisle:
--   penetration   = share of all orders containing the aisle
--   reorder_rate  = share of its lines that were re-purchases (first orders excluded,
--                   because every line in a first order is new by definition)
--   repeat_buyers = of users who ever bought from the aisle, share who did so in 2+ orders
WITH lines AS (
  SELECT ol.*, o.user_id, o.order_number
  FROM order_lines ol
  JOIN orders o USING (order_id)
),
aisle_lines AS (
  SELECT
    aisle_id,
    department_id,
    COUNT(DISTINCT order_id)                            AS orders_with_aisle,
    AVG(CASE WHEN order_number > 1 THEN reordered END)  AS reorder_rate
  FROM lines
  GROUP BY aisle_id, department_id
),
per_user AS (
  SELECT aisle_id, user_id, COUNT(DISTINCT order_id) AS n_orders
  FROM lines
  GROUP BY aisle_id, user_id
),
repeat AS (
  SELECT aisle_id, AVG((n_orders >= 2)::INTEGER) AS repeat_buyers
  FROM per_user
  GROUP BY aisle_id
),
total AS (SELECT COUNT(DISTINCT order_id) AS n FROM order_lines)
SELECT
  a.aisle,
  d.department,
  (fd.department_id IS NOT NULL)                       AS is_fresh,
  al.orders_with_aisle::DOUBLE / (SELECT n FROM total) AS penetration,
  al.reorder_rate,
  r.repeat_buyers
FROM aisle_lines al
JOIN aisles a USING (aisle_id)
JOIN departments d USING (department_id)
JOIN repeat r USING (aisle_id)
LEFT JOIN fresh_departments fd USING (department_id)
WHERE a.aisle NOT IN ('missing', 'other')
ORDER BY penetration DESC;
