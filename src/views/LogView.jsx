// ─── LOG ─────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { PROGRAM } from '../config.js';
import { sessionsPerWeek, daysSince } from '../analysis.js';
import { addSets, removeSet } from '../store.js';
import { Stat, Heatmap, WeeklyLoad } from '../ui.jsx';

function ImportPanel({ onDone }) {
  const [text, setText] = useState('');
  const rows = text.split('\n').filter((r) => r.trim());

  const run = () => {
    const parsed = rows.map((row) => {
      const c = row.split('\t');
      return {
        date: c[0]?.trim(), day: c[1]?.trim(), exercise: c[2]?.trim(),
        set: parseInt(c[3], 10), reps: parseInt(c[4], 10), weight: parseFloat(c[5]),
        rpe: parseFloat(c[6]) || null, rir: parseFloat(c[7]) || null,
      };
    }).filter((r) => r.date && r.exercise && !isNaN(r.reps) && !isNaN(r.weight));

    if (parsed.length) {
      addSets(parsed);
      setText('');
      onDone(`${parsed.length} ${parsed.length === 1 ? 'set' : 'sets'} imported`);
    } else {
      onDone('Nothing parsed — check the column order');
    }
  };

  return (
    <div className="card">
      <div className="field">
        <div className="label">Paste tab-separated sets</div>
        <div className="muted">date · day (A/B/C) · exercise · set# · reps · weight · RPE · RIR</div>
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'2026-09-07\tA\tBarbell Back Squat\t1\t8\t50\t\t3'} />
      </div>
      <button className="btn primary" style={{ marginTop: 10 }} onClick={run} disabled={!rows.length}>
        Import {rows.length || ''} {rows.length === 1 ? 'row' : 'rows'}
      </button>
      <div className="muted" style={{ marginTop: 8 }}>
        Saved on this device. Sheets rows are pulled separately and are never overwritten.
      </div>
    </div>
  );
}

export default function LogView({ sessions, data, weeklyLoadData, onToast }) {
  const [showImport, setShowImport] = useState(false);
  const [open, setOpen] = useState(null);

  const totalVolume = data.reduce((s, r) => s + r.weight * r.reps, 0);
  const rate = sessionsPerWeek(sessions);
  const since = daysSince(sessions[0]?.date);

  return (
    <div className="page stack">
      <div className="row-between">
        <h1>Training log</h1>
        <button className="btn small" onClick={() => setShowImport((v) => !v)}>
          {showImport ? 'Cancel' : '+ Import'}
        </button>
      </div>

      {showImport && <ImportPanel onDone={(m) => { onToast(m); setShowImport(false); }} />}

      <div className="stats">
        <Stat label="Sessions" value={sessions.length} sub={`${rate.toFixed(1)}×/wk, last 4 wks`} />
        <Stat label="Sets" value={data.length} sub="working sets" />
        <Stat label="Tonnage" value={`${(totalVolume / 1000).toFixed(1)}t`} sub="lifetime" />
        <Stat label="Days since" value={since ?? '—'} sub={since > 4 ? 'too long' : 'last session'} alert={since > 4} />
      </div>

      <div className="card">
        <div className="label">Training frequency</div>
        <div style={{ marginTop: 12 }}><Heatmap sessions={sessions} weeks={26} /></div>
      </div>

      <div className="card">
        <div className="label">Weekly load — barbell and mat</div>
        <div style={{ marginTop: 14 }}><WeeklyLoad weeks={weeklyLoadData} /></div>
        <div className="muted" style={{ marginTop: 10 }}>
          Three grappling sessions is 4½ hours of high-intensity full-body work. Plan lifting around it, not beside it.
        </div>
      </div>

      <div className="card">
        <div className="label">Sessions</div>
        {sessions.length === 0 && <div className="empty">Nothing logged yet.</div>}
        <div className="list" style={{ marginTop: 6 }}>
          {sessions.slice(0, 40).map((sess) => {
            const plan = PROGRAM[sess.day];
            const isOpen = open === sess.date;
            const exercises = [...new Set(sess.sets.map((s) => s.exercise))];
            return (
              <div key={sess.date}>
                <button className="row-between" style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => setOpen(isOpen ? null : sess.date)} aria-expanded={isOpen}>
                  <div className="row" style={{ gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8, flex: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: plan?.colorLight || 'var(--sunk)', color: plan?.color || 'var(--ink-3)',
                      fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13,
                    }}>{sess.day}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {new Date(`${sess.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="muted">{sess.sets.length} sets · {exercises.length} exercises · {(sess.volume / 1000).toFixed(1)}t</div>
                    </div>
                  </div>
                  <span className="mono" style={{ color: 'var(--ink-3)', fontSize: 13 }}>{isOpen ? '−' : '+'}</span>
                </button>

                {isOpen && (
                  <div style={{ marginTop: 10, paddingLeft: 44 }}>
                    {exercises.map((name) => (
                      <div key={name} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>{name}</div>
                        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                          {sess.sets.filter((s) => s.exercise === name).sort((a, b) => a.set - b.set).map((s, j) => (
                            <span key={j} className="mono" style={{
                              padding: '5px 9px', borderRadius: 6, background: 'var(--bg)',
                              border: '1px solid var(--rule-soft)', fontSize: 12.5,
                            }}>
                              <b>{s.reps}</b><span style={{ color: 'var(--ink-3)' }}>×</span>{s.weight}
                              <span style={{ color: 'var(--ink-3)' }}>kg</span>
                              {s.rir != null && <span style={{ color: 'var(--accent)', marginLeft: 5, fontSize: 10.5 }}>RIR {s.rir}</span>}
                              {s.source === 'local' && (
                                <button onClick={() => { removeSet(s.id); onToast('Set removed'); }}
                                  style={{ marginLeft: 6, color: 'var(--ink-3)' }} aria-label="Delete set">×</button>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
