// Exercises the pure logic against the real training log.
//   npm run verify              cached sheet (offline, no network)
//   npm run verify -- --refresh re-fetch and rewrite the cache

import { PROGRAM, DAY_ORDER, nextDayAfter, BODY_PARAMS } from '../src/config.js';
import { canonical, metaFor } from '../src/exercises.js';
import { BLOCKS, mesocycleState, rotationSpec, PROGRAM_START, TOTAL_PLANNED_SESSIONS } from '../src/mesocycles.js';
import { prescribe } from '../src/progression.js';
import { toSessions, byExercise, volumePerRotation, smoothSeries, daysAgo } from '../src/analysis.js';
import { parseRows } from '../src/sheets.js';
import { addSet, addSets, pendingRecords, markSynced, clearAll, removeSet, saveNote, noteFor, addBodyweight, deletedIds } from '../src/store.js';
import { sheetValues } from './fixture.mjs';
import { TYPES as SYNC_TYPES } from '../src/sync.js';

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
};

// ── The real sheet, through the production parser ─────────────────────────
const { values, source } = await sheetValues();
const { sets: rows, bodyweight } = parseRows(values);

// Raw spellings, read straight from the sheet, purely to test the alias map.
const EXERCISE_COLUMNS = [24, 25, 26, 2, 3, 4, 5, 6, 7, 8];
const raw = [];
for (const r of values) {
  if (!/^\d{1,2}\/\d{1,2}\/\d{4}/.test(String(r[0] ?? ''))) continue;
  if (!(parseInt(String(r[9] ?? '').trim(), 10) >= 1)) continue;
  for (const c of EXERCISE_COLUMNS) if (r[c]?.trim()) { raw.push(r[c].trim()); break; }
}

console.log(`\n${rows.length} working sets from ${values.length} rows · ${source}\n`);

// ── 1. Alias collapsing ───────────────────────────────────────────────────
console.log('Exercise aliases');
const before = new Set(raw).size;
const after = new Set(rows.map((r) => r.exercise)).size;
check(`collapses ${before} logged spellings into ${after} canonical names`, after < before);
for (const [a, b] of [
  ['Barbell or Dumbbell Rows', 'Barbell Rows'],
  ['Tricep Pulldown', 'Tricep Pushdown'],
  ['Overhead Tricep Press', 'Overhead Tricep Extension'],
  ['Barbell or Dumbbell Curls', 'Dumbbell Curls'],
  ['Pull-ups or Lat Pulldown', 'Lat Pulldown'],
]) check(`"${a}" → "${b}"`, canonical(a) === b, canonical(a));

const history = byExercise(rows);
const sessions = toSessions(rows);
check('row history now merges into one series',
  (history['Barbell Rows'] || []).length === rows.filter((r) => r.exercise === 'Barbell Rows').length);

// ── 2. Mesocycle state machine ────────────────────────────────────────────
console.log('\nMesocycle state');
const byId = Object.fromEntries(BLOCKS.map((b) => [b.id, b]));
const at = (n) => mesocycleState(Array.from({ length: n }, () => '2026-10-01'));
check('0 sessions → M0, session 1', at(0).block.id === 'M0' && at(0).sessionNumber === 1);
check('6 sessions → M1, session 1', at(6).block.id === 'M1' && at(6).sessionNumber === 1);
check('M1 session 13 is the deload', at(6 + 12).spec.isDeload, JSON.stringify(at(18).spec));
check('M1 session 12 is not a deload', !at(6 + 11).spec.isDeload);
check('19 sessions → M2', at(19).block.id === 'M2');
check(`historic sets before ${PROGRAM_START} do not advance the plan`,
  mesocycleState(sessions.map((s) => s.date)).block.id === 'M0');
check('RIR tightens 3 → 2 → 1.5 → 0.5 across rotations',
  [0, 3, 6, 9].map((i) => rotationSpec(BLOCKS[1], i).rir).join(',') === '3,2,1.5,0.5');
check('deload prescribes RIR 5', rotationSpec(BLOCKS[1], 12).rir === 5);
check(`total planned sessions = ${TOTAL_PLANNED_SESSIONS}`, TOTAL_PLANNED_SESSIONS === 100);

// ── 3. Rotation order ─────────────────────────────────────────────────────
console.log('\nRotation');
check('A → B → C → A', DAY_ORDER.map(nextDayAfter).join('') === 'BCA');
let letter = 'A';
const seq = [letter];
for (let i = 0; i < 8; i++) seq.push(letter = nextDayAfter(letter));
check('never repeats a letter twice running', !/(.)\1/.test(seq.join('')), seq.join(''));

