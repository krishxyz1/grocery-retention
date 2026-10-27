import { useEffect, useRef, useState } from 'react';
import { LineChart, num, pct } from './charts';
import { SampleSize } from './SampleSize';
import headline from './data/headline.json';
import ladder from './data/habit_ladder.json';
import cohorts from './data/cohort_retention.json';
import rfm from './data/rfm_segments.json';
import aisles from './data/aisle_stickiness.json';
import products from './data/product_stickiness.json';
import baseline from './data/experiment_baseline.json';
import { AislePlate, Ladder, PostageStamp, StampCard } from './drawings';

/* The idea: a shopper's own stationery (the receipt, the stamp card, the
   reply slip) becomes the report. Each section is another printed piece. */

const REPO = 'https://github.com/krishxyz1/grocery-retention';
const sql = (f: string) => `${REPO}/blob/main/sql/${f}`;

const H = headline[0];
const b4 = baseline[0];
const step = (n: number) => ladder.find((r) => r.order_number === n)!.p_next_order;

// Of 100 shoppers at order 4, how many are left at each later order.
const survivors = [4, 5, 6, 7, 8, 9, 10, 11].reduce<{ order: number; left: number }[]>((acc, order) => {
  const prev = acc[acc.length - 1];
  acc.push({ order, left: prev ? prev.left * step(prev.order) : 100 });
  return acc;
}, []);
const at11 = Math.round(survivors[7].left);

const cohortIds = [...new Set(cohorts.map((c) => c.cohort))];
const curve = (id: string) => cohorts.filter((c) => c.cohort === id).map((c) => ({ x: c.month, y: c.retained }));
const retained = (id: string, m: number) => curve(id).find((p) => p.x === m)!.y;
const NONE = cohortIds[0];
const MOSTLY = cohortIds[3];

const weighted = (fresh: boolean) => {
  const rows = aisles.filter((a) => a.is_fresh === fresh);
  return rows.reduce((s, r) => s + r.reorder_rate * r.penetration, 0) / rows.reduce((s, r) => s + r.penetration, 0);
};
const freshRate = weighted(true);
const otherRate = weighted(false);

const slipping = rfm.find((r) => r.segment === 'Slipping regulars')!;
const segments = [slipping, ...rfm.filter((r) => r !== slipping)];
const NEXT: Record<string, string> = {
  'Slipping regulars': 'Win back with a freshness promise before a coupon.',
  Champions: 'Protect. Never train them to wait for a discount.',
  Loyal: 'Nudge from fortnightly to weekly with their staples.',
  Promising: 'Still in the habit window. The restock card is for them.',
  'Needs attention': 'Watch. Spend nothing yet.',
  Hibernating: 'Leave alone. Cheapest segment to ignore.',
};
const staples = products.filter((p) => p.kind === 'staple');

const LADDER_ROWS = [4, 6, 10, 20, 40];

/* ------------------------------------------------------------------ motion */

// Scroll progress of the hero, 0 → 1, drives the card shrinking to a stub.
function useHeroProgress() {
  const ref = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const total = el.offsetHeight - innerHeight;
        setP(Math.min(1, Math.max(0, -el.getBoundingClientRect().top / Math.max(1, total))));
      });
    };
    on();
    addEventListener('scroll', on, { passive: true });
    addEventListener('resize', on);
    return () => {
      removeEventListener('scroll', on);
      removeEventListener('resize', on);
      cancelAnimationFrame(raf);
    };
  }, []);
  return [ref, p] as const;
}

