import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Histogram, LineChart, Scatter, TipRow, num, pct, type Dot, type Series } from './charts';
import { SampleSize } from './SampleSize';
import headline from './data/headline.json';
import ladder from './data/habit_ladder.json';
import gaps from './data/gap_distribution.json';
import cadence from './data/cadence_segments.json';
import cohorts from './data/cohort_retention.json';
import rfm from './data/rfm_segments.json';
import aisles from './data/aisle_stickiness.json';
import baseline from './data/experiment_baseline.json';

const H = headline[0];
const REPO = 'https://github.com/krishxyz1/grocery-retention';

const REPORTS = [
  { id: 'retention', label: 'Retention' },
  { id: 'habit', label: 'Habit window' },
  { id: 'rhythm', label: 'Order rhythm' },
  { id: 'aisles', label: 'Aisles' },
  { id: 'segments', label: 'Segments' },
  { id: 'test', label: 'Test planner' },
] as const;
type ReportId = (typeof REPORTS)[number]['id'];

/* ----------------------------------------------------------------- shared */

const COHORT_COLORS = ['#9db7f5', '#5f8cef', '#1e61f0', '#0b3aa8'];
const cohortIds = [...new Set(cohorts.map((c) => c.cohort))];
const cohortLabel = (id: string) => id.replace(/^\d /, '');
const cohortSize = (id: string) => cohorts.find((c) => c.cohort === id)!.cohort_users;
const curve = (id: string) => cohorts.filter((c) => c.cohort === id).map((c) => ({ x: c.month, y: c.retained }));
const at = (id: string, m: number) => curve(id).find((p) => p.x === m)!.y;

const step = (n: number) => ladder.find((r) => r.order_number === n)!.p_next_order;
const survivorsFrom4 = (to: number) =>
  Array.from({ length: to - 3 }, (_, i) => i + 4).reduce<{ x: number; y: number }[]>((acc, order) => {
    const prev = acc[acc.length - 1];
    acc.push({ x: order, y: prev ? prev.y * step(prev.x) : 1 });
    return acc;
  }, []);

const weighted = (rows: typeof aisles) =>
  rows.reduce((s, r) => s + r.reorder_rate * r.penetration, 0) / rows.reduce((s, r) => s + r.penetration, 0);

