import { BarChart, Figure, LineChart, Scatter, num, pct, type Dot, type Series } from './charts';
import { SampleSize } from './SampleSize';
import headline from './data/headline.json';
import ladder from './data/habit_ladder.json';
import gaps from './data/gap_distribution.json';
import cadence from './data/cadence_segments.json';
import cohorts from './data/cohort_retention.json';
import rfm from './data/rfm_segments.json';
import aisles from './data/aisle_stickiness.json';
import firstBasket from './data/first_basket_effect.json';
import products from './data/product_stickiness.json';
import baseline from './data/experiment_baseline.json';

const H = headline[0];
const REPO = 'https://github.com/krishxyz1/grocery-retention';

/* ----------------------------------------------------------- derived data */

const RAMP = ['var(--ramp-1)', 'var(--ramp-2)', 'var(--ramp-3)', 'var(--ramp-4)'];
const cohortNames = [...new Set(cohorts.map((c) => c.cohort))];
const cohortSeries: Series[] = cohortNames.map((name, i) => ({
  key: name,
  label: name.replace(/^\d /, ''),
  color: RAMP[i],
  points: cohorts.filter((c) => c.cohort === name).map((c) => ({ x: c.month, y: c.retained })),
}));
const cohortAt = (i: number, month: number) => cohortSeries[i].points.find((p) => p.x === month)!.y;
// Each cohort's retention divided by the no-fresh cohort's, month by month.
const relativeSeries: Series[] = cohortSeries.slice(1).map((s) => ({
  ...s,
  points: s.points.map((p) => ({ x: p.x, y: p.y / cohortAt(0, p.x) })),
}));

const step = (n: number) => ladder.find((r) => r.order_number === n)!;
const freshAisles = aisles.filter((a) => a.is_fresh);
const otherAisles = aisles.filter((a) => !a.is_fresh);
const weighted = (rows: typeof aisles) =>
  rows.reduce((s, r) => s + r.reorder_rate * r.penetration, 0) / rows.reduce((s, r) => s + r.penetration, 0);

const LABELLED = new Set(['fresh fruits', 'fresh vegetables', 'milk', 'eggs', 'spices seasonings', 'baking ingredients']);
const dots: Dot[] = aisles.map((a) => ({
  id: a.aisle,
  x: a.penetration,
  y: a.reorder_rate,
  color: a.is_fresh ? 'var(--fresh)' : 'var(--other)',
  label: LABELLED.has(a.aisle),
  tip: (
    <>
      <div className="tip-h">{a.aisle}</div>
      <div className="tip-row"><span>Department</span><b>{a.department}</b></div>
      <div className="tip-row"><span>In % of orders</span><b>{pct(a.penetration, 1)}</b></div>
      <div className="tip-row"><span>Reorder rate</span><b>{pct(a.reorder_rate)}</b></div>
      <div className="tip-row"><span>Bought again by</span><b>{pct(a.repeat_buyers)}</b></div>
    </>
  ),
}));

const fb = Object.fromEntries(firstBasket.map((r) => [r.first_basket.startsWith('First') ? 'yes' : 'no', r]));
const slipping = rfm.find((r) => r.segment === 'Slipping regulars')!;
const weeklySeg = cadence[0];
const b4 = baseline[0];

const SEGMENT_NOTES: Record<string, string> = {
  Champions: 'Recent and frequent. Protect: do not train them on discounts.',
  Loyal: 'Steady fortnightly rhythm. Nudge toward weekly with staples.',
  'Slipping regulars': 'Habitual users whose latest gap is 2x their own norm. Highest-value win-back pool.',
  Promising: 'Few orders but came back quickly. Still inside the habit window.',
  'Needs attention': 'Middling on both axes. Watch, do not spend.',
  Hibernating: 'Rarely ordered and long gone. Cheapest to ignore.',
};

/* -------------------------------------------------------------------- app */

