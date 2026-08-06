// ─── PROGRESS ────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { PROGRAM } from '../config.js';
import { MUSCLE_ORDER } from '../exercises.js';
import { e1rm } from '../progression.js';
import { volumePerRotation, personalRecords } from '../analysis.js';
import { LineChart, VolumeChart, Sparkline, Pill } from '../ui.jsx';

export default function ProgressView({ history, sessions, selected, onSelect }) {
  const programExercises = useMemo(() => {
    const seen = new Set();
    for (const day of Object.values(PROGRAM)) {
      for (const ex of day.exercises) seen.add(ex.name);
    }
    return [...seen];
  }, []);

  // Anything trained, whether or not it survived into the new program.
  const allExercises = useMemo(() => {
    const set = new Set(programExercises);
    for (const name of Object.keys(history)) set.add(name);
    return [...set].sort();
  }, [history, programExercises]);

  const [muscleWindow, setMuscleWindow] = useState(12);
  const ex = selected && history[selected] ? selected : (allExercises.find((n) => history[n]) || allExercises[0]);
  const prs = useMemo(() => personalRecords(history), [history]);

  const chartData = useMemo(() => {
    const sets = history[ex] || [];
    const dates = [...new Set(sets.map((s) => s.date))].sort();
    return dates.map((d) => {
      const day = sets.filter((s) => s.date === d);
      return {
        date: d,
        maxWeight: Math.max(...day.map((s) => s.weight)),
        avgReps: day.reduce((a, s) => a + s.reps, 0) / day.length,
        e1rm: Math.max(...day.map((s) => e1rm(s.weight, s.reps))),
        volume: day.reduce((a, s) => a + s.weight * s.reps, 0),
        sets: day.length,
      };
    });
  }, [history, ex]);

  // Volume over the trailing window of sessions, expressed per A–B–C rotation.
  const volumes = useMemo(() => {
    const recent = sessions.slice(0, muscleWindow);
    const rows = recent.flatMap((s) => s.sets);
    return volumePerRotation(rows, Math.max(recent.length, 1));
  }, [sessions, muscleWindow]);

  return (
    <div className="page stack">
      <h1>Progress</h1>

      <div className="card">
        <div className="row-between">
          <div className="label">Hard sets per muscle, per rotation</div>
          <div className="row" style={{ gap: 6 }}>
            {[12, 24, 60].map((w) => (
              <button key={w} className={`btn small${muscleWindow === w ? ' primary' : ''}`} onClick={() => setMuscleWindow(w)}>
                {w === 60 ? 'All' : `${w / 3} rot`}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <VolumeChart volumes={volumes} order={MUSCLE_ORDER} />
        </div>
        <div className="muted" style={{ marginTop: 12 }}>
          Measured per rotation rather than per week: per-session volume was never the problem, distribution and
          rotation rate were. A bar at zero is a muscle receiving nothing.
        </div>
      </div>

      <div className="card">
        <div className="label">Exercise</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {allExercises.map((name) => (
            <button key={name} className={`btn small${ex === name ? ' primary' : ''}`}
              onClick={() => onSelect(name)}
              style={!history[name] ? { opacity: .45 } : undefined}>
              {name}
            </button>
          ))}
        </div>
      </div>

      {chartData.length > 0 ? (
        <>
          <div className="card">
            <div className="row-between">
              <div className="label">Estimated 1RM — {ex}</div>
              <Sparkline data={chartData.map((d) => d.e1rm)} />
            </div>
            <div style={{ marginTop: 12 }}>
              <LineChart
                points={chartData.map((d) => ({ y: d.e1rm, label: d.date.slice(5) }))}
                format={(v) => v.toFixed(0)}
              />
            </div>
          </div>

          {prs[ex] && (
            <div className="card" style={{ background: 'var(--accent-soft)', borderColor: '#F5D5D0' }}>
              <div className="label">Personal records</div>
              <div className="stats" style={{ marginTop: 12, gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div>
                  <div className="muted">Max weight</div>
                  <div className="mono" style={{ fontSize: 19, fontWeight: 700 }}>{prs[ex].maxWeight} kg</div>
                </div>
                <div>
                  <div className="muted">Best e1RM</div>
                  <div className="mono" style={{ fontSize: 19, fontWeight: 700, color: 'var(--accent)' }}>{prs[ex].maxE1RM.toFixed(1)} kg</div>
                </div>
                <div>
                  <div className="muted">Best set volume</div>
                  <div className="mono" style={{ fontSize: 19, fontWeight: 700 }}>{prs[ex].maxVolume}</div>
                </div>
              </div>
              <div className="muted" style={{ marginTop: 10 }}>Best session: {prs[ex].bestDate}</div>
            </div>
          )}

          <div className="card">
            <div className="label">Session breakdown</div>
            <div className="scroll-x" style={{ marginTop: 10 }}>
              <table>
                <thead>
                  <tr><th>Date</th><th>Sets</th><th>Top set</th><th>Avg reps</th><th>e1RM</th><th>Volume</th></tr>
                </thead>
                <tbody>
                  {[...chartData].reverse().map((d) => (
                    <tr key={d.date}>
                      <td className="mono">{d.date}</td>
                      <td>{d.sets}</td>
                      <td className="mono" style={{ fontWeight: 700, color: 'var(--ink)' }}>{d.maxWeight} kg</td>
                      <td>{d.avgReps.toFixed(1)}</td>
                      <td className="mono" style={{ color: 'var(--accent)' }}>{d.e1rm.toFixed(1)}</td>
                      <td>{d.volume}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card"><div className="empty">No data yet for {ex}.</div></div>
      )}

      {!programExercises.includes(ex) && history[ex] && (
        <div className="card" style={{ background: 'var(--warn-bg)', borderColor: 'var(--warn-line)' }}>
          <Pill color="var(--warn)">Retired</Pill>
          <div className="dim" style={{ marginTop: 8, color: 'var(--ink)' }}>
            {ex} is no longer in the program. Its history is kept so the volume chart and PRs stay honest.
          </div>
        </div>
      )}
    </div>
  );
}
