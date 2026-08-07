// ─── TODAY ───────────────────────────────────────────────────────────────────
//
// The home screen, and the one fix that matters most: it reads the last logged
// letter, shows the next one, and never offers a choice. In the best six weeks
// of the old log, Day A ran seven times and Day C once — because picking the
// day was possible.
//

import { useState } from 'react';
import { PROGRAM } from '../config.js';
import { prescribe, STATUS_STYLE } from '../progression.js';
import { setBonus } from '../mesocycles.js';
import { today as todayIso } from '../analysis.js';
import { addSet, removeSet, addGrappling } from '../store.js';
import { Pill, Track } from '../ui.jsx';

function BlockHeader({ meso }) {
  const { block, sessionNumber, spec, sessionsLeftInBlock, nextBlock } = meso;
  return (
    <div className="block-head">
      <div className="row-between">
        <div>
          <div className="label">{block.id} · {block.name}</div>
          <div style={{ fontSize: 17, fontWeight: 600, marginTop: 3 }}>
            Session {sessionNumber} of {block.sessions}
          </div>
        </div>
        <Pill color="#fff" solid={false}>{spec.label}</Pill>
      </div>
      <Track value={sessionNumber - 1} max={block.sessions} color="#fff" />
      <div className="block-meta">
        <span>Target <b>RIR {spec.rir}</b></span>
        {spec.isDeload
          ? <span><b>Deload session</b> — half sets, 60%</span>
          : <span>Deload in <b>{sessionsLeftInBlock - 1}</b> {sessionsLeftInBlock - 1 === 1 ? 'session' : 'sessions'}</span>}
        {nextBlock && <span>Then <b>{nextBlock.id}</b> · {nextBlock.name}</span>}
      </div>
    </div>
  );
}

function SetLogger({ exercise, prescription, loggedSets, day, onLogged }) {
  const [drafts, setDrafts] = useState({});
  const iso = todayIso();

  const draftFor = (i) => drafts[i] ?? {
    reps: prescription.lo,
    weight: prescription.weight ?? '',
  };

  const update = (i, patch) => setDrafts((d) => ({ ...d, [i]: { ...draftFor(i), ...patch } }));

  const log = (i) => {
    const { reps, weight } = draftFor(i);
    if (!reps || weight === '' || weight === null) return;
    addSet({
      date: iso, day, exercise: exercise.name, set: i + 1,
      reps: Number(reps), weight: Number(weight), rir: prescription.rir,
    });
    onLogged?.(`${exercise.name} — set ${i + 1} logged`);
  };

  // Undo a mis-tap. Only possible for sets logged in the app: rows pulled from
  // the Sheet carry no id and have to be edited in the form.
  const undo = (i) => {
    const done = loggedSets[i];
    if (!done?.id) return;
    removeSet(done.id);
    setDrafts((d) => ({ ...d, [i]: { reps: done.reps, weight: done.weight } }));
    onLogged?.(`${exercise.name} — set ${i + 1} undone`);
  };

  const anyLogged = loggedSets.some((s) => s?.id);

  return (
    <>
      <div className="set-hint">
        <span /><span>Reps</span><span>kg</span><span />
      </div>
      <div className="sets">
        {Array.from({ length: prescription.sets }, (_, i) => {
          const done = loggedSets[i];
          const draft = draftFor(i);
          const undoable = !!done?.id;
          return (
            <div className="set-row" key={i}>
              <div className="n">{i + 1}</div>
              <input type="number" inputMode="numeric" aria-label={`Set ${i + 1} reps`}
                value={done ? done.reps : draft.reps}
                disabled={!!done}
                onChange={(e) => update(i, { reps: e.target.value })} />
              <input type="number" inputMode="decimal" step="0.5" aria-label={`Set ${i + 1} weight`}
                value={done ? done.weight : draft.weight}
                disabled={!!done}
                onChange={(e) => update(i, { weight: e.target.value })} />
              <button className={`act${done ? ' done' : ''}`}
                onClick={() => (done ? undo(i) : log(i))}
                disabled={!!done && !undoable}
                title={undoable ? 'Tap to undo' : done ? 'Logged via the form' : 'Log this set'}
                aria-label={undoable ? `Undo set ${i + 1}` : done ? `Set ${i + 1} logged` : `Log set ${i + 1}`}>
                {done ? '✓' : '+'}
              </button>
            </div>
          );
        })}
      </div>
      {anyLogged && (
        <div className="muted" style={{ padding: '0 var(--pad) 12px', marginTop: -4 }}>
          Tap ✓ to undo a set.
        </div>
      )}
    </>
  );
}

