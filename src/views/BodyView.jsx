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
  const [matDate, setMatDate] = useState(todayIso());
  const fileInput = useRef(null);
  const local = useStore();

  const series = smoothSeries(bodyweight);
  const latest = series[series.length - 1];
  const first = series[0];

  const points = series.map((s) => ({ y: s.smooth, label: s.date.slice(5) }));
  const guide = first
    ? series.map((s) => {
        const weeks = (new Date(`${s.date}T00:00:00`) - new Date(`${first.date}T00:00:00`)) / (7 * 86400000);
        return { y: first.smooth + weeks * BODY_PARAMS.weeklyGainTarget, label: s.date.slice(5) };
      })
    : [];

  const change = latest && first ? latest.smooth - first.smooth : 0;
  const weeksSpan = latest && first
    ? Math.max((new Date(`${latest.date}T00:00:00`) - new Date(`${first.date}T00:00:00`)) / (7 * 86400000), 0)
    : 0;
  const actualRate = weeksSpan > 1 ? change / weeksSpan : null;

  const save = () => {
    const v = parseFloat(value.replace(',', '.'));
    if (!v || v < 30 || v > 200) { onToast('Enter a weight in kg'); return; }
    addBodyweight({ date: todayIso(), value: v });
    setValue('');
    onToast(`Logged ${v} kg`);
  };

  const recentMats = [...grappling].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);

  // Everything logged in the app lives in this browser only — the Sheet is
  // read-only from here. So there needs to be a way to get it out.
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
        <div className="label" style={{ color: 'var(--accent)' }}>The number that outranks the program</div>
        <div className="dim" style={{ marginTop: 8, color: 'var(--ink)' }}>
          You are {BODY_PARAMS.weight} kg and want to be bigger. If bodyweight does not move, no mesocycle
          structure will save the year. Weigh yourself every Monday, same conditions, and target
          <b> +{BODY_PARAMS.weeklyGainTarget} kg a week — about +4 kg by June</b>. The form has had this field all
          along; it was filled in on 0 of 297 rows.
        </div>
      </div>

      <div className="card">
        <div className="label">Log today's weight</div>
        <div className="row" style={{ marginTop: 10, gap: 8 }}>
          <div className="field grow">
            <input type="number" inputMode="decimal" step="0.1" placeholder="65.0" aria-label="Bodyweight in kg"
              value={value} onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()} />
          </div>
          <button className="btn primary" onClick={save}>Save</button>
        </div>
      </div>

      <div className="stats">
        <Stat label="Current" value={latest ? `${latest.smooth.toFixed(1)}` : '—'} sub="kg, 7-day avg" />
        <Stat label="Change" value={latest ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}` : '—'} sub="kg since first entry" />
        <Stat label="Rate"
          value={actualRate !== null ? `${actualRate >= 0 ? '+' : ''}${actualRate.toFixed(2)}` : '—'}
          sub={`kg/wk · target +${BODY_PARAMS.weeklyGainTarget}`}
          alert={actualRate !== null && actualRate < BODY_PARAMS.weeklyGainTarget * 0.5} />
        <Stat label="Readings" value={bodyweight.length} sub="logged" />
      </div>

      <div className="card">
        <div className="label">Bodyweight — 7-day average against target slope</div>
        <div style={{ marginTop: 12 }}>
          {points.length ? <LineChart points={points} guide={guide} format={(v) => v.toFixed(1)} />
            : <div className="empty">No readings yet. One a week is enough.</div>}
        </div>
      </div>

      <div className="card">
        <div className="label">Intake targets</div>
        <div className="stats" style={{ marginTop: 12, gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div>
            <div className="muted">Protein</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{BODY_PARAMS.proteinTarget} g</div>
            <div className="muted">2.0 g/kg · range 104–143 g</div>
          </div>
          <div>
            <div className="muted">Calories</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{BODY_PARAMS.calorieTarget}</div>
            <div className="muted">lean-bulk surplus (~300 kcal)</div>
          </div>
        </div>
        <div className="dim" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--rule-soft)' }}>
          Your own meal modelling put a pisto day at <b>1,350 kcal / 84 g protein</b> and a grappling day at
          <b> 1,900 kcal</b>. At 65 kg with six weekly sessions, both are deficits — the likeliest single reason
          the bench sat at 55 kg from January to June. These are reference targets, not tracked intake.
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
          Sets, grappling and bodyweight logged in the app are stored in this browser only —
          they are not written back to the Google Sheet, and another device will not see them.
          Keep a backup.
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
