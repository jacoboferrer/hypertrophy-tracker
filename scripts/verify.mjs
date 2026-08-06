// Exercises the pure logic against the real training log.
//   npm run verify              cached sheet (offline, no network)
//   npm run verify -- --refresh re-fetch and rewrite the cache

import { PROGRAM, DAY_ORDER, nextDayAfter } from '../src/config.js';
import { canonical, metaFor } from '../src/exercises.js';
import { BLOCKS, mesocycleState, rotationSpec } from '../src/mesocycles.js';
import { prescribe } from '../src/progression.js';
import { toSessions, byExercise, volumePerRotation } from '../src/analysis.js';
import { parseRows } from '../src/sheets.js';
import { sheetValues } from './fixture.mjs';

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
const at = (n) => mesocycleState(Array.from({ length: n }, () => '2026-10-01'));
check('0 sessions → M0, session 1', at(0).block.id === 'M0' && at(0).sessionNumber === 1);
check('6 sessions → M1, session 1', at(6).block.id === 'M1' && at(6).sessionNumber === 1);
check('M1 session 13 is the deload', at(6 + 12).spec.isDeload, JSON.stringify(at(18).spec));
check('M1 session 12 is not a deload', !at(6 + 11).spec.isDeload);
check('19 sessions → M2', at(19).block.id === 'M2');
check('historic sets before 7 Sep do not advance the plan',
  mesocycleState(sessions.map((s) => s.date)).block.id === 'M0');
check('RIR tightens 3 → 2 → 1.5 → 0.5 across rotations',
  [0, 3, 6, 9].map((i) => rotationSpec(BLOCKS[1], i).rir).join(',') === '3,2,1.5,0.5');
check('deload prescribes RIR 5', rotationSpec(BLOCKS[1], 12).rir === 5);
check(`total planned sessions = ${BLOCKS.reduce((s, b) => s + b.sessions, 0)}`,
  BLOCKS.reduce((s, b) => s + b.sessions, 0) === 85);

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
check('every prescribed load lands on a real increment across all 85 sessions',
  problems.length === 0, problems.slice(0, 4).join(' | '));

// The specific bug: averaging 57.5/57.5/55 used to propose 56.7 kg.
const benchHistory = { 'Barbell Flat Bench Press': [
  { date: '2026-05-25', exercise: 'Barbell Flat Bench Press', set: 1, reps: 6, weight: 57.5 },
  { date: '2026-05-25', exercise: 'Barbell Flat Bench Press', set: 2, reps: 6, weight: 57.5 },
  { date: '2026-05-25', exercise: 'Barbell Flat Bench Press', set: 3, reps: 5, weight: 55 },
] };
const benchEx = PROGRAM.A.exercises[1];
const held = prescribe({ exercise: benchEx, exerciseIndex: 1, history: benchHistory,
  block: BLOCKS[3], spec: rotationSpec(BLOCKS[3], 1) });
check('top set beats the average (57.5, not 56.7)', held.weight === 57.5, `${held.weight}`);
check('a short set blocks the increase', held.status === 'hold', held.status);

const allCleared = { 'Barbell Flat Bench Press': [
  { date: '2026-05-25', exercise: 'Barbell Flat Bench Press', set: 1, reps: 8, weight: 55 },
  { date: '2026-05-25', exercise: 'Barbell Flat Bench Press', set: 2, reps: 8, weight: 55 },
  { date: '2026-05-25', exercise: 'Barbell Flat Bench Press', set: 3, reps: 8, weight: 55 },
] };
const up = prescribe({ exercise: benchEx, exerciseIndex: 1, history: allCleared,
  block: BLOCKS[3], spec: rotationSpec(BLOCKS[3], 1) });
check('all sets at the top of the range adds one increment', up.status === 'increase' && up.weight === 57.5, `${up.status} ${up.weight}`);

const restart = prescribe({ exercise: benchEx, exerciseIndex: 1, history: allCleared,
  block: BLOCKS[1], spec: rotationSpec(BLOCKS[1], 0) });
check('M1 opens the bench at its restart load of 45 kg', restart.weight === 45, `${restart.weight}`);

const deload = prescribe({ exercise: benchEx, exerciseIndex: 1, history: allCleared,
  block: BLOCKS[1], spec: rotationSpec(BLOCKS[1], 12) });
check('deload drops to 60% and halves the sets', deload.weight === 32.5 && deload.sets <= 2, `${deload.weight}kg × ${deload.sets}`);

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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
