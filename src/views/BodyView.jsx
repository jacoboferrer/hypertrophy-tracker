// ─── BODY ────────────────────────────────────────────────────────────────────
//
// Replaces the old Nutrition tab, in which every number was hardcoded —
// including a 65 kg bodyweight that nothing verified. What survives is the one
// finding that mattered (two of three modelled days sat under maintenance) and
// the one measurement that outranks everything else in the app.
//

import { useState, useRef } from 'react';
import { BODY_PARAMS } from '../config.js';
import { smoothSeries, today as todayIso } from '../analysis.js';
import {
  addBodyweight, addGrappling, removeGrappling,
  exportJSON, importJSON, useStore,
} from '../store.js';
import { LineChart, Stat, Pill } from '../ui.jsx';

const HARDNESS = { 1: 'Light', 2: 'Normal', 3: 'Hard' };

export default function BodyView({ bodyweight, grappling, onToast }) {
  const [value, setValue] = useState('');
  const [waistValue, setWaistValue] = useState('');
  const [matDate, setMatDate] = useState(todayIso());
  const fileInput = useRef(null);
  const local = useStore();

  const series = smoothSeries(bodyweight);
  const waistSeries = smoothSeries(bodyweight, 7, 'waist');
  const latest = series[series.length - 1];
  const first = series[0];
  const latestWaist = waistSeries[waistSeries.length - 1];
  const firstWaist = waistSeries[0];

  const points = series.map((s) => ({ y: s.smooth, label: s.date.slice(5) }));

  // A corridor, not a line: +0.05 to +0.1 kg/week is the honest target.
  const [lo, hi] = BODY_PARAMS.weeklyGainBand;
  const slope = (rate) => (first ? series.map((s) => {
    const weeks = (new Date(`${s.date}T00:00:00`) - new Date(`${first.date}T00:00:00`)) / (7 * 86400000);
    return { y: first.smooth + weeks * rate, label: s.date.slice(5) };
  }) : []);
  const band = { lower: slope(lo), upper: slope(hi) };

  const change = latest && first ? latest.smooth - first.smooth : 0;
  const weeksSpan = latest && first
    ? Math.max((new Date(`${latest.date}T00:00:00`) - new Date(`${first.date}T00:00:00`)) / (7 * 86400000), 0)
    : 0;
  const actualRate = weeksSpan > 1 ? change / weeksSpan : null;
  const waistChange = latestWaist && firstWaist ? latestWaist.smooth - firstWaist.smooth : null;

  // The whole point of measuring both. Weight up with waist flat is the
  // surplus landing where you want it; weight up with waist up is not.
  const verdict = (() => {
    if (actualRate === null || waistChange === null) return null;
    if (actualRate < lo * 0.5) return { tone: 'warn', text: 'Weight is flat or falling. Add ~150 kcal and hold protein.' };
    if (waistChange > 1.5) return { tone: 'warn', text: 'Waist is climbing faster than it should. Cut back ~150–200 kcal.' };
    if (actualRate > hi * 1.5) return { tone: 'warn', text: 'Gaining faster than the corridor. Ease off ~150 kcal.' };
    return { tone: 'good', text: 'Weight rising, waist steady — the surplus is going where you want it.' };
  })();

  const save = () => {
    const v = value.trim() ? parseFloat(value.replace(',', '.')) : null;
    const w = waistValue.trim() ? parseFloat(waistValue.replace(',', '.')) : null;
    if (v === null && w === null) { onToast('Enter a weight, a waist measurement, or both'); return; }
    if (v !== null && (isNaN(v) || v < 30 || v > 200)) { onToast('Weight should be in kg'); return; }
    if (w !== null && (isNaN(w) || w < 40 || w > 200)) { onToast('Waist should be in cm'); return; }
    addBodyweight({ date: todayIso(), value: v, waist: w });
    setValue(''); setWaistValue('');
    onToast([v && `${v} kg`, w && `${w} cm`].filter(Boolean).join(' · ') + ' logged');
  };

  const recentMats = [...grappling].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);

  // A second copy, independent of the Sheet sync — for clearing browser data,
  // or moving an unsent queue to another device.
  const download = () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hypertrophy-backup-${todayIso()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Backup downloaded');
  };

  const restore = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      importJSON(await file.text());
      onToast('Backup restored');
    } catch {
      onToast('Could not read that file');
    }
    event.target.value = '';
  };

  return (
    <div className="page stack">
      <h1>Body</h1>

      <div className="card" style={{ background: 'var(--accent-soft)', borderColor: '#F5D5D0' }}>
        <div className="label" style={{ color: 'var(--accent)' }}>Monday measurements</div>
        <div className="dim" style={{ marginTop: 8, color: 'var(--ink)' }}>
          At ~20% body fat the constraint is not the fat you carry but how little muscle sits under it.
          That makes this a recomposition, not a bulk: target
          <b> +{lo}–{hi} kg a week (about +2 to +4 kg by June)</b> and keep protein high.
          Weight alone cannot say which tissue you added — <b>waist is the discriminator</b>.
          Same spot, same time, once a week.
        </div>
      </div>

      <div className="card">
        <div className="label">Log today</div>
        <div className="row" style={{ marginTop: 10, gap: 8, alignItems: 'flex-end' }}>
          <div className="field grow">
            <span className="muted">Weight, kg</span>
            <input type="number" inputMode="decimal" step="0.1" placeholder="65.0" aria-label="Bodyweight in kg"
              value={value} onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()} />
          </div>
          <div className="field grow">
            <span className="muted">Waist, cm</span>
            <input type="number" inputMode="decimal" step="0.1" placeholder="80.0" aria-label="Waist in cm"
              value={waistValue} onChange={(e) => setWaistValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()} />
          </div>
          <button className="btn primary" onClick={save}>Save</button>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>Either alone is fine. Both is better.</div>
      </div>

      <div className="stats">
        <Stat label="Current" value={latest ? `${latest.smooth.toFixed(1)}` : '—'} sub="kg, 7-day avg" />
        <Stat label="Change" value={latest ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}` : '—'} sub="kg since first entry" />
        <Stat label="Rate"
          value={actualRate !== null ? `${actualRate >= 0 ? '+' : ''}${actualRate.toFixed(2)}` : '—'}
          sub={`kg/wk · target +${lo}–${hi}`}
          alert={actualRate !== null && actualRate < lo * 0.5} />
        <Stat label="Waist"
          value={latestWaist ? latestWaist.smooth.toFixed(1) : '—'}
          sub={waistChange !== null ? `cm · ${waistChange >= 0 ? '+' : ''}${waistChange.toFixed(1)} since start` : 'cm'}
          alert={waistChange !== null && waistChange > 1.5} />
      </div>

      <div className="card">
        <div className="label">Bodyweight — rolling average against the target corridor</div>
        <div style={{ marginTop: 12 }}>
          {points.length ? <LineChart points={points} band={band} format={(v) => v.toFixed(1)} />
            : <div className="empty">No readings yet. One a week is enough.</div>}
        </div>
        {verdict && (
          <div style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 8, fontSize: 13.5,
            background: verdict.tone === 'good' ? 'var(--good-bg)' : 'var(--warn-bg)',
            border: `1px solid ${verdict.tone === 'good' ? 'var(--good-line)' : 'var(--warn-line)'}`,
            color: verdict.tone === 'good' ? 'var(--good)' : 'var(--warn)',
          }}>{verdict.text}</div>
        )}
      </div>

      <div className="card">
        <div className="label">Waist — the discriminator</div>
        <div style={{ marginTop: 12 }}>
          {waistSeries.length
            ? <LineChart points={waistSeries.map((w) => ({ y: w.smooth, label: w.date.slice(5) }))}
                color="var(--info)" height={140} format={(v) => v.toFixed(1)} />
            : <div className="empty">No waist measurements yet. Weight rising with waist flat is the goal.</div>}
        </div>
      </div>

      <div className="card">
        <div className="label">Intake targets</div>
        <div className="stats" style={{ marginTop: 12, gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div>
            <div className="muted">Protein</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{BODY_PARAMS.proteinTarget} g</div>
            <div className="muted">2.0 g/kg · range {BODY_PARAMS.proteinRange[0]}–{BODY_PARAMS.proteinRange[1]} g</div>
          </div>
          <div>
            <div className="muted">Calories</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{BODY_PARAMS.calorieTarget}</div>
            <div className="muted">maintenance to a small surplus</div>
          </div>
        </div>
        <div className="dim" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--rule-soft)' }}>
          Your own meal modelling put a pisto day at <b>1,350 kcal / 84 g protein</b> and a grappling day at
          <b> 1,900 kcal</b>. At 65 kg with six weekly sessions, both are deficits — the likeliest single reason
          the bench sat at 55 kg from January to June. Protein consistency matters more here than the calorie
          number: it is what makes a recomposition work. These are reference targets, not tracked intake.
        </div>
      </div>

      <div className="card">
        <div className="row-between">
          <div className="label">Grappling</div>
          <div className="row" style={{ gap: 6 }}>
            <input type="date" value={matDate} onChange={(e) => setMatDate(e.target.value)}
              aria-label="Grappling date"
              style={{ padding: '6px 8px', border: '1px solid var(--rule)', borderRadius: 8, background: 'var(--bg)', fontSize: 13 }} />
          </div>
        </div>
        <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {[1, 2, 3].map((h) => (
            <button key={h} className="btn small"
              onClick={() => { addGrappling({ date: matDate, minutes: 90, hardness: h }); onToast(`${HARDNESS[h]} session logged`); }}>
              + {HARDNESS[h]}
            </button>
          ))}
        </div>

        {recentMats.length === 0
          ? <div className="empty">No mat sessions logged yet.</div>
          : (
            <div className="list" style={{ marginTop: 10 }}>
              {recentMats.map((g) => (
                <div key={g.id} className="row-between">
                  <div className="row" style={{ gap: 10 }}>
                    <span className="mono" style={{ fontSize: 13 }}>{g.date}</span>
                    <Pill color={g.hardness === 3 ? 'var(--accent)' : g.hardness === 2 ? 'var(--good)' : 'var(--ink-3)'}>
                      {HARDNESS[g.hardness]}
                    </Pill>
                    <span className="muted">{g.minutes} min</span>
                  </div>
                  <button className="btn small ghost" onClick={() => { removeGrappling(g.id); onToast('Removed'); }}>×</button>
                </div>
              ))}
            </div>
          )}
      </div>

      <div className="card">
        <div className="label">This device</div>
        <div className="dim" style={{ marginTop: 8 }}>
          Everything logged here is written to the Google Sheet as soon as there is a
          connection, and held on this device until then. The backup below is a second
          copy — useful before clearing browser data, or to move a queue between devices.
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn small primary" onClick={download}>↓ Download backup</button>
          <button className="btn small" onClick={() => fileInput.current?.click()}>↑ Restore</button>
          <input ref={fileInput} type="file" accept="application/json,.json"
            onChange={restore} style={{ display: 'none' }} />
        </div>
        <div className="muted mono" style={{ marginTop: 12 }}>
          {local.sets.length} sets · {local.grappling.length} mat sessions · {local.bodyweight.length} weigh-ins
        </div>
      </div>
    </div>
  );
}
