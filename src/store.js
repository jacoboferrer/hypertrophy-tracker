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

const EMPTY = { sets: [], grappling: [], bodyweight: [] };

let state = load();
const listeners = new Set();

function load() {
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
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[store] could not persist:', err.message);
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

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// ── Sets ────────────────────────────────────────────────────────────────
export function addSet(entry) {
  commit({ ...state, sets: [...state.sets, { id: uid(), source: 'local', ...entry }] });
}

export function addSets(entries) {
  const stamped = entries.map((e) => ({ id: uid(), source: 'local', ...e }));
  commit({ ...state, sets: [...state.sets, ...stamped] });
}

export function removeSet(id) {
  commit({ ...state, sets: state.sets.filter((s) => s.id !== id) });
}

// ── Grappling ───────────────────────────────────────────────────────────
export function addGrappling({ date, minutes = 90, hardness = 2 }) {
  const without = state.grappling.filter((g) => g.date !== date);
  commit({ ...state, grappling: [...without, { id: uid(), date, minutes, hardness }] });
}

export function removeGrappling(id) {
  commit({ ...state, grappling: state.grappling.filter((g) => g.id !== id) });
}

// ── Bodyweight ──────────────────────────────────────────────────────────
export function addBodyweight({ date, value }) {
  const without = state.bodyweight.filter((b) => b.date !== date);
  commit({ ...state, bodyweight: [...without, { id: uid(), date, value }] });
}

export function removeBodyweight(id) {
  commit({ ...state, bodyweight: state.bodyweight.filter((b) => b.id !== id) });
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
  });
}

export function clearAll() {
  commit(EMPTY);
}
