import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { nextDayAfter, SYNC_CONFIG } from './config.js';
import { mesocycleState } from './mesocycles.js';
import { fetchFromGoogleSheets } from './sheets.js';
import { useStore, pruneSynced } from './store.js';
import { syncNow, countPending } from './sync.js';
import { toSessions, byExercise, weeklyLoad, today as todayIso } from './analysis.js';
import Today from './views/Today.jsx';
import PlanView from './views/PlanView.jsx';
import LogView from './views/LogView.jsx';
import ProgressView from './views/ProgressView.jsx';
import BodyView from './views/BodyView.jsx';

const VIEWS = [
  { id: 'today',    glyph: '◉', label: 'Today' },
  { id: 'plan',     glyph: '◎', label: 'Plan' },
  { id: 'log',      glyph: '≡', label: 'Log' },
  { id: 'progress', glyph: '↗', label: 'Progress' },
  { id: 'body',     glyph: '◇', label: 'Body' },
];

export default function App() {
  const [view, setView] = useState('today');
  const [remote, setRemote] = useState({ sets: [], bodyweight: [], grappling: [] });
  const [sync, setSync] = useState({ source: null, error: null, at: null });
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const local = useStore();

  const showToast = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const pull = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchFromGoogleSheets();
      setRemote(result);
      setSync({ source: 'sheets', error: null, at: new Date().toISOString() });
    } catch (err) {
      console.warn('[sheets]', err.message);
      setSync((s) => ({ ...s, source: s.source || 'local', error: err.message }));
    }
    setLoading(false);
  }, []);

  useEffect(() => { pull(); }, [pull]);

  // ── Push local records to the Sheet ───────────────────────────────────
  const pending = countPending(local);

  const push = useCallback(async (announce = true) => {
    if (!SYNC_CONFIG.enabled || pushing) return;
    setPushing(true);
    const result = await syncNow();
    setPushing(false);
    setPushError(result.ok ? null : result.reason);
    if (result.ok && result.written > 0) {
      if (announce) showToast(`${result.written} saved to the Sheet`);
      pull();  // read them back so local copies can be pruned
    }
  }, [pushing, showToast, pull]);

  // Drain the queue whenever there is something to send, and again as soon as
  // the connection comes back after a session logged offline.
  useEffect(() => {
    if (pending > 0) push(false);
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onOnline = () => push(false);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [push]);

  // ── Merge remote and local ────────────────────────────────────────────
  // A record the Sheet has echoed back is dropped from the local copy, so a
  // synced set is never counted twice.
  const remoteIds = useMemo(() => ({
    sets: new Set(remote.sets.map((s) => s.id).filter(Boolean)),
    grappling: new Set(remote.grappling.map((g) => g.id).filter(Boolean)),
    bodyweight: new Set(remote.bodyweight.map((b) => b.id).filter(Boolean)),
  }), [remote]);

  useEffect(() => { pruneSynced(remoteIds); }, [remoteIds]);

  const data = useMemo(
    () => [...remote.sets, ...local.sets.filter((s) => !remoteIds.sets.has(s.id))],
    [remote.sets, local.sets, remoteIds],
  );

  const grappling = useMemo(() => {
    const merged = new Map();
    for (const g of remote.grappling) merged.set(g.date, g);
    for (const g of local.grappling) if (!remoteIds.grappling.has(g.id)) merged.set(g.date, g);
    return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [remote.grappling, local.grappling, remoteIds]);

  const bodyweight = useMemo(() => {
    const merged = new Map();
    for (const b of remote.bodyweight) merged.set(b.date, b);
    for (const b of local.bodyweight) if (!remoteIds.bodyweight.has(b.id)) merged.set(b.date, b);
    return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [remote.bodyweight, local.bodyweight, remoteIds]);

  const sessions = useMemo(() => toSessions(data), [data]);
  const history = useMemo(() => byExercise(data), [data]);
  const loadWeeks = useMemo(() => weeklyLoad(sessions, grappling, 12), [sessions, grappling]);

  // ── Where we are in the plan ──────────────────────────────────────────
  const iso = todayIso();

  // Today's session is in progress, so it must not advance the block counter.
  const completed = useMemo(
    () => sessions.map((s) => s.date).filter((d) => d < iso),
    [sessions, iso],
  );

  const meso = useMemo(() => mesocycleState(completed), [completed]);

  const { day, lastSessionDate } = useMemo(() => {
    const todaySession = sessions.find((s) => s.date === iso);
    if (todaySession) {
      const previous = sessions.find((s) => s.date < iso);
      return { day: todaySession.day, lastSessionDate: previous?.date || null };
    }
    const previous = sessions.find((s) => s.date < iso);
    return { day: previous ? nextDayAfter(previous.day) : 'A', lastSessionDate: previous?.date || null };
  }, [sessions, iso]);

  if (loading && !data.length && !sync.error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>◎</div>
          <div className="mono" style={{ fontSize: 13 }}>Loading training data…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`banner ${pending > 0 || sync.error || pushError ? 'warn' : 'ok'}`}>
        <span>
          {pending > 0
            ? `● ${pending} ${pending === 1 ? 'record' : 'records'} waiting to save`
            : sync.source === 'sheets' && !sync.error
              ? `● Saved to the Sheet — ${data.length} sets`
              : `● Offline — ${data.length} sets on this device`}
          {(sync.error || pushError) && (
            <span style={{ display: 'block', fontSize: 11.5, opacity: .85 }}>
              {pushError || sync.error}
            </span>
          )}
          {!pending && sync.at && (
            <span style={{ color: 'var(--ink-3)', marginLeft: 10 }}>
              {new Date(sync.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </span>
        <span className="row" style={{ gap: 6 }}>
          {pending > 0 && SYNC_CONFIG.enabled && (
            <button className="btn small primary" onClick={() => push(true)} disabled={pushing}>
              {pushing ? 'Saving…' : '↑ Save now'}
            </button>
          )}
          <button className="btn small ghost" onClick={pull} disabled={loading}>
            {loading ? 'Syncing…' : '⟳ Refresh'}
          </button>
        </span>
      </div>

      <nav className="nav">
        {VIEWS.map((v) => (
          <button key={v.id} className="nav-item" aria-current={view === v.id ? 'page' : undefined}
            onClick={() => setView(v.id)}>
            <span className="glyph" aria-hidden="true">{v.glyph}</span>
            <span>{v.label}</span>
          </button>
        ))}
      </nav>

      {view === 'today' && (
        <Today meso={meso} day={day} history={history} data={data}
          grappling={grappling} lastSessionDate={lastSessionDate} onToast={showToast} />
      )}
      {view === 'plan' && <PlanView meso={{ ...meso, currentDay: day }} history={history} />}
      {view === 'log' && (
        <LogView sessions={sessions} data={data} weeklyLoadData={loadWeeks} onToast={showToast} />
      )}
      {view === 'progress' && (
        <ProgressView history={history} sessions={sessions}
          selected={selectedExercise} onSelect={setSelectedExercise} />
      )}
      {view === 'body' && (
        <BodyView bodyweight={bodyweight} grappling={grappling} onToast={showToast} />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
