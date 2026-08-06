// ─── Google Sheets Integration ───────────────────────────────────────────────
//
// SETUP
// 1. Share the Sheet: "Anyone with the link" → Viewer.
// 2. Create a Google Cloud API key with the Sheets API enabled, and RESTRICT it
//    to the Sheets API and to your GitHub Pages referrer. A key in a client
//    bundle is readable by anyone who loads the page — restriction, not
//    secrecy, is what protects it.
// 3. Copy .env.example to .env.local and fill in the values. Never commit them.
//
// Form column mapping:
//   0  Marca temporal          → date
//   1  Routine                 → day (Full Body - A/B/C, or legacy names)
//   2–8  legacy exercise cols  → exercise name
//   9  Working Set             → set number, or "Warmup" (skipped)
//   10 Repetitions   11 Weight (kg)   12 Comment
//   13 RPE           14 RIR           15 Technical Quality   16 Rest Time
//   17 Sleep quality 18 Energy level  19 Body weight
//   24–26 Full Body A/B/C cols → exercise name (take priority)
//

import { SHEETS_CONFIG } from './config.js';
import { canonical } from './exercises.js';

const ROUTINE_TO_DAY = {
  'day a': 'A', 'día a': 'A', 'full body - a': 'A', 'full body a': 'A',
  'day b': 'B', 'día b': 'B', 'full body - b': 'B', 'full body b': 'B',
  'day c': 'C', 'día c': 'C', 'full body - c': 'C', 'full body c': 'C',
  // Legacy routine names from the pre-April form
  'push day': 'A', 'pull day': 'B', 'upper body': 'C',
};

const EXERCISE_COLUMNS = [24, 25, 26, 2, 3, 4, 5, 6, 7, 8];

function parseTimestamp(ts) {
  if (!ts) return null;
  // Google Sheets Spanish locale: D/MM/YYYY H:MM:SS. Checked before the native
  // parser, which reads 1/06/2026 as 6 January.
  const match = String(ts).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const d = new Date(ts);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return null;
}

const num = (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
};

function parseRow(row) {
  if (!row || row.length < 12) return null;

  const date = parseTimestamp(row[0]);
  if (!date) return null;

  const setRaw = String(row[9] ?? '').trim();
  const bodyweight = num(row[19]);

  // Warm-ups carry no working volume but may still carry a bodyweight reading.
  const isWarmup = /^(warmup|calentamiento)$/i.test(setRaw);
  const setNum = parseInt(setRaw, 10);
  if (isWarmup || isNaN(setNum) || setNum < 1) {
    return bodyweight ? { kind: 'bodyweight', date, value: bodyweight } : null;
  }

  let exercise = '';
  for (const col of EXERCISE_COLUMNS) {
    const v = row[col];
    if (v && String(v).trim()) { exercise = String(v).trim(); break; }
  }
  if (!exercise) return null;

  const reps = parseInt(row[10], 10);
  const weight = num(row[11]);
  if (isNaN(reps) || weight === null) return null;

  const routine = String(row[1] ?? '').trim().toLowerCase();

  return {
    kind: 'set',
    date,
    day: ROUTINE_TO_DAY[routine] || 'A',
    exercise: canonical(exercise),   // collapses the five alias pairs
    set: setNum,
    reps,
    weight,
    rpe: num(row[13]),
    rir: num(row[14]),
    quality: row[15] || null,
    rest: row[16] || null,
    sleep: row[17] || null,
    energy: row[18] || null,
    bodyweight,
    comment: row[12] || null,
    source: 'sheets',
  };
}

/**
 * Turn raw sheet rows into sets and bodyweight readings.
 * Exported so the test scripts exercise this parser rather than a copy of it.
 */
export function parseRows(values) {
  const parsed = values.map(parseRow).filter(Boolean);

  const sets = parsed.filter((r) => r.kind === 'set');
  const bodyweight = [];
  const seen = new Set();
  for (const r of parsed) {
    const value = r.kind === 'bodyweight' ? r.value : r.bodyweight;
    if (value && !seen.has(r.date)) { seen.add(r.date); bodyweight.push({ date: r.date, value }); }
  }

  return { sets, bodyweight };
}

/** The range this app reads. Shared with the fixture cache. */
export const SHEET_RANGE = (name) => `${name}!A2:AA5000`;

export function sheetsUrl({ SHEET_ID, API_KEY, SHEET_NAME }) {
  if (!SHEET_ID) throw new Error('VITE_SHEETS_ID is not set — copy .env.example to .env.local');
  if (!API_KEY) throw new Error('VITE_SHEETS_API_KEY is not set — copy .env.example to .env.local');
  const range = encodeURIComponent(SHEET_RANGE(SHEET_NAME));
  return `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;
}

export async function fetchFromGoogleSheets() {
  const response = await fetch(sheetsUrl(SHEETS_CONFIG));
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Sheets API ${response.status}: ${err.error?.message || response.statusText}`);
  }

  const { values = [] } = await response.json();
  const { sets, bodyweight } = parseRows(values);

  console.log(`[Sheets] ${values.length} rows → ${sets.length} working sets, ${bodyweight.length} bodyweight readings`);
  return { sets, bodyweight };
}
