# Memo: move the habit window with fresh food

**Problem.** Grocery retention is decided early. Of shoppers who place a 4th order, only 49% place an 11th. Per-order drop-off is 11.6% at order 4, and it halves only by order 20. Every point of drop-off we remove at orders 4 to 10 compounds into the most valuable cohort we have: weekly shoppers, who are 32% of users and 57% of orders.

**What the data says.**

1. *Shopping runs on a weekly clock.* Gaps between orders spike at 7 days, with bumps at 14, 21 and 30. Reminders should follow each shopper's own rhythm, not a fixed "we miss you" day.
2. *Fresh is what people come back for.* Fresh aisles are re-bought 69% of the time vs 55% for everything else. Bananas, milk, spinach and eggs top the product-level repurchase list.
3. *A fresh first basket predicts a longer relationship.* Shoppers whose first basket was at least a third fresh retain 1.7 to 1.8x as well by month 11 as shoppers who bought no fresh food. Above a third, more fresh food doesn't help further, so the step comes from having *some* fresh food.
4. *Risk is personal.* 25,846 habitual shoppers (12.5%) have a latest gap at least twice their own norm. A global recency cut-off misses them.

The first-basket finding is correlational. Households that cook may simply stick around. So I'm proposing a test, not a launch.

**Proposal.** At order 4, start a *"your usual fresh basket"* card: a one-tap restock of the fresh items this shopper has already bought. It shows in-app plus one notification, timed to their median gap minus one day. No discount.

**Experiment.** 50/50 user-level split at order 4, measured until order 11 or 90 days.

- Primary: next order within 14 days. Baseline 58%, MDE +2pp, about 9.5k users per arm at α = 0.05 and 80% power.
- Secondary: reach order 11 within 90 days (baseline 49%).
- Guardrails: notification opt-outs, basket size, and **fresh-item complaint and refund rate**.

**Decision rule.** Ship at ≥ +2pp with no guardrail worse by more than 0.5pp. If the primary metric wins but complaints rise, treat it as a quality problem first. Below +1pp, kill it.

**Next test.** For slipping regulars, a three-arm win-back: a freshness guarantee vs a flat discount vs holdout. If trust brings people back as well as money does, it's cheaper and doesn't train shoppers to wait for coupons.

*Krish Gujral. All numbers come from `sql/` in this repo and can be reproduced with `npm run analyze`.*