// ── 4. Prescriptions are loadable ─────────────────────────────────────────
console.log('\nPrescriptions');
const problems = [];
for (const [id, block] of BLOCKS.map((b, i) => [b.id, b])) {
  for (let s = 0; s < block.sessions; s++) {
    const spec = rotationSpec(block, s);
    for (const day of DAY_ORDER) {
      PROGRAM[day].exercises.forEach((exercise, i) => {
        const p = prescribe({ exercise, exerciseIndex: i, history, block, spec });
        if (p.untracked || p.weight == null) return;
        const inc = metaFor(exercise.name).increment;
        const steps = p.weight / inc;
        if (Math.abs(steps - Math.round(steps)) > 1e-9) {
          problems.push(`${id}/s${s + 1} ${exercise.name}: ${p.weight}kg not a multiple of ${inc}`);
        }
        if (p.sets < 1) problems.push(`${id}/s${s + 1} ${exercise.name}: ${p.sets} sets`);
        if (p.lo < 1 || p.hi < p.lo) problems.push(`${id}/s${s + 1} ${exercise.name}: reps ${p.lo}-${p.hi}`);
      });
    }
  }
}
check(`every prescribed load lands on a real increment across all ${TOTAL_PLANNED_SESSIONS} sessions`,
  problems.length === 0, problems.slice(0, 4).join(' | '));

// The specific bug: averaging 57.5/57.5/55 used to propose 56.7 kg.
const benchHistory = { 'Barbell Flat Bench Press': [
  { date: '2026-05-25', exercise: 'Barbell Flat Bench Press', set: 1, reps: 6, weight: 57.5 },
  { date: '2026-05-25', exercise: 'Barbell Flat Bench Press', set: 2, reps: 6, weight: 57.5 },
  { date: '2026-05-25', exercise: 'Barbell Flat Bench Press', set: 3, reps: 5, weight: 55 },
] };
const benchEx = PROGRAM.A.exercises[1];
const midBlock = rotationSpec(byId.M2, 4);   // rotation 2 — past the block restart
const held = prescribe({ exercise: benchEx, exerciseIndex: 1, history: benchHistory,
  block: byId.M2, spec: midBlock });
check('top set beats the average (57.5, not 56.7)', held.weight === 57.5, `${held.weight}`);
check('a short set blocks the increase', held.status === 'hold', held.status);

const allCleared = { 'Barbell Flat Bench Press': [
  { date: '2026-05-25', exercise: 'Barbell Flat Bench Press', set: 1, reps: 8, weight: 55 },
  { date: '2026-05-25', exercise: 'Barbell Flat Bench Press', set: 2, reps: 8, weight: 55 },
  { date: '2026-05-25', exercise: 'Barbell Flat Bench Press', set: 3, reps: 8, weight: 55 },
] };
const up = prescribe({ exercise: benchEx, exerciseIndex: 1, history: allCleared,
  block: byId.M2, spec: midBlock });
check('all sets at the top of the range adds one increment', up.status === 'increase' && up.weight === 57.5, `${up.status} ${up.weight}`);

const restart = prescribe({ exercise: benchEx, exerciseIndex: 1, history: allCleared,
  block: byId.M1, spec: rotationSpec(byId.M1, 0) });
check('M1 opens the bench at its restart load of 45 kg', restart.weight === 45, `${restart.weight}`);

const deload = prescribe({ exercise: benchEx, exerciseIndex: 1, history: allCleared,
  block: byId.M1, spec: rotationSpec(byId.M1, 12) });
check('deload drops to 60% and halves the sets', deload.weight === 32.5 && deload.sets <= 2, `${deload.weight}kg × ${deload.sets}`);

// ── 4b. Extra sets are bonus volume, never a penalty ──────────────────────
console.log('\nExtra sets');
const squatEx = PROGRAM.A.exercises[0];
const squatHist = (reps) => ({ 'Barbell Back Squat': reps.map((r, i) => ({
  date: '2026-09-04', exercise: 'Barbell Back Squat', set: i + 1, reps: r, weight: 55 })) });
const judge = (reps) => prescribe({ exercise: squatEx, exerciseIndex: 0,
  history: squatHist(reps), block: byId.M2, spec: rotationSpec(byId.M2, 4) });

const clean = judge([8, 8, 8]);
const withExtra = judge([8, 8, 8, 5]);
const withTwoExtras = judge([8, 8, 8, 6, 5]);
const shortPrescribed = judge([8, 6, 8]);

check('three prescribed sets at the top earn the increase', clean.status === 'increase');
check('a hard fourth set does not cancel it',
  withExtra.status === 'increase' && withExtra.weight === clean.weight,
  `${withExtra.status} ${withExtra.weight}`);
