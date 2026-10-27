import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/* ------------------------------------------------------------------ utils */

export const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
export const num = (v: number) => v.toLocaleString('en-US');

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(640);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const linear = (d0: number, d1: number, r0: number, r1: number) => (v: number) =>
  r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

const log = (d0: number, d1: number, r0: number, r1: number) => {
  const l0 = Math.log10(d0);
  const l1 = Math.log10(d1);
  return (v: number) => r0 + ((Math.log10(v) - l0) / (l1 - l0)) * (r1 - r0);
};

interface Tip {
  x: number;
  y: number;
  body: ReactNode;
}

function Tooltip({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null;
  const flip = tip.x > width * 0.62;
  return (
    <div
      className="tip"
      style={{
        left: flip ? undefined : tip.x + 14,
        right: flip ? width - tip.x + 14 : undefined,
        top: Math.max(0, tip.y - 12),
      }}
    >
      {tip.body}
    </div>
  );
}

/* ------------------------------------------------------------- line chart */

export interface Series {
  key: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

export function LineChart({
  series,
  y: [y0, y1],
  yTicks,
  xTicks,
  xFormat = String,
  yFormat = (v) => pct(v),
  xLabel,
  band,
  height = 300,
  endLabels = false,
}: {
  series: Series[];
  y: [number, number];
  yTicks: number[];
  xTicks: number[];
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  xLabel?: string;
  band?: { from: number; to: number; label: string };
  height?: number;
  endLabels?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hoverX, setHoverX] = useState<number | null>(null);
  const m = { t: 16, r: endLabels ? 132 : 16, b: 40, l: 48 };
  const xs = series[0].points.map((p) => p.x);
  const sx = linear(xs[0], xs[xs.length - 1], m.l, width - m.r);
  const sy = linear(y0, y1, height - m.b, m.t);

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left + m.l;
    let best = xs[0];
    for (const x of xs) if (Math.abs(sx(x) - px) < Math.abs(sx(best) - px)) best = x;
    setHoverX(best);
  };

  const tip: Tip | null =
    hoverX === null
      ? null
      : {
          x: sx(hoverX),
          y: m.t,
          body: (
            <>
              <div className="tip-h">{xFormat(hoverX)}</div>
              {series.map((s) => {
                const p = s.points.find((q) => q.x === hoverX);
                return p ? (
                  <div className="tip-row" key={s.key}>
                    <i style={{ background: s.color }} />
                    <span>{s.label}</span>
                    <b>{yFormat(p.y)}</b>
                  </div>
                ) : null;
              })}
            </>
          ),
        };

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img">
        {band && (
          <g>
            <rect
              x={sx(band.from)}
              y={m.t}
              width={sx(band.to) - sx(band.from)}
              height={height - m.t - m.b}
              className="band"
            />
            <text x={sx(band.from) + 6} y={m.t + 14} className="band-label">
              {band.label}
            </text>
          </g>
        )}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={sy(t)} y2={sy(t)} className="grid" />
            <text x={m.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="tick">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={sx(t)} y={height - m.b + 18} textAnchor="middle" className="tick">
            {xFormat(t)}
          </text>
        ))}
        {xLabel && (
          <text x={width - m.r} y={height - 4} textAnchor="end" className="axis-label">
            {xLabel}
          </text>
        )}
        {series.map((s) => (
          <path
            key={s.key}
            d={s.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)},${sy(p.y)}`).join('')}
            fill="none"
            style={{ stroke: s.color }}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {endLabels &&
          spreadLabels(
            series.map((s) => ({ s, y: sy(s.points[s.points.length - 1].y) })),
            15,
          ).map(({ s, y }) => (
            <text key={s.key} x={width - m.r + 10} y={y} dy="0.32em" className="end-label">
              {s.label}
            </text>
          ))}
        {hoverX !== null && (
          <g>
            <line x1={sx(hoverX)} x2={sx(hoverX)} y1={m.t} y2={height - m.b} className="crosshair" />
            {series.map((s) => {
              const p = s.points.find((q) => q.x === hoverX);
              return p ? (
                <circle key={s.key} cx={sx(p.x)} cy={sy(p.y)} r={4.5} style={{ fill: s.color }} className="ring" />
              ) : null;
            })}
          </g>
        )}
        <rect
          x={m.l}
          y={m.t}
          width={Math.max(0, width - m.l - m.r)}
          height={height - m.t - m.b}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHoverX(null)}
        />
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

// Nudges end-of-line labels apart so neighbouring series never overlap.
function spreadLabels<T extends { y: number }>(items: T[], gap: number): T[] {
  const sorted = [...items].sort((a, b) => a.y - b.y).map((i) => ({ ...i }));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].y - sorted[i - 1].y < gap) sorted[i].y = sorted[i - 1].y + gap;
  }
  return sorted;
}

/* -------------------------------------------------------------- bar chart */

export function BarChart({
  data,
  yTicks,
  yFormat = (v) => pct(v),
  xFormat = String,
  xTickEvery = 1,
  color,
  highlight,
  highlightColor,
  xLabel,
  height = 260,
  tipLabel,
}: {
  data: { x: number; y: number }[];
  yTicks: number[];
  yFormat?: (v: number) => string;
  xFormat?: (v: number) => string;
  xTickEvery?: number;
  color: string;
  highlight?: (x: number) => boolean;
  highlightColor?: string;
  xLabel?: string;
  height?: number;
  tipLabel: (d: { x: number; y: number }) => ReactNode;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const m = { t: 12, r: 8, b: 40, l: 44 };
  const yMax = yTicks[yTicks.length - 1];
  const sy = linear(0, yMax, height - m.b, m.t);
  const step = (width - m.l - m.r) / data.length;
  const gap = Math.max(2, step * 0.18);
  const bw = Math.max(1, step - gap);

  const bar = (x: number, y: number, w: number, h: number) => {
    const r = Math.min(4, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  };

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={sy(t)} y2={sy(t)} className="grid" />
            <text x={m.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="tick">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = m.l + i * step + gap / 2;
          const top = sy(d.y);
          const on = highlight?.(d.x);
          return (
            <g key={d.x}>
              <path
                d={bar(x, top, bw, height - m.b - top)}
                style={{ fill: on && highlightColor ? highlightColor : color }}
                opacity={hover === null || hover === i ? 1 : 0.55}
              />
              {i % xTickEvery === 0 && (
                <text x={x + bw / 2} y={height - m.b + 18} textAnchor="middle" className="tick">
                  {xFormat(d.x)}
                </text>
              )}
              <rect
                x={m.l + i * step}
                y={m.t}
                width={step}
                height={height - m.t - m.b}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              />
            </g>
          );
        })}
        {xLabel && (
          <text x={width - m.r} y={height - 4} textAnchor="end" className="axis-label">
            {xLabel}
          </text>
        )}
      </svg>
      <Tooltip
        width={width}
        tip={
          hover === null
            ? null
            : { x: m.l + hover * step + step / 2, y: sy(data[hover].y), body: tipLabel(data[hover]) }
        }
      />
    </div>
  );
}

/* ---------------------------------------------------------------- scatter */

export interface Dot {
  id: string;
  x: number;
  y: number;
  color: string;
  label?: boolean;
  tip: ReactNode;
}

export function Scatter({
  dots,
  x: [x0, x1],
  y: [y0, y1],
  xTicks,
  yTicks,
  xFormat,
  yFormat = (v) => pct(v),
  xLabel,
  yLabel,
  height = 380,
}: {
  dots: Dot[];
  x: [number, number];
  y: [number, number];
  xTicks: number[];
  yTicks: number[];
  xFormat: (v: number) => string;
  yFormat?: (v: number) => string;
  xLabel: string;
  yLabel: string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Dot | null>(null);
  const m = { t: 24, r: 16, b: 44, l: 48 };
  const sx = log(x0, x1, m.l, width - m.r);
  const sy = linear(y0, y1, height - m.b, m.t);
  const narrow = width < 520;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left + m.l;
    const py = e.clientY - box.top + m.t;
    let best: Dot | null = null;
    let bd = 22 * 22;
    for (const d of dots) {
      const dd = (sx(d.x) - px) ** 2 + (sy(d.y) - py) ** 2;
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
    setHover(best);
  };

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={sy(t)} y2={sy(t)} className="grid" />
            <text x={m.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="tick">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={sx(t)} y={height - m.b + 18} textAnchor="middle" className="tick">
            {xFormat(t)}
          </text>
        ))}
        <text x={width - m.r} y={height - 4} textAnchor="end" className="axis-label">
          {xLabel}
        </text>
        <text x={m.l} y={12} className="axis-label">
          {yLabel}
        </text>
        {dots.map((d) => (
          <circle
            key={d.id}
            cx={sx(d.x)}
            cy={sy(d.y)}
            r={hover?.id === d.id ? 6 : 4.5}
            style={{ fill: d.color }}
            className="ring"
            opacity={hover && hover.id !== d.id ? 0.45 : 0.9}
          />
        ))}
        {!narrow &&
          dots
            .filter((d) => d.label)
            .map((d) => (
              <text
                key={d.id}
                x={sx(d.x) > width * 0.68 ? sx(d.x) - 9 : sx(d.x) + 9}
                y={sy(d.y)}
                dy="0.32em"
                textAnchor={sx(d.x) > width * 0.68 ? 'end' : 'start'}
                className="dot-label"
              >
                {d.id}
              </text>
            ))}
        <rect
          x={m.l}
          y={m.t}
          width={Math.max(0, width - m.l - m.r)}
          height={height - m.t - m.b}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      <Tooltip width={width} tip={hover ? { x: sx(hover.x), y: sy(hover.y), body: hover.tip } : null} />
    </div>
  );
}

/* ----------------------------------------------------------------- figure */

const REPO = 'https://github.com/krishxyz1/grocery-retention/blob/main/sql/';

export function Figure({
  n,
  title,
  dek,
  sql,
  legend,
  table,
  children,
}: {
  n: number;
  title: string;
  dek?: string;
  sql: string;
  legend?: { label: string; color: string }[];
  table: { columns: string[]; rows: (string | number)[][] };
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className="fig">
      <figcaption>
        <span className="fig-n">Fig. {n}</span>
        <h3>{title}</h3>
        {dek && <p className="fig-dek">{dek}</p>}
      </figcaption>
      {legend && (
        <ul className="legend">
          {legend.map((l) => (
            <li key={l.label}>
              <i style={{ background: l.color }} />
              {l.label}
            </li>
          ))}
        </ul>
      )}
      {showTable ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
      <div className="fig-foot">
        <button type="button" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
          {showTable ? 'Show chart' : 'Show data'}
        </button>
        <a href={REPO + sql} target="_blank" rel="noreferrer">
          sql/{sql}
        </a>
      </div>
    </figure>
  );
}
