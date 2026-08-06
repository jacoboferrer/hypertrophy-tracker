// ─── CONFIGURATION ───────────────────────────────────────────────────────────
//
// Secrets come from the environment, never from source. Copy .env.example to
// .env.local and fill it in — .env.local is git-ignored via the "*.local" rule.
//
//   VITE_SHEETS_ID=...
//   VITE_SHEETS_API_KEY=...
//   VITE_SHEETS_TAB=Respuestas de formulario 1
//
// A key shipped in a client bundle is always readable by whoever loads the
// page. The real control is restriction: scope the key to the Sheets API and
// to your GitHub Pages referrer in the Google Cloud console.
//

// `?? {}` keeps this module importable outside Vite, so the logic can be
// exercised by the verification script in scripts/.
const env = import.meta.env ?? {};

export const SHEETS_CONFIG = {
  SHEET_ID: env.VITE_SHEETS_ID || '',
  API_KEY: env.VITE_SHEETS_API_KEY || '',
  SHEET_NAME: env.VITE_SHEETS_TAB || 'Respuestas de formulario 1',
};

// ─── PROGRAM ─────────────────────────────────────────────────────────────────
//
// Revised for the 2026–27 course. Four obligatory lifts per session with the
// highest-priority one first, plus an optional finisher: sessions of five
// obligatory exercises got skipped, and a session you leave after exercise two
// still counts.
//
//   restart  — opening load for block M1, one increment below a weight you
//              have already beaten. Re-treading beats grinding.
//   optional — "if time". Excluded from the session's core set count.
//

export const PROGRAM = {
  A: {
    name: 'Day A — Squat & Horizontal Push',
    tag: 'A',
    color: '#C8391E',
    colorLight: '#FEF2F0',
    exercises: [
      { name: 'Barbell Back Squat',       type: 'Compound',  sets: 3, repRange: '6-8',   restart: 50 },
      { name: 'Barbell Flat Bench Press', type: 'Compound',  sets: 3, repRange: '6-8',   restart: 45 },
      { name: 'Barbell Rows',             type: 'Compound',  sets: 3, repRange: '8-10',  restart: 50 },
      { name: 'Lateral Raises',           type: 'Isolation', sets: 3, repRange: '12-18', restart: 10 },
      { name: 'Neck Work',                type: 'Accessory', sets: 2, repRange: '15-15' },
      { name: 'Tricep Pushdown',          type: 'Isolation', sets: 2, repRange: '10-15', optional: true },
    ],
  },
  B: {
    name: 'Day B — Hinge & Vertical Pull',
    tag: 'B',
    color: '#1A6BB5',
    colorLight: '#EEF5FC',
    exercises: [
      { name: 'Dumbbell RDL',             type: 'Compound',  sets: 3, repRange: '8-12',  restart: 16 },
      { name: 'Lat Pulldown',             type: 'Compound',  sets: 3, repRange: '6-10',  restart: 35 },
      { name: 'Incline Dumbbell Press',   type: 'Compound',  sets: 3, repRange: '8-12',  restart: 18 },
      { name: 'Leg Curl',                 type: 'Isolation', sets: 3, repRange: '10-15' },
      { name: 'Grip Work',                type: 'Accessory', sets: 1, repRange: '1-1' },
      { name: 'Dumbbell Curls',           type: 'Isolation', sets: 2, repRange: '10-15', optional: true },
    ],
  },
  C: {
    name: 'Day C — Quads & Vertical Push',
    tag: 'C',
    color: '#1A8A6E',
    colorLight: '#EDF8F5',
    exercises: [
      { name: 'Leg Press',                type: 'Compound',  sets: 3, repRange: '10-15' },
      { name: 'Dumbbell Shoulder Press',  type: 'Compound',  sets: 3, repRange: '8-12',  restart: 14 },
      { name: 'Cable Row',                type: 'Compound',  sets: 3, repRange: '10-15' },
      { name: 'Face Pulls',               type: 'Isolation', sets: 3, repRange: '15-20' },
      { name: 'Neck Work',                type: 'Accessory', sets: 2, repRange: '15-15' },
      { name: 'Incline Dumbbell Curl',    type: 'Isolation', sets: 2, repRange: '10-15', optional: true },
      { name: 'Overhead Tricep Extension',type: 'Isolation', sets: 2, repRange: '10-15', optional: true },
    ],
  },
};

export const DAY_ORDER = ['A', 'B', 'C'];

/** The rotation is strictly ordered — you never choose the day. */
export function nextDayAfter(day) {
  const i = DAY_ORDER.indexOf(day);
  return i === -1 ? 'A' : DAY_ORDER[(i + 1) % DAY_ORDER.length];
}

export const BODY_PARAMS = {
  weight: 65,
  height: 1.74,
  age: 37,
  proteinTarget: 130,   // 2.0 g/kg
  calorieTarget: 2600,  // lean-bulk surplus
  weeklyGainTarget: 0.1, // kg/week — about +4 kg across the course
  targetSessionsPerWeek: 2.5,
};
