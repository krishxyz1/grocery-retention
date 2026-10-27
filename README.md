# The habit is in the fruit aisle

A retention teardown of 3.4M grocery orders (the Instacart 2017 open dataset): where shoppers drop off, what brings them back, and the experiment it leads to. Everything is written in SQL and run in DuckDB. A static report site shows the results, and every chart links to the query behind it.

[One-page memo](docs/memo.md) · [Experiment plan](docs/experiment-plan.md) · [All queries](sql/)

## What I found

| | |
|---|---|
| **Habit window** | Only **49%** of shoppers who place a 4th order ever place an 11th. Per-order drop-off is 11.6% at order 4 and 5.9% by order 20. |
| **Weekly clock** | Gaps between orders spike at exactly 7 days. Weekly shoppers are 32% of users but place 57% of orders. |
| **Fresh drives return** | Fresh aisles (produce, dairy & eggs, bakery, meat, deli) are re-bought **69%** of the time vs **55%** for the rest. |
| **First basket matters** | By month 11, shoppers whose first basket was mostly fresh retain **1.8x** as well as those who bought no fresh food. The gap widens every month. |
| **Who's slipping** | **25,846** habitual shoppers (12.5%) have a latest gap at least 2x their own usual gap. A fixed "21 days inactive" rule would miss most of them. |

**Decision:** a cadence-timed "your usual fresh basket" restock for shoppers at orders 4 to 10. It's tested against a holdout on *next order within 14 days* (baseline 58%, +2pp MDE, about 9.5k users per arm), with fresh-item complaint rate as a guardrail.

## Repo

```
sql/
  00_load.sql                 raw CSV -> tables
  01_model.sql                per-user timelines, baskets, user table
  10_headline.sql ... 19_*.sql one file per analysis, last SELECT is exported
scripts/run.mjs               runs the SQL, writes site/src/data/*.json
site/                         Vite + React report, hand-rolled SVG charts
docs/                         memo + experiment plan
```

## Run it

```bash
# 1. data (about 700 MB). Get the Instacart CSVs from Kaggle or a mirror and place them in data/raw/:
#    orders.csv, order_products__prior.csv, order_products__train.csv, products.csv, aisles.csv, departments.csv

npm install
npm run analyze -- --rebuild   # load + model + every analysis (about 10 s on a laptop)
npm run dev                    # report at localhost:5173
```

`npm run analyze -- cohort` re-runs only the analyses whose filename matches.

## Deploy

The report is a static site, and the JSON it reads is committed, so Vercel needs no database. Import the repo and Vercel picks up `vercel.json`. That builds `site/` and serves `site/dist`.

## Caveats I designed around

- **Users have 4 to 100 orders.** The dataset excludes anyone who ordered fewer than 4 times, so first-to-second order drop-off, usually the biggest leak, can't be measured here.
- **No dates, gaps capped at 30.** Timelines are rebuilt from `days_since_prior_order`, and any 30 means "30 or more".
- **No prices.** Basket size in items stands in for spend in RFM.
- **No end of observation.** I never label anyone "churned". Gap inflation (latest gap / own median gap) measures drift instead.
- **First-basket effects are correlational.** That's why the output is an experiment, not a roadmap item.

The queries use a few DuckDB conveniences (`MEDIAN`, `ARG_MAX`, `range()`, `//`). Each has a direct Postgres equivalent (`percentile_cont(0.5)`, `DISTINCT ON`, `generate_series`, `div`).

Data: *The Instacart Online Grocery Shopping Dataset 2017*, released by Instacart for non-commercial use.