function ExerciseCard({ exercise, index, history, block, spec, loggedSets, day, onLogged }) {
  const p = prescribe({ exercise, exerciseIndex: index, history, block, spec });
  const style = STATUS_STYLE[p.status] || STATUS_STYLE.hold;
  const bonus = setBonus(block, spec, index);

  return (
    <div className={`ex-card${p.optional ? ' optional' : ''}`}>
      <div className="ex-head">
        <div className="grow">
          <div className="ex-name">
            {index + 1}. {exercise.name}
            {p.optional && <span className="muted" style={{ fontWeight: 400 }}> · if time</span>}
          </div>
          <div className="row" style={{ marginTop: 6, gap: 6, flexWrap: 'wrap' }}>
            <Pill color={style.color}>{style.label}</Pill>
            {bonus > 0 && <Pill color="var(--info)">+{bonus} set</Pill>}
          </div>
        </div>
        <div className="ex-target">
          {p.untracked ? '—' : p.weight !== null ? `${p.weight} kg` : '?'}
          <small>{p.sets} × {p.repRange} @ RIR {p.rir}</small>
        </div>
      </div>

      <div className="ex-note" style={{ background: style.bg, color: style.color, borderTop: `1px solid ${style.border}` }}>
        {p.message}
      </div>

      {!p.untracked && (
        <SetLogger exercise={exercise} prescription={p} loggedSets={loggedSets} day={day} onLogged={onLogged} />
      )}

      {p.lastSummary && (
        <div className="ex-last">
          Last {p.lastSummary.date} · {p.lastSummary.sets} sets @ {p.lastSummary.weight} kg
          {' · '}{p.lastSummary.minReps === p.lastSummary.maxReps
            ? `${p.lastSummary.maxReps} reps`
            : `${p.lastSummary.minReps}–${p.lastSummary.maxReps} reps`}
        </div>
      )}
    </div>
  );
}

export default function Today({ meso, day, history, data, grappling, lastSessionDate, onToast }) {
  const iso = todayIso();
  const plan = PROGRAM[day];
  const { block, spec } = meso;

  const loggedToday = data.filter((r) => r.date === iso);
  const byExerciseToday = {};
  for (const r of loggedToday) {
    (byExerciseToday[r.exercise] ||= []).push(r);
  }
  for (const list of Object.values(byExerciseToday)) list.sort((a, b) => a.set - b.set);

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const recentMat = grappling.find((g) => g.date === iso || g.date === yesterday);
  const legDay = day === 'A' || day === 'B';

  const coreCount = plan.exercises.filter((e) => !e.optional).length;
  const doneCount = plan.exercises.filter((e) => !e.optional && byExerciseToday[e.name]?.length).length;

  return (
    <div className="page stack">
      <BlockHeader meso={meso} />

      <div className="day-banner">
        <div className="day-badge" style={{ background: plan.colorLight, color: plan.color }}>{day}</div>
        <div className="grow">
          <div style={{ fontWeight: 600, fontSize: 15.5 }}>{plan.name.replace(/^Day . — /, '')}</div>
          <div className="muted" style={{ marginTop: 2 }}>
            {lastSessionDate
              ? `Next in rotation after ${lastSessionDate}`
              : 'First session of the plan'}
            {doneCount > 0 && ` · ${doneCount}/${coreCount} done`}
          </div>
        </div>
      </div>

      {recentMat && legDay && (
        <div className="card" style={{ background: 'var(--warn-bg)', borderColor: 'var(--warn-line)' }}>
          <div className="label" style={{ color: 'var(--warn)' }}>Autoregulation</div>
          <div className="dim" style={{ marginTop: 6, color: 'var(--ink)' }}>
            Grappling logged {recentMat.date === iso ? 'today' : 'yesterday'} and this is a leg-dominant day.
            Add one RIR to everything and drop the optional lift — a reduced session still advances the block.
          </div>
        </div>
      )}

      {spec.isDeload && (
        <div className="card" style={{ background: 'var(--plum-bg)', borderColor: '#E0D4F0' }}>
          <div className="label" style={{ color: 'var(--plum)' }}>Deload</div>
          <div className="dim" style={{ marginTop: 6, color: 'var(--ink)' }}>
            Half the sets at 60% of load, five reps in reserve. This is the session that makes the next block possible — it is not optional.
          </div>
        </div>
      )}

      <div className="stack">
        {plan.exercises.map((exercise, i) => (
          <ExerciseCard
            key={exercise.name + i}
            exercise={exercise}
            index={i}
            history={history}
            block={block}
            spec={spec}
            day={day}
            loggedSets={byExerciseToday[exercise.name] || []}
            onLogged={onToast}
          />
        ))}
      </div>

      <div className="card">
        <div className="label">Also today</div>
        <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
          <button className="btn small" onClick={() => { addGrappling({ date: iso, minutes: 90, hardness: 2 }); onToast('Grappling logged — 90 min'); }}>
            + Grappling, 90 min
          </button>
          <button className="btn small" onClick={() => { addGrappling({ date: iso, minutes: 90, hardness: 3 }); onToast('Hard grappling logged'); }}>
            + Grappling, hard
          </button>
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          Mat work is the dominant load in your week and every autoregulation rule depends on it being recorded.
        </div>
      </div>
    </div>
  );
}