check('nor do two extras', withTwoExtras.status === 'increase');
check('extras are counted and reported', withTwoExtras.lastSummary.extras === 2, `${withTwoExtras.lastSummary.extras}`);
check('a short PRESCRIBED set still blocks it', shortPrescribed.status === 'hold', shortPrescribed.status);
check('extras still count as logged volume', withTwoExtras.lastSummary.sets === 5, `${withTwoExtras.lastSummary.sets}`);

// ── 5. Volume attribution ─────────────────────────────────────────────────
console.log('\nVolume');
const spring = sessions.filter((s) => s.date >= '2026-04-20');
const vol = volumePerRotation(spring.flatMap((s) => s.sets), spring.length);
// The finding was zero DIRECT hamstring work. Squats still credit 0.25 each,
// so the attributed total is small but non-zero — which is the honest picture.
const directHams = spring.flatMap((s) => s.sets)
  .filter((r) => (metaFor(r.exercise).muscles.hams || 0) >= 1).length;
check('no direct hamstring work at all in Apr–Jun', directHams === 0, `${directHams} sets`);
check('attributed hamstring volume stays negligible', vol.hams < 2, `${vol.hams}`);
check('triceps out-earned back in the old rotation', vol.triceps > vol.back, `${vol.triceps.toFixed(1)} vs ${vol.back.toFixed(1)}`);
console.log('    ' + Object.entries(vol).filter(([, v]) => v > 0)
  .map(([m, v]) => `${m} ${v.toFixed(1)}`).join(' · '));

// New rotation, projected at peak (rotation 4 of an accumulation block).
const projected = {};
for (const day of DAY_ORDER) {
  const spec = rotationSpec(BLOCKS[2], 9);
  PROGRAM[day].exercises.forEach((exercise, i) => {
    if (exercise.optional) return;
    const p = prescribe({ exercise, exerciseIndex: i, history, block: BLOCKS[2], spec });
    for (const [m, w] of Object.entries(metaFor(exercise.name).muscles)) {
      projected[m] = (projected[m] || 0) + p.sets * w;
    }
  });
}
console.log('    projected: ' + Object.entries(projected).sort((a, b) => b[1] - a[1])
  .map(([m, v]) => `${m} ${v.toFixed(1)}`).join(' · '));
check('new rotation gives hamstrings real volume', projected.hams >= 5, `${projected.hams}`);
check('new rotation puts back ahead of triceps', projected.back > projected.triceps,
  `${projected.back.toFixed(1)} vs ${projected.triceps.toFixed(1)}`);
check('neck is now trained', (projected.neck || 0) > 0);

// ── 6. Sync queue ─────────────────────────────────────────────────────────
console.log('\nSync queue');
clearAll();
addSets([
  { date: '2026-09-07', day: 'A', exercise: 'Barbell Back Squat', set: 1, reps: 8, weight: 50 },
  { date: '2026-09-07', day: 'A', exercise: 'Barbell Back Squat', set: 2, reps: 8, weight: 50 },
]);
let queued = pendingRecords('sets');
check('newly logged sets queue for the Sheet', queued.length === 2, `${queued.length}`);
check('each carries a unique id', new Set(queued.map((r) => r.id)).size === 2);
check('each carries a loggedAt timestamp', queued.every((r) => r.loggedAt));

markSynced('sets', [queued[0].id]);
queued = pendingRecords('sets');
check('confirmed ids leave the queue', queued.length === 1, `${queued.length}`);
check('the unconfirmed one stays', queued[0].reps === 8 && queued[0].set === 2);

markSynced('sets', [queued[0].id]);
check('queue empties once all are confirmed', pendingRecords('sets').length === 0);

addSet({ date: '2026-09-07', day: 'A', exercise: 'Lateral Raises', set: 1, reps: 12, weight: 10 });
const undoTarget = pendingRecords('sets')[0];
removeSet(undoTarget.id);
check('an undone set never reaches the Sheet', pendingRecords('sets').length === 0);
clearAll();

// ── 7. Session notes ──────────────────────────────────────────────────────
console.log('\nSession notes');
clearAll();
saveNote({ date: '2026-08-17', day: 'A', block: 'M0', note: '  left shoulder tweaky  ' });
check('a note is stored trimmed', noteFor('2026-08-17') === 'left shoulder tweaky');
check('and queues for the Sheet', pendingRecords('notes').length === 1);
saveNote({ date: '2026-08-17', day: 'A', block: 'M0', note: 'revised' });
check('re-saving replaces the unsynced draft', pendingRecords('notes').length === 1 && noteFor('2026-08-17') === 'revised');
saveNote({ date: '2026-08-17', day: 'A', block: 'M0', note: '' });
check('clearing removes it', noteFor('2026-08-17') === '' && pendingRecords('notes').length === 0);
check('notes are a synced record type', SYNC_TYPES.includes('notes'));
clearAll();

