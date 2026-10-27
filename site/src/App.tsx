import { useState, type ReactNode } from 'react';
import { Histogram, LineChart, Scatter, TipRow, num, pct, type Dot, type Series } from './charts';
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

const REPO = 'https://github.com/krishxyz1/grocery-retention';
const sqlUrl = (f: string) => `${REPO}/blob/main/sql/${f}`;

const HUE = 'var(--chart-hue)';
const INK = 'var(--chart-ink)';
const GREY = 'var(--chart-grey)';

/* ------------------------------------------------------------- the numbers */

const H = headline[0];
const step = (n: number) => ladder.find((r) => r.order_number === n)!;
const b4 = baseline[0];

// The ladder: of 100 shoppers placing order 4, how many are left at each order.
// Built from the per-step probabilities, so it must land on the reach-order-11
// rate computed independently in sql/19 (within rounding).
const survivors = [4, 5, 6, 7, 8, 9, 10, 11].reduce<{ order: number; left: number }[]>((acc, order) => {
  const prev = acc[acc.length - 1];
  acc.push({ order, left: prev ? prev.left * step(prev.order).p_next_order : 100 });
  return acc;
}, []);
console.assert(
  Math.abs(survivors[7].left / 100 - b4.p_reach_order_11) < 0.005,
  'ladder and sql/19 disagree on reach-order-11',
);

const cohortName = (c: string) => c.replace(/^\d /, '');
const cohortIds = [...new Set(cohorts.map((c) => c.cohort))];
const curve = (id: string) => cohorts.filter((c) => c.cohort === id).map((c) => ({ x: c.month, y: c.retained }));
const at = (id: string, month: number) => curve(id).find((p) => p.x === month)!.y;
const NONE = cohortIds[0];
const MOSTLY = cohortIds[3];
const lift11 = at(MOSTLY, 11) / at(NONE, 11);

const freshAisles = aisles.filter((a) => a.is_fresh);
const otherAisles = aisles.filter((a) => !a.is_fresh);
const weighted = (rows: typeof aisles) =>
  rows.reduce((s, r) => s + r.reorder_rate * r.penetration, 0) / rows.reduce((s, r) => s + r.penetration, 0);
const freshRate = weighted(freshAisles);
const otherRate = weighted(otherAisles);

const LABELLED = new Set(['fresh fruits', 'fresh vegetables', 'milk', 'eggs', 'spices seasonings', 'baking ingredients']);
const dots: Dot[] = aisles.map((a) => ({
  id: a.aisle,
  x: a.penetration,
  y: a.reorder_rate,
  color: a.is_fresh ? HUE : GREY,
  label: LABELLED.has(a.aisle),
  tip: (
    <>
      <div className="tip-h">{a.aisle}</div>
      <TipRow k="In orders" v={pct(a.penetration, 1)} />
      <TipRow k="Reorder rate" v={pct(a.reorder_rate)} />
      <TipRow k="Bought again by" v={pct(a.repeat_buyers)} />
    </>
  ),
}));

const fb = Object.fromEntries(firstBasket.map((r) => [r.first_basket.startsWith('First') ? 'yes' : 'no', r]));
const slipping = rfm.find((r) => r.segment === 'Slipping regulars')!;
const weekly = cadence[0];

const staples = products.filter((p) => p.kind === 'staple').slice(0, 5);
const oneAndDone = products
  .filter((p) => p.kind === 'one_and_done')
  .sort((a, b) => a.repurchase_rate - b.repurchase_rate)
  .slice(0, 5);

const NEXT_STEP: Record<string, string> = {
  Champions: 'Protect. Never discount',
  Loyal: 'Nudge from fortnightly to weekly',
  'Slipping regulars': 'Win back with a freshness guarantee',
  Promising: 'Restock card in the habit window',
  'Needs attention': 'Watch, don’t spend',
  Hibernating: 'Leave alone',
};

/* ------------------------------------------------------------------ pieces */

