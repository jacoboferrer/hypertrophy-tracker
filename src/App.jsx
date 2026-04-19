import { useState, useEffect, useMemo, useCallback } from "react";
import { PROGRAM, PROGRESSION, BODY_PARAMS } from "./config.js";
import { fetchFromGoogleSheets, getLastSyncInfo } from "./sheets.js";

// ─── SAMPLE DATA (used when Sheets not configured) ──────────────────────────
const SAMPLE_DATA = [
  { date: "2026-01-07", day: "A", exercise: "Barbell Flat Bench Press", set: 1, reps: 6, weight: 57.5, rpe: 4, rir: 1 },
  { date: "2026-01-07", day: "A", exercise: "Barbell Flat Bench Press", set: 2, reps: 5, weight: 57.5, rpe: 4, rir: 0 },
  { date: "2026-01-07", day: "A", exercise: "Barbell Flat Bench Press", set: 3, reps: 6, weight: 55, rpe: 4, rir: 1 },
  { date: "2026-01-07", day: "A", exercise: "Lateral Raises", set: 1, reps: 10, weight: 10, rpe: 3, rir: 2 },
  { date: "2026-01-07", day: "A", exercise: "Lateral Raises", set: 2, reps: 9, weight: 10, rpe: 3, rir: 1 },
  { date: "2026-01-12", day: "A", exercise: "Barbell Flat Bench Press", set: 1, reps: 8, weight: 55, rpe: 3, rir: 2 },
  { date: "2026-01-12", day: "A", exercise: "Barbell Flat Bench Press", set: 2, reps: 6, weight: 55, rpe: 4, rir: 1 },
  { date: "2026-01-12", day: "A", exercise: "Barbell Flat Bench Press", set: 3, reps: 6, weight: 55, rpe: 4, rir: 1 },
  { date: "2026-01-12", day: "B", exercise: "Incline Dumbbell Press", set: 1, reps: 7, weight: 22, rpe: 4, rir: 1 },
  { date: "2026-01-12", day: "B", exercise: "Incline Dumbbell Press", set: 2, reps: 6, weight: 22, rpe: 4, rir: 1 },
  { date: "2026-01-12", day: "B", exercise: "Incline Dumbbell Press", set: 3, reps: 6, weight: 22, rpe: 4, rir: 0 },
  { date: "2026-01-12", day: "B", exercise: "Dumbbell Curls", set: 1, reps: 12, weight: 10, rpe: 3, rir: 2 },
  { date: "2026-01-12", day: "B", exercise: "Dumbbell Curls", set: 2, reps: 10, weight: 10, rpe: 3, rir: 1 },
  { date: "2026-02-02", day: "A", exercise: "Barbell Flat Bench Press", set: 1, reps: 8, weight: 55, rpe: 3, rir: 2 },
  { date: "2026-02-02", day: "A", exercise: "Barbell Flat Bench Press", set: 2, reps: 6, weight: 55, rpe: 4, rir: 1 },
  { date: "2026-02-02", day: "A", exercise: "Barbell Flat Bench Press", set: 3, reps: 5, weight: 55, rpe: 4, rir: 0 },
  { date: "2026-02-09", day: "A", exercise: "Barbell Flat Bench Press", set: 1, reps: 6, weight: 55, rpe: 4, rir: 1 },
  { date: "2026-02-09", day: "A", exercise: "Barbell Flat Bench Press", set: 2, reps: 6, weight: 55, rpe: 4, rir: 1 },
  { date: "2026-02-09", day: "A", exercise: "Barbell Flat Bench Press", set: 3, reps: 6, weight: 55, rpe: 4, rir: 1 },
  { date: "2026-03-23", day: "A", exercise: "Barbell Flat Bench Press", set: 1, reps: 6, weight: 55, rpe: 4, rir: 1 },
  { date: "2026-03-23", day: "A", exercise: "Barbell Flat Bench Press", set: 2, reps: 6, weight: 55, rpe: 4, rir: 1 },
  { date: "2026-03-23", day: "A", exercise: "Barbell Flat Bench Press", set: 3, reps: 5, weight: 55, rpe: 4, rir: 0 },
  { date: "2026-03-23", day: "A", exercise: "Barbell Back Squat", set: 1, reps: 8, weight: 40, rpe: 3, rir: 3 },
  { date: "2026-03-23", day: "A", exercise: "Barbell Back Squat", set: 2, reps: 8, weight: 40, rpe: 3, rir: 2 },
  { date: "2026-03-23", day: "A", exercise: "Barbell Back Squat", set: 3, reps: 8, weight: 40, rpe: 3, rir: 2 },
];

