-- Top-line numbers quoted in the memo.
SELECT
  (SELECT COUNT(*) FROM users)                                       AS users,
  (SELECT COUNT(*) FROM orders)                                      AS orders,
  (SELECT COUNT(*) FROM order_lines)                                 AS order_lines,
  (SELECT COUNT(*) FROM products)                                    AS products,
  (SELECT MEDIAN(total_orders) FROM users)                           AS median_orders_per_user,
  (SELECT MIN(total_orders) FROM users)                              AS min_orders_per_user,
  (SELECT MAX(total_orders) FROM users)                              AS max_orders_per_user,
  (SELECT MEDIAN(days_since_prior_order) FROM orders)                AS median_gap_days,
  (SELECT AVG((days_since_prior_order = 30)::INTEGER) FROM orders
     WHERE days_since_prior_order IS NOT NULL)                       AS share_gaps_30plus,
  (SELECT AVG(reordered) FROM order_lines ol
     JOIN orders o USING (order_id) WHERE o.order_number > 1)        AS reorder_rate_after_first,
  (SELECT AVG(items) FROM baskets)                                   AS avg_basket_items,
  (SELECT AVG(fresh_share) FROM baskets)                             AS avg_fresh_share;
