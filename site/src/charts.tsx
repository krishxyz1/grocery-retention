import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/* Small SVG charts drawn to one set of rules: 3-5 solid gridlines, no y-axis line,
   straight 2px lines with no point markers, square-bottomed bars, one hue on the
   main data element, a plain tooltip box, labels that never sit on a mark. */

export const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
export const num = (v: number) => v.toLocaleString('en-US');

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(520);
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

const log = (d0: number, d1: number, r0: number, r1: number) => (v: number) =>
  r0 + ((Math.log10(v) - Math.log10(d0)) / (Math.log10(d1) - Math.log10(d0))) * (r1 - r0);

function Tip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const flip = x > width * 0.6;
  return (
    <div
      className="tip"
      role="status"
      style={{ left: flip ? undefined : x + 12, right: flip ? width - x + 12 : undefined, top: Math.max(0, y - 8) }}
    >
      {children}
    </div>
  );
}

export const TipRow = ({ k, v }: { k: string; v: string }) => (
  <div className="tip-row">
    <span>{k}</span>
    <b>{v}</b>
  </div>
);

// Drops x labels that would collide at this width (about 6.5px per character at
// 12px), always keeping the first and last.
function fitTicks(ticks: number[], at: (v: number) => number, fmt: (v: number) => string) {
  const w = (t: number) => fmt(t).length * 6.5 + 12;
  const kept = [ticks[0]];
  for (const t of ticks.slice(1, -1)) {
    const prev = kept[kept.length - 1];
    if (at(t) - at(prev) > (w(t) + w(prev)) / 2) kept.push(t);
  }
  const last = ticks[ticks.length - 1];
  while (kept.length > 1 && at(last) - at(kept[kept.length - 1]) <= (w(last) + w(kept[kept.length - 1])) / 2) kept.pop();
  return [...kept, last];
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
  band,
  annotation,
  endLabels = false,
  height = 220,
  label,
}: {
  series: Series[];
  y: [number, number];
  yTicks: number[];
  xTicks: number[];
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  band?: { from: number; to: number; label: string };
  annotation?: { x: number; label: string };
  endLabels?: boolean;
  height?: number;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hoverX, setHoverX] = useState<number | null>(null);
  const top = band || annotation ? 28 : 8;
  const m = { t: top, r: endLabels ? 104 : 8, b: 28, l: 44 };
  const xs = series[0].points.map((p) => p.x);
  const sx = linear(xs[0], xs[xs.length - 1], m.l, width - m.r);
  const sy = linear(y0, y1, height - m.b, m.t);

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left + m.l;
    setHoverX(xs.reduce((best, x) => (Math.abs(sx(x) - px) < Math.abs(sx(best) - px) ? x : best), xs[0]));
  };

  const ends = endLabels
    ? spread(series.map((s) => ({ s, y: sy(s.points[s.points.length - 1].y) })), 16)
    : [];

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={label}>
        {band && (
          <g>
            <rect x={sx(band.from)} y={m.t} width={sx(band.to) - sx(band.from)} height={height - m.t - m.b} className="band" />
            <text x={sx(band.from)} y={14} className="note">
              {band.label}
            </text>
          </g>
        )}
        {yTicks.map((t, i) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={sy(t)} y2={sy(t)} className={i === 0 ? 'baseline' : 'grid'} />
            <text x={m.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="tick">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {fitTicks(xTicks, sx, xFormat).map((t, i, all) => (
          <text
            key={t}
            x={sx(t)}
            y={height - 8}
            textAnchor={i === 0 ? 'start' : i === all.length - 1 ? 'end' : 'middle'}
            className="tick"
          >
            {xFormat(t)}
          </text>
        ))}
        {annotation && (
          <g>
            <line x1={sx(annotation.x)} x2={sx(annotation.x)} y1={20} y2={height - m.b} className="marker" />
            <text x={sx(annotation.x)} y={14} textAnchor="end" className="note">
              {annotation.label}
            </text>
          </g>
        )}
        {series.map((s) => (
          <path
            key={s.key}
            d={s.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)},${sy(p.y)}`).join('')}
            fill="none"
            style={{ stroke: s.color }}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ))}
        {ends.map(({ s, y }) => (
          <text key={s.key} x={width - m.r + 8} y={y} dy="0.32em" className="end-label">
            {s.label}
          </text>
        ))}
        {hoverX !== null && (
          <g>
            <line x1={sx(hoverX)} x2={sx(hoverX)} y1={m.t} y2={height - m.b} className="hover-line" />
            {series.map((s) => {
              const p = s.points.find((q) => q.x === hoverX);
              return p ? <circle key={s.key} cx={sx(p.x)} cy={sy(p.y)} r={4} style={{ fill: s.color }} className="dot" /> : null;
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
      {hoverX !== null && (
        <Tip x={sx(hoverX)} y={m.t} width={width}>
          <div className="tip-h">{xFormat(hoverX)}</div>
          {series.map((s) => {
            const p = s.points.find((q) => q.x === hoverX);
            return p ? <TipRow key={s.key} k={s.label} v={yFormat(p.y)} /> : null;
          })}
        </Tip>
      )}
    </div>
  );
}

function spread<T extends { y: number }>(items: T[], gap: number): T[] {
  const out = [...items].sort((a, b) => a.y - b.y).map((i) => ({ ...i }));
  for (let i = 1; i < out.length; i++) if (out[i].y - out[i - 1].y < gap) out[i].y = out[i - 1].y + gap;
  return out;
}

/* -------------------------------------------------------------- histogram */

export function Histogram({
  data,
  yTicks,
  yFormat = (v) => pct(v),
  xFormat = String,
  xTicks,
  color,
  highlight,
  highlightColor,
  height = 220,
  label,
  tip,
}: {
  data: { x: number; y: number }[];
  yTicks: number[];
  yFormat?: (v: number) => string;
  xFormat?: (v: number) => string;
  xTicks: number[];
  color: string;
  highlight?: (x: number) => boolean;
  highlightColor?: string;
  height?: number;
  label: string;
  tip: (d: { x: number; y: number }) => ReactNode;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const m = { t: 8, r: 8, b: 28, l: 44 };
  const sy = linear(0, yTicks[yTicks.length - 1], height - m.b, m.t);
  const step = (width - m.l - m.r) / data.length;
  const seam = 2;

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={label}>
        {yTicks.map((t, i) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={sy(t)} y2={sy(t)} className={i === 0 ? 'baseline' : 'grid'} />
            <text x={m.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="tick">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = m.l + i * step + seam / 2;
          const yTop = sy(d.y);
          const on = highlight?.(d.x);
          return (
            <g key={d.x}>
              <rect
                x={x}
                y={yTop}
                width={Math.max(1, step - seam)}
                height={height - m.b - yTop}
                style={{ fill: on && highlightColor ? highlightColor : color }}
                opacity={hover === null || hover === i ? 1 : 0.6}
              />
              {xTicks.includes(d.x) && (
                <text x={x + (step - seam) / 2} y={height - 8} textAnchor="middle" className="tick">
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
      </svg>
      {hover !== null && (
        <Tip x={m.l + hover * step + step / 2} y={sy(data[hover].y)} width={width}>
          {tip(data[hover])}
        </Tip>
      )}
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
  height = 300,
  label,
}: {
  dots: Dot[];
  x: [number, number];
  y: [number, number];
  xTicks: number[];
  yTicks: number[];
  xFormat: (v: number) => string;
  yFormat?: (v: number) => string;
  height?: number;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Dot | null>(null);
  const m = { t: 8, r: 8, b: 28, l: 44 };
  const sx = log(x0, x1, m.l, width - m.r);
  const sy = linear(y0, y1, height - m.b, m.t);

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left + m.l;
    const py = e.clientY - box.top + m.t;
    let best: Dot | null = null;
    let bd = 20 * 20;
    for (const d of dots) {
      const dd = (sx(d.x) - px) ** 2 + (sy(d.y) - py) ** 2;
      if (dd < bd) [bd, best] = [dd, d];
    }
    setHover(best);
  };

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={label}>
        {yTicks.map((t, i) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={sy(t)} y2={sy(t)} className={i === 0 ? 'baseline' : 'grid'} />
            <text x={m.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="tick">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {fitTicks(xTicks, sx, xFormat).map((t, i, all) => (
          <text
            key={t}
            x={sx(t)}
            y={height - 8}
            textAnchor={i === 0 ? 'start' : i === all.length - 1 ? 'end' : 'middle'}
            className="tick"
          >
            {xFormat(t)}
          </text>
        ))}
        {dots.map((d) => (
          <circle
            key={d.id}
            cx={sx(d.x)}
            cy={sy(d.y)}
            r={hover?.id === d.id ? 5.5 : 4}
            style={{ fill: d.color }}
            className="dot"
            opacity={hover && hover.id !== d.id ? 0.5 : 1}
          />
        ))}
        {width > 480 &&
          dots
            .filter((d) => d.label)
            .map((d) => {
              const right = sx(d.x) > width * 0.66;
              return (
                <text
                  key={d.id}
                  x={right ? sx(d.x) - 8 : sx(d.x) + 8}
                  y={sy(d.y)}
                  dy="0.32em"
                  textAnchor={right ? 'end' : 'start'}
                  className="end-label"
                >
                  {d.id}
                </text>
              );
            })}
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
      {hover && (
        <Tip x={sx(hover.x)} y={sy(hover.y)} width={width}>
          {hover.tip}
        </Tip>
      )}
    </div>
  );
}
