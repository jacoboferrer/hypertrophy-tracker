// ─── SYNC ────────────────────────────────────────────────────────────────────
//
// Pushes locally logged records to the Sheet through the Apps Script endpoint.
//
// Everything is written to localStorage first and queued, so a session logged
// in a basement is never lost — the queue drains when signal returns. Records
// carry a client-generated id and the endpoint deduplicates on it, so a retry
// after a lost response cannot double-write.
//

import { SYNC_CONFIG } from './config.js';
import { pendingRecords, markSynced } from './store.js';

export const TYPES = ['sets', 'grappling', 'bodyweight', 'notes'];

/**
 * POST one batch. Sent as text/plain deliberately: that keeps it a "simple"
 * CORS request, and Apps Script web apps cannot answer a preflight OPTIONS.
 */
async function post(type, records) {
  const response = await fetch(SYNC_CONFIG.URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: SYNC_CONFIG.TOKEN, type, records }),
    redirect: 'follow',
  });

  if (!response.ok) throw new Error(`Sync endpoint returned ${response.status}`);

  const result = await response.json().catch(() => {
    throw new Error('Sync endpoint returned a non-JSON response — check the deployment');
  });

  if (!result.ok) throw new Error(result.error === 'unauthorised'
    ? 'Sync token rejected — VITE_SYNC_TOKEN does not match the script'
    : `Sync failed: ${result.error}`);

  return result;
}

/**
 * Drain the queue. Returns a summary rather than throwing, so a failed sync
 * degrades to "still pending" instead of interrupting a workout.
 */
export async function syncNow() {
  if (!SYNC_CONFIG.enabled) {
    return { ok: false, reason: 'disabled', written: 0, pending: countPending() };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, reason: 'offline', written: 0, pending: countPending() };
  }

  let written = 0;
  for (const type of TYPES) {
    const records = pendingRecords(type);
    if (!records.length) continue;
    try {
      const result = await post(type, records);
      markSynced(type, result.ids || []);
      written += result.written || 0;
    } catch (err) {
      return { ok: false, reason: err.message, written, pending: countPending() };
    }
  }

  return { ok: true, written, pending: countPending() };
}

/** Pass the store snapshot to make this recompute on render; omit to read live state. */
export function countPending(snapshot) {
  if (snapshot) {
    return TYPES.reduce((total, type) => total + (snapshot[type] || []).filter((r) => !r.syncedAt).length, 0);
  }
  return TYPES.reduce((total, type) => total + pendingRecords(type).length, 0);
}

/** Confirms the endpoint is reachable and the token matches. */
export async function checkEndpoint() {
  if (!SYNC_CONFIG.enabled) return { ok: false, error: 'No VITE_SYNC_URL configured' };
  try {
    const response = await fetch(SYNC_CONFIG.URL, { redirect: 'follow' });
    const result = await response.json();
    return result;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
