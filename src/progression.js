// ─── PROGRESSION ─────────────────────────────────────────────────────────────
//
// Two rules the old implementation got wrong:
//
//  1. Load comes from the TOP set, not the average of all sets. Averaging
//     57.5 / 57.5 / 55 proposed 56.7 kg — below the top set, and not a weight
//     that exists on a barbell.
//  2. Progression requires ALL working sets at the top of the range, which is
//     what the Program tab always claimed and the code never did.
//

import { metaFor, roundToIncrement } from './exercises.js';
import { setBonus } from './mesocycles.js';

export function e1rm(weight, reps) {
  return weight * (1 + reps / 30);
}

export function parseRepRange(range) {
  const [lo, hi] = String(range).split('-').map(Number);
  return { lo, hi: hi ?? lo };
}

/** Heaviest set of a session; ties broken by reps. */
export function topSet(sets) {
  return sets.reduce((best, s) => {
    if (s.weight > best.weight) return s;
    if (s.weight === best.weight && s.reps > best.reps) return s;
    return best;
  }, sets[0]);
}

/** The most recent session in which this exercise was trained. */
export function lastPerformance(history, exerciseName) {
  const sets = history[exerciseName];
  if (!sets?.length) return null;
  const date = sets.reduce((a, s) => (s.date > a ? s.date : a), sets[0].date);
  return { date, sets: sets.filter((s) => s.date === date) };
}

/**
 * What to do today, for one exercise, given where we are in the block.
 * Returns everything the Today card needs to render without further maths.
 */
export function prescribe({ exercise, exerciseIndex, history, block, spec }) {
  const meta = metaFor(exercise.name);

  // ── Sets ──────────────────────────────────────────────────────────────
  let sets = exercise.sets + setBonus(block, spec, exerciseIndex) + (block.setDelta || 0);
  if (spec.setCap) sets = Math.min(sets, spec.setCap);
  if (spec.halveSets) sets = Math.ceil(sets / 2);
  sets = Math.max(1, sets);

  // ── Reps ──────────────────────────────────────────────────────────────
  let { lo, hi } = parseRepRange(exercise.repRange);
  if (block.repShift && exercise.type === 'Compound') {
    lo = Math.max(3, lo + block.repShift);
    hi = Math.max(lo + 2, hi + block.repShift);
  }
  const repRange = lo === hi ? `${lo}` : `${lo}–${hi}`;

  const base = {
    name: exercise.name, sets, lo, hi, repRange,
    rir: spec.rir, optional: !!exercise.optional, type: exercise.type,
    increment: meta.increment,
  };

  if (meta.untracked) {
    return { ...base, untracked: true, weight: null, status: 'accessory', message: 'Bodyweight or fixed load — no progression tracked' };
  }

  // ── Load ──────────────────────────────────────────────────────────────
  const last = lastPerformance(history, exercise.name);
  const firstExposure = spec.rotation === 0 && !spec.isDeload;

  if (!last) {
    if (exercise.restart) {
      return { ...base, weight: exercise.restart, status: 'restart',
        message: `Opening load for ${block.id}` };
    }
    return { ...base, weight: null, status: 'no_data',
      message: `No history — pick a load you can hold for ${hi} reps at RIR ${spec.rir}` };
  }

  const top = topSet(last.sets);
  const minReps = Math.min(...last.sets.map((s) => s.reps));
  const enoughSets = last.sets.length >= Math.min(sets, exercise.sets);
  const clearedAllSets = minReps >= hi && enoughSets;
  const round = (w) => roundToIncrement(w, meta.increment);
  const lastSummary = { date: last.date, sets: last.sets.length, weight: top.weight, minReps, maxReps: Math.max(...last.sets.map((s) => s.reps)) };

  if (spec.isDeload) {
    return { ...base, weight: round(top.weight * 0.6), status: 'deload', lastSummary,
      message: 'Deload — half the sets, 60% of load, leave five in reserve' };
  }

  if (spec.loadPct && spec.loadPct < 1) {
    return { ...base, weight: round(top.weight * spec.loadPct), status: 'reentry', lastSummary,
      message: `${Math.round(spec.loadPct * 100)}% of your last working load` };
  }

  if (firstExposure && block.useRestart && exercise.restart) {
    return { ...base, weight: exercise.restart, status: 'restart', lastSummary,
      message: `Block restart — ${exercise.restart} kg. Re-treading a weight you have beaten is how it moves again` };
  }

  if (firstExposure && block.kind === 'ramp') {
    return { ...base, weight: round(Math.max(top.weight - meta.increment, meta.increment)), status: 'restart', lastSummary,
      message: 'Block restart — one increment below last block’s finish' };
  }

  if (clearedAllSets) {
    return { ...base, weight: round(top.weight + meta.increment), status: 'increase', lastSummary,
      message: `All ${last.sets.length} sets cleared ${hi} reps — up ${meta.increment} kg, back to ${lo}` };
  }

  return { ...base, weight: round(top.weight), status: 'hold', lastSummary,
    message: enoughSets
      ? `Hold ${round(top.weight)} kg until every set reaches ${hi} (lowest was ${minReps})`
      : `Hold ${round(top.weight)} kg — only ${last.sets.length} working ${last.sets.length === 1 ? 'set' : 'sets'} logged last time` };
}

export const STATUS_STYLE = {
  increase: { label: 'Add load', color: '#1A8A6E', bg: '#EDF8F5', border: '#C5E8DE' },
  hold:     { label: 'Hold',     color: '#B8860B', bg: '#FFF8E6', border: '#F0E6C0' },
  restart:  { label: 'Restart',  color: '#1A6BB5', bg: '#EEF5FC', border: '#CFE2F5' },
  deload:   { label: 'Deload',   color: '#7B5EA7', bg: '#F5F1FA', border: '#E0D4F0' },
  reentry:  { label: 'Re-entry', color: '#1A6BB5', bg: '#EEF5FC', border: '#CFE2F5' },
  no_data:  { label: 'New',      color: '#666',    bg: '#FAFAF9', border: '#E8E6E3' },
  accessory:{ label: 'Accessory',color: '#666',    bg: '#FAFAF9', border: '#E8E6E3' },
};