// ─── UTILITIES ───────────────────────────────────────────────────────────────
function e1rm(w, r) { return w * (1 + r / 30); }
function parseRepRange(range) { const [lo, hi] = range.split("-").map(Number); return { lo, hi }; }

function getProgression(config, lastSets) {
  if (!lastSets?.length) return { status: "no_data", message: "No data yet", targetWeight: 0, targetReps: config.repRange };
  const avgW = lastSets.reduce((s, x) => s + x.weight, 0) / lastSets.length;
  const maxR = Math.max(...lastSets.map(x => x.reps));
  const { lo, hi } = parseRepRange(config.repRange);
  if (config.method === "Double") {
    const { targetReps, restartReps, dbIncrement } = PROGRESSION.Double;
    const t = Math.min(hi, targetReps);
    if (maxR >= t && lastSets.length >= config.sets)
      return { status: "ready", message: `↑ Jump to ${(avgW + dbIncrement).toFixed(1)} kg, restart at ${restartReps}–${restartReps + 2} reps`, targetWeight: avgW + dbIncrement, targetReps: `${restartReps}-${restartReps + 2}` };
    return { status: "building", message: `Build reps at ${avgW.toFixed(1)} kg — ${maxR}/${t}`, targetWeight: avgW, targetReps: `${lo}-${hi}`, progress: maxR / t };
  }
  const pct = config.type === "Compound" ? PROGRESSION.Linear.compoundPct : PROGRESSION.Linear.isolationPct;
  if (maxR >= hi && lastSets.length >= config.sets) {
    const nw = Math.round(avgW * (1 + pct) * 2) / 2;
    return { status: "ready", message: `↑ Increase to ${nw.toFixed(1)} kg (+${(pct * 100).toFixed(1)}%)`, targetWeight: nw, targetReps: `${lo}-${Math.ceil((lo + hi) / 2)}` };
  }
  return { status: "building", message: `Build reps at ${avgW.toFixed(1)} kg — ${maxR}/${hi}`, targetWeight: avgW, targetReps: config.repRange, progress: maxR / hi };
}

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────
function Sparkline({ data, width = 120, height = 32, color = "#C8391E" }) {
  if (!data || data.length < 2) return null;
  const mn = Math.min(...data) * 0.95, mx = Math.max(...data) * 1.05, rng = mx - mn || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - mn) / rng) * height}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={height - ((data[data.length - 1] - mn) / rng) * height} r="3" fill={color} />
    </svg>
  );
}

function Bar({ value, max, color = "#C8391E", h = 6 }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ width: "100%", height: h, background: "#F0EFED", borderRadius: h / 2 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: h / 2, transition: "width 0.4s ease" }} />
    </div>
  );
}

