// ─── MESOCYCLES ──────────────────────────────────────────────────────────────
//
// A block is thirteen sessions — four A–B–C rotations plus one deload — not
// four weeks. Every week-based block written for this log died the first time
// life took a fortnight: a lost fortnight in February, a lost month in April,
// two months lost to summer. A session-counted block cannot be missed, only
// delayed.
//
// Blocks therefore advance on logged sessions. The dates below are indicative
// only; the strip slides right whenever a week goes missing.
//

export const PROGRAM_START = '2026-08-17';

export const BLOCKS = [
  {
    id: 'M0', name: 'Re-entry', kind: 'entry', sessions: 6,
    window: '17 Aug – 6 Sep',
    note: 'Two sets per exercise, RIR 4, about 65% of your last working loads. You have not lifted since 1 June — this block exists to make M1 possible, not to build anything.',
    setCap: 2, rir: 4, loadPct: 0.65,
  },
  {
    id: 'M1', name: 'Accumulation I', kind: 'ramp', sessions: 13,
    window: '7 Sep – 11 Oct',
    note: 'Full ramp, and the block that breaks the plateaus: compounds open at their restart loads and climb one increment per rotation. The term is fresh — this is the easiest block of the year to actually run.',
    useRestart: true,
  },
  {
    id: 'M2', name: 'Accumulation II', kind: 'ramp', sessions: 13,
    window: '12 Oct – 15 Nov',
    note: 'Highest volume of the year — the peak rotations carry an extra accessory set. Compounds restart one increment below M1’s finish.',
    extraAccessorySet: true,
  },
  {
    id: 'M3', name: 'Intensification', kind: 'ramp', sessions: 13,
    window: '16 Nov – 20 Dec',
    note: 'Heavier and leaner: compound rep ranges drop by two, one fewer accessory set. The lowest-volume working block, deliberately placed in the busiest weeks of term — it is the cheapest to recover from alongside hard grappling.',
    repShift: -2, setDelta: -1,
  },
  {
    id: 'H1', name: 'Hold — exams', kind: 'hold', sessions: 8,
    window: '21 Dec – 24 Jan',
    note: 'Two sessions a week, two sets each, RIR 3, load held. About a third of normal volume retains essentially all of your strength. Planned, so December is a decision rather than a collapse.',
    setCap: 2, rir: 3, loadPct: 1,
  },
  {
    id: 'M4', name: 'Accumulation III', kind: 'ramp', sessions: 13,
    window: '25 Jan – 28 Feb',
    note: 'Volume again, on top of M3’s higher strength base. This is where the year’s size actually arrives.',
  },
  {
    id: 'M5', name: 'Accumulation IV', kind: 'ramp', sessions: 13,
    window: '1 Mar – 4 Apr',
    note: 'The second spring volume block, and the last one before the year’s heaviest work.',
    extraAccessorySet: true,
  },
  {
    id: 'M6', name: 'Intensification + test', kind: 'ramp', sessions: 13,
    window: '5 Apr – 9 May',
    note: 'Accumulate, then intensify, then test — the order that makes a test mean something. Ends with a genuine top set on bench, squat and row against a year of data.',
    repShift: -2, setDelta: -1, test: true,
  },
  {
    id: 'H2', name: 'Hold — exams', kind: 'hold', sessions: 8,
    window: '10 May – 30 Jun',
    note: 'Maintenance again, then re-plan in July from a year of clean data rather than five months of Day A.',
    setCap: 2, rir: 3, loadPct: 1,
  },
];

export const TOTAL_PLANNED_SESSIONS = BLOCKS.reduce((s, b) => s + b.sessions, 0);

// Reps in reserve by rotation. Nothing in the old log ever prescribed an easy
// week — 95 of 268 sets were logged at RIR 0.
export const RIR_BY_ROTATION = [3, 2, 1.5, 0.5];
const DELOAD_RIR = 5;

/**
 * Where a session sits inside its block.
 * Rotations 0–3 are sessions 1–12; session 13 is the deload.
 */
export function rotationSpec(block, sessionInBlock) {
  if (block.kind !== 'ramp') {
    return {
      rotation: null,
      label: block.kind === 'entry' ? 'Re-entry' : 'Maintenance',
      rir: block.rir,
      loadPct: block.loadPct ?? 1,
      isDeload: false,
      setCap: block.setCap,
    };
  }
  const isDeload = sessionInBlock >= block.sessions - 1;
  if (isDeload) {
    return { rotation: 4, label: 'Deload', rir: DELOAD_RIR, loadPct: 0.6, isDeload: true, halveSets: true };
  }
  const rotation = Math.floor(sessionInBlock / 3);
  return {
    rotation,
    label: `Rotation ${rotation + 1}`,
    rir: RIR_BY_ROTATION[Math.min(rotation, 3)],
    loadPct: 1,
    isDeload: false,
  };
}

/**
 * Extra sets earned by position in the block.
 * Rotation 2 adds a set to the first lift; rotation 3 adds one to the third.
 */
export function setBonus(block, spec, exerciseIndex) {
  if (block.kind !== 'ramp' || spec.isDeload || spec.rotation == null) return 0;
  let bonus = 0;
  if (spec.rotation >= 1 && exerciseIndex === 0) bonus += 1;
  if (spec.rotation >= 2 && exerciseIndex === 2) bonus += 1;
  if (block.extraAccessorySet && spec.rotation >= 3 && exerciseIndex === 3) bonus += 1;
  return bonus;
}

/**
 * Current position in the plan, derived purely from logged sessions on or
 * after PROGRAM_START. No manual state to keep in sync, and a missed week
 * delays the block rather than invalidating it.
 */
export function mesocycleState(sessionDates) {
  const done = sessionDates.filter((d) => d >= PROGRAM_START).length;

  let remaining = done;
  for (let i = 0; i < BLOCKS.length; i++) {
    const block = BLOCKS[i];
    if (remaining < block.sessions) {
      const spec = rotationSpec(block, remaining);
      return {
        block,
        blockIndex: i,
        sessionInBlock: remaining,
        sessionNumber: remaining + 1,
        sessionsLeftInBlock: block.sessions - remaining,
        spec,
        totalDone: done,
        nextBlock: BLOCKS[i + 1] || null,
        finished: false,
      };
    }
    remaining -= block.sessions;
  }

  const last = BLOCKS[BLOCKS.length - 1];
  return {
    block: last,
    blockIndex: BLOCKS.length - 1,
    sessionInBlock: last.sessions,
    sessionNumber: last.sessions,
    sessionsLeftInBlock: 0,
    spec: rotationSpec(last, last.sessions - 1),
    totalDone: done,
    nextBlock: null,
    finished: true,
  };
}

/** Cumulative session index at which each block starts — for the year strip. */
export function blockOffsets() {
  let acc = 0;
  return BLOCKS.map((b) => {
    const start = acc;
    acc += b.sessions;
    return { id: b.id, start, end: acc };
  });
}