// ── 7a. Undoing a set that already reached the Sheet ──────────────────────
console.log('\nUndo');
clearAll();
addSet({ date: '2026-08-19', day: 'C', exercise: 'Leg Press', set: 1, reps: 12, weight: 60 });
let pendingSet = pendingRecords('sets')[0];
removeSet(pendingSet.id);
check('an unsynced set just disappears', pendingRecords('sets').length === 0);
check('with nothing queued for the Sheet', pendingRecords('deletions').length === 0);

addSet({ date: '2026-08-19', day: 'C', exercise: 'Leg Press', set: 1, reps: 12, weight: 60 });
pendingSet = pendingRecords('sets')[0];
markSynced('sets', [pendingSet.id]);          // the Sheet has it now
removeSet(pendingSet.id);
const queuedDeletions = pendingRecords('deletions');
check('undoing a synced set queues a deletion', queuedDeletions.length === 1, `${queuedDeletions.length}`);
check('the deletion names the tab and the row',
  queuedDeletions[0].recordType === 'sets' && queuedDeletions[0].targetId === pendingSet.id);
check('and the id is hidden from the merge', deletedIds().has(pendingSet.id));
check('deletions are a synced record type', SYNC_TYPES.includes('deletions'));
clearAll();

// ── 7b. Weight and waist share a record ───────────────────────────────────
console.log('\nBody measurements');
clearAll();
addBodyweight({ date: '2026-08-17', value: 65.2 });
addBodyweight({ date: '2026-08-17', waist: 80.5 });
const bw = pendingRecords('bodyweight');
check('one row per date, not two', bw.length === 1, `${bw.length}`);
check('adding waist keeps the weight', bw[0].value === 65.2 && bw[0].waist === 80.5,
  `${bw[0].value} / ${bw[0].waist}`);
const wSeries = smoothSeries([{ date: '2026-08-17', value: 65.2, waist: 80.5 }, { date: '2026-08-24', value: 65.4 }], 7, 'waist');
check('the waist series skips entries without one', wSeries.length === 1, `${wSeries.length}`);
check('the gain target is a corridor, not a line',
  Array.isArray(BODY_PARAMS.weeklyGainBand) && BODY_PARAMS.weeklyGainBand.length === 2);
check('calories are maintenance-to-small-surplus', BODY_PARAMS.calorieTarget === 2450, `${BODY_PARAMS.calorieTarget}`);
clearAll();

// ── 8. Re-entry discount only after real time off ─────────────────────────
console.log('\nRe-entry discount');
const m0 = BLOCKS[0];
const entrySpec = rotationSpec(m0, 0);
const squat = PROGRAM.A.exercises[0];
const iso = (n) => daysAgo(n);

const stale = { 'Barbell Back Squat': [1, 2, 3].map((n) => ({ date: iso(80), exercise: 'Barbell Back Squat', set: n, reps: 8, weight: 50 })) };
const fresh = { 'Barbell Back Squat': [1, 2, 3].map((n) => ({ date: iso(4), exercise: 'Barbell Back Squat', set: n, reps: 8, weight: 50 })) };

const afterLayoff = prescribe({ exercise: squat, exerciseIndex: 0, history: stale, block: m0, spec: entrySpec });
const afterTraining = prescribe({ exercise: squat, exerciseIndex: 0, history: fresh, block: m0, spec: entrySpec });

check('80 days off → discounted to ~65%', afterLayoff.status === 'reentry' && afterLayoff.weight === 32.5, `${afterLayoff.weight} kg`);
check('4 days off → no discount, normal progression instead',
  afterTraining.status !== 'reentry' && afterTraining.weight >= 50,
  `${afterTraining.status} ${afterTraining.weight} kg`);
check('either way the load is loadable', [afterLayoff, afterTraining].every((p) => (p.weight * 10) % 25 === 0));

// ── 9. Start date ─────────────────────────────────────────────────────────
console.log('\nCalendar');
check('program starts Monday 17 August 2026', PROGRAM_START === '2026-08-17');
check('17 Aug 2026 is a Monday', new Date(`${PROGRAM_START}T00:00:00`).getDay() === 1);
check('blocks total 100 sessions', TOTAL_PLANNED_SESSIONS === 100, `${TOTAL_PLANNED_SESSIONS}`);
check('August sessions do not consume the block', mesocycleState(['2026-08-10']).totalDone === 0);
check('sessions from the 17th do', mesocycleState(['2026-08-17', '2026-08-19']).totalDone === 2);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
