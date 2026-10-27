-- Products people try once vs. products that become staples.
-- repurchase_rate = of users who ever bought the product, share who bought it again.
-- Only products tried by 3,000+ users, so a handful of fans can't top the list.
WITH per_user AS (
  SELECT ol.product_id, o.user_id, COUNT(*) AS times
  FROM order_lines ol
  JOIN orders o USING (order_id)
  GROUP BY 1, 2
),
stats AS (
  SELECT
    product_id,
    COUNT(*)                     AS buyers,
    AVG((times >= 2)::INTEGER)   AS repurchase_rate,
    AVG(times)                   AS avg_times
  FROM per_user
  GROUP BY product_id
  HAVING COUNT(*) >= 3000
),
ranked AS (
  SELECT
    s.*, p.product_name, a.aisle, d.department,
    ROW_NUMBER() OVER (ORDER BY repurchase_rate DESC) AS top_rank,
    ROW_NUMBER() OVER (ORDER BY repurchase_rate ASC)  AS bottom_rank
  FROM stats s
  JOIN products p USING (product_id)
  JOIN aisles a USING (aisle_id)
  JOIN departments d ON d.department_id = p.department_id
)
SELECT
  CASE WHEN top_rank <= 15 THEN 'staple' ELSE 'one_and_done' END AS kind,
  product_name, aisle, department, buyers, repurchase_rate, avg_times
FROM ranked
WHERE top_rank <= 15 OR bottom_rank <= 15
ORDER BY kind DESC, repurchase_rate DESC;
