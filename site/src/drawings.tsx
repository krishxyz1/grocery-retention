/* Pictures drawn from the data itself, in the page's one ink. Each one stands
   where a photograph would: it is the image, and it is also a reading of the data. */

// A loyalty stamp card for 100 shoppers at their 4th order: the stamped ones
// reached order 11. Stamps are filled circles; the rest are open rings.
export function StampCard({ filled, label }: { filled: number; label: string }) {
  const cols = 10;
  const cell = 28;
  const r = 10;
  return (
    <svg className="stamp-card" viewBox={`0 0 ${cols * cell} ${cols * cell}`} role="img" aria-label={label}>
      {Array.from({ length: 100 }, (_, i) => {
        const x = (i % cols) * cell + cell / 2;
        const y = Math.floor(i / cols) * cell + cell / 2;
        const on = i < filled;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={on ? r : r - 1}
            className={on ? 'stamp-on' : 'stamp-off'}
            style={{ ['--i' as string]: i }}
          />
        );
      })}
    </svg>
  );
}

// The step-down from 100 shoppers at order 4 to the ones left at order 11, as a
// stack of bars that shorten order by order, like a receipt getting cut.
export function Ladder({ rows }: { rows: { order: number; left: number }[] }) {
  const h = 30;
  const gap = 8;
  const w = 600;
  return (
    <svg className="ladder" viewBox={`0 0 ${w} ${rows.length * (h + gap)}`} role="img" aria-label="Shoppers left at each order, out of 100 at order 4">
      {rows.map((r, i) => (
        <g key={r.order} transform={`translate(0 ${i * (h + gap)})`}>
          <rect width={(r.left / 100) * (w - 150)} height={h} className={r.order === 11 ? 'ladder-last' : 'ladder-bar'} />
          <text x={(r.left / 100) * (w - 150) + 12} y={h / 2} dy="0.35em" className="ladder-label">
            {Math.round(r.left)} at order {r.order}
          </text>
        </g>
      ))}
    </svg>
  );
}

// Every aisle in the store as one dot on a square plate: across is how often it is
// shopped (log scale), up is how often its items are bought again. Fresh aisles
// are solid, the rest are rings.
export function AislePlate({
  aisles,
  label,
}: {
  aisles: { aisle: string; penetration: number; reorder_rate: number; is_fresh: boolean }[];
  label: string;
}) {
  const S = 600;
  const pad = 48;
  const lx = (v: number) => (Math.log10(v) - Math.log10(0.0008)) / (Math.log10(0.8) - Math.log10(0.0008));
  const x = (v: number) => pad + lx(v) * (S - 2 * pad);
  const y = (v: number) => S - pad - ((v - 0.1) / 0.8) * (S - 2 * pad);
  const named = new Set(['fresh fruits', 'milk', 'spices seasonings']);
  return (
    <svg className="plate-svg" viewBox={`0 0 ${S} ${S}`} role="img" aria-label={label}>
      <rect width={S} height={S} className="plate-ground" />
      {aisles.map((a) =>
        a.is_fresh ? (
          <circle key={a.aisle} cx={x(a.penetration)} cy={y(a.reorder_rate)} r={7} className="dot-fresh">
            <title>{`${a.aisle}: re-bought ${Math.round(a.reorder_rate * 100)}%`}</title>
          </circle>
        ) : (
          <circle key={a.aisle} cx={x(a.penetration)} cy={y(a.reorder_rate)} r={5.5} className="dot-other">
            <title>{`${a.aisle}: re-bought ${Math.round(a.reorder_rate * 100)}%`}</title>
          </circle>
        ),
      )}
      {aisles
        .filter((a) => named.has(a.aisle))
        .map((a) => {
          const right = x(a.penetration) > S * 0.6;
          return (
            <text
              key={a.aisle}
              x={x(a.penetration) + (right ? -14 : 14)}
              y={y(a.reorder_rate)}
              dy="0.35em"
              textAnchor={right ? 'end' : 'start'}
              className="plate-label"
            >
              {a.aisle}
            </text>
          );
        })}
      <text x={pad} y={S - 16} className="plate-axis">
        rarely shopped
      </text>
      <text x={S - pad} y={S - 16} textAnchor="end" className="plate-axis">
        in most baskets
      </text>
      <text x={16} y={pad} className="plate-axis" transform={`rotate(-90 16 ${pad})`} textAnchor="end">
        bought again more
      </text>
    </svg>
  );
}

// A postage stamp for the back of the card: perforated edge, the ticket mark.
export function PostageStamp() {
  const w = 88;
  const h = 112;
  const perf = 6;
  const holes = [];
  for (let x = perf; x < w; x += perf * 2) holes.push(<circle key={`t${x}`} cx={x} cy={0} r={3} />, <circle key={`b${x}`} cx={x} cy={h} r={3} />);
  for (let y = perf; y < h; y += perf * 2) holes.push(<circle key={`l${y}`} cx={0} cy={y} r={3} />, <circle key={`r${y}`} cx={w} cy={y} r={3} />);
  return (
    <svg className="postage" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <mask id="perf">
        <rect width={w} height={h} fill="#fff" />
        <g fill="#000">{holes}</g>
      </mask>
      <g mask="url(#perf)">
        <rect width={w} height={h} className="postage-ground" />
        <rect x={10} y={10} width={w - 20} height={h - 20} className="postage-inner" />
        <path d="M24 74l12-14 10 8 18-22" className="postage-line" />
        <text x={w / 2} y={96} textAnchor="middle" className="postage-text">
          49
        </text>
      </g>
    </svg>
  );
}
