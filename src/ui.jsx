// ─── SHARED UI ───────────────────────────────────────────────────────────────
//
// Every component lives at module scope. The old build declared Dashboard,
// LogView and the rest inside App(), so each render produced a new component
// type and React remounted the whole subtree — which is why the import
// textarea lost focus on every keystroke.
//

import { useMemo } from 'react';
import { MUSCLES, MUSCLE_TARGETS } from './exercises.js';
import { isoWeekStart, toISODate } from './analysis.js';

export function Pill({ children, color = '#999', solid = false }) {
  return (
    <span className="pill" style={solid
      ? { background: color, color: '#fff' }
      : { background: `${color}18`, color }}>
      {children}
    </span>
  );
}

export function Track({ value, max = 1, color = 'var(--accent)' }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0)) * 100;
  return <div className="track"><div style={{ width: `${pct}%`, background: color }} /></div>;
}

export function Stat({ label, value, sub, alert = false }) {
  return (
    <div className={`stat${alert ? ' alert' : ''}`}>
      <div className="label">{label}</div>
      <div className="metric">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Sparkline({ data, width = 96, height = 28, color = 'var(--accent)' }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...data) * 0.97;
  const max = Math.max(...data) * 1.03;
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`);
  const lastY = height - ((data[data.length - 1] - min) / range) * height;
  return (
    <svg width={width} height={height} style={{ display: 'block', flex: 'none' }} aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}

/**
 * Training heatmap. Fixed from the previous version, which was fed raw set
 * rows rather than sessions (so a cell counted sets), started its weeks with
 * a Sunday jump bug, and was hard-capped at 20 weeks — not enough for a
 * 40-week course.
 */
export function Heatmap({ sessions, weeks = 26 }) {
  const columns = useMemo(() => {
    const counts = {};
    for (const s of sessions) counts[s.date] = s.sets.length;

    const end = new Date();
    const startWeek = new Date(`${isoWeekStart(toISODate(end))}T00:00:00`);
    startWeek.setDate(startWeek.getDate() - (weeks - 1) * 7);

    const cols = [];
    for (let w = 0; w < weeks; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(startWeek);
        day.setDate(day.getDate() + w * 7 + d);
        const iso = toISODate(day);
        days.push({ date: iso, count: counts[iso] || 0, future: day > end });
      }
      cols.push(days);
    }
    return cols;
  }, [sessions, weeks]);

  const shade = (n) => (n === 0 ? 'var(--sunk)' : n < 8 ? '#C6E48B' : n < 14 ? '#7BC96F' : '#239A3B');
  const todayIso = toISODate(new Date());

  return (
    <>
      <div className="scroll-x">
        <div className="heat">
          <div className="heat-col" style={{ marginRight: 4 }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => (
              <div key={i} className="heat-cell mono" style={{ fontSize: 8.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{l}</div>
            ))}
          </div>
          {columns.map((days, wi) => (
            <div key={wi} className="heat-col">
              {days.map((d) => (
                <div key={d.date} className="heat-cell"
                  title={`${d.date} — ${d.count} ${d.count === 1 ? 'set' : 'sets'}`}
                  style={{
                    background: d.future ? 'transparent' : shade(d.count),
                    border: d.date === todayIso ? '2px solid var(--ink)' : 'none',
                    opacity: d.future ? 0.35 : 1,
                  }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="heat-key">
        <span>Less</span>
        {['var(--sunk)', '#C6E48B', '#7BC96F', '#239A3B'].map((c) => <i key={c} style={{ background: c }} />)}
        <span>More</span>
      </div>
    </>
  );
}

/**
 * Hard sets per muscle, against the target band. The chart that would have
 * shown zero hamstring sets in February rather than in August.
 */
export function VolumeChart({ volumes, order, unit = 'per rotation' }) {
  const max = Math.max(
    ...Object.values(volumes),
    ...order.map((m) => MUSCLE_TARGETS[m]?.[1] || 0),
    1,
  ) * 1.12;

  return (
    <>
      {order.map((muscle) => {
        const value = volumes[muscle] || 0;
        const [lo, hi] = MUSCLE_TARGETS[muscle] || [0, 0];
        const met = value >= lo;
        return (
          <div key={muscle} className="vol-row">
            <div className="vol-name">{MUSCLES[muscle]}</div>
            <div className="vol-track">
              <div className="vol-band" style={{ left: `${(lo / max) * 100}%`, width: `${((hi - lo) / max) * 100}%` }} />
              <div className="vol-bar" style={{
                width: `${(value / max) * 100}%`,
                background: value === 0 ? 'var(--accent)' : met ? 'var(--good)' : 'var(--warn)',
                opacity: value === 0 ? 0.25 : 0.8,
              }} />
            </div>
            <div className="vol-num" style={{ color: value === 0 ? 'var(--accent)' : undefined }}>
              {value.toFixed(1)}
            </div>
          </div>
        );
      })}
      <div className="heat-key" style={{ marginTop: 12 }}>
        <i style={{ background: 'rgba(26,138,110,.16)', borderRight: '2px solid var(--good)' }} />
        <span>Target band, sets {unit}</span>
      </div>
    </>
  );
}

/** Lifting sets and mat hours in one picture — the only honest week. */
export function WeeklyLoad({ weeks }) {
  const maxSets = Math.max(...weeks.map((w) => w.sets), 20);
  const maxMats = Math.max(...weeks.map((w) => w.matMinutes / 60), 6);
  return (
    <>
      <div className="load">
        {weeks.map((w) => (
          <div key={w.week} className="load-col" title={`Week of ${w.week}: ${w.lifts} lifts / ${w.sets} sets · ${w.mats} mat sessions`}>
            <div className="lift" style={{ height: `${(w.sets / maxSets) * 55}%` }} />
            <div className="mat" style={{ height: `${((w.matMinutes / 60) / maxMats) * 40}%` }} />
          </div>
        ))}
      </div>
      <div className="heat-key" style={{ marginTop: 10, gap: 14 }}>
        <span><i style={{ background: 'var(--accent)', display: 'inline-block', marginRight: 5, verticalAlign: -1 }} />Lifting sets</span>
        <span><i style={{ background: 'var(--good)', opacity: .75, display: 'inline-block', marginRight: 5, verticalAlign: -1 }} />Mat hours</span>
      </div>
    </>
  );
}

/**
 * Generic line chart. `guide` draws a dashed reference series — used for the
 * bodyweight target slope of +0.1 kg/week.
 */
export function LineChart({ points, guide, band, color = 'var(--accent)', height = 170, format = (v) => v.toFixed(1) }) {
  if (!points || points.length === 0) return <div className="empty">No data yet.</div>;

  const W = 500, H = height, padL = 44, padB = 26;
  const all = [
    ...points.map((p) => p.y),
    ...(guide || []).map((p) => p.y),
    ...(band?.lower || []).map((p) => p.y),
    ...(band?.upper || []).map((p) => p.y),
  ];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const lo = min - span * 0.12;
  const hi = max + span * 0.12;

  const x = (i, n) => padL + (i / Math.max(n - 1, 1)) * (W - padL - 8);
  const y = (v) => (H - padB) - ((v - lo) / (hi - lo)) * (H - padB - 10);

  const line = (series) => series.map((p, i) => `${x(i, series.length)},${y(p.y)}`).join(' ');
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + f * (hi - lo));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img">
      {gridValues.map((v, i) => (
        <g key={i}>
          <line x1={padL} y1={y(v)} x2={W - 8} y2={y(v)} stroke="var(--rule-soft)" strokeWidth="1" />
          <text x={padL - 6} y={y(v) + 3.5} fontSize="9.5" textAnchor="end" fill="var(--ink-3)" fontFamily="var(--mono)">{format(v)}</text>
        </g>
      ))}
      {/* A target corridor rather than a single line — the honest shape of a
          +0.05 to +0.1 kg/week goal. */}
      {band?.lower?.length > 1 && band?.upper?.length > 1 && (
        <>
          <path
            d={`M ${band.lower.map((p, i) => `${x(i, band.lower.length)},${y(p.y)}`).join(' L ')} L ${[...band.upper].reverse().map((p, i, arr) => `${x(arr.length - 1 - i, arr.length)},${y(p.y)}`).join(' L ')} Z`}
            fill="var(--good)" opacity=".12" />
          {[band.lower, band.upper].map((series, i) => (
            <polyline key={i} points={line(series)} fill="none" stroke="var(--good)"
              strokeWidth="1.25" strokeDasharray="4 4" opacity=".65" />
          ))}
        </>
      )}
      {guide?.length > 1 && (
        <polyline points={line(guide)} fill="none" stroke="var(--good)" strokeWidth="1.5" strokeDasharray="4 4" opacity=".8" />
      )}
      {points.length > 1 && (
        <polyline points={line(points)} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {points.map((p, i) => (
        <circle key={i} cx={x(i, points.length)} cy={y(p.y)} r="3.5" fill={color} stroke="var(--surface)" strokeWidth="1.5" />
      ))}
      {points.map((p, i) => {
        const step = Math.ceil(points.length / 6);
        if (i % step !== 0 && i !== points.length - 1) return null;
        return (
          <text key={i} x={x(i, points.length)} y={H - 7} fontSize="9" textAnchor="middle" fill="var(--ink-3)" fontFamily="var(--mono)">
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}
