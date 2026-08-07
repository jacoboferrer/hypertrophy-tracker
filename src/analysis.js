// ─── DERIVED VIEWS OF THE LOG ────────────────────────────────────────────────

import { metaFor, MUSCLE_ORDER } from './exercises.js';
import { e1rm } from './progression.js';

/** Group flat set rows into sessions, newest first. */
export function toSessions(rows) {
  const byDate = {};
  for (const r of rows) {
    if (!byDate[r.date]) byDate[r.date] = { date: r.date, day: r.day, sets: [] };
    byDate[r.date].sets.push(r);
  }
  // A session's day is whichever letter most of its sets carry.
  for (const s of Object.values(byDate)) {
    const tally = {};
    for (const x of s.sets) tally[x.day] = (tally[x.day] || 0) + 1;
    s.day = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
    s.volume = s.sets.reduce((t, x) => t + x.weight * x.reps, 0);
  }
  return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
}

export function byExercise(rows) {
  const h = {};
  for (const r of rows) {
    if (!h[r.exercise]) h[r.exercise] = [];
    h[r.exercise].push(r);
  }
  return h;
}

export function personalRecords(history) {
  const out = {};
  for (const [ex, sets] of Object.entries(history)) {
    const best = sets.reduce((b, s) => (e1rm(s.weight, s.reps) > e1rm(b.weight, b.reps) ? s : b));
    out[ex] = {
      maxWeight: Math.max(...sets.map((s) => s.weight)),
      maxE1RM: e1rm(best.weight, best.reps),
      maxVolume: Math.max(...sets.map((s) => s.weight * s.reps)),
      bestDate: best.date,
    };
  }
  return out;
}

/**
 * Hard sets per muscle across a set of rows, credited by the attribution
 * weights in exercises.js (1 direct, 0.5 secondary, 0.25 incidental).
 */
export function volumeByMuscle(rows) {
  const totals = Object.fromEntries(MUSCLE_ORDER.map((m) => [m, 0]));
  for (const r of rows) {
    const { muscles } = metaFor(r.exercise);
    for (const [muscle, weight] of Object.entries(muscles)) {
      if (muscle in totals) totals[muscle] += weight;
    }
  }
  return totals;
}

/**
 * Volume per A–B–C rotation — the honest unit. Measured per week it looks like
 * a recovery problem; measured per rotation it is plainly a rotation-rate
 * problem, which is a different fix.
 */
export function volumePerRotation(rows, sessionCount) {
  const rotations = Math.max(sessionCount / 3, 1);
  const totals = volumeByMuscle(rows);
  return Object.fromEntries(Object.entries(totals).map(([m, v]) => [m, v / rotations]));
}

/** Rolling sessions-per-week over a trailing window. */
export function sessionsPerWeek(sessions, days = 28) {
  if (!sessions.length) return 0;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const recent = sessions.filter((s) => s.date >= cutoff).length;
  return recent / (days / 7);
}

export function daysSince(dateStr) {
  if (!dateStr) return null;
  const then = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  return Math.floor((now - then) / 86400000);
}

export function isoWeekStart(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const dow = (d.getDay() + 6) % 7; // Monday = 0, fixing the Sunday jump
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`; // local date, unlike toISOString which shifts by TZ
}

export function today() {
  return toISODate(new Date());
}

/**
 * Trailing moving average, oldest first. `key` picks the measurement, and
 * entries missing it are skipped — weight and waist are logged together but
 * either can be left blank.
 */
export function smoothSeries(entries, window = 7, key = 'value') {
  const sorted = [...entries]
    .filter((e) => typeof e[key] === 'number' && !isNaN(e[key]))
    .sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((e, i) => {
    const slice = sorted.slice(Math.max(0, i - window + 1), i + 1);
    return { date: e.date, value: e[key], smooth: slice.reduce((s, x) => s + x[key], 0) / slice.length };
  });
}

/** Combined weekly load: lifting sets alongside mat hours. */
export function weeklyLoad(sessions, grappling, weeks = 12) {
  const buckets = {};
  const start = isoWeekStart(toISODate(new Date(Date.now() - weeks * 7 * 86400000)));
  const touch = (wk) => {
    if (!buckets[wk]) buckets[wk] = { week: wk, sets: 0, lifts: 0, mats: 0, matMinutes: 0 };
    return buckets[wk];
  };
  // Seed every week in range so gaps render as gaps, not as missing columns.
  for (let i = 0; i <= weeks; i++) {
    const d = new Date(`${start}T00:00:00`);
    d.setDate(d.getDate() + i * 7);
    touch(toISODate(d));
  }
  for (const s of sessions) {
    const wk = isoWeekStart(s.date);
    if (wk < start) continue;
    const b = touch(wk);
    b.sets += s.sets.length;
    b.lifts += 1;
  }
  for (const g of grappling) {
    const wk = isoWeekStart(g.date);
    if (wk < start) continue;
    const b = touch(wk);
    b.mats += 1;
    b.matMinutes += g.minutes || 90;
  }
  return Object.values(buckets).sort((a, b) => a.week.localeCompare(b.week));
}
