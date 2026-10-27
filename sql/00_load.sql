-- Raw load. The prior + train order_products files are two halves of the same
-- fact table (train = each user's most recent order), so they are stacked here.
-- "test" orders exist in orders.csv but their baskets were withheld by Instacart.

CREATE OR REPLACE TABLE departments AS
SELECT * FROM read_csv('data/raw/departments.csv', header = true);

CREATE OR REPLACE TABLE aisles AS
SELECT * FROM read_csv('data/raw/aisles.csv', header = true);

CREATE OR REPLACE TABLE products AS
SELECT * FROM read_csv('data/raw/products.csv', header = true);

CREATE OR REPLACE TABLE orders AS
SELECT
  order_id,
  user_id,
  eval_set,
  order_number,
  order_dow,
  order_hour_of_day::INTEGER        AS order_hour_of_day,
  days_since_prior_order::INTEGER   AS days_since_prior_order
FROM read_csv('data/raw/orders.csv', header = true);

CREATE OR REPLACE TABLE order_products AS
SELECT order_id, product_id, add_to_cart_order, reordered
FROM read_csv('data/raw/order_products__prior.csv', header = true)
UNION ALL
SELECT order_id, product_id, add_to_cart_order, reordered
FROM read_csv('data/raw/order_products__train.csv', header = true);
