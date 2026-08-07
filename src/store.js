// ─── LOCAL-FIRST STORE ───────────────────────────────────────────────────────
//
// The Google Form needs a signal; gym basements do not. Everything logged here
// lands in localStorage immediately and merges with the Sheets pull on read, so
// a session is never lost to a dead connection.
//
// Also the home for the two things the form has never captured: grappling —
// 4½ hours a week that appeared nowhere in the data — and bodyweight, a field
// that existed on the form and was filled in on 0 of 297 rows.
//

import { useSyncExternalStore } from 'react';

const KEY = 'hypertrophy-tracker/v1';

const EMPTY = { sets: [], grappling: [], bodyweight: [], notes: [] };

// Absent under Node, where the test scripts exercise this module directly.
// Declared before load() runs — a const referenced from a hoisted function is
// still in its temporal dead zone until this line executes.
const hasStorage = typeof localStorage !== 'undefined';

let state = load();
const listeners = new Set();

function load() {
  if (!hasStorage) return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return EMPTY;
  }
}

function commit(next) {
  state = next;
  if (hasStorage) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      // Quota exceeded, or Safari private mode. The in-memory state is still
      // correct and the sync queue will drain it — but say so.
      console.warn('[store] could not persist:', err.message);
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStore() {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

const uid = () => (crypto?.randomUUID
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`);

const stamp = (entry) => ({
  id: uid(),
  source: 'local',
  syncedAt: null,      // set once the Sheet has confirmed the write
  loggedAt: new Date().toISOString(),
  ...entry,
});

// ── Sets ────────────────────────────────────────────────────────────────
export function addSet(entry) {
  commit({ ...state, sets: [...state.sets, stamp(entry)] });
}

export function addSets(entries) {
  commit({ ...state, sets: [...state.sets, ...entries.map(stamp)] });
}

export function removeSet(id) {
  commit({ ...state, sets: state.sets.filter((s) => s.id !== id) });
}

// ── Grappling ───────────────────────────────────────────────────────────
export function addGrappling({ date, minutes = 90, hardness = 2 }) {
  const without = state.grappling.filter((g) => g.date !== date || g.syncedAt);
  commit({ ...state, grappling: [...without, stamp({ date, minutes, hardness })] });
}

export function removeGrappling(id) {
  commit({ ...state, grappling: state.grappling.filter((g) => g.id !== id) });
}

// ── Bodyweight ──────────────────────────────────────────────────────────
/** Weight and waist are taken together on the same morning, so they share a row. */
export function addBodyweight({ date, value, waist }) {
  const previous = state.bodyweight.find((b) => b.date === date && !b.syncedAt);
  const without = state.bodyweight.filter((b) => b.date !== date || b.syncedAt);
  commit({ ...state, bodyweight: [...without, stamp({
    date,
    value: value ?? previous?.value ?? null,
    waist: waist ?? previous?.waist ?? null,
  })] });
}

export function removeBodyweight(id) {
  commit({ ...state, bodyweight: state.bodyweight.filter((b) => b.id !== id) });
}

// ── Session notes ───────────────────────────────────────────────────────
/** One note per session date; re-saving replaces the unsynced draft. */
export function saveNote({ date, day, block, note }) {
  const text = String(note ?? '').trim();
  const without = state.notes.filter((n) => n.date !== date || n.syncedAt);
  if (!text) { commit({ ...state, notes: without }); return; }
  commit({ ...state, notes: [...without, stamp({ date, day, block, note: text })] });
}

export function noteFor(date) {
  const matches = state.notes.filter((n) => n.date === date);
  return matches.length ? matches[matches.length - 1].note : '';
}

// ── Sync bookkeeping ────────────────────────────────────────────────────
/** Records not yet confirmed by the Sheet. */
export function pendingRecords(type) {
  return (state[type] || []).filter((r) => !r.syncedAt);
}

/** Mark the ids the endpoint accepted, so they stop being re-sent. */
export function markSynced(type, ids) {
  if (!ids?.length) return;
  const accepted = new Set(ids);
  const at = new Date().toISOString();
  commit({
    ...state,
    [type]: state[type].map((r) => (accepted.has(r.id) && !r.syncedAt ? { ...r, syncedAt: at } : r)),
  });
}

/**
 * Drop local copies the Sheet has echoed back, so the same set is not held in
 * two places once it is safely stored.
 */
export function pruneSynced(remoteIdsByType) {
  let changed = false;
  const next = { ...state };
  for (const [type, ids] of Object.entries(remoteIdsByType)) {
    if (!ids?.size) continue;
    const kept = state[type].filter((r) => !(r.syncedAt && ids.has(r.id)));
    if (kept.length !== state[type].length) { next[type] = kept; changed = true; }
  }
  if (changed) commit(next);
}

// ── Backup ──────────────────────────────────────────────────────────────
export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  commit({
    sets: parsed.sets || [],
    grappling: parsed.grappling || [],
    bodyweight: parsed.bodyweight || [],
    notes: parsed.notes || [],
  });
}

export function clearAll() {
  commit(EMPTY);
}