function Heatmap({ sessions }) {
  const weeks = useMemo(() => {
    if (!sessions.length) return [];
    const sorted = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));
    const first = new Date(sorted[0].date), last = new Date(sorted[sorted.length - 1].date);
    const nw = Math.ceil((last - first) / (7 * 86400000)) + 1;
    const r = [];
    for (let w = 0; w < Math.min(nw, 20); w++) {
      const ws = new Date(first); ws.setDate(ws.getDate() + w * 7 - ws.getDay() + 1);
      const days = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(ws); day.setDate(day.getDate() + d);
        const ds = day.toISOString().slice(0, 10);
        days.push({ date: ds, count: sessions.filter(s => s.date === ds).length, dow: d });
      }
      r.push({ days });
    }
    return r;
  }, [sessions]);
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginRight: 4 }}>
          {labels.map((l, i) => <div key={i} style={{ width: 14, height: 14, fontSize: 9, color: "#999", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace" }}>{l}</div>)}
        </div>
        {weeks.map((wk, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {wk.days.map((d, di) => (
              <div key={di} title={`${d.date}: ${d.count} sets`} style={{
                width: 14, height: 14, borderRadius: 3,
                background: d.count === 0 ? "#F0EFED" : d.count < 5 ? "#C6E48B" : d.count < 10 ? "#7BC96F" : "#239A3B",
                border: d.date === new Date().toISOString().slice(0, 10) ? "2px solid #1A1A1A" : "none",
              }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("dashboard");
  const [data, setData] = useState([]);
  const [selectedDay, setSelectedDay] = useState("A");
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState({ source: null, error: null, lastSync: null });
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  // ── Load data on mount ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const sheetsData = await fetchFromGoogleSheets();
        setData(sheetsData);
        setSyncStatus({ source: "google_sheets", error: null, lastSync: new Date().toISOString() });
      } catch (err) {
        console.warn("[Sheets] Falling back to sample data:", err.message);
        setData(SAMPLE_DATA);
        setSyncStatus({ source: "sample", error: err.message, lastSync: null });
      }
      setLoading(false);
    })();
  }, []);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const sheetsData = await fetchFromGoogleSheets();
      setData(sheetsData);
      setSyncStatus({ source: "google_sheets", error: null, lastSync: new Date().toISOString() });
    } catch (err) {
      setSyncStatus(prev => ({ ...prev, error: err.message }));
    }
    setLoading(false);
  }, []);

  const handleImport = useCallback(() => {
    try {
      const rows = importText.trim().split("\n").filter(r => r.trim());
      const parsed = rows.map(row => {
        const c = row.split("\t");
        return { date: c[0], day: c[1], exercise: c[2], set: parseInt(c[3]), reps: parseInt(c[4]), weight: parseFloat(c[5]), rpe: parseFloat(c[6]) || null, rir: parseFloat(c[7]) || null };
      }).filter(r => r.date && r.exercise && !isNaN(r.reps) && !isNaN(r.weight));
      if (parsed.length > 0) { setData(prev => [...prev, ...parsed]); setImportText(""); setShowImport(false); }
    } catch (e) { console.error("Import error", e); }
  }, [importText]);

  // ── Derived data ───────────────────────────────────────────────────────
  const sessions = useMemo(() => {
    const m = {};
    data.forEach(r => { if (!m[r.date]) m[r.date] = { date: r.date, day: r.day, sets: [] }; m[r.date].sets.push(r); });
    return Object.values(m).sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);

  const exerciseHistory = useMemo(() => {
    const h = {};
    data.forEach(r => { if (!h[r.exercise]) h[r.exercise] = []; h[r.exercise].push(r); });
    return h;
  }, [data]);

  const personalRecords = useMemo(() => {
    const p = {};
    Object.entries(exerciseHistory).forEach(([ex, sets]) => {
      p[ex] = { maxWeight: Math.max(...sets.map(s => s.weight)), maxE1RM: Math.max(...sets.map(s => e1rm(s.weight, s.reps))), maxVolume: Math.max(...sets.map(s => s.weight * s.reps)), bestDate: sets.reduce((b, s) => e1rm(s.weight, s.reps) > e1rm(b.weight, b.reps) ? s : b).date };
    });
    return p;
  }, [exerciseHistory]);

  const weeklyFreq = useMemo(() => {
    if (sessions.length < 2) return 0;
    const d = sessions.map(s => new Date(s.date));
    const span = (Math.max(...d) - Math.min(...d)) / (7 * 86400000);
    return span > 0 ? (sessions.length / span).toFixed(1) : sessions.length;
  }, [sessions]);

  const allExercises = useMemo(() => {
    const a = new Set();
    Object.values(PROGRAM).forEach(d => d.exercises.forEach(e => a.add(e.name)));
    return [...a];
  }, []);

  // ── Styles (white theme) ───────────────────────────────────────────────
  const S = {
    nav: { display: "flex", gap: 0, borderBottom: "1px solid #E8E6E3", background: "#fff", position: "sticky", top: 0, zIndex: 100 },
    navItem: (on) => ({
      padding: "14px 20px", fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
      color: on ? "#C8391E" : "#999", borderBottom: on ? "2px solid #C8391E" : "2px solid transparent",
      transition: "all 0.15s", fontFamily: "'JetBrains Mono', monospace", userSelect: "none",
    }),
    card: { background: "#fff", border: "1px solid #E8E6E3", borderRadius: 12, padding: 20 },
    metric: { fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", fontFamily: "'JetBrains Mono', monospace", color: "#1A1A1A" },
    label: { fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" },
    tag: (c) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: c + "14", color: c, letterSpacing: "0.04em", fontFamily: "'JetBrains Mono', monospace" }),
    btn: (on) => ({ padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: on ? "#C8391E" : "#F0EFED", color: on ? "#fff" : "#666", transition: "all 0.15s" }),
    page: { padding: 24, maxWidth: 920, margin: "0 auto" },
    divider: { borderBottom: "1px solid #F0EFED" },
  };

  // ── Sync banner ────────────────────────────────────────────────────────
  const SyncBanner = () => (
    <div style={{ padding: "10px 24px", background: syncStatus.source === "google_sheets" ? "#EDF8F5" : "#FFF8E6", borderBottom: "1px solid #E8E6E3", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
      <div>
        {syncStatus.source === "google_sheets" ? (
          <span style={{ color: "#1A8A6E" }}>● Connected to Google Sheets — {data.length} sets loaded</span>
        ) : (
          <span style={{ color: "#B8860B" }}>● Using sample data{syncStatus.error ? ` — ${syncStatus.error}` : ""}</span>
        )}
        {syncStatus.lastSync && <span style={{ color: "#999", marginLeft: 12 }}>Last sync: {new Date(syncStatus.lastSync).toLocaleTimeString()}</span>}
      </div>
      <button onClick={handleRefresh} disabled={loading} style={{ ...S.btn(false), padding: "6px 14px", fontSize: 12, opacity: loading ? 0.5 : 1 }}>
        {loading ? "Syncing…" : "⟳ Refresh"}
      </button>
    </div>
  );

  // ── DASHBOARD ──────────────────────────────────────────────────────────
  const Dashboard = () => {
    const totalVol = data.reduce((s, r) => s + r.weight * r.reps, 0);
    const lastSess = sessions[0];
    const daysSince = lastSess ? Math.floor((new Date() - new Date(lastSess.date)) / 86400000) : "—";
    return (
      <div style={S.page}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.02em", color: "#1A1A1A" }}>Hypertrophy Tracker</h1>
          <p style={{ color: "#999", fontSize: 14, margin: "4px 0 0" }}>Full Body 3× — Squat / Hinge / Unilateral</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Sessions", value: sessions.length, sub: `${weeklyFreq}×/wk` },
            { label: "Total Sets", value: data.length, sub: "working sets" },
            { label: "Volume", value: `${(totalVol / 1000).toFixed(1)}t`, sub: "total tonnage" },
            { label: "Days Since", value: daysSince, sub: typeof daysSince === "number" && daysSince > 4 ? "⚠ too long" : "last session" },
          ].map((m, i) => (
            <div key={i} style={S.card}>
              <div style={S.label}>{m.label}</div>
              <div style={{ ...S.metric, color: i === 3 && daysSince > 4 ? "#C8391E" : "#1A1A1A" }}>{m.value}</div>
              <div style={{ fontSize: 11, color: i === 3 && daysSince > 4 ? "#C8391E" : "#999", marginTop: 2 }}>{m.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ ...S.card, marginBottom: 24 }}>
          <div style={S.label}>Training Frequency</div>
          <div style={{ marginTop: 12 }}><Heatmap sessions={data} /></div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#999" }}>Less</span>
            {["#F0EFED", "#C6E48B", "#7BC96F", "#239A3B"].map((c, i) => <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />)}
            <span style={{ fontSize: 11, color: "#999" }}>More</span>
          </div>
        </div>
        <div style={{ ...S.card, marginBottom: 24 }}>
          <div style={S.label}>Progression Status</div>
          <div style={{ marginTop: 12 }}>
            {allExercises.map(exName => {
              const cfg = Object.values(PROGRAM).flatMap(d => d.exercises).find(e => e.name === exName);
              const hist = exerciseHistory[exName] || [];
              const lastD = hist.length ? [...new Set(hist.map(h => h.date))].sort().pop() : null;
              const lastS = lastD ? hist.filter(h => h.date === lastD) : [];
              const prog = getProgression(cfg, lastS);
              const trend = [...new Set(hist.map(h => h.date))].sort().map(d => Math.max(...hist.filter(h => h.date === d).map(s => e1rm(s.weight, s.reps))));
              return (
                <div key={exName} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", ...S.divider, cursor: "pointer" }}
                  onClick={() => { setSelectedExercise(exName); setView("progress"); }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>{exName}</div>
                    <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{prog.message}</div>
                  </div>
                  <div style={{ width: 80, textAlign: "right" }}>
                    {prog.status === "ready" ? <span style={S.tag("#1A8A6E")}>READY ↑</span>
                      : prog.status === "building" ? <span style={S.tag("#B8860B")}>BUILDING</span>
                      : <span style={S.tag("#999")}>NO DATA</span>}
                  </div>
                  <Sparkline data={trend} color={prog.status === "ready" ? "#1A8A6E" : "#C8391E"} />
                </div>
              );
            })}
          </div>
        </div>
        <div style={S.card}>
          <div style={S.label}>Recent Sessions</div>
          {sessions.slice(0, 5).map((sess, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", ...(i < 4 ? S.divider : {}) }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: PROGRAM[sess.day]?.colorLight || "#F0EFED", color: PROGRAM[sess.day]?.color || "#999", fontWeight: 700, fontSize: 14, fontFamily: "'JetBrains Mono', monospace" }}>{sess.day}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#1A1A1A" }}>{new Date(sess.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</div>
                <div style={{ fontSize: 12, color: "#999" }}>{sess.sets.length} sets · {[...new Set(sess.sets.map(s => s.exercise))].length} exercises · {(sess.sets.reduce((s, r) => s + r.weight * r.reps, 0) / 1000).toFixed(1)}t</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── PROGRAM VIEW ─────────────────────────────────────────────────────────
  const ProgramView = () => (
    <div style={S.page}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: "#1A1A1A" }}>3-Day Full Body Split</h2>
      <p style={{ color: "#999", fontSize: 14, lineHeight: 1.7, marginBottom: 24, maxWidth: 620 }}>
        Each session: 1 lower compound + 1 upper push + 1 upper pull + 1–2 accessories.
        Train Mon / Wed / Fri or any 3 non-consecutive days, avoiding the day before hard grappling.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {Object.entries(PROGRAM).map(([k, d]) => (
          <button key={k} onClick={() => setSelectedDay(k)} style={{ ...S.btn(selectedDay === k), background: selectedDay === k ? d.color : "#F0EFED" }}>
            {d.tag} — {d.name.split("—")[1]?.trim()}
          </button>
        ))}
      </div>
      <div style={S.card}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: PROGRAM[selectedDay].color }}>{PROGRAM[selectedDay].name}</h3>
        <div style={{ fontSize: 12, color: "#999", marginBottom: 20 }}>~55–60 min · {PROGRAM[selectedDay].exercises.length} exercises · {PROGRAM[selectedDay].exercises.reduce((s, e) => s + e.sets, 0)} total sets</div>
        {PROGRAM[selectedDay].exercises.map((ex, i) => {
          const hist = exerciseHistory[ex.name] || [];
          const lastD = hist.length ? [...new Set(hist.map(h => h.date))].sort().pop() : null;
          const lastS = lastD ? hist.filter(h => h.date === lastD) : [];
          const prog = getProgression(ex, lastS);
          return (
            <div key={i} style={{ padding: 16, marginBottom: 8, borderRadius: 10, background: "#FAFAF9", border: "1px solid #F0EFED" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A" }}>{i + 1}. {ex.name}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <span style={S.tag(ex.type === "Compound" ? "#1A6BB5" : "#7B5EA7")}>{ex.type}</span>
                    <span style={S.tag("#999")}>{ex.method}</span>
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#1A1A1A" }}>{ex.sets}×{ex.repRange}</div>
              </div>
              {prog.status !== "no_data" && (
                <div style={{ padding: "8px 12px", borderRadius: 6, marginTop: 8, background: prog.status === "ready" ? "#EDF8F5" : "#FFF8E6", border: `1px solid ${prog.status === "ready" ? "#C5E8DE" : "#F0E6C0"}` }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: prog.status === "ready" ? "#1A8A6E" : "#B8860B" }}>{prog.status === "ready" ? "▲ Ready to progress" : "◆ Building"}</div>
                  <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{prog.message}</div>
                  {prog.targetWeight > 0 && <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, fontFamily: "'JetBrains Mono', monospace", color: "#1A1A1A" }}>Target: {prog.targetWeight.toFixed(1)} kg × {prog.targetReps}</div>}
                </div>
              )}
              {lastS.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#999" }}>Last ({lastD}):</span>
                  {lastS.map((s, j) => <span key={j} style={{ fontSize: 12, color: "#666", fontFamily: "'JetBrains Mono', monospace" }}>{s.reps}×{s.weight}kg</span>)}
                </div>
              )}
            </div>
          );
        })}
        <div style={{ marginTop: 20, padding: 16, borderRadius: 8, background: "#FAFAF9", border: "1px dashed #E8E6E3" }}>
          <div style={{ ...S.label, marginBottom: 10 }}>Progression Methods</div>
          <div style={{ fontSize: 13, color: "#666", lineHeight: 1.8 }}>
            <strong style={{ color: "#1A1A1A" }}>Linear</strong> (barbell/machine): Hit top of rep range for all sets → increase weight 2.5% (compound) or 5% (isolation)<br />
            <strong style={{ color: "#1A1A1A" }}>Double</strong> (dumbbell): Build from 10→15 reps at current weight → jump +2 kg → restart at 6–8 reps
          </div>
        </div>
      </div>
    </div>
  );

  // ── LOG VIEW ─────────────────────────────────────────────────────────────
  const LogView = () => (
    <div style={S.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#1A1A1A" }}>Training Log</h2>
        <button style={S.btn(true)} onClick={() => setShowImport(!showImport)}>{showImport ? "Cancel" : "+ Import Data"}</button>
      </div>
      {showImport && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={S.label}>Paste tab-separated data</div>
          <p style={{ fontSize: 12, color: "#999", margin: "8px 0" }}>Format: date → day(A/B/C) → exercise → set# → reps → weight → RPE → RIR</p>
          <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder={"2026-04-21\tA\tBarbell Back Squat\t1\t8\t50\t3\t2"}
            style={{ width: "100%", minHeight: 100, padding: 12, borderRadius: 8, background: "#FAFAF9", border: "1px solid #E8E6E3", color: "#1A1A1A", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", resize: "vertical", boxSizing: "border-box" }} />
          <button style={{ ...S.btn(true), marginTop: 10 }} onClick={handleImport}>Import {importText.split("\n").filter(r => r.trim()).length} rows</button>
        </div>
      )}
      {sessions.map((sess, i) => (
        <div key={i} style={{ ...S.card, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: PROGRAM[sess.day]?.colorLight || "#F0EFED", color: PROGRAM[sess.day]?.color || "#999", fontWeight: 700, fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{sess.day}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>{new Date(sess.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
                <div style={{ fontSize: 12, color: "#999" }}>{PROGRAM[sess.day]?.name || sess.day}</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#1A1A1A" }}>{(sess.sets.reduce((s, r) => s + r.weight * r.reps, 0) / 1000).toFixed(1)}t</div>
              <div style={{ fontSize: 11, color: "#999" }}>{sess.sets.length} sets</div>
            </div>
          </div>
          {[...new Set(sess.sets.map(s => s.exercise))].map(exName => (
            <div key={exName} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#666", marginBottom: 4 }}>{exName}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {sess.sets.filter(s => s.exercise === exName).map((s, j) => (
                  <div key={j} style={{ padding: "6px 12px", borderRadius: 6, background: "#FAFAF9", border: "1px solid #F0EFED", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
                    <span style={{ fontWeight: 700 }}>{s.reps}</span><span style={{ color: "#999" }}>×</span><span>{s.weight}</span><span style={{ color: "#999" }}>kg</span>
                    {s.rpe && <span style={{ color: "#C8391E", marginLeft: 6, fontSize: 11 }}>RPE {s.rpe}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  // ── PROGRESS VIEW ────────────────────────────────────────────────────────
  const ProgressView = () => {
    const ex = selectedExercise || allExercises[0];
    const hist = exerciseHistory[ex] || [];
    const dates = [...new Set(hist.map(h => h.date))].sort();
    const chartData = dates.map(d => {
      const s = hist.filter(h => h.date === d);
      return { date: d, maxWeight: Math.max(...s.map(x => x.weight)), avgReps: (s.reduce((a, x) => a + x.reps, 0) / s.length).toFixed(1), e1rm: Math.max(...s.map(x => e1rm(x.weight, x.reps))), volume: s.reduce((a, x) => a + x.weight * x.reps, 0), sets: s.length };
    });
    const maxE = chartData.length ? Math.max(...chartData.map(d => d.e1rm)) : 0;
    const minE = chartData.length ? Math.min(...chartData.map(d => d.e1rm)) * 0.9 : 0;
    const cH = 180, cW = 500;
    return (
      <div style={S.page}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: "#1A1A1A" }}>Exercise Progress</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {allExercises.map(n => <button key={n} onClick={() => setSelectedExercise(n)} style={{ ...S.btn(ex === n), fontSize: 12, padding: "6px 14px" }}>{n}</button>)}
        </div>
        {chartData.length > 0 ? (
          <>
            <div style={S.card}>
              <div style={S.label}>Estimated 1RM Progression</div>
              <svg viewBox={`0 0 ${cW + 60} ${cH + 40}`} style={{ width: "100%", maxHeight: 240, marginTop: 12 }}>
                {[0, 0.25, 0.5, 0.75, 1].map(p => {
                  const y = cH - p * cH, v = (minE + p * (maxE - minE)).toFixed(0);
                  return <g key={p}><line x1={50} y1={y} x2={cW + 50} y2={y} stroke="#F0EFED" strokeWidth="1" /><text x={45} y={y + 4} fill="#999" fontSize="10" textAnchor="end" fontFamily="'JetBrains Mono', monospace">{v}</text></g>;
                })}
                <polyline points={chartData.map((d, i) => { const x = 50 + (i / Math.max(chartData.length - 1, 1)) * cW, y = cH - ((d.e1rm - minE) / (maxE - minE || 1)) * cH; return `${x},${y}`; }).join(" ")} fill="none" stroke="#C8391E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {chartData.map((d, i) => { const x = 50 + (i / Math.max(chartData.length - 1, 1)) * cW, y = cH - ((d.e1rm - minE) / (maxE - minE || 1)) * cH; return <circle key={i} cx={x} cy={y} r="4" fill="#C8391E" stroke="#fff" strokeWidth="2" />; })}
                {chartData.map((d, i) => { if (chartData.length > 6 && i % 2 !== 0) return null; const x = 50 + (i / Math.max(chartData.length - 1, 1)) * cW; return <text key={i} x={x} y={cH + 20} fill="#999" fontSize="9" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">{d.date.slice(5)}</text>; })}
              </svg>
            </div>
            <div style={{ ...S.card, marginTop: 12 }}>
              <div style={S.label}>Session Breakdown</div>
              <div style={{ overflowX: "auto", marginTop: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr style={S.divider}>{["Date", "Sets", "Best Set", "Avg Reps", "e1RM", "Volume"].map(h => <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#999", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>)}</tr></thead>
                  <tbody>{chartData.map((d, i) => <tr key={i} style={{ borderBottom: "1px solid #F0EFED" }}><td style={{ padding: "8px 12px", fontFamily: "'JetBrains Mono', monospace" }}>{d.date}</td><td style={{ padding: "8px 12px" }}>{d.sets}</td><td style={{ padding: "8px 12px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{d.maxWeight}kg</td><td style={{ padding: "8px 12px" }}>{d.avgReps}</td><td style={{ padding: "8px 12px", fontFamily: "'JetBrains Mono', monospace", color: "#C8391E" }}>{d.e1rm.toFixed(1)}</td><td style={{ padding: "8px 12px" }}>{d.volume}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
            {personalRecords[ex] && (
              <div style={{ ...S.card, marginTop: 12, background: "#FEF2F0", border: "1px solid #F5D5D0" }}>
                <div style={S.label}>Personal Records — {ex}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 12 }}>
                  <div><div style={{ fontSize: 11, color: "#999" }}>Max Weight</div><div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{personalRecords[ex].maxWeight} kg</div></div>
                  <div><div style={{ fontSize: 11, color: "#999" }}>Best e1RM</div><div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#C8391E" }}>{personalRecords[ex].maxE1RM.toFixed(1)} kg</div></div>
                  <div><div style={{ fontSize: 11, color: "#999" }}>Best Volume (set)</div><div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{personalRecords[ex].maxVolume}</div></div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ ...S.card, textAlign: "center", padding: 60, color: "#999" }}>No data yet for {ex}. Start logging your sets!</div>
        )}
      </div>
    );
  };

  // ── NUTRITION VIEW ───────────────────────────────────────────────────────
  const NutritionView = () => {
    const meals = [
      { name: "Desayuno yogurt", kcal: 397, protein: 41, freq: "Diario", emoji: "🥣" },
      { name: "Pollo al curry", kcal: 1417, protein: 95, freq: "1×/semana", emoji: "🍛" },
      { name: "Pollo con tomate", kcal: 1005, protein: 87, freq: "1×/semana", emoji: "🍗" },
      { name: "Burrito post-grappling", kcal: 795, protein: 36, freq: "2×/semana", emoji: "🌯" },
      { name: "Ensalada griega", kcal: 271, protein: 14, freq: "2×/semana", emoji: "🥗" },
      { name: "Ensalada aguacate", kcal: 285, protein: 18, freq: "2×/semana", emoji: "🥑" },
      { name: "Hamburguesa", kcal: 2027, protein: 126, freq: "Ocasional", emoji: "🍔" },
      { name: "Pan + Jamón serrano", kcal: 310, protein: 35, freq: "Cena frecuente", emoji: "🥖" },
    ];
    const days = [
      { name: "Pollo curry day", meals: ["Desayuno yogurt", "Pollo al curry", "Ensalada griega", "Pan + Jamón serrano"], total: { kcal: 2395, protein: 185 } },
      { name: "Pisto day (LOW ⚠)", meals: ["Desayuno yogurt", "Pisto + huevos (~25g P)", "Ensalada aguacate"], total: { kcal: 1350, protein: 84 } },
      { name: "Grappling day", meals: ["Desayuno yogurt", "Comida variable", "Burrito post-grappling"], total: { kcal: 1900, protein: 110 } },
    ];
    return (
      <div style={S.page}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#1A1A1A" }}>Nutrition Tracking</h2>
        <p style={{ color: "#999", fontSize: 14, marginBottom: 24 }}>Targets: {BODY_PARAMS.proteinTarget}g protein/day (2g/kg) · {BODY_PARAMS.calorieTarget} kcal/day for lean bulk</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
          <div style={S.card}>
            <div style={S.label}>Daily Protein Target</div>
            <div style={S.metric}>{BODY_PARAMS.proteinTarget}g</div>
            <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>2.0 g/kg × {BODY_PARAMS.weight} kg</div>
            <Bar value={130} max={143} color="#1A8A6E" h={4} />
            <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>Range: 104–143g (1.6–2.2 g/kg)</div>
          </div>
          <div style={S.card}>
            <div style={S.label}>Daily Calorie Target</div>
            <div style={S.metric}>{BODY_PARAMS.calorieTarget}</div>
            <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>Lean bulk surplus (~300 kcal)</div>
            <Bar value={2300} max={2600} color="#B8860B" h={4} />
            <div style={{ fontSize: 11, color: "#C8391E", marginTop: 4 }}>⚠ Many days below 2000 kcal</div>
          </div>
        </div>
        <div style={{ ...S.card, marginBottom: 24 }}>
          <div style={S.label}>Your Meal Database</div>
          {meals.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", ...(i < meals.length - 1 ? S.divider : {}) }}>
              <div style={{ fontSize: 24, width: 36, textAlign: "center" }}>{m.emoji}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 500, color: "#1A1A1A" }}>{m.name}</div><div style={{ fontSize: 12, color: "#999" }}>{m.freq}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{m.protein}g P</div><div style={{ fontSize: 12, color: "#999" }}>{m.kcal} kcal</div></div>
              <div style={{ width: 60 }}><Bar value={m.protein} max={100} color={m.protein >= 40 ? "#1A8A6E" : m.protein >= 25 ? "#B8860B" : "#C8391E"} /></div>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <div style={S.label}>Typical Day Analysis</div>
          {days.map((day, i) => {
            const pOk = day.total.protein >= BODY_PARAMS.proteinTarget, cOk = day.total.kcal >= BODY_PARAMS.calorieTarget;
            return (
              <div key={i} style={{ padding: 14, marginTop: i > 0 ? 8 : 12, borderRadius: 8, background: pOk && cOk ? "#EDF8F5" : "#FEF2F0", border: `1px solid ${pOk && cOk ? "#C5E8DE" : "#F5D5D0"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>{day.name}</div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14, color: pOk ? "#1A8A6E" : "#C8391E" }}>{day.total.protein}g P {pOk ? "✓" : "✗"}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14, color: cOk ? "#1A8A6E" : "#C8391E" }}>{day.total.kcal} kcal {cOk ? "✓" : "✗"}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>{day.meals.join(" → ")}</div>
                {!pOk && <div style={{ fontSize: 12, color: "#C8391E", marginTop: 6 }}>💡 Add {BODY_PARAMS.proteinTarget - day.total.protein}g protein: e.g. 1 scoop whey (25g) + 100g chicken (30g)</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── RENDER ─────────────────────────────────────────────────────────────
  if (loading && !data.length) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "'JetBrains Mono', monospace", color: "#999" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
          <div>Loading training data…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9" }}>
      <SyncBanner />
      <nav style={S.nav}>
        {["dashboard", "program", "log", "progress", "nutrition"].map(v => (
          <div key={v} style={S.navItem(view === v)} onClick={() => setView(v)}>
            {v === "dashboard" ? "⊞" : v === "program" ? "◎" : v === "log" ? "≡" : v === "progress" ? "↗" : "◇"} {v}
          </div>
        ))}
      </nav>
      {view === "dashboard" && <Dashboard />}
      {view === "program" && <ProgramView />}
      {view === "log" && <LogView />}
      {view === "progress" && <ProgressView />}
      {view === "nutrition" && <NutritionView />}
    </div>
  );
}
