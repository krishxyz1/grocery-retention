# Experiment plan: fresh restock in the habit window

| | |
|---|---|
| **Owner** | Krish Gujral |
| **Status** | Designed, baselines pulled from `sql/19_experiment_baseline.sql` |
| **Population** | Shoppers placing their 4th order |
| **Unit** | User, assigned once at order 4, sticky until order 11 or day 90 |
| **Split** | 50 / 50, treatment vs current experience |

## Hypothesis

If a shopper's usual fresh items are ready to reorder on the day they'd normally shop, more of them will order on rhythm, and more will get through orders 4 to 10, where half of shoppers are lost today.

## Treatment

- A "your usual fresh basket" card at the top of home: the fresh SKUs this shopper bought in at least 2 of their last 4 orders, each pre-selected with its last quantity.
- One notification, sent at `median_gap - 1` days after the last order (minimum 3 days), at the shopper's most common order hour.
- No discount and no urgency copy. The message is the basket, plus a line on when it was sourced.

## Metrics

| Type | Metric | Baseline | Source |
|---|---|---|---|
| Primary | Next order placed within 14 days of the previous one | 58.0% at order 4 | `19_experiment_baseline.sql` |
| Secondary | Reaches order 11 within 90 days | 49.3% | `19_experiment_baseline.sql` |
| Secondary | Fresh share of the next basket | 54% avg basket | `10_headline.sql` |
| Guardrail | Notification opt-out rate | measure in A/A week | events |
| Guardrail | Items per basket | 10.1 | `10_headline.sql` |
| Guardrail | Fresh-item complaint / refund rate per order | measure in A/A week | support tickets |

## Sample size

Two-sided two-proportion z-test, α = 0.05, power = 80%:

```
p1 = 0.58, p2 = 0.60, p̄ = 0.59
n  = (1.96·√(2·p̄·(1−p̄)) + 0.8416·√(p1(1−p1) + p2(1−p2)))² / (p2 − p1)²
   ≈ 9,493 per arm
```

At 3,000 shoppers reaching order 4 per week, that's about 7 weeks of enrolment plus a 14-day outcome tail. The report has a live calculator for other traffic levels.

## Before launch

- Run an A/A week to confirm the split is balanced and to measure guardrail baselines.
- Check for sample ratio mismatch daily (chi-square, p < 0.001 = stop and debug).
- Pre-register this document. One read at the planned sample size, no peeking.

## Decision rule

| Result | Action |
|---|---|
| Primary ≥ +2pp, p < 0.05, no guardrail worse by > 0.5pp | Ship to all shoppers at orders 4 to 10 |
| Primary wins, complaint rate up | Hold. Fix fresh quality for the SKUs driving complaints, then re-run |
| Primary +1 to +2pp | Iterate on timing and basket selection, re-test |
| Primary < +1pp | Kill. The reminder isn't worth the notification budget |

## Risks

- **Notification fatigue.** Capped at one notification per cycle, with opt-out as a guardrail.
- **Novelty effect.** Read the effect separately for weeks 1 to 2 and weeks 3+ of exposure.
- **Quality debt.** More fresh orders through a supply chain that can't keep them fresh would win the metric and lose the customer. That's why complaints are a guardrail and not a footnote.