function useReport(): [ReportId, (r: ReportId) => void] {
  const read = () => {
    const r = new URLSearchParams(location.search).get('report');
    return (REPORTS.some((x) => x.id === r) ? r : 'retention') as ReportId;
  };
  const [report, setReport] = useState<ReportId>(read);
  useEffect(() => {
    const onPop = () => setReport(read());
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);
  const go = (r: ReportId) => {
    history.pushState(null, '', `?report=${r}`);
    setReport(r);
  };
  return [report, go];
}

/* ----------------------------------------------------------------- layout */

function Workspace({ query, children }: { query: ReactNode; children: ReactNode }) {
  return (
    <div className="workspace">
      <aside className="query" aria-label="Report settings">
        {query}
      </aside>
      <div className="results">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Card({ title, sub, aside, children }: { title: string; sub?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="card" aria-label={title}>
      <header className="card-head">
        <div>
          <h2>{title}</h2>
          {sub && <p className="card-sub">{sub}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

const Insight = ({ children }: { children: ReactNode }) => (
  <p className="insight">
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.2V16h6v-.3c0-.8.4-1.6 1-2.2A6 6 0 0 0 12 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
    <span>{children}</span>
  </p>
);

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

/* ------------------------------------------------------------ retention */

function Retention() {
  const [shown, setShown] = useState<string[]>([cohortIds[0], cohortIds[3]]);
  const [mode, setMode] = useState<'share' | 'lift'>('share');
  const toggle = (id: string) =>
    setShown((s) => (s.includes(id) ? (s.length > 1 ? s.filter((x) => x !== id) : s) : [...s, id]));

  const series: Series[] = cohortIds
    .map((id, i) => ({ id, i }))
    .filter(({ id }) => shown.includes(id))
    .map(({ id, i }) => ({
      key: id,
      label: cohortLabel(id),
      color: COHORT_COLORS[i],
      points: mode === 'share' ? curve(id) : curve(id).map((p) => ({ x: p.x, y: p.y / at(cohortIds[0], p.x) })),
    }));

  const lift11 = at(cohortIds[3], 11) / at(cohortIds[0], 11);

  return (
    <Workspace
      query={
        <>
          <Field label="Cohort by">
            <div className="static-select">Fresh share of first basket</div>
          </Field>
          <Field label="Cohorts">
            <ul className="checks">
              {cohortIds.map((id, i) => (
                <li key={id}>
                  <label>
                    <input type="checkbox" checked={shown.includes(id)} onChange={() => toggle(id)} />
                    <i style={{ background: COHORT_COLORS[i] }} aria-hidden="true" />
                    <span>{cohortLabel(id)}</span>
                    <small>{num(cohortSize(id))}</small>
                  </label>
                </li>
              ))}
            </ul>
          </Field>
          <Field label="Show">
            <Segmented
              label="Measure"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'share', label: 'Still ordering' },
                { value: 'lift', label: 'vs no fresh' },
              ]}
            />
          </Field>
          <p className="query-note">A shopper counts in a month if they placed any order in it. Month 0 is the first order.</p>
        </>
      }
    >
      <Card
        title={mode === 'share' ? 'Share still ordering, by month since first order' : 'Retention relative to shoppers with no fresh items'}
        aside={<Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />}
      >
        <LineChart
          label="Retention curves by first-basket cohort"
          series={series}
          y={mode === 'share' ? [0, 1] : [0.9, 2]}
          yTicks={mode === 'share' ? [0, 0.25, 0.5, 0.75, 1] : [1, 1.25, 1.5, 1.75, 2]}
          yFormat={mode === 'share' ? (v) => pct(v) : (v) => `${v.toFixed(2)}×`}
          xTicks={[0, 2, 4, 6, 8, 11]}
          xFormat={(v) => `Month ${v}`}
          height={320}
        />
        <Insight>
          By month 11, shoppers whose first basket was mostly fresh are {lift11.toFixed(1)}× as likely to still be ordering
          as shoppers who bought no fresh food, and the gap widens every month.
        </Insight>
      </Card>

      <Card title="Cohort table" sub="Share of each cohort still ordering in each month">
        <div className="table-scroll">
          <table className="heat">
            <thead>
              <tr>
                <th>Cohort</th>
                <th className="num">Shoppers</th>
                {Array.from({ length: 12 }, (_, m) => (
                  <th key={m} className="num">
                    M{m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohortIds.map((id) => (
                <tr key={id}>
                  <th scope="row">{cohortLabel(id)}</th>
                  <td className="num">{num(cohortSize(id))}</td>
                  {curve(id).map((p) => (
                    <td
                      key={p.x}
                      className="num"
                      style={{ background: `rgba(30, 97, 240, ${(p.y * 0.85).toFixed(2)})`, color: p.y > 0.5 ? '#fff' : undefined }}
                    >
                      {pct(p.y)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Workspace>
  );
}

/* ----------------------------------------------------------------- habit */

function Habit() {
  const [view, setView] = useState<'next' | 'left'>('next');
  const [range, setRange] = useState<'20' | '60'>('20');
  const to = Number(range);
  const rows = ladder.filter((r) => r.order_number <= to);
  const left = survivorsFrom4(to);
  const at11 = survivorsFrom4(11)[7].y;

  return (
    <Workspace
      query={
        <>
          <Field label="Measure">
            <Segmented
              label="Measure"
              value={view}
              onChange={setView}
              options={[
                { value: 'next', label: 'Chance of next order' },
                { value: 'left', label: 'Shoppers left' },
              ]}
            />
          </Field>
          <Field label="Orders">
            <Segmented
              label="Order range"
              value={range}
              onChange={setRange}
              options={[
                { value: '20', label: '4 to 20' },
                { value: '60', label: '4 to 60' },
              ]}
            />
          </Field>
          <p className="query-note">Only shoppers with 4 or more orders are in this dataset, so the chart starts at order 4.</p>
        </>
      }
    >
      <Card
        title={view === 'next' ? 'Chance of placing one more order' : 'Of 100 shoppers at order 4, how many are still ordering'}
        sub={view === 'next' ? 'By the order a shopper has just placed' : 'Compounding each step’s chance of a next order'}
      >
        {view === 'next' ? (
          <LineChart
            label="Chance of placing one more order by order number"
            series={[{ key: 'p', label: 'Places one more', color: 'var(--accent)', points: rows.map((r) => ({ x: r.order_number, y: r.p_next_order })) }]}
            y={[0.86, 0.98]}
            yTicks={[0.86, 0.9, 0.94, 0.98]}
            xTicks={to === 20 ? [4, 8, 12, 16, 20] : [4, 20, 40, 60]}
            xFormat={(v) => `Order ${v}`}
            yFormat={(v) => pct(v)}
            band={{ from: 4, to: 10, label: 'Orders 4–10' }}
            height={320}
          />
        ) : (
          <LineChart
            label="Shoppers left out of 100 at order 4"
            series={[{ key: 'l', label: 'Still ordering', color: 'var(--accent)', points: left }]}
            y={[0, 1]}
            yTicks={[0, 0.25, 0.5, 0.75, 1]}
            xTicks={to === 20 ? [4, 8, 12, 16, 20] : [4, 20, 40, 60]}
            xFormat={(v) => `Order ${v}`}
            yFormat={(v) => `${Math.round(v * 100)}`}
            annotation={{ x: 11, label: `${Math.round(at11 * 100)} at order 11` }}
            height={320}
          />
        )}
        <Insight>
          {pct(1 - step(4), 1)} of shoppers stop after order 4, against {pct(1 - step(20), 1)} after order 20. Only{' '}
          {Math.round(at11 * 100)} of every 100 shoppers at order 4 make it to order 11, so orders 4 to 10 are where an
          intervention has the most to gain.
        </Insight>
      </Card>

      <div className="kpis">
        <div>
          <span>Stop after order 4</span>
          <b>{pct(1 - step(4), 1)}</b>
        </div>
        <div>
          <span>Stop after order 10</span>
          <b>{pct(1 - step(10), 1)}</b>
        </div>
        <div>
          <span>Stop after order 20</span>
          <b>{pct(1 - step(20), 1)}</b>
        </div>
        <div>
          <span>Reach order 11 from order 4</span>
          <b>{pct(baseline[0].p_reach_order_11, 1)}</b>
        </div>
      </div>
    </Workspace>
  );
}

/* ---------------------------------------------------------------- rhythm */

function Rhythm() {
  const [highlight, setHighlight] = useState(true);
  const weekly = cadence[0];
  return (
    <Workspace
      query={
        <>
          <Field label="Highlight">
            <label className="switch">
              <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />
              <span>Weekly peaks (7, 14, 21 days)</span>
            </label>
          </Field>
          <p className="query-note">Gaps of 30 days or more are all recorded as 30 in the source data.</p>
        </>
      }
    >
      <Card title="Days between consecutive orders" sub="Share of all repeat orders">
        <Histogram
          label="Days between consecutive orders"
          data={gaps.map((g) => ({ x: g.gap_days, y: g.share }))}
          yTicks={[0, 0.04, 0.08, 0.12]}
          xTicks={[0, 7, 14, 21, 30]}
          xFormat={(v) => (v === 30 ? '30+ days' : v === 0 ? 'Same day' : `${v} days`)}
          color="var(--bar)"
          highlight={highlight ? (x) => x === 7 || x === 14 || x === 21 : undefined}
          highlightColor="var(--accent)"
          height={280}
          tip={(d) => (
            <>
              <div className="tip-h">{d.x === 30 ? '30 days or more' : `${d.x} days`}</div>
              <TipRow k="Share of orders" v={pct(d.y, 1)} />
            </>
          )}
        />
        <Insight>
          The most common gap is exactly 7 days. People shop on a weekly clock, so a reminder should follow each shopper’s
          own rhythm rather than a fixed day.
        </Insight>
      </Card>

      <Card title="Shoppers by usual rhythm" sub="Each shopper’s median gap between orders">
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Usual rhythm</th>
                <th className="num">Shoppers</th>
                <th className="num">Share of shoppers</th>
                <th className="num">Share of orders</th>
                <th className="num">Orders each</th>
              </tr>
            </thead>
            <tbody>
              {cadence.map((c) => (
                <tr key={c.cadence}>
                  <td>{c.cadence.replace(/^\d /, '')}</td>
                  <td className="num">{num(c.users)}</td>
                  <td className="num">{pct(c.share_users, 1)}</td>
                  <td className="num">
                    <span className="inline-bar" style={{ ['--w' as string]: c.share_orders }} />
                    {pct(c.share_orders, 1)}
                  </td>
                  <td className="num">{c.avg_orders.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Insight>
          Weekly shoppers are {pct(weekly.share_users)} of shoppers but place {pct(weekly.share_orders)} of orders.
        </Insight>
      </Card>
    </Workspace>
  );
}

/* ---------------------------------------------------------------- aisles */

function Aisles() {
  const departments = useMemo(() => [...new Set(aisles.map((a) => a.department))].sort(), []);
  const [dept, setDept] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'reorder_rate' | 'penetration'>('reorder_rate');

  const match = (a: (typeof aisles)[number]) =>
    (!dept || a.department === dept) && (!query || a.aisle.includes(query.trim().toLowerCase()));
  const filtering = Boolean(dept || query);
  const dots: Dot[] = aisles.map((a) => ({
    id: a.aisle,
    x: a.penetration,
    y: a.reorder_rate,
    color: !match(a) ? '#dfe3ea' : a.is_fresh ? 'var(--accent)' : '#8e97a8',
    label: filtering ? match(a) && aisles.filter(match).length <= 8 : ['fresh fruits', 'milk', 'spices seasonings'].includes(a.aisle),
    tip: (
      <>
        <div className="tip-h">{a.aisle}</div>
        <TipRow k="Department" v={a.department} />
        <TipRow k="In orders" v={pct(a.penetration, 1)} />
        <TipRow k="Reorder rate" v={pct(a.reorder_rate)} />
      </>
    ),
  }));
  const rows = aisles.filter(match).sort((a, b) => b[sort] - a[sort]);
  const fresh = weighted(aisles.filter((a) => a.is_fresh));
  const other = weighted(aisles.filter((a) => !a.is_fresh));

  return (
    <Workspace
      query={
        <>
          <Field label="Department">
            <select value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Find an aisle">
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. yogurt…" autoComplete="off" spellCheck={false} />
          </Field>
          <Field label="Sort table by">
            <Segmented
              label="Sort"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'reorder_rate', label: 'Reorder rate' },
                { value: 'penetration', label: 'Reach' },
              ]}
            />
          </Field>
        </>
      }
    >
      <Card
        title="How often each aisle is shopped vs. re-bought"
        aside={
          <Legend
            items={[
              { label: 'Fresh', color: 'var(--accent)' },
              { label: 'Other', color: '#8e97a8' },
            ]}
          />
        }
      >
        <Scatter
          label="Aisles by share of orders (log scale) and reorder rate"
          dots={dots}
          x={[0.0008, 0.8]}
          y={[0.1, 0.9]}
          xTicks={[0.001, 0.01, 0.1, 0.5]}
          yTicks={[0.1, 0.3, 0.5, 0.7, 0.9]}
          xFormat={(v) => `${pct(v, v < 0.01 ? 1 : 0)} of orders`}
          height={340}
        />
        <Insight>
          Fresh aisles are re-bought {pct(fresh)} of the time against {pct(other)} for the rest of the store. Bananas,
          milk, spinach and eggs are the most re-bought products of all.
        </Insight>
      </Card>

      <Card title={`${rows.length} aisles`} sub={dept ? `In ${dept}` : 'All departments'}>
        <div className="table-scroll tall">
          <table className="data">
            <thead>
              <tr>
                <th>Aisle</th>
                <th>Department</th>
                <th className="num">In orders</th>
                <th className="num">Reorder rate</th>
                <th className="num">Bought again by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.aisle}>
                  <td>
                    {a.aisle}
                    {a.is_fresh && <span className="tag">Fresh</span>}
                  </td>
                  <td className="muted">{a.department}</td>
                  <td className="num">{pct(a.penetration, 1)}</td>
                  <td className="num">{pct(a.reorder_rate)}</td>
                  <td className="num">{pct(a.repeat_buyers)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No aisle matches. Clear the search or pick another department.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </Workspace>
  );
}

/* -------------------------------------------------------------- segments */

const NEXT_STEP: Record<string, string> = {
  'Slipping regulars': 'Win back with a freshness promise before any discount.',
  Champions: 'Protect. Don’t train them to wait for coupons.',
  Loyal: 'Nudge from fortnightly to weekly with their staples.',
  Promising: 'Still in the habit window: the restock card is for them.',
  'Needs attention': 'Watch. Spend nothing yet.',
  Hibernating: 'Leave alone. Cheapest segment to ignore.',
};
const SEGMENT_HOW: Record<string, string> = {
  'Slipping regulars': 'Frequent shoppers whose latest gap is at least twice their usual gap.',
  Champions: 'Ordered recently and often.',
  Loyal: 'Steady, middling frequency and recency.',
  Promising: 'Few orders so far, but came back quickly.',
  'Needs attention': 'Middling on both frequency and recency.',
  Hibernating: 'Few orders and a long time since the last.',
};

function Segments() {
  const [selected, setSelected] = useState('Slipping regulars');
  const seg = rfm.find((r) => r.segment === selected)!;
  const max = Math.max(...rfm.map((r) => r.users));
  return (
    <Workspace
      query={
        <>
          <Field label="Segment">
            <ul className="seg-list" aria-label="Segments">
              {rfm.map((r) => (
                <li key={r.segment}>
                  <button type="button" aria-pressed={r.segment === selected} onClick={() => setSelected(r.segment)}>
                    <span>{r.segment}</span>
                    <small>{pct(r.share_users)}</small>
                  </button>
                </li>
              ))}
            </ul>
          </Field>
          <p className="query-note">
            Each shopper’s latest gap is compared with their own usual gap, so a weekly shopper who goes quiet stands out even
            when a monthly shopper with the same gap would not.
          </p>
        </>
      }
    >
      <Card title={seg.segment} sub={SEGMENT_HOW[seg.segment]}>
        <div className="kpis in-card">
          <div>
            <span>Shoppers</span>
            <b>{num(seg.users)}</b>
          </div>
          <div>
            <span>Orders each</span>
            <b>{seg.avg_orders.toFixed(1)}</b>
          </div>
          <div>
            <span>Usual gap</span>
            <b>{seg.median_usual_gap} days</b>
          </div>
          <div>
            <span>Latest gap</span>
            <b>{seg.median_latest_gap === 30 ? '30+ days' : `${seg.median_latest_gap} days`}</b>
          </div>
        </div>
        <Insight>{NEXT_STEP[seg.segment]}</Insight>
      </Card>

      <Card title="All segments">
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Segment</th>
                <th className="num">Shoppers</th>
                <th className="num">Orders each</th>
                <th className="num">Usual gap</th>
                <th className="num">Latest gap</th>
              </tr>
            </thead>
            <tbody>
              {rfm.map((r) => (
                <tr key={r.segment} className={r.segment === selected ? 'is-selected' : undefined}>
                  <td>
                    <button type="button" className="row-button" onClick={() => setSelected(r.segment)}>
                      {r.segment}
                    </button>
                  </td>
                  <td className="num">
                    <span className="inline-bar" style={{ ['--w' as string]: r.users / max }} />
                    {num(r.users)}
                  </td>
                  <td className="num">{r.avg_orders.toFixed(1)}</td>
                  <td className="num">{r.median_usual_gap} days</td>
                  <td className="num">{r.median_latest_gap === 30 ? '30+ days' : `${r.median_latest_gap} days`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Workspace>
  );
}

/* ------------------------------------------------------------------ test */

function TestPlanner() {
  const b4 = baseline[0];
  return (
    <Workspace
      query={
        <>
          <Field label="The change">
            <p className="query-text">
              From a shopper’s 4th order, send one “your usual fresh basket” card the day before they would normally shop.
              No discount. Half get it, half don’t.
            </p>
          </Field>
          <p className="query-note">Baselines come from shoppers at their 4th order in this dataset.</p>
        </>
      }
    >
      <div className="split">
        <Card title="Sample size" sub="Two-sided test of two proportions, equal arms">
          <SampleSize baseline={b4.p_next_within_14d} />
        </Card>
        <Card title="Experiment spec">
          <dl className="spec">
            <div>
              <dt>Primary metric</dt>
              <dd>Next order within 14 days · today {pct(b4.p_next_within_14d)}</dd>
            </div>
            <div>
              <dt>Secondary</dt>
              <dd>Reach order 11 within 90 days · today {pct(b4.p_reach_order_11)}</dd>
            </div>
            <div>
              <dt>Guardrails</dt>
              <dd>Notification opt-outs, items per basket, fresh-item complaints</dd>
            </div>
            <div>
              <dt>Ship if</dt>
              <dd>+2 points or more, p &lt; 0.05, no guardrail worse by half a point</dd>
            </div>
            <div>
              <dt>Stop if</dt>
              <dd>Under +1 point, or complaints rise</dd>
            </div>
            <div>
              <dt>Next test</dt>
              <dd>Slipping regulars: freshness promise vs discount vs holdout</dd>
            </div>
          </dl>
        </Card>
      </div>
      <Card title="Baselines by order number" sub="What the control group would do without the card">
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>At order</th>
                <th className="num">Shoppers</th>
                <th className="num">Next order within 14 days</th>
                <th className="num">Go on to reach order 11</th>
              </tr>
            </thead>
            <tbody>
              {baseline.map((b) => (
                <tr key={b.order_number}>
                  <td>Order {b.order_number}</td>
                  <td className="num">{num(b.users_at_step)}</td>
                  <td className="num">{pct(b.p_next_within_14d, 1)}</td>
                  <td className="num">{pct(b.p_reach_order_11, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Workspace>
  );
}

/* -------------------------------------------------------------------- app */

export default function App() {
  const [report, go] = useReport();
  const title = REPORTS.find((r) => r.id === report)!.label;

  useEffect(() => {
    document.title = `${title} · Who Comes Back`;
  }, [title]);

  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to report
      </a>
      <header className="topbar">
        <a
          className="brand"
          href="?report=retention"
          onClick={(e) => {
            e.preventDefault();
            go('retention');
          }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <rect width="22" height="22" rx="6" fill="var(--accent)" />
            <path d="M5.5 15.5 9 11l3 2.5 4.5-6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Who Comes Back
        </a>
        <span className="dataset">
          Instacart · {num(H.orders)} orders · {num(H.users)} shoppers
        </span>
        <a className="gh" href={REPO}>
          GitHub
        </a>
      </header>

      <nav className="tabs" aria-label="Reports">
        {REPORTS.map((r) => (
          <a
            key={r.id}
            href={`?report=${r.id}`}
            aria-current={r.id === report ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              go(r.id);
            }}
          >
            {r.label}
          </a>
        ))}
      </nav>

      <main id="main">
        <h1 className="sr-only">{title}</h1>
        {report === 'retention' && <Retention />}
        {report === 'habit' && <Habit />}
        {report === 'rhythm' && <Rhythm />}
        {report === 'aisles' && <Aisles />}
        {report === 'segments' && <Segments />}
        {report === 'test' && <TestPlanner />}
      </main>
    </div>
  );
}
