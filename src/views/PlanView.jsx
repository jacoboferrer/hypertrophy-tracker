// ─── PLAN ────────────────────────────────────────────────────────────────────
//
// The year at a glance, and the three sessions with today's prescriptions
// already applied. Blocks are drawn proportional to their session count, not
// to calendar time — the whole point is that they slide.
//

import { useState } from 'react';
import { PROGRAM, DAY_ORDER } from '../config.js';
import { BLOCKS, TOTAL_PLANNED_SESSIONS, rotationSpec } from '../mesocycles.js';
import { prescribe, STATUS_STYLE } from '../progression.js';
import { Pill } from '../ui.jsx';

const KIND_COLOR = {
  ramp: 'var(--info)',
  entry: 'var(--good)',
  hold: 'var(--ink-3)',
};

function YearStrip({ meso }) {
  return (
    <div className="scroll-x">
      <div style={{ display: 'flex', gap: 2, minWidth: 560 }}>
        {BLOCKS.map((b, i) => {
          const current = i === meso.blockIndex;
          const done = i < meso.blockIndex;
          const color = b.id === 'M3' ? 'var(--accent)' : KIND_COLOR[b.kind];
          return (
            <div key={b.id} style={{ flex: b.sessions, minWidth: 0 }}>
              <div style={{
                height: 40, borderRadius: 4, display: 'flex', alignItems: 'center',
                paddingLeft: 8, overflow: 'hidden',
                background: current ? color : done ? 'var(--sunk)' : `${color}22`,
                border: current ? 'none' : `1px solid ${done ? 'var(--rule)' : `${color}55`}`,
              }}>
                <span className="mono" style={{
                  fontSize: 11, fontWeight: 700,
                  color: current ? '#fff' : done ? 'var(--ink-3)' : color,
                }}>{b.id}</span>
              </div>
              <div className="mono" style={{ fontSize: 9, color: 'var(--ink-3)', marginTop: 4, textAlign: 'center' }}>
                {b.sessions}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PlanView({ meso, history }) {
  const [day, setDay] = useState(meso.currentDay || 'A');
  const plan = PROGRAM[day];
  const { block, spec } = meso;

  return (
    <div className="page stack">
      <div>
        <h1>The 2026–27 plan</h1>
        <p className="dim" style={{ marginTop: 6 }}>
          Eight blocks, {TOTAL_PLANNED_SESSIONS} sessions, about 2.5 lifting sessions a week — the rate you
          actually sustained through April and May. A block ends on its last session, whatever the calendar did.
        </p>
      </div>

      <div className="card">
        <div className="label">Blocks, sized by session count</div>
        <div style={{ marginTop: 12 }}><YearStrip meso={meso} /></div>
        <div className="muted" style={{ marginTop: 10 }}>
          Currently in <b style={{ color: 'var(--ink)' }}>{block.id} · {block.name}</b>,
          session {meso.sessionNumber} of {block.sessions} · {meso.totalDone} of {TOTAL_PLANNED_SESSIONS} logged since 7 Sep.
        </div>
      </div>

      <div className="card">
        <div className="label">One mesocycle</div>
        <table style={{ marginTop: 10 }}>
          <thead>
            <tr><th>Position</th><th>Sessions</th><th>Sets</th><th>RIR</th></tr>
          </thead>
          <tbody>
            {[0, 3, 6, 9, 12].map((s) => {
              const sp = rotationSpec({ kind: 'ramp', sessions: 13 }, s);
              const rows = ['base', '+1 on lift 1', '+1 on lift 3', 'hold peak', 'halved'];
              const idx = s === 12 ? 4 : s / 3;
              return (
                <tr key={s} style={{ background: meso.spec.label === sp.label ? 'var(--accent-soft)' : undefined }}>
                  <td style={{ color: 'var(--ink)', fontWeight: 600 }}>{sp.label}</td>
                  <td className="mono">{s === 12 ? '13' : `${s + 1}–${s + 3}`}</td>
                  <td>{rows[idx]}</td>
                  <td className="mono">{sp.rir}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="label">Session {day}</div>
        <div className="row" style={{ gap: 6, marginTop: 10, marginBottom: 4 }}>
          {DAY_ORDER.map((d) => (
            <button key={d} className={`btn small${day === d ? ' primary' : ''}`}
              style={day === d ? { background: PROGRAM[d].color } : undefined}
              onClick={() => setDay(d)}>
              {d} — {PROGRAM[d].name.split('—')[1].trim()}
            </button>
          ))}
        </div>
        <div className="list" style={{ marginTop: 8 }}>
          {plan.exercises.map((ex, i) => {
            const p = prescribe({ exercise: ex, exerciseIndex: i, history, block, spec });
            const style = STATUS_STYLE[p.status] || STATUS_STYLE.hold;
            return (
              <div key={ex.name + i} className="row-between" style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>
                    {i + 1}. {ex.name}
                    {ex.optional && <span className="muted" style={{ fontWeight: 400 }}> · if time</span>}
                  </div>
                  <div className="muted" style={{ marginTop: 3 }}>{p.message}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontWeight: 700, fontSize: 15 }}>
                    {p.untracked ? '—' : p.weight !== null ? `${p.weight} kg` : '?'}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{p.sets} × {p.repRange}</div>
                  <div style={{ marginTop: 4 }}><Pill color={style.color}>{style.label}</Pill></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="label">Blocks</div>
        <div className="list" style={{ marginTop: 6 }}>
          {BLOCKS.map((b, i) => (
            <div key={b.id} style={{ opacity: i < meso.blockIndex ? 0.5 : 1 }}>
              <div className="row-between">
                <div className="row" style={{ gap: 8 }}>
                  <span className="mono" style={{ fontWeight: 700, color: b.id === 'M3' ? 'var(--accent)' : KIND_COLOR[b.kind] }}>{b.id}</span>
                  <span style={{ fontWeight: 600, fontSize: 14.5 }}>{b.name}</span>
                  {i === meso.blockIndex && <Pill color="var(--accent)">Current</Pill>}
                </div>
                <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{b.window} · {b.sessions}</span>
              </div>
              <div className="dim" style={{ marginTop: 5, fontSize: 13.5 }}>{b.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ background: 'var(--good-bg)', borderColor: 'var(--good-line)' }}>
        <div className="label" style={{ color: 'var(--good)' }}>Grappling rules</div>
        <ul style={{ margin: '10px 0 0 18px', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.6 }}>
          <li>Never load legs heavily within 24 h of hard grappling — move the calendar slot, never the rotation order.</li>
          <li>Lifting within 12 h after the mat: add one RIR, drop the optional lift.</li>
          <li>Three hard mat sessions this week? Take two lifting sessions, not three. The block advances more slowly and that is correct.</li>
          <li>Competition or a hard open mat: treat the next session as the block's deload and carry on.</li>
          <li>Neck and grip are grappling work. They stay in even during hold blocks.</li>
        </ul>
      </div>
    </div>
  );
}