// Parts of each section rise in once, staggered. Content is visible without JS.
function useEntrances() {
  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>('[data-rise]');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.documentElement.classList.add('motion');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* -------------------------------------------------------------------- page */

const TABS = ['Aisles', 'First basket', 'Products'] as const;

export default function App() {
  const [heroRef, p] = useHeroProgress();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Aisles');
  useEntrances();

  return (
    <>
      <a className="skip" href="#findings">
        Skip to the findings
      </a>

      <header className="hero" ref={heroRef} style={{ ['--p' as string]: p }}>
        <div className="hero-stage">
          <article className="ticket">
            <h1 className="ticket-title">
              <span>Who</span> <span>comes</span> <span>back</span>
            </h1>
            <p className="ticket-facts">
              A grocery retention teardown of
              <br />
              {num(H.orders)} grocery orders
              <br />
              from {num(H.users)} shoppers
            </p>
            <p className="ticket-sentence">
              Where shoppers stop ordering, what brings them back, and the test I would run next. Written in SQL.
            </p>
            <figure className="ticket-card">
              <StampCard filled={at11} label={`${at11} of 100 shoppers at their fourth order go on to place an eleventh`} />
              <figcaption>Of 100 shoppers at their 4th order, the {at11} stamped ones place an 11th.</figcaption>
            </figure>
            <div className="ticket-foot">
              <span>Krish Gujral</span>
              <a className="btn" href="#findings">
                Read the findings
              </a>
              <a href={REPO}>Source</a>
            </div>
          </article>
        </div>
      </header>

      <main>
        <section id="findings" className="intro wrap" aria-labelledby="intro-h">
          <div className="intro-top">
            <h2 id="intro-h" data-rise>
              Half don’t stay
            </h2>
            <p className="intro-note" data-rise>
              Of every 100 shoppers who place a fourth order, {at11} place an eleventh. The ones who stay come back on a
              weekly clock, and they come back for fresh food.
            </p>
          </div>
          <dl className="facts">
            <div data-rise>
              <dt>{at11} of 100</dt>
              <dd>reach order 11 after order 4</dd>
            </div>
            <div data-rise>
              <dt>{H.median_gap_days} days</dt>
              <dd>is the usual gap between orders</dd>
            </div>
            <div data-rise>
              <dt>{pct(freshRate)}</dt>
              <dd>of fresh-aisle items are re-buys, against {pct(otherRate)}</dd>
            </div>
            <div data-rise>
              <dt>{num(slipping.users)}</dt>
              <dd>regulars are drifting from their rhythm</dd>
            </div>
          </dl>
          <figure className="intro-photo" data-rise>
            <Ladder rows={survivors} />
          </figure>
        </section>

        <section className="ledger" aria-labelledby="ledger-h">
          <div className="wrap ledger-grid">
            <h2 id="ledger-h" className="ledger-head">
              <span>The odds of</span> one more order
            </h2>
            <div className="ledger-rows">
              {LADDER_ROWS.map((n) => {
                const [whole, dec] = (step(n) * 100).toFixed(1).split('.');
                return (
                  <div className="ledger-row" key={n} data-rise>
                    <span className="whole">{whole}</span>
                    <span className="dec">.{dec}</span>
                    <span className="cap">
                      per cent of shoppers at order {n} place order {n + 1}
                    </span>
                  </div>
                );
              })}
              <p className="ledger-note" data-rise>
                Each early order is close to a coin toss compared with later ones. Compounded from order 4 to 11, the
                losses take {100 - at11} of every 100 shoppers. That window is where an intervention has the most to
                move. <a href={sql('11_habit_ladder.sql')}>The query</a>
              </p>
            </div>
          </div>
        </section>

        <section className="plate" aria-labelledby="plate-h">
          <figure className="plate-photo" data-rise>
            <AislePlate aisles={aisles} label="All 132 aisles by how often they are shopped and how often their items are bought again. Fresh aisles cluster at the top right." />
          </figure>
          <div className="plate-text">
            <div className="tabs" role="tablist" aria-label="Ways of cutting the data">
              {TABS.map((t) => (
                <button
                  key={t}
                  role="tab"
                  type="button"
                  aria-selected={tab === t}
                  aria-controls="plate-panel"
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div id="plate-panel" role="tabpanel" className="plate-body">
              <h2 id="plate-h">Fresh food brings them back</h2>
              {tab === 'Aisles' && (
                <>
                  <p className="big-compare">
                    {pct(freshRate)} <span>against {pct(otherRate)}</span>
                  </p>
                  <p>
                    Items from produce, dairy and eggs, bakery, meat and deli are re-buys {pct(freshRate)} of the time.
                    Everything else in the store is re-bought {pct(otherRate)} of the time, weighted by how often each
                    aisle is shopped.
                  </p>
                </>
              )}
              {tab === 'First basket' && (
                <>
                  <LineChart
                    label="Share still ordering by month since first order, mostly-fresh first basket against none"
                    series={[
                      { key: 'm', label: 'Mostly fresh', color: 'var(--ink)', points: curve(MOSTLY) },
                      { key: 'n', label: 'No fresh', color: 'var(--muted-line)', points: curve(NONE) },
                    ]}
                    y={[0, 1]}
                    yTicks={[0, 0.5, 1]}
                    xTicks={[0, 6, 11]}
                    xFormat={(v) => `Month ${v}`}
                    yFormat={(v) => pct(v)}
                    endLabels
                    height={190}
                  />
                  <p>
                    By month 11, {pct(retained(MOSTLY, 11))} of shoppers whose first basket was mostly fresh are still
                    ordering, against {pct(retained(NONE, 11))} of those who bought none. Correlation, so it is a test to
                    run, not a fact to ship.
                  </p>
                </>
              )}
              {tab === 'Products' && (
                <>
                  <ol className="mini-list">
                    {staples.slice(0, 5).map((s) => (
                      <li key={s.product_name}>
                        <span>{s.product_name}</span>
                        <b>{pct(s.repurchase_rate)}</b>
                      </li>
                    ))}
                  </ol>
                  <p>Share of buyers who bought it again, among products tried by 3,000 or more shoppers.</p>
                </>
              )}
            </div>
            <div className="cells">
              <a className="cell ink" href={sql('16_aisle_stickiness.sql')}>
                Aisle query
              </a>
              <a className="cell" href={sql('14_cohort_retention.sql')}>
                Cohort query
              </a>
            </div>
          </div>
        </section>

        <section className="segments wrap-narrow" aria-labelledby="seg-h">
          <h2 id="seg-h" className="giant" data-rise>
            Segments
          </h2>
          <p className="seg-note" data-rise>
            A 20-day gap is normal for a monthly shopper and alarming for a weekly one, so each shopper’s latest gap is
            compared with their own usual gap.
          </p>
          <div className="bars">
            {segments.map((s, i) => (
              <details key={s.segment} open={i === 0} data-rise>
                <summary>
                  <span>{s.segment}</span>
                  <span className="bar-count">{num(s.users)}</span>
                </summary>
                <dl>
                  <div>
                    <dt>Share of shoppers</dt>
                    <dd>{pct(s.share_users, 1)}</dd>
                  </div>
                  <div>
                    <dt>Orders on average</dt>
                    <dd>{s.avg_orders.toFixed(1)}</dd>
                  </div>
                  <div>
                    <dt>Usual gap</dt>
                    <dd>{s.median_usual_gap} days</dd>
                  </div>
                  <div>
                    <dt>Latest gap</dt>
                    <dd>{s.median_latest_gap === 30 ? '30 days or more' : `${s.median_latest_gap} days`}</dd>
                  </div>
                  <p>{NEXT[s.segment]}</p>
                </dl>
              </details>
            ))}
          </div>
        </section>

        <section className="slip-field" aria-labelledby="slip-h">
          <div className="wrap slip-grid">
            <div className="slip-intro" data-rise>
              <h2 id="slip-h">The test I would run</h2>
              <p>
                From their fourth order, shoppers get a one-tap card with the fresh items they usually buy, sent the day
                before they would normally shop. No discount. Half get it, half don’t.
              </p>
            </div>
            <div className="slip" data-rise>
              <h3>Before launch</h3>
              <p className="slip-row">
                <span>A/A week to check the split</span>
                <i aria-hidden="true" />
                <span>7 days</span>
              </p>
              <p className="slip-row">
                <span>Decision rule written down</span>
                <i aria-hidden="true" />
                <span>day 0</span>
              </p>
              <h3>Enrolment</h3>
              <p className="slip-row">
                <span>Shoppers at order 4, split 50/50</span>
                <i aria-hidden="true" />
                <span>9,493 each</span>
              </p>
              <p className="slip-row">
                <span>At 3,000 new shoppers a week</span>
                <i aria-hidden="true" />
                <span>7 weeks</span>
              </p>
              <h3>Readout</h3>
              <p className="slip-row">
                <span>Next order within 14 days, today {pct(b4.p_next_within_14d)}</span>
                <i aria-hidden="true" />
                <span>+2 points</span>
              </p>
              <p className="slip-row">
                <span>Fresh-item complaints must not rise</span>
                <i aria-hidden="true" />
                <span>guardrail</span>
              </p>
              <p className="slip-total">
                <span>Ship, iterate or stop</span>
                <span>9 weeks</span>
              </p>
            </div>
          </div>
        </section>

        <section className="patrons" aria-labelledby="patrons-h">
          <article className="patron-card" data-rise>
            <h2 id="patrons-h">What people buy again</h2>
            <p className="names">
              {staples.map((s, i) => (
                <span key={s.product_name}>
                  <span className="name">
                    {s.product_name}
                    {i < staples.length - 1 ? ' ·' : ''}
                  </span>{' '}
                </span>
              ))}
            </p>
          </article>
        </section>

        <section className="reply-field" aria-labelledby="reply-h">
          <p className="reply-lead" data-rise>
            Every number on this page comes from a SQL file you can run on the same CSVs. Change the inputs on the card to
            plan the test for a different store.
          </p>
          <article className="reply-card" data-rise>
            <h2 id="reply-h">Plan the test</h2>
            <SampleSize baseline={b4.p_next_within_14d} />
            <a className="reply-action" href={REPO}>
              Open the SQL on GitHub
            </a>
          </article>
        </section>
      </main>

      <footer className="back">
        <div className="postcard">
          <div className="postcard-msg">
            <h2>Read with care</h2>
            <p>
              Instacart only sampled shoppers with {H.min_orders_per_user} to {H.max_orders_per_user} orders, so the
              first-to-second order drop is invisible here. Gaps of 30 days or more are all recorded as 30. There are no
              prices and no end date, so nobody is called churned.
            </p>
          </div>
          <div className="postcard-address">
            <span className="stamp">
              <PostageStamp />
            </span>
            <a href={REPO}>The repository</a>
            <a href={`${REPO}/blob/main/docs/memo.md`}>One-page memo</a>
            <a href={`${REPO}/blob/main/docs/experiment-plan.md`}>Experiment plan</a>
            <a href="mailto:krishagar8@gmail.com">krishagar8@gmail.com</a>
          </div>
          <p className="imprint">
            Krish Gujral. Data: The Instacart Online Grocery Shopping Dataset 2017, non-commercial use. Drawings are made from the data on this page.
          </p>
        </div>
      </footer>
    </>
  );
}
