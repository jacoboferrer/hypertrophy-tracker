// ─── Google Sheets Integration ───────────────────────────────────────────────
// 
// HOW TO SET UP:
// 1. Open your Google Sheet (the one receiving form responses)
// 2. Click Share → "Anyone with the link" → set to "Viewer"
// 3. Copy the Sheet ID from the URL:
//    https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
// 4. Get a Google Sheets API key:
//    - Go to https://console.cloud.google.com/
//    - Create a project (or use existing)
//    - Enable "Google Sheets API"
//    - Go to Credentials → Create Credentials → API Key
//    - (Optional) Restrict the key to Google Sheets API only
// 5. Paste both values in config.js
//
// Your Google Form column mapping (based on your existing form):
//   Col 0: Marca temporal        → timestamp
//   Col 1: Routine               → day (Day A / Day B / Day C)
//   Col 2: Day A exercises       → exercise name (conditional on routine)
//   Col 3: Day B exercises       → exercise name (conditional on routine)
//   Col 4: Day C exercises       → exercise name (conditional on routine)
//   Col 5-8: Extra selections    → exercise name (fallback)
//   Col 9: Working Set           → set number (1,2,3,4 or "Warmup")
//   Col 10: Repetitions          → reps
//   Col 11: Weight (kg)          → weight
//   Col 12: Comment              → comment
//   Col 13: RPE                  → rpe
//   Col 14: RIR                  → rir
//   Col 15: Technical Quality    → quality
//   Col 16: Rest Time            → rest
// ─────────────────────────────────────────────────────────────────────────────

import { SHEETS_CONFIG } from './config.js';

// Map routine names to day tags
const ROUTINE_TO_DAY = {
  'Day A': 'A', 'Día A': 'A', 'day a': 'A',
  'Day B': 'B', 'Día B': 'B', 'day b': 'B',
  'Day C': 'C', 'Día C': 'C', 'day c': 'C',
  // Full Body routine names from updated form
  'Full Body - A': 'A', 'Full body - A': 'A', 'full body - a': 'A',
  'Full Body - B': 'B', 'Full body - B': 'B', 'full body - b': 'B',
  'Full Body - C': 'C', 'Full body - C': 'C', 'full body - c': 'C',
  // Legacy mappings from old form
  'Push day': 'A', 'Pull day': 'B', 'Upper body': 'C',
};

function parseRow(row) {
  if (!row || row.length < 12) return null;

  const timestamp = row[0];
  const routine = (row[1] || '').trim();
  const setRaw = (row[9] || '').toString().trim();

  // Skip warmups
  if (setRaw.toLowerCase() === 'warmup' || setRaw.toLowerCase() === 'calentamiento') return null;

  const setNum = parseInt(setRaw);
  if (isNaN(setNum) || setNum < 1) return null;

  // Resolve exercise name from conditional columns (old: 2-8, new Full Body: 24-26)
  const exercise = (row[24] || row[25] || row[26] || row[2] || row[3] || row[4] || row[5] || row[6] || row[7] || row[8] || '').trim();
  if (!exercise) return null;

  const reps = parseInt(row[10]);
  const weight = parseFloat(row[11]);
  if (isNaN(reps) || isNaN(weight)) return null;

  // Parse date from timestamp
  let date;
  try {
    const d = new Date(timestamp);
    date = d.toISOString().slice(0, 10);
  } catch {
    return null;
  }

  // Map routine to day tag
  const day = ROUTINE_TO_DAY[routine] || ROUTINE_TO_DAY[routine.toLowerCase()] || 'A';

  return {
    date,
    day,
    exercise,
    set: setNum,
    reps,
    weight,
    rpe: row[13] ? parseFloat(row[13]) : null,
    rir: row[14] ? parseFloat(row[14]) : null,
    quality: row[15] || null,
    rest: row[16] || null,
    comment: row[12] || null,
  };
}

export async function fetchFromGoogleSheets() {
  const { SHEET_ID, API_KEY, SHEET_NAME } = SHEETS_CONFIG;

  if (!SHEET_ID || SHEET_ID === 'YOUR_SHEET_ID_HERE') {
    throw new Error('SHEET_ID not configured. Edit src/config.js');
  }
  if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
    throw new Error('API_KEY not configured. Edit src/config.js');
  }

  const range = `${SHEET_NAME}!A2:AA1000`; // Skip header row, fetch up to 1000 rows (columns A-AA)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?key=${API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Google Sheets API error ${response.status}: ${err.error?.message || response.statusText}`
    );
  }

  const json = await response.json();
  const rows = json.values || [];

  const parsed = rows.map(parseRow).filter(Boolean);

  console.log(`[Sheets] Fetched ${rows.length} rows, parsed ${parsed.length} working sets`);
  return parsed;
}

export function getLastSyncInfo(data) {
  if (!data.length) return { lastDate: null, totalSets: 0, dateRange: '' };
  const dates = data.map(d => d.date).sort();
  return {
    lastDate: dates[dates.length - 1],
    totalSets: data.length,
    dateRange: `${dates[0]} → ${dates[dates.length - 1]}`,
  };
}
