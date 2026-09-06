// ─── TODAY ───────────────────────────────────────────────────────────────────
//
// The home screen, and the one fix that matters most: it reads the last logged
// letter, shows the next one, and never offers a choice. In the best six weeks
// of the old log, Day A ran seven times and Day C once — because picking the
// day was possible.
//

import { useState, useEffect } from 'react';
import { PROGRAM, nextDayAfter } from '../config.js';
import { prescribe, STATUS_STYLE } from '../progression.js';
import { setBonus } from '../mesocycles.js';
import { today as todayIso, daysAgo } from '../analysis.js';
import { addSet, addSets, removeSet, addGrappling, saveNote, noteFor } from '../store.js';
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

function SetLogger({ exercise, prescription, loggedSets, day, block, spec, onLogged }) {
  const [drafts, setDrafts] = useState({});
  const [extraSlots, setExtraSlots] = useState(0);
  const iso = todayIso();

  // Rows beyond the prescription: either already logged, or opened by hand.
  const extraLogged = Math.max(0, loggedSets.length - prescription.sets);
  const rowCount = prescription.sets + Math.max(extraSlots, extraLogged);

  const draftFor = (i) => drafts[i] ?? {
    reps: prescription.lo,
    weight: prescription.weight ?? '',
    rir: Math.round(prescription.rir),   // actual, pre-filled with the target
  };

  const update = (i, patch) => setDrafts((d) => ({ ...d, [i]: { ...draftFor(i), ...patch } }));

  const log = (i) => {
    const { reps, weight, rir } = draftFor(i);
    if (!reps || weight === '' || weight === null) return;
    addSet({
      date: iso, day, exercise: exercise.name, set: i + 1,
      reps: Number(reps), weight: Number(weight),
      rir: rir === '' || rir === null ? null : Number(rir),
      block: block.id, rotation: spec.rotation,
    });
    onLogged?.(`${exercise.name} — set ${i + 1} logged`);
  };

  // Undo a mis-tap. Only possible for sets logged in the app: rows pulled from
  // the Sheet carry no id and have to be edited in the form.
  const undo = (i) => {
    const done = loggedSets[i];
    if (!done?.id) return;
    removeSet(done.id);
    setDrafts((d) => ({ ...d, [i]: { reps: done.reps, weight: done.weight, rir: done.rir } }));
    onLogged?.(`${exercise.name} — set ${i + 1} undone`);
  };

  const anyLogged = loggedSets.some((s) => s?.id);

  return (
    <>
      <div className="set-hint">
        <span /><span>Reps</span><span>kg</span><span>RIR</span><span />
      </div>
      <div className="sets">
        {Array.from({ length: rowCount }, (_, i) => {
          const done = loggedSets[i];
          const draft = draftFor(i);
          const undoable = !!done?.id;
          const extra = i >= prescription.sets;
          return (
            <div className={`set-row${extra ? ' extra' : ''}`} key={i}>
              <div className="n" title={extra ? 'Extra set — bonus volume, not part of the progression rule' : undefined}>
                {i + 1}{extra && '+'}
              </div>
              <input type="number" inputMode="numeric" aria-label={`Set ${i + 1} reps`}
                value={done ? done.reps : draft.reps}
                disabled={!!done}
                onChange={(e) => update(i, { reps: e.target.value })} />
              <input type="number" inputMode="decimal" step="0.5" aria-label={`Set ${i + 1} weight`}
                value={done ? done.weight : draft.weight}
                disabled={!!done}
                onChange={(e) => update(i, { weight: e.target.value })} />
              <input type="number" inputMode="numeric" min="0" max="6" step="1"
                aria-label={`Set ${i + 1} reps in reserve`}
                className={!done && Number(draft.rir) < prescription.rir ? 'hot' : undefined}
                value={done ? (done.rir ?? '') : draft.rir}
                disabled={!!done}
                onChange={(e) => update(i, { rir: e.target.value })} />
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
      <div className="row" style={{ padding: '0 var(--pad) 12px', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn small ghost" onClick={() => setExtraSlots((n) => n + 1)}>
          + Add a set
        </button>
        <span className="muted">
          {anyLogged && 'Tap ✓ to undo. '}
          {rowCount > prescription.sets && 'Extra sets count as volume, never against progression.'}
        </span>
      </div>
    </>
  );
}

function AccessoryLogger({ exercise, prescription, loggedSets, day, block, spec, onLogged }) {
  const iso = todayIso();
  const done = loggedSets.length > 0;

  const mark = () => {
    addSets(Array.from({ length: prescription.sets }, (_, i) => ({
      date: iso, day, exercise: exercise.name, set: i + 1,
      reps: prescription.lo, weight: 0, rir: null,
      block: block.id, rotation: spec.rotation,
    })));
    onLogged?.(`${exercise.name} — done`);
  };

  const clear = () => {
    loggedSets.filter((s) => s.id).forEach((s) => removeSet(s.id));
    onLogged?.(`${exercise.name} — cleared`);
  };

  return (
    <div className="sets">
      <button className={`btn${done ? '' : ' primary'}`}
        onClick={done ? clear : mark}
        style={done ? { background: 'var(--good-bg)', color: 'var(--good)' } : undefined}>
        {done ? `✓ Done — ${loggedSets.length} × ${prescription.lo}. Tap to clear` : `Mark ${prescription.sets} × ${prescription.lo} done`}
      </button>
    </div>
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

      {p.untracked ? (
        <AccessoryLogger exercise={exercise} prescription={p} loggedSets={loggedSets}
          day={day} block={block} spec={spec} onLogged={onLogged} />
      ) : (
        <SetLogger exercise={exercise} prescription={p} loggedSets={loggedSets}
          day={day} block={block} spec={spec} onLogged={onLogged} />
      )}

      {p.lastSummary && (
        <div className="ex-last">
          Last {p.lastSummary.date} · {p.lastSummary.sets} sets
          {p.lastSummary.extras > 0 && ` (${p.lastSummary.extras} extra)`} @ {p.lastSummary.weight} kg
          {' · '}{p.lastSummary.minReps === p.lastSummary.maxReps
            ? `${p.lastSummary.maxReps} reps`
            : `${p.lastSummary.minReps}–${p.lastSummary.maxReps} reps`}
        </div>
      )}
    </div>
  );
}

function SessionNote({ date, day, block, onSaved }) {
  const [text, setText] = useState(() => noteFor(date));
  const [dirty, setDirty] = useState(false);

  // Reload when the day rolls over mid-session.
  useEffect(() => { setText(noteFor(date)); setDirty(false); }, [date]);

  const commit = () => {
    if (!dirty) return;
    saveNote({ date, day, block: block.id, note: text });
    setDirty(false);
    onSaved?.(text.trim() ? 'Note saved' : 'Note cleared');
  };

  return (
    <div className="card">
      <div className="label">Session note — optional</div>
      <div className="field" style={{ marginTop: 8 }}>
        <textarea
          value={text}
          placeholder="Left shoulder tweaky · trained 3h after grappling · gym packed, skipped leg press"
          style={{ minHeight: 64, fontFamily: 'inherit', fontSize: 14 }}
          onChange={(e) => { setText(e.target.value); setDirty(true); }}
          onBlur={commit} />
      </div>
      <div className="row-between" style={{ marginTop: 8 }}>
        <span className="muted">
          {dirty ? 'Unsaved' : text.trim() ? 'Saved' : 'The context you will want in April.'}
        </span>
        {dirty && <button className="btn small primary" onClick={commit}>Save note</button>}
      </div>
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

  const yesterday = daysAgo(1);
  const recentMat = grappling.find((g) => g.date === iso || g.date === yesterday);
  const legDay = day === 'A' || day === 'B';

  // "Done" means at least one set — the same standard the session design uses,
  // where leaving after exercise two still counts as a session.
  const core = plan.exercises.filter((e) => !e.optional);
  const coreCount = core.length;
  const doneCount = core.filter((e) => byExerciseToday[e.name]?.length).length;
  const complete = coreCount > 0 && doneCount === coreCount;
  const setsToday = loggedToday.length;

  return (
    <div className="page stack">
      <BlockHeader meso={meso} />

      <div className={`day-banner${complete ? ' complete' : ''}`}>
        <div className="day-badge" style={complete
          ? { background: 'var(--good)', color: '#fff' }
          : { background: plan.colorLight, color: plan.color }}>
          {complete ? '✓' : day}
        </div>
        <div className="grow">
          <div style={{ fontWeight: 600, fontSize: 15.5 }}>
            {complete ? `Day ${day} complete` : plan.name.replace(/^Day . — /, '')}
          </div>
          <div className="muted" style={{ marginTop: 2 }}>
            {complete
              ? `${coreCount} of ${coreCount} exercises · ${setsToday} sets · Day ${nextDayAfter(day)} next, from tomorrow`
              : doneCount > 0
                ? `${doneCount} of ${coreCount} exercises · already counts as a session`
                : (lastSessionDate
                    ? `Next in rotation after ${lastSessionDate}`
                    : 'First session of the plan')}
          </div>
          {doneCount > 0 && !complete && (
            <div style={{ marginTop: 8 }}>
              <Track value={doneCount} max={coreCount} color="var(--good)" />
            </div>
          )}
        </div>
      </div>

      {complete && (
        <div className="card" style={{ background: 'var(--good-bg)', borderColor: 'var(--good-line)' }}>
          <div className="dim" style={{ color: 'var(--ink)' }}>
            Nothing to mark off — a session is its date. This one counts as soon as the day turns,
            and tomorrow this screen opens on <b>Day {nextDayAfter(day)}</b> with
            <b> {meso.block.id} · session {meso.sessionNumber + 1} of {meso.block.sessions}</b>.
            Anything you add below still lands on today.
          </div>
        </div>
      )}

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

      <SessionNote date={iso} day={day} block={block} onSaved={onToast} />

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
