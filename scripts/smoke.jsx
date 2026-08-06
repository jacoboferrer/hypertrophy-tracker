// Renders every view with the real training log to catch runtime errors the
// build cannot see. Bundled through esbuild by scripts/smoke.mjs.

import { renderToString } from 'react-dom/server';
import { nextDayAfter } from '../src/config.js';
import { mesocycleState } from '../src/mesocycles.js';
import { toSessions, byExercise, weeklyLoad } from '../src/analysis.js';
import Today from '../src/views/Today.jsx';
import PlanView from '../src/views/PlanView.jsx';
import LogView from '../src/views/LogView.jsx';
import ProgressView from '../src/views/ProgressView.jsx';
import BodyView from '../src/views/BodyView.jsx';

export function run(rows, grappling, bodyweight) {
  const sessions = toSessions(rows);
  const history = byExercise(rows);
  const iso = new Date().toISOString().slice(0, 10);
  const completed = sessions.map((s) => s.date).filter((d) => d < iso);
  const meso = mesocycleState(completed);
  const previous = sessions.find((s) => s.date < iso);
  const day = previous ? nextDayAfter(previous.day) : 'A';
  const loadWeeks = weeklyLoad(sessions, grappling, 12);
  const noop = () => {};

  const cases = {
    Today: <Today meso={meso} day={day} history={history} data={rows}
      grappling={grappling} lastSessionDate={previous?.date || null} onToast={noop} />,
    Plan: <PlanView meso={{ ...meso, currentDay: day }} history={history} />,
    Log: <LogView sessions={sessions} data={rows} weeklyLoadData={loadWeeks} onToast={noop} />,
    Progress: <ProgressView history={history} sessions={sessions} selected={null} onSelect={noop} />,
    Body: <BodyView bodyweight={bodyweight} grappling={grappling} onToast={noop} />,
  };

  const results = {};
  for (const [name, element] of Object.entries(cases)) {
    results[name] = renderToString(element).length;
  }
  return { results, meso, day, sessions: sessions.length };
}

// Empty-state pass: a brand new install with nothing logged at all.
export function runEmpty() {
  return run([], [], []);
}
