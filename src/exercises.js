// ─── EXERCISE REGISTRY ───────────────────────────────────────────────────────
//
// One canonical name per movement, plus every spelling that has ever appeared
// in the Google Form. Without this, five pairs of aliases split the history:
// "Barbell Rows" / "Barbell or Dumbbell Rows", "Tricep Pushdown" /
// "Tricep Pulldown", and so on — every PR and progression call was reading
// only one slice of its own data.
//

// alias (lower-cased) → canonical name
export const ALIASES = {
  'barbell rows': 'Barbell Rows',
  'barbell row': 'Barbell Rows',
  'barbell or dumbbell rows': 'Barbell Rows',

  'tricep pushdown': 'Tricep Pushdown',
  'tricep pulldown': 'Tricep Pushdown',
  'triceps pushdown': 'Tricep Pushdown',

  'overhead tricep extension': 'Overhead Tricep Extension',
  'overhead tricep press': 'Overhead Tricep Extension',
  'overhead triceps extension': 'Overhead Tricep Extension',

  'dumbbell curls': 'Dumbbell Curls',
  'dumbbell curl': 'Dumbbell Curls',
  'barbell or dumbbell curls': 'Dumbbell Curls',

  'lat pulldown': 'Lat Pulldown',
  'pull-ups or lat pulldown': 'Lat Pulldown',
  'pull ups or lat pulldown': 'Lat Pulldown',
  'pull-ups': 'Lat Pulldown',

  'barbell flat bench press': 'Barbell Flat Bench Press',
  'bench press': 'Barbell Flat Bench Press',
  'barbell back squat': 'Barbell Back Squat',
  'back squat': 'Barbell Back Squat',
  'incline dumbbell press': 'Incline Dumbbell Press',
  'incline dumbbell curl': 'Incline Dumbbell Curl',
  'dumbbell shoulder press': 'Dumbbell Shoulder Press',
  'lateral raises': 'Lateral Raises',
  'lateral raise': 'Lateral Raises',
  'face pulls': 'Face Pulls',
  'cable row': 'Cable Row',
  'seated cable row': 'Cable Row',
  'bulgarian split squat': 'Bulgarian Split Squat',
  'romanian deadlift': 'Romanian Deadlift',
  'dumbbell romanian deadlift': 'Dumbbell RDL',
  'dumbbell rdl': 'Dumbbell RDL',
  'leg press': 'Leg Press',
  'leg curl': 'Leg Curl',
  'seated leg curl': 'Leg Curl',
  'lying leg curl': 'Leg Curl',
  'neck harness': 'Neck Work',
  'neck work': 'Neck Work',
  'dead hang': 'Grip Work',
  "farmer's carry": 'Grip Work',
  'grip work': 'Grip Work',
};

/** Resolve any logged spelling to its canonical name. */
export function canonical(name) {
  if (!name) return '';
  const trimmed = String(name).trim();
  return ALIASES[trimmed.toLowerCase()] || trimmed;
}

// ─── MUSCLE ATTRIBUTION ──────────────────────────────────────────────────────
//
// Weights are the fraction of a set credited to each muscle: 1 for a direct
// target, 0.5 for meaningful secondary work, 0.25 for incidental. Used by the
// volume chart — the one that would have shown zero hamstring sets in February
// rather than in August.
//

export const MUSCLES = {
  chest: 'Chest',
  back: 'Back',
  quads: 'Quads',
  hams: 'Hamstrings',
  glutes: 'Glutes',
  sideDelts: 'Side delts',
  frontDelts: 'Front delts',
  rearDelts: 'Rear delts',
  triceps: 'Triceps',
  biceps: 'Biceps',
  neck: 'Neck',
};

export const MUSCLE_ORDER = [
  'back', 'chest', 'quads', 'hams', 'glutes',
  'sideDelts', 'frontDelts', 'rearDelts', 'triceps', 'biceps', 'neck',
];

// Hard sets per A–B–C rotation, on the same attribution model as above — a
// set of bench counts fully for chest and half for triceps and front delts.
// The upper bound is what the new rotation allocates at its peak rotation;
// the lower bound is roughly its base rotation, i.e. the floor to stay above.
export const MUSCLE_TARGETS = {
  back: [9, 12], chest: [5, 7], quads: [6, 8], hams: [6, 9], glutes: [5, 8],
  sideDelts: [4, 5.5], frontDelts: [4.5, 6.5], rearDelts: [5, 8],
  triceps: [4, 5], biceps: [4, 5.5], neck: [4, 4],
};

export const EXERCISE_META = {
  'Barbell Back Squat':       { increment: 2.5, muscles: { quads: 1, glutes: 0.5, hams: 0.25 } },
  'Barbell Flat Bench Press': { increment: 2.5, muscles: { chest: 1, triceps: 0.5, frontDelts: 0.5 } },
  'Barbell Rows':             { increment: 2.5, muscles: { back: 1, biceps: 0.5, rearDelts: 0.5 } },
  'Lateral Raises':           { increment: 2,   muscles: { sideDelts: 1 } },
  'Tricep Pushdown':          { increment: 2.5, muscles: { triceps: 1 } },
  'Dumbbell RDL':             { increment: 2,   muscles: { hams: 1, glutes: 1, back: 0.25 } },
  'Lat Pulldown':             { increment: 2.5, muscles: { back: 1, biceps: 0.5 } },
  'Incline Dumbbell Press':   { increment: 2,   muscles: { chest: 1, frontDelts: 0.5, triceps: 0.5 } },
  'Leg Curl':                 { increment: 2.5, muscles: { hams: 1 } },
  'Dumbbell Curls':           { increment: 2,   muscles: { biceps: 1 } },
  'Leg Press':                { increment: 5,   muscles: { quads: 1, glutes: 0.5 } },
  'Dumbbell Shoulder Press':  { increment: 2,   muscles: { frontDelts: 1, sideDelts: 0.5, triceps: 0.5 } },
  'Cable Row':                { increment: 2.5, muscles: { back: 1, biceps: 0.5, rearDelts: 0.5 } },
  'Face Pulls':               { increment: 2.5, muscles: { rearDelts: 1 } },
  'Incline Dumbbell Curl':    { increment: 2,   muscles: { biceps: 1 } },
  'Overhead Tricep Extension':{ increment: 2,   muscles: { triceps: 1 } },
  'Neck Work':                { increment: 1.25, muscles: { neck: 1 }, untracked: true },
  'Grip Work':                { increment: 0,   muscles: {}, untracked: true },

  // Retired from the program, retained so historical volume still resolves.
  'Bulgarian Split Squat':    { increment: 2,   muscles: { quads: 1, glutes: 0.5 } },
  'Romanian Deadlift':        { increment: 2.5, muscles: { hams: 1, glutes: 1, back: 0.25 } },
};

export function metaFor(name) {
  return EXERCISE_META[canonical(name)] || { increment: 2.5, muscles: {} };
}

/** Round a load to something the gym actually has on the rack. */
export function roundToIncrement(weight, increment) {
  if (!increment) return Math.round(weight * 2) / 2;
  return Math.round(weight / increment) * increment;
}
