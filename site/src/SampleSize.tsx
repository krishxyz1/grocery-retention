import { useState } from 'react';
import { num } from './charts';

const Z_ALPHA: Record<string, number> = { '0.05': 1.96, '0.01': 2.5758 };
const Z_POWER: Record<string, number> = { '0.8': 0.8416, '0.9': 1.2816 };

// Two-sided test of two proportions, equal allocation.
export function perArm(p1: number, mde: number, alpha: string, power: string) {
  const p2 = p1 + mde;
  const pBar = (p1 + p2) / 2;
  const a = Z_ALPHA[alpha] * Math.sqrt(2 * pBar * (1 - pBar));
  const b = Z_POWER[power] * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  return Math.ceil(((a + b) / mde) ** 2);
}

const parse = (s: string) => Number(s.replace(',', '.').trim());

export function SampleSize({ baseline }: { baseline: number }) {
  const [p1, setP1] = useState(String(Math.round(baseline * 100)));
  const [mde, setMde] = useState('2');
  const [alpha, setAlpha] = useState('0.05');
  const [power, setPower] = useState('0.8');
  const [weekly, setWeekly] = useState('3000');

  const base = parse(p1);
  const lift = parse(mde);
  const perWeek = parse(weekly);
  const valid = base > 0 && lift > 0 && base + lift < 100 && perWeek > 0;
  const n = valid ? perArm(base / 100, lift / 100, alpha, power) : 0;
  const weeks = valid ? Math.ceil((2 * n) / perWeek) : 0;

  return (
    <form className="calc" onSubmit={(e) => e.preventDefault()}>
      <div className="calc-out" aria-live="polite">
        <div>
          <span className="calc-k">Shoppers per arm</span>
          <span className="calc-v">{valid ? num(n) : '–'}</span>
        </div>
        <div>
          <span className="calc-k">Weeks to enrol both arms</span>
          <span className="calc-v">{valid ? weeks : '–'}</span>
        </div>
      </div>
      {!valid && <p className="calc-error">The baseline plus the lift has to stay under 100%, and every figure must be above zero.</p>}
      <div className="fields">
        <label>
          <span>Baseline, next order in 14 days</span>
          <span className="input">
            <input name="baseline" inputMode="decimal" autoComplete="off" value={p1} onChange={(e) => setP1(e.target.value)} />
            <em>%</em>
          </span>
        </label>
        <label>
          <span>Smallest lift worth shipping</span>
          <span className="input">
            <input name="lift" inputMode="decimal" autoComplete="off" value={mde} onChange={(e) => setMde(e.target.value)} />
            <em>points</em>
          </span>
        </label>
        <label>
          <span>Significance level</span>
          <select name="alpha" value={alpha} onChange={(e) => setAlpha(e.target.value)}>
            <option value="0.05">0.05</option>
            <option value="0.01">0.01</option>
          </select>
        </label>
        <label>
          <span>Power</span>
          <select name="power" value={power} onChange={(e) => setPower(e.target.value)}>
            <option value="0.8">80%</option>
            <option value="0.9">90%</option>
          </select>
        </label>
        <label>
          <span>Shoppers reaching order 4 each week</span>
          <span className="input">
            <input name="weekly" inputMode="numeric" autoComplete="off" value={weekly} onChange={(e) => setWeekly(e.target.value)} />
          </span>
        </label>
      </div>
      <p className="small">Add 14 days after the last shopper enrols so their outcome window can close. Read the result once, at this sample.</p>
    </form>
  );
}
