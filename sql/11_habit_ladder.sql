-- "Habit ladder": of the users who placed order n, what share went on to place n+1?
-- Instacart only sampled users with 4+ orders, so steps 1-3 are 100% by construction
-- and are excluded. Users are also capped at 100 orders, so the tail stops at 60.
WITH reach AS (
  SELECT n, COUNT(*) AS users_reaching
  FROM users, range(1, 62) t(n)
  WHERE total_orders >= n
  GROUP BY n
)
SELECT
  a.n                                          AS order_number,
  a.users_reaching,
  b.users_reaching::DOUBLE / a.users_reaching  AS p_next_order
FROM reach a
JOIN reach b ON b.n = a.n + 1
WHERE a.n BETWEEN 4 AND 60
ORDER BY a.n;
