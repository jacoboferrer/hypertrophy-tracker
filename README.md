# Hypertrophy Tracker

A session-counted mesocycle tracker for the 2026–27 course. Pulls logged sets
from a Google Form → Sheet, prescribes what to do today, and keeps the rotation
honest.

## Setup

```bash
npm install
cp .env.example .env.local     # fill in your Sheet ID and API key
npm run dev
```

`.env.local` is git-ignored. Nothing secret belongs in `src/`.

| Variable | What it is |
| --- | --- |
| `VITE_SHEETS_ID` | The ID in your Sheet URL: `docs.google.com/spreadsheets/d/**THIS**/edit` |
| `VITE_SHEETS_API_KEY` | Google Cloud API key with the Sheets API enabled |
| `VITE_SHEETS_TAB` | Tab name holding form responses |

The Sheet must be shared as **Anyone with the link → Viewer**.

> **A key in a client bundle is readable by anyone who loads the page.** Secrecy
> is not the control — restriction is. In the Google Cloud console, restrict the
> key to the Sheets API and to your GitHub Pages referrer.

```bash
npm test             # logic checks against the log, then renders every view
npm run test:refresh # same, but re-fetch the sheet first
npm run build
npm run deploy       # GitHub Pages
```

### Why the tests don't need the network

A referrer-restricted key rejects Node — it sends no `Referer` header, and
Google answers `Requests from referer <empty> are blocked`. Two things handle
that. The scripts declare `TEST_REFERER` (an origin allowed on the key) when
they fetch, and the first successful fetch is cached to
`scripts/.fixture.json`, which is git-ignored. Every later run reads the cache
and touches no network at all, so the suite works on a plane and survives key
rotation. Use `npm run test:refresh` after logging new sessions.

If the fetch fails and a cache exists, the scripts warn and carry on. If
neither works, they stop with an explanation rather than testing nothing.

## How it works

**Blocks are counted in sessions, not weeks.** A mesocycle is thirteen sessions
— four A–B–C rotations plus a deload. Week-based blocks break the first time
life takes a fortnight, and this log lost a fortnight in February, a month in
April and two months to summer. A session-counted block can only be delayed.

Position in the plan is derived entirely from logged sessions on or after
`PROGRAM_START`, so there is no state to keep in sync. See `src/mesocycles.js`.

**The rotation is strictly ordered.** The Today screen reads the last logged
letter and shows the next one; it never offers a choice. In the best six weeks
of the previous log, Day A ran seven times and Day C once.

**Progression is double progression on every working set.** Load rises only
when all sets reach the top of the rep range, and it comes from the top set,
rounded to a real increment — 2.5 kg on a barbell, 2 kg on a dumbbell pair.
Rotation 1 of each block opens one increment below the last block's finish.

**Sets logged on the phone land in `localStorage` first** and merge with the
Sheets pull on read, so a dead signal in the gym costs nothing. A service worker
caches the app shell for the same reason.

## Layout

```
src/
  config.js        Sheets env, the A/B/C program, body params
  exercises.js     alias map, muscle attribution, loadable increments
  mesocycles.js    block definitions and the session-counted state machine
  progression.js   what to lift today, given the block position
  analysis.js      sessions, volume, weekly load, trends
  store.js         local-first log: sets, grappling, bodyweight
  sheets.js        Google Sheets pull and row parsing
  ui.jsx           charts and shared primitives
  views/           Today · Plan · Log · Progress · Body
scripts/
  verify.mjs       logic checks against the real log
  smoke.mjs        server-renders every view, real data and empty
```

`exercises.js` is the file to edit when the form gains a new movement — add the
spelling to `ALIASES` and the attribution to `EXERCISE_META`, or its history
will fragment and its volume will go uncounted.

## Form columns

The parser reads the response sheet positionally, so column order matters:

| Col | Field |
| --- | --- |
| 0 | Timestamp (`D/MM/YYYY` — parsed before the native `Date`, which reads `1/06` as 6 January) |
| 1 | Routine → day letter |
| 2–8 | Legacy exercise columns |
| 9 | Working set number, or `Warmup` (skipped) |
| 10–11 | Reps, weight (kg) |
| 13–14 | RPE, RIR |
| 19 | Body weight |
| 24–26 | Full Body A/B/C exercise columns (take priority) |