function Card({
  title,
  finding,
  span,
  sql,
  aside,
  table,
  children,
}: {
  title: string;
  finding?: ReactNode;
  span: number;
  sql?: string;
  aside?: ReactNode;
  table?: { columns: string[]; rows: (string | number)[][]; numeric?: number[] };
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`card span-${span}`} aria-label={title}>
      <header className="card-head">
        <div>
          <h2>{title}</h2>
          {finding && <p className="finding">{finding}</p>}
        </div>
        {aside}
      </header>
      {asTable && table ? <DataTable {...table} /> : children}
      {(sql || table) && (
        <footer className="card-foot">
          {table && (
            <button type="button" className="text-button" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
              {asTable ? 'Show chart' : 'Show as table'}
            </button>
          )}
          {sql && (
            <a href={sqlUrl(sql)} target="_blank" rel="noreferrer" translate="no">
              {sql}
            </a>
          )}
        </footer>
      )}
    </section>
  );
}

function DataTable({ columns, rows, numeric = [] }: { columns: string[]; rows: (string | number)[][]; numeric?: number[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c} className={numeric.includes(i) ? 'num' : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={numeric.includes(j) ? 'num' : undefined}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Legend = ({ items }: { items: { label: string; color: string }[] }) => (
  <ul className="legend">
    {items.map((i) => (
      <li key={i.label}>
        <i style={{ background: i.color }} aria-hidden="true" />
        {i.label}
      </li>
    ))}
  </ul>
);

const Mark = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <rect width="24" height="24" rx="6" fill="var(--chart-hue)" />
    <path d="M6 17h4v-4h4V9h4" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

/* -------------------------------------------------------------------- app */

export default function App() {
  return (
    <>
      <a className="skip" href="#report">
        Skip to the report
      </a>
      <header className="viewer-bar">
        <a className="product" href={REPO}>
          <Mark />
          <span>Grocery retention</span>
        </a>
        <span className="crumb">Instacart open dataset</span>
        <a className="button" href={REPO}>
          SQL on GitHub
        </a>
      </header>

      <main id="report" className="column">
        <div className="title-row">
          <div>
            <h1>Where grocery shoppers stop coming back</h1>
            <p className="source">
              {num(H.orders)} orders from {num(H.users)} shoppers · Instacart 2017 open dataset · computed in DuckDB
            </p>
          </div>
          <a className="button" href={`${REPO}/blob/main/docs/memo.md`}>
            Read the memo
          </a>
        </div>
        <p className="lead">
          Half of the shoppers who reach a 4th order never place an 11th. The ones who stay come back for fresh food, so
          the fix is a fresh restock timed to each shopper’s own week, tested against a holdout.
        </p>

        <p className="notice" role="note">
          Sampled data: every shopper here has between {H.min_orders_per_user} and {H.max_orders_per_user} orders, and
          gaps of 30 days or more are all recorded as 30. Drop-off before the 4th order can’t be seen.
        </p>

        <dl className="stats">
          <div>
            <dt>Reach order 11 after order 4</dt>
            <dd>{pct(b4.p_reach_order_11, 1)}</dd>
          </div>
          <div>
            <dt>Usual gap between orders</dt>
            <dd>
              {H.median_gap_days} <small>days</small>
            </dd>
          </div>
          <div>
            <dt>Fresh aisles re-bought</dt>
            <dd>
              {pct(freshRate)} <small>vs {pct(otherRate)} for the rest</small>
            </dd>
          </div>
          <div>
            <dt>Regulars slipping from their rhythm</dt>
            <dd>{num(slipping.users)}</dd>
          </div>
        </dl>

        {/* 12 columns: 12 × 79.67 + 11 × 12 = 1088 */}
        <div className="grid">
          <Card
            span={7}
            title="Each order makes the next one more likely"
            finding={`At order 4, ${pct(1 - step(4).p_next_order, 1)} of shoppers never place a 5th. By order 20 the loss per order is ${pct(1 - step(20).p_next_order, 1)}.`}
            sql="11_habit_ladder.sql"
            table={{
              columns: ['Order', 'Shoppers reaching it', 'Placed one more'],
              rows: ladder.map((r) => [`#${r.order_number}`, num(r.users_reaching), pct(r.p_next_order, 1)]),
              numeric: [1, 2],
            }}
          >
            <LineChart
              label="Chance of placing one more order, by order number"
              series={[{ key: 'p', label: 'Placed one more', color: HUE, points: ladder.map((r) => ({ x: r.order_number, y: r.p_next_order })) }]}
              y={[0.86, 0.98]}
              yTicks={[0.86, 0.9, 0.94, 0.98]}
              xTicks={[4, 20, 30, 40, 50, 60]}
              xFormat={(v) => `Order ${v}`}
              band={{ from: 4, to: 10, label: 'Orders 4–10, the habit window' }}
              height={276}
            />
          </Card>

          <Card
            span={5}
            title="Of 100 shoppers at their 4th order"
            finding="How many are still ordering at each step, compounding the chances on the left."
            aside={<span className="answer">{Math.round(survivors[7].left)}</span>}
          >
            <ol className="ladder" aria-label="Shoppers left at each order">
              {survivors.map((s) => (
                <li key={s.order} className={s.order === 11 ? 'is-answer' : undefined}>
                  <span className="ladder-fill" style={{ width: `${s.left}%` }} aria-hidden="true" />
                  <span>Order {s.order}</span>
                  <b>{s.left.toFixed(0)}</b>
                </li>
              ))}
            </ol>
          </Card>

          <Card
            span={7}
            title="Grocery runs on a weekly clock"
            finding="Gaps between orders peak at exactly 7, 14 and 21 days. The last bar holds every gap of 30 days or more."
            sql="12_gap_distribution.sql"
            table={{
              columns: ['Days since last order', 'Orders', 'Share'],
              rows: gaps.map((g) => [g.gap_days === 30 ? '30+' : g.gap_days, num(g.orders), pct(g.share, 1)]),
              numeric: [1, 2],
            }}
          >
            <Histogram
              label="Days between consecutive orders"
              data={gaps.map((g) => ({ x: g.gap_days, y: g.share }))}
              yTicks={[0, 0.04, 0.08, 0.12]}
              xTicks={[0, 7, 14, 21, 30]}
              xFormat={(v) => (v === 30 ? '30+ days' : v === 0 ? 'Same day' : `${v} days`)}
              color={GREY}
              highlight={(x) => x === 7 || x === 14 || x === 21}
              highlightColor={HUE}
              height={216}
              tip={(d) => (
                <>
                  <div className="tip-h">{d.x === 30 ? '30 days or more' : `${d.x} days`}</div>
                  <TipRow k="Share of orders" v={pct(d.y, 1)} />
                </>
              )}
            />
          </Card>

          <Card
            span={5}
            title="Weekly shoppers place most of the orders"
            finding={`${pct(weekly.share_users)} of shoppers order weekly and place ${pct(weekly.share_orders)} of all orders.`}
            sql="13_cadence_segments.sql"
          >
            <DataTable
              columns={['Usual rhythm', 'Shoppers', 'Orders', 'Avg orders']}
              numeric={[1, 2, 3]}
              rows={cadence.map((c) => [c.cadence.replace(/^\d /, ''), pct(c.share_users, 1), pct(c.share_orders, 1), c.avg_orders.toFixed(1)])}
            />
            <p className="small">
              Usual rhythm is each shopper’s median gap. It is the natural trigger for a reminder: the day before they
              would shop anyway, not a fixed “we miss you” on day 14.
            </p>
          </Card>

          <Card
            span={8}
            title="Fresh aisles are the ones people re-buy"
            finding={`Produce, dairy and eggs, bakery, meat and deli are re-bought ${pct(freshRate)} of the time, against ${pct(otherRate)} for everything else.`}
            sql="16_aisle_stickiness.sql"
            aside={<Legend items={[{ label: 'Fresh aisle', color: HUE }, { label: 'Other aisle', color: GREY }]} />}
            table={{
              columns: ['Aisle', 'Department', 'In orders', 'Reorder rate', 'Bought again by'],
              rows: aisles.map((a) => [a.aisle, a.department, pct(a.penetration, 2), pct(a.reorder_rate), pct(a.repeat_buyers)]),
              numeric: [2, 3, 4],
            }}
          >
            <Scatter
              label="Every aisle by share of orders (log scale) and reorder rate"
              dots={dots}
              x={[0.0008, 0.8]}
              y={[0.1, 0.9]}
              xTicks={[0.001, 0.01, 0.1, 0.5]}
              yTicks={[0.1, 0.3, 0.5, 0.7, 0.9]}
              xFormat={(v) => `${pct(v, v < 0.01 ? 1 : 0)} of orders`}
              height={450}
            />
          </Card>

          <Card
            span={4}
            title="Staples and one-time buys"
            finding="Share of buyers who bought it again. Products tried by 3,000+ shoppers."
            sql="18_product_stickiness.sql"
          >
            <h3 className="list-head">Bought again most</h3>
            <ul className="kv">
              {staples.map((p) => (
                <li key={p.product_name}>
                  <span>{p.product_name}</span>
                  <b>{pct(p.repurchase_rate)}</b>
                </li>
              ))}
            </ul>
            <h3 className="list-head">Bought again least</h3>
            <ul className="kv">
              {oneAndDone.map((p) => (
                <li key={p.product_name}>
                  <span>{p.product_name}</span>
                  <b>{pct(p.repurchase_rate)}</b>
                </li>
              ))}
            </ul>
            <p className="small">A jar of cumin lasts months. Repurchase only signals quality between items with similar use cycles.</p>
          </Card>

          <Card
            span={7}
            title="A fresh first basket keeps shoppers longer"
            finding={`By month 11, shoppers whose first basket was mostly fresh are ${lift11.toFixed(1)}× as likely to still be ordering as those who bought none. The gap widens every month.`}
            sql="14_cohort_retention.sql"
            aside={
              <Legend
                items={[
                  { label: 'Mostly fresh', color: HUE },
                  { label: 'No fresh items', color: INK },
                ]}
              />
            }
            table={{
              columns: ['Month', 'Mostly fresh', 'No fresh items', 'Ratio'],
              rows: curve(MOSTLY).map((p) => [`Month ${p.x}`, pct(p.y), pct(at(NONE, p.x)), `${(p.y / at(NONE, p.x)).toFixed(2)}×`]),
              numeric: [1, 2, 3],
            }}
          >
            <LineChart
              label="Share of each cohort still ordering, by month since first order"
              series={
                [
                  { key: 'mostly', label: 'Mostly fresh', color: HUE, points: curve(MOSTLY) },
                  { key: 'none', label: 'No fresh items', color: INK, points: curve(NONE) },
                ] satisfies Series[]
              }
              y={[0, 1]}
              yTicks={[0, 0.25, 0.5, 0.75, 1]}
              xTicks={[0, 3, 6, 9, 11]}
              xFormat={(v) => `Month ${v}`}
              annotation={{ x: 11, label: `${lift11.toFixed(1)}× at month 11` }}
              height={200}
            />
          </Card>

          <Card
            span={5}
            title="Some fresh food is enough"
            finding="The two cohorts with a third or more fresh retain almost the same. The step comes from having some."
            sql="17_first_basket_effect.sql"
          >
            <DataTable
              columns={['First basket', 'Shoppers', 'Month 6', 'Month 11']}
              numeric={[1, 2, 3]}
              rows={cohortIds.map((id) => [
                cohortName(id),
                num(cohorts.find((c) => c.cohort === id)!.cohort_users),
                pct(at(id, 6)),
                pct(at(id, 11)),
              ])}
            />
            <p className="small">
              With produce in the first basket: {fb.yes.avg_orders.toFixed(1)} orders on average and{' '}
              {pct(fb.yes.share_reaching_20)} reach 20. Without: {fb.no.avg_orders.toFixed(1)} and{' '}
              {pct(fb.no.share_reaching_20)}. This is correlation. Households that cook may stay anyway, which is why the
              next step is a test.
            </p>
          </Card>

          <Card
            span={12}
            title="Who is slipping"
            finding={`A shopper who usually orders every ${slipping.median_usual_gap} days and hasn’t in 30 is a different case from a monthly shopper at day 30. Comparing each latest gap to that shopper’s own rhythm finds ${num(slipping.users)} regulars drifting away.`}
            sql="15_rfm_segments.sql"
          >
            <div className="table-scroll">
              <table className="segments">
                <thead>
                  <tr>
                    <th>Segment</th>
                    <th className="num">Shoppers</th>
                    <th className="num">Avg orders</th>
                    <th className="num">Usual gap</th>
                    <th className="num">Latest gap</th>
                    <th>Next step</th>
                  </tr>
                </thead>
                <tbody>
                  {rfm.map((r) => (
                    <tr key={r.segment} className={r.segment === 'Slipping regulars' ? 'is-focus' : undefined}>
                      <td>{r.segment}</td>
                      <td className="num">
                        {num(r.users)}
                        <small>{pct(r.share_users)}</small>
                      </td>
                      <td className="num">{r.avg_orders.toFixed(1)}</td>
                      <td className="num">{r.median_usual_gap} days</td>
                      <td className="num">{r.median_latest_gap === 30 ? '30+ days' : `${r.median_latest_gap} days`}</td>
                      <td className="muted">{NEXT_STEP[r.segment]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            span={7}
            title="The test: a fresh restock in the habit window"
            finding="Written before launch, so the result is read against a rule and not against hope."
          >
            <dl className="spec">
              <div>
                <dt>Change</dt>
                <dd>
                  From order 4, a one-tap card with the fresh items this shopper buys, sent once at their usual gap minus a
                  day. No discount.
                </dd>
              </div>
              <div>
                <dt>Who</dt>
                <dd>Shoppers placing their 4th order, split 50/50 by user, followed to order 11 or day 90.</dd>
              </div>
              <div>
                <dt>Primary metric</dt>
                <dd>
                  Next order within 14 days. Today {pct(b4.p_next_within_14d)} at order 4 (
                  <a href={sqlUrl('19_experiment_baseline.sql')}>baseline query</a>).
                </dd>
              </div>
              <div>
                <dt>Secondary</dt>
                <dd>Reaches order 11 within 90 days. Today {pct(b4.p_reach_order_11)} of shoppers at order 4 do.</dd>
              </div>
              <div>
                <dt>Guardrails</dt>
                <dd>Notification opt-outs, items per basket, and complaints about fresh items.</dd>
              </div>
              <div>
                <dt>Ship if</dt>
                <dd>+2 points or more at p &lt; 0.05 and no guardrail worse by half a point.</dd>
              </div>
              <div>
                <dt>Stop if</dt>
                <dd>Under +1 point, or complaints rise. More fresh orders that arrive tired lose the shopper.</dd>
              </div>
            </dl>
          </Card>

          <Card span={5} title="How many shoppers it needs" finding="Two-sided test of two proportions, equal arms.">
            <SampleSize baseline={b4.p_next_within_14d} />
          </Card>

          <Card span={12} title="How this was made" finding="Every number on this page comes from one SQL file in the repo, run in DuckDB on the raw CSVs.">
            <div className="method">
              <ul className="caveats">
                <li>No calendar dates. Each shopper’s timeline is rebuilt from days since the previous order, starting at their first order.</li>
                <li>No prices. Basket size in items stands in for spend in the segments.</li>
                <li>No end of observation. Nobody is labelled churned. Drift from their own rhythm is measured instead.</li>
                <li>{pct(H.share_gaps_30plus, 1)} of gaps read 30, meaning “30 or more”, so later timelines are lower bounds.</li>
              </ul>
              <ul className="files">
                {[
                  ['00_load.sql', 'Load the raw files'],
                  ['01_model.sql', 'Timelines, baskets, shoppers'],
                  ['11_habit_ladder.sql', 'Chance of one more order'],
                  ['12_gap_distribution.sql', 'Days between orders'],
                  ['14_cohort_retention.sql', 'Retention by first basket'],
                  ['15_rfm_segments.sql', 'Segments and gap inflation'],
                  ['16_aisle_stickiness.sql', 'Aisle reach and reorder'],
                  ['19_experiment_baseline.sql', 'Baselines for the test'],
                ].map(([f, d]) => (
                  <li key={f}>
                    <span>{d}</span>
                    <a href={sqlUrl(f)} translate="no">
                      {f}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </main>

      <footer className="column foot">
        Krish Gujral · Data: The Instacart Online Grocery Shopping Dataset 2017, released by Instacart for non-commercial use.
      </footer>
    </>
  );
}
