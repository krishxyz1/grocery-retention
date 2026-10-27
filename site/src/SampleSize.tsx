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

export function SampleSize({ baseline }: { baseline: number }) {
  const [p1, setP1] = useState(Math.round(baseline * 100));
  const [mde, setMde] = useState(2);
  const [alpha, setAlpha] = useState('0.05');
  const [power, setPower] = useState('0.8');
  const [weekly, setWeekly] = useState(3000);

  const valid = p1 > 0 && p1 + mde < 100 && mde > 0 && weekly > 0;
  const n = valid ? perArm(p1 / 100, mde / 100, alpha, power) : 0;
  const weeks = valid ? Math.ceil((2 * n) / weekly) : 0;

  return (
    <div className="calc">
      <div className="calc-inputs">
        <label>
          <span>Baseline, next order ≤ 14 days</span>
          <span className="field">
            <input type="number" min={1} max={99} value={p1} onChange={(e) => setP1(+e.target.value)} />
            <em>%</em>
          </span>
        </label>
        <label>
          <span>Smallest lift worth shipping</span>
          <span className="field">
            <input type="number" min={0.5} max={20} step={0.5} value={mde} onChange={(e) => setMde(+e.target.value)} />
            <em>pp</em>
          </span>
        </label>
        <label>
          <span>Significance (two-sided α)</span>
          <select value={alpha} onChange={(e) => setAlpha(e.target.value)}>
            <option value="0.05">0.05</option>
            <option value="0.01">0.01</option>
          </select>
        </label>
        <label>
          <span>Power</span>
          <select value={power} onChange={(e) => setPower(e.target.value)}>
            <option value="0.8">80%</option>
            <option value="0.9">90%</option>
          </select>
        </label>
        <label>
          <span>Users reaching order 4 per week</span>
          <span className="field">
            <input type="number" min={100} step={100} value={weekly} onChange={(e) => setWeekly(+e.target.value)} />
          </span>
        </label>
      </div>
      <div className="calc-out" aria-live="polite">
        {valid ? (
          <>
            <div>
              <span className="calc-k">Users per arm</span>
              <span className="calc-v">{num(n)}</span>
            </div>
            <div>
              <span className="calc-k">Enrolment time</span>
              <span className="calc-v">
                {weeks} {weeks === 1 ? 'week' : 'weeks'}
              </span>
            </div>
            <p>
              Plus a 14-day tail so the last user enrolled can complete the outcome window. Read the result once, at
              the planned sample. No early stopping on a good-looking day.
            </p>
          </>
        ) : (
          <p>Baseline plus lift must stay under 100%, and every input must be positive.</p>
        )}
      </div>
    </div>
  );
}
