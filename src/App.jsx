import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { nextDayAfter } from './config.js';
import { mesocycleState } from './mesocycles.js';
import { fetchFromGoogleSheets } from './sheets.js';
import { useStore } from './store.js';
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
  const [remote, setRemote] = useState({ sets: [], bodyweight: [] });
  const [sync, setSync] = useState({ source: null, error: null, at: null });
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

  // ── Merge remote and local ────────────────────────────────────────────
  const data = useMemo(() => [...remote.sets, ...local.sets], [remote.sets, local.sets]);

  const bodyweight = useMemo(() => {
    const merged = new Map();
    for (const b of remote.bodyweight) merged.set(b.date, { ...b });
    for (const b of local.bodyweight) merged.set(b.date, { ...b }); // local wins
    return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [remote.bodyweight, local.bodyweight]);

  const sessions = useMemo(() => toSessions(data), [data]);
  const history = useMemo(() => byExercise(data), [data]);
  const loadWeeks = useMemo(() => weeklyLoad(sessions, local.grappling, 12), [sessions, local.grappling]);

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
      <div className={`banner ${sync.source === 'sheets' && !sync.error ? 'ok' : 'warn'}`}>
        <span>
          {sync.source === 'sheets' && !sync.error
            ? `● Synced — ${data.length} sets`
            : `● Offline — ${data.length} sets on this device${sync.error ? ` · ${sync.error}` : ''}`}
          {sync.at && <span style={{ color: 'var(--ink-3)', marginLeft: 10 }}>
            {new Date(sync.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>}
        </span>
        <button className="btn small ghost" onClick={pull} disabled={loading}>
          {loading ? 'Syncing…' : '⟳ Refresh'}
        </button>
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
          grappling={local.grappling} lastSessionDate={lastSessionDate} onToast={showToast} />
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
        <BodyView bodyweight={bodyweight} grappling={local.grappling} onToast={showToast} />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