export default function App() {
  return (
    <>
      <header className="masthead">
        <div className="wrap">
          <a className="kicker" href={REPO}>
            Retention teardown · Instacart open dataset · DuckDB
          </a>
          <h1>The habit is in the fruit aisle</h1>
          <p className="dek">
            A retention read of {num(H.orders)} grocery orders from {num(H.users)} shoppers: where people drop off,
            what brings them back, and the experiment I would run next.
          </p>
          <p className="byline">
            Krish Gujral · <a href={REPO}>Source and SQL on GitHub</a>
          </p>
        </div>
      </header>

      <main className="wrap">
        <aside className="tldr" aria-label="Summary">
          <h2>In three sentences</h2>
          <ol>
            <li>
              Shoppers are most likely to quit between their 4th and 10th order: only {pct(b4.p_reach_order_11)} of the
              people who place a 4th order ever place an 11th.
            </li>
            <li>
              Fresh food is the retention engine. Fresh aisles are re-bought {pct(weighted(freshAisles))} of the time
              against {pct(weighted(otherAisles))} for everything else, and shoppers whose first basket was mostly fresh
              are still ordering in month nine at {pct(cohortAt(3, 9))}, against {pct(cohortAt(0, 9))} for those who
              bought none.
            </li>
            <li>
              So the intervention is a cadence-timed "your usual fresh basket" restock for users in the habit window,
              tested against holdout on next-order-within-14-days, with fresh-item complaints as the guardrail.
            </li>
          </ol>
        </aside>

        <section>
          <h2>
            <span className="sec-n">01</span>Reading the data honestly
          </h2>
          <p>
            Instacart released {num(H.order_lines)} order lines across {num(H.products)} products in 2017. It is the
            closest public thing to a real grocery order log, but it has traps that change what you can claim:
          </p>
          <ul className="caveats">
            <li>
              <b>No one has fewer than {H.min_orders_per_user} orders.</b> Users were sampled with 4 to 100 orders, so
              first-to-second order drop-off, usually the biggest leak, is invisible. Everything here describes
              shoppers who already came back three times.
            </li>
            <li>
              <b>No dates.</b> Only "days since prior order". I rebuilt each user's timeline from it, with day 0 at their
              first order.
            </li>
            <li>
              <b>Gaps are capped at 30.</b> {pct(H.share_gaps_30plus, 1)} of gaps read exactly 30, meaning "30 or more".
              Timelines after a long break are lower bounds.
            </li>
            <li>
              <b>No prices.</b> Basket size in items stands in for spend wherever RFM would want money.
            </li>
            <li>
              <b>No end date.</b> A user's last order may be churn or may be where the sample stopped. I never call a
              user churned. I use drift from their own rhythm instead (section 05).
            </li>
          </ul>
          <div className="stats">
            <div>
              <span className="stat-v">{H.median_orders_per_user}</span>
              <span className="stat-k">median orders per shopper</span>
            </div>
            <div>
              <span className="stat-v">{H.median_gap_days} days</span>
              <span className="stat-k">median gap between orders</span>
            </div>
            <div>
              <span className="stat-v">{pct(H.reorder_rate_after_first)}</span>
              <span className="stat-k">of items after order 1 are re-buys</span>
            </div>
            <div>
              <span className="stat-v">{pct(H.avg_fresh_share)}</span>
              <span className="stat-k">of an average basket is fresh</span>
            </div>
          </div>
        </section>

        <section>
          <h2>
            <span className="sec-n">02</span>The habit window
          </h2>
          <p>
            The useful question is not "what is retention" but "at which order does the next one become likely?" For
            every order number I took the share of shoppers who went on to place one more. The curve rises steeply and
            then flattens. Each early order is a coin flip that slowly becomes a routine.
          </p>
          <Figure
            n={1}
            title="Chance of placing one more order, by order number"
            dek={`At order 4, ${pct(1 - step(4).p_next_order, 1)} of shoppers never place a 5th. By order 20 the per-step loss is ${pct(1 - step(20).p_next_order, 1)}.`}
            sql="11_habit_ladder.sql"
            table={{
              columns: ['Order', 'Shoppers reaching it', 'Placed one more'],
              rows: ladder.map((r) => [r.order_number, num(r.users_reaching), pct(r.p_next_order, 1)]),
            }}
          >
            <LineChart
              series={[
                {
                  key: 'p',
                  label: 'Placed one more',
                  color: 'var(--ink)',
                  points: ladder.map((r) => ({ x: r.order_number, y: r.p_next_order })),
                },
              ]}
              y={[0.86, 0.97]}
              yTicks={[0.86, 0.88, 0.9, 0.92, 0.94, 0.96]}
              xTicks={[4, 10, 20, 30, 40, 50, 60]}
              xFormat={(v) => `#${v}`}
              yFormat={(v) => pct(v, 0)}
              xLabel="order number"
              band={{ from: 4, to: 10, label: 'habit window' }}
            />
          </Figure>
          <p>
            Compounded, those early steps are where the business is decided. Of shoppers who reach order 4, only{' '}
            <b>{pct(b4.p_reach_order_11)}</b> reach order 11. After that the per-order risk roughly halves and keeps
            falling. Orders 4 to 10 are where an intervention has the most curve to move, so that is the population
            for the experiment.
          </p>
        </section>

        <section>
          <h2>
            <span className="sec-n">03</span>Grocery runs on a weekly clock
          </h2>
          <p>
            Gaps between orders spike at exactly 7 days, with smaller bumps at 14, 21 and 30. People shop on a calendar,
            not on impulse. That makes a personal cadence the natural trigger for any reminder, not a fixed "we miss
            you" after N days.
          </p>
          <Figure
            n={2}
            title="Days between consecutive orders"
            dek="Share of all repeat orders. The 30 bar holds every gap of 30 days or more."
            sql="12_gap_distribution.sql"
            table={{
              columns: ['Gap (days)', 'Orders', 'Share'],
              rows: gaps.map((g) => [g.gap_days === 30 ? '30+' : g.gap_days, num(g.orders), pct(g.share, 1)]),
            }}
          >
            <BarChart
              data={gaps.map((g) => ({ x: g.gap_days, y: g.share }))}
              yTicks={[0, 0.04, 0.08, 0.12]}
              yFormat={(v) => pct(v, 0)}
              xTickEvery={7}
              xFormat={(v) => (v === 30 ? '30+' : String(v))}
              color="var(--bar)"
              highlight={(x) => x === 7 || x === 14 || x === 21}
              highlightColor="var(--ink)"
              xLabel="days since previous order"
              tipLabel={(d) => (
                <>
                  <div className="tip-h">{d.x === 30 ? '30+ days' : `${d.x} days`}</div>
                  <div className="tip-row"><span>Share of orders</span><b>{pct(d.y, 1)}</b></div>
                </>
              )}
            />
          </Figure>
          <p>
            Grouping shoppers by their own median gap shows how lopsided this is. Weekly shoppers are{' '}
            {pct(weeklySeg.share_users)} of people but place {pct(weeklySeg.share_orders)} of all orders. Moving a
            fortnightly shopper to weekly is worth more than reactivating a lapsed one.
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Usual rhythm</th>
                  <th>Shoppers</th>
                  <th>Share of shoppers</th>
                  <th>Share of orders</th>
                  <th>Avg orders</th>
                </tr>
              </thead>
              <tbody>
                {cadence.map((c) => (
                  <tr key={c.cadence}>
                    <td>{c.cadence.replace(/^\d /, '')}</td>
                    <td>{num(c.users)}</td>
                    <td>{pct(c.share_users, 1)}</td>
                    <td>{pct(c.share_orders, 1)}</td>
                    <td>{c.avg_orders.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2>
            <span className="sec-n">04</span>Fresh food is what brings people back
          </h2>
          <p>
            Plotting every aisle by how often it shows up against how often it is re-bought splits the store in two.
            Fresh aisles (produce, dairy and eggs, bakery, meat, deli) sit top-right. Shoppers buy them often and buy
            them again. Pantry aisles like spices and baking sit at the bottom. Nobody re-buys cumin every week.
          </p>
          <Figure
            n={3}
            title="Every aisle: reach vs. re-purchase"
            dek={`Reorder rate excludes first orders, where nothing can be a re-buy. Fresh aisles average ${pct(weighted(freshAisles))} weighted by volume, the rest ${pct(weighted(otherAisles))}.`}
            sql="16_aisle_stickiness.sql"
            legend={[
              { label: 'Fresh aisle', color: 'var(--fresh)' },
              { label: 'Everything else', color: 'var(--other)' },
            ]}
            table={{
              columns: ['Aisle', 'Department', 'In % of orders', 'Reorder rate', 'Bought again by'],
              rows: aisles.map((a) => [a.aisle, a.department, pct(a.penetration, 2), pct(a.reorder_rate), pct(a.repeat_buyers)]),
            }}
          >
            <Scatter
              dots={dots}
              x={[0.0008, 0.8]}
              y={[0.1, 0.9]}
              xTicks={[0.001, 0.01, 0.1, 0.5]}
              yTicks={[0.2, 0.4, 0.6, 0.8]}
              xFormat={(v) => pct(v, v < 0.01 ? 1 : 0)}
              xLabel="share of orders containing the aisle (log scale)"
              yLabel="reorder rate"
            />
          </Figure>
          <p>
            The same pattern shows up per shopper. I put users into cohorts by how fresh their first basket was and
            tracked what share were still ordering in each 30-day month after it.
          </p>
          <Figure
            n={4}
            title="Still ordering, by month since first order"
            dek="Cohorts by the fresh share of the first basket. Month 0 is 100% by definition."
            sql="14_cohort_retention.sql"
            legend={cohortSeries.map((s, i) => ({
              label: `${s.label} (${num(cohorts.find((c) => c.cohort === cohortNames[i])!.cohort_users)})`,
              color: s.color,
            }))}
            table={{
              columns: ['Cohort', ...Array.from({ length: 12 }, (_, m) => `M${m}`)],
              rows: cohortSeries.map((s) => [s.label, ...s.points.map((p) => pct(p.y))]),
            }}
          >
            <LineChart
              series={cohortSeries}
              y={[0, 1]}
              yTicks={[0, 0.25, 0.5, 0.75, 1]}
              xTicks={[0, 2, 4, 6, 8, 10]}
              xFormat={(v) => `M${v}`}
              xLabel="months since first order"
              height={320}
            />
          </Figure>
          <Figure
            n={5}
            title="The gap widens every month"
            dek="Each cohort's retention divided by the no-fresh cohort's. 1.0x = no difference."
            sql="14_cohort_retention.sql"
            legend={relativeSeries.map((s) => ({ label: s.label, color: s.color }))}
            table={{
              columns: ['Cohort', ...Array.from({ length: 12 }, (_, m) => `M${m}`)],
              rows: relativeSeries.map((s) => [s.label, ...s.points.map((p) => `${p.y.toFixed(2)}x`)]),
            }}
          >
            <LineChart
              series={relativeSeries}
              y={[0.9, 2]}
              yTicks={[1, 1.25, 1.5, 1.75, 2]}
              xTicks={[0, 2, 4, 6, 8, 10]}
              xFormat={(v) => `M${v}`}
              yFormat={(v) => `${v.toFixed(2)}x`}
              xLabel="months since first order"
              height={280}
            />
          </Figure>
          <p>
            Two things stand out. The gap is real and it widens: by month 11 the mostly-fresh cohort retains{' '}
            {pct(cohortAt(3, 11))} against {pct(cohortAt(0, 11))}, close to double. And the top two cohorts are almost
            identical. The jump comes from having <i>some</i> fresh food in the first order, not from having a lot of
            it.
          </p>
          <p>
            The simpler cut agrees. {pct(fb.yes.users / H.users)} of shoppers had produce in their first basket. They
            go on to place {fb.yes.avg_orders.toFixed(1)} orders on average against {fb.no.avg_orders.toFixed(1)}, and{' '}
            {pct(fb.yes.share_reaching_20)} reach 20 orders against {pct(fb.no.share_reaching_20)}.
          </p>
          <p className="aside">
            This is correlation. Someone who buys spinach on day one may just be a household that cooks, and would
            stick around anyway. That is exactly why the next step is an experiment and not a roadmap item.
          </p>

          <h3 className="sub">Staples vs. one-and-done</h3>
          <p>
            At product level, among items tried by at least 3,000 shoppers, the most re-bought list is bananas, milk,
            spinach, eggs and berries. The least re-bought is spices and baking supplies. That is not a quality signal.
            A jar of cumin lasts months. Repurchase rate only means something when you compare products with similar
            consumption cycles, and fresh food is the category where the cycle is short enough for quality to show up
            in the data quickly.
          </p>
          <div className="lists">
            {(['staple', 'one_and_done'] as const).map((kind) => (
              <div key={kind}>
                <h4>{kind === 'staple' ? 'Most re-bought' : 'Least re-bought'}</h4>
                <ol>
                  {products
                    .filter((p) => p.kind === kind)
                    .sort((a, b) => (kind === 'staple' ? b.repurchase_rate - a.repurchase_rate : a.repurchase_rate - b.repurchase_rate))
                    .slice(0, 8)
                    .map((p) => (
                      <li key={p.product_name}>
                        <span>{p.product_name}</span>
                        <b>{pct(p.repurchase_rate)}</b>
                      </li>
                    ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>
            <span className="sec-n">05</span>Who is slipping
          </h2>
          <p>
            A standard RFM cut-off ("no order in 21 days = at risk") treats a monthly shopper and a weekly shopper the
            same. I added <b>gap inflation</b>: the latest gap divided by the shopper's own median gap. Anyone with a
            frequent history whose latest gap is at least double their usual one is a <i>slipping regular</i>.
          </p>
          <div className="table-wrap">
            <table className="data seg">
              <thead>
                <tr>
                  <th>Segment</th>
                  <th>Shoppers</th>
                  <th>Avg orders</th>
                  <th>Usual gap</th>
                  <th>Latest gap</th>
                  <th>What to do</th>
                </tr>
              </thead>
              <tbody>
                {rfm.map((r) => (
                  <tr key={r.segment} className={r.segment === 'Slipping regulars' ? 'hl' : undefined}>
                    <td>{r.segment}</td>
                    <td>
                      {num(r.users)} <small>{pct(r.share_users)}</small>
                    </td>
                    <td>{r.avg_orders.toFixed(1)}</td>
                    <td>{r.median_usual_gap}d</td>
                    <td>{r.median_latest_gap === 30 ? '30d+' : `${r.median_latest_gap}d`}</td>
                    <td className="note">{SEGMENT_NOTES[r.segment]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            {num(slipping.users)} shoppers ({pct(slipping.share_users, 1)}) fit. They average{' '}
            {slipping.avg_orders.toFixed(0)} orders and usually come back every {slipping.median_usual_gap} days, but
            their latest gap was 30 days or more. A fixed recency rule would mix them in with people who were never
            regulars. They are the obvious pool for a win-back test, and the ones where a bad experience (a rotten
            avocado, a missing item) most likely caused the break.
          </p>
          <p className="sql-ref">
            <a href={`${REPO}/blob/main/sql/15_rfm_segments.sql`}>sql/15_rfm_segments.sql</a>
          </p>
        </section>

        <section>
          <h2>
            <span className="sec-n">06</span>The decision: a fresh restock in the habit window
          </h2>
          <p>
            Put the findings together. Orders 4 to 10 are where shoppers leak. People shop on a weekly clock. Fresh
            food is what they come back for. The intervention follows from that:
          </p>
          <div className="spec">
            <div>
              <h4>Intervention</h4>
              <p>
                When a shopper places order 4, start a <b>"your usual fresh basket"</b> card: a one-tap restock of the
                fresh items they have bought before. It appears in-app and as one notification, timed to their own
                median gap minus one day (never sooner than 3 days). No discount. The message is the basket itself.
              </p>
            </div>
            <div>
              <h4>Hypothesis</h4>
              <p>
                If a shopper's next fresh restock is ready on the day they would usually think about it, more of them
                will place their next order on rhythm, and more will make it past order 10.
              </p>
            </div>
            <div>
              <h4>Design</h4>
              <p>
                User-level 50/50 randomisation at order 4. Control gets the current experience. Shoppers stay in their
                arm until order 11 or 90 days.
              </p>
            </div>
            <div>
              <h4>Primary metric</h4>
              <p>
                Next order within 14 days. Baseline at order 4 is <b>{pct(b4.p_next_within_14d)}</b> (
                <a href={`${REPO}/blob/main/sql/19_experiment_baseline.sql`}>sql/19</a>).
              </p>
            </div>
            <div>
              <h4>Secondary</h4>
              <p>Reach order 11 within 90 days (baseline {pct(b4.p_reach_order_11)}). Fresh share of the next basket.</p>
            </div>
            <div>
              <h4>Guardrails</h4>
              <p>
                Notification opt-out rate. Average basket size. <b>Fresh-item complaint and refund rate.</b> Pushing
                more fresh orders through a supply chain that cannot keep them fresh would win the metric and lose
                the customer.
              </p>
            </div>
          </div>

          <h3 className="sub">How many shoppers it needs</h3>
          <p>
            A +2 point lift on a {pct(b4.p_next_within_14d)} baseline is the smallest change worth the notification
            budget. Change the inputs to see how the sample moves.
          </p>
          <SampleSize baseline={b4.p_next_within_14d} />

          <h3 className="sub">Decision rule, written before launch</h3>
          <ul className="caveats">
            <li>
              <b>Ship</b> if the primary metric improves by at least 2 points at p &lt; 0.05 and no guardrail moves
              by more than half a point in the wrong direction.
            </li>
            <li>
              <b>Iterate</b> if the primary metric improves but complaints rise. That is a sourcing problem dressed up
              as a growth win, so fix the quality first.
            </li>
            <li>
              <b>Kill</b> if the effect is under 1 point. The reminder is noise to the customer.
            </li>
          </ul>
          <p>
            <b>Follow-up test:</b> for slipping regulars, a three-arm win-back. A freshness guarantee ("anything not
            fresh is replaced, no questions") vs. a flat discount vs. holdout. If trust brings people back as well as
            money does, it is cheaper and does not teach anyone to wait for a coupon.
          </p>
        </section>

        <section className="method">
          <h2>
            <span className="sec-n">07</span>Method
          </h2>
          <p>
            All numbers come from SQL run in DuckDB on the raw CSVs. <code>npm run analyze</code> rebuilds the tables
            and exports each result as JSON for this page. Each figure links to the query behind it. The queries are
            plain SQL except for a few DuckDB conveniences (<code>MEDIAN</code>, <code>ARG_MAX</code>,{' '}
            <code>range()</code>) that have direct Postgres equivalents.
          </p>
          <ol className="sql-index">
            {[
              ['00_load.sql', 'raw load'],
              ['01_model.sql', 'user timelines, baskets, user table'],
              ['11_habit_ladder.sql', 'P(next order) by order number'],
              ['12_gap_distribution.sql', 'days between orders'],
              ['13_cadence_segments.sql', 'shoppers by usual rhythm'],
              ['14_cohort_retention.sql', 'monthly retention by first-basket cohort'],
              ['15_rfm_segments.sql', 'RFM + gap inflation'],
              ['16_aisle_stickiness.sql', 'aisle reach vs. re-purchase'],
              ['17_first_basket_effect.sql', 'produce in first basket'],
              ['18_product_stickiness.sql', 'staples vs. one-and-done'],
              ['19_experiment_baseline.sql', 'baselines for the test'],
            ].map(([f, d]) => (
              <li key={f}>
                <a href={`${REPO}/blob/main/sql/${f}`}>{f}</a>
                <span>{d}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="wrap foot">
        Data: "The Instacart Online Grocery Shopping Dataset 2017", released by Instacart for non-commercial use.
      </footer>
    </>
  );
}
