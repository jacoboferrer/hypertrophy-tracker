# Making changes and getting them live

The loop is: **edit → test → commit → push**. Pushing to `main` triggers a
GitHub Actions build that deploys to
<https://jacoboferrer.github.io/hypertrophy-tracker/>. There is no manual
deploy step.

```bash
cd ~/Dropbox/entrenamiento/strength-workout/hypertrophy-tracker
npm run dev          # http://localhost:5173/hypertrophy-tracker/
```

> The dev URL **must** include `/hypertrophy-tracker/`. `vite.config.js` sets
> `base` for GitHub Pages, so the bare root 404s.

Make the change, check it in the browser, then:

```bash
npm test             # 50 logic checks + renders every view
git add -A
git commit -m "Short summary of what changed"
git push origin main
```

Wait about two minutes, then **hard-reload the live page** — ⌘⇧R. A normal
reload can serve the old bundle from the service worker cache.

### Confirm the deploy landed

```bash
# Did the run succeed?
curl -s "https://api.github.com/repos/jacoboferrer/hypertrophy-tracker/actions/runs?per_page=1" \
  | python3 -c "import json,sys; r=json.load(sys.stdin,strict=False)['workflow_runs'][0]; print(r['head_sha'][:7], r['status'], r['conclusion'])"

# Is the change actually in the served bundle?
curl -s https://jacoboferrer.github.io/hypertrophy-tracker/ -o /tmp/l.html
JS=$(grep -oE '/hypertrophy-tracker/assets/index-[A-Za-z0-9_-]+\.js' /tmp/l.html | head -1)
curl -s "https://jacoboferrer.github.io$JS" | grep -c "some text you just added"
```

Or just look at the [Actions tab](https://github.com/jacoboferrer/hypertrophy-tracker/actions).

---

## Always run the tests

`npm test` catches things the build cannot. Vite compiles modules without
executing them, so a crash on import — a temporal-dead-zone error, a bad
import path — builds perfectly and dies in the browser. That has happened
here. `npm run smoke` server-renders every view against your real log **and**
against an empty store, which is how a broken empty state gets caught.

Tests read a cached copy of the Sheet (`scripts/.fixture.json`, git-ignored),
so they need no network. After logging real sessions:

```bash
npm run test:refresh   # re-fetch the Sheet, then test
```

If a fetch fails and a cache exists, the scripts warn and carry on.

---

## Common changes

### Change the program — sets, reps, exercises

`src/config.js` → `PROGRAM`. Each exercise:

```js
{ name: 'Barbell Back Squat', type: 'Compound', sets: 3, repRange: '6-8', restart: 50 }
```

- `type` — `Compound` exercises get the rep-range shift in intensification blocks
- `sets` — the base for rotation 1; the block ramp adds on top
- `restart` — opening load for M1 only
- `optional: true` — renders as "if time", excluded from the core set count

### Add a new exercise

Two files, and **both** are required:

1. `src/config.js` — add it to a day in `PROGRAM`
2. `src/exercises.js` — add it to `EXERCISE_META` with an `increment` and
   `muscles`, and add every spelling to `ALIASES`

Skip step 2 and it silently defaults to a 2.5 kg increment and **counts toward
no muscle at all** in the volume chart. This is exactly how the original log
ended up with five alias pairs splitting its own history.

```js
// exercises.js
'Pendlay Row': { increment: 2.5, muscles: { back: 1, biceps: 0.5, rearDelts: 0.5 } },
// and in ALIASES
'pendlay row': 'Pendlay Row',
```

### Change the blocks or the calendar

`src/mesocycles.js` — `PROGRAM_START` and `BLOCKS`. Block `window` strings are
labels only; position is derived from logged sessions, so changing a window
changes nothing but the text.

Changing `PROGRAM_START` **re-dates the whole plan**: sessions before it don't
count toward any block.

> If you reorder `BLOCKS`, check `scripts/verify.mjs` — look up blocks by id
> (`byId.M2`), never by index. Positional indexing broke silently when a hold
> block became an intensification one.

### Change intensity or volume progression

`src/mesocycles.js`:

- `RIR_BY_ROTATION` — the `[3, 2, 1.5, 0.5]` ramp
- `setBonus()` — which lift earns an extra set, and when
- `rotationSpec()` — deload behaviour (60% load, halved sets, RIR 5)

`src/progression.js` holds the load rules: top-set-not-average, all-sets-at-top
before adding load, block restarts, and the 21-day `DETRAINING_DAYS` threshold
for the re-entry discount.

### Change the Apps Script (the write endpoint)

Editing `apps-script/Code.gs` in the repo changes **nothing** by itself — it is
a reference copy. To actually change the endpoint:

1. Open the Sheet → **Extensions → Apps Script**
2. Click in the code, **⌘A** (the whole file must highlight), **⌘V**
3. **Check line 1 is `/**`**, not `function myFunction() {`
4. Re-set `SHARED_TOKEN` on line 21 if you replaced the whole file
5. **⌘S**
6. **Implementar → Gestionar implementaciones → ✏️ → Versión: Versión nueva → Implementar**

Two traps, both of which cost time the first go:

- **Pasting inside the stub.** If the code lands inside
  `function myFunction() { … }`, `doGet` and `doPost` are nested rather than
  top level, and the URL returns *"Función de script no encontrada: doGet"*.
  The function dropdown next to ▷ Ejecutar should list
  `book, sheetFor, existingIds, reply, doPost, doGet`.
- **Editing does not redeploy.** A deployment is a frozen snapshot. Use
  **Manage deployments → edit → New version** to keep the same URL;
  **New deployment** mints a different one and you would have to update
  `VITE_SYNC_URL` everywhere.

Confirm by opening the `/exec` URL in a browser — it should return JSON with a
row count per tab.

Adding a **new record type** means changing `TABS` in the script *and*
`APP_TABS` in `src/config.js`, `TYPES` in `src/sync.js`, and the read path in
`src/sheets.js`. Keep the column order identical on both sides.

### Add or change an environment variable

Three places, or it works locally and breaks in production:

1. `.env.local` — for `npm run dev`
2. `.env.example` — so a future clone knows it exists
3. `.github/workflows/deploy.yml` — under the `npm run build` step's `env:`,
   reading from `secrets.*`, plus the secret itself at
   [Settings → Secrets → Actions](https://github.com/jacoboferrer/hypertrophy-tracker/settings/secrets/actions)

Vite only exposes variables prefixed `VITE_` to the browser. It reads env files
**at startup**, so restart the dev server after editing `.env.local`.

---

## Rotating the Google API key

Create the replacement before deleting the old one, so the app is never down.

1. [console.cloud.google.com](https://console.cloud.google.com) → **APIs &
   Services → Credentials → + Create credentials → API key**
2. Edit it: **Application restrictions → Websites**, adding
   `https://jacoboferrer.github.io/*` and `http://localhost:5173/*`;
   **API restrictions → Restrict key → Google Sheets API**
3. Update `VITE_SHEETS_API_KEY` in `.env.local` **and** the GitHub secret
4. Restart dev, confirm the banner reads *Saved to the Sheet*
5. Delete the old key, then push to redeploy

The key is visible in the public bundle by design — restriction is the control,
not secrecy. Rotating makes any copy in git history inert, so there is no need
to rewrite history.

**The referrer restriction blocks Node**, which sends no `Referer` header. The
test scripts declare `TEST_REFERER` from `.env.local` to get around it; keep
that value matching one of the key's allowed origins.

---

## When something breaks

| Symptom | Cause | Fix |
| --- | --- | --- |
| Live page unchanged after a push | Service worker cache | ⌘⇧R, or DevTools → Application → Service Workers → Unregister |
| Build fails: `VITE_SHEETS_API_KEY is missing` | GitHub secret absent | Add it in repo settings |
| Banner: *Offline — N sets on this device* | Key expired, or referrer not allowed | Check the key in Google Cloud |
| Banner: *Sync token rejected* | `VITE_SYNC_TOKEN` ≠ `SHARED_TOKEN` | Make them match, redeploy the script |
| *Función de script no encontrada: doGet* | Code pasted inside the stub, or not redeployed | See "Change the Apps Script" |
| `npm run build` → `MODULE_NOT_FOUND` rollup | Wrong-arch binary in `node_modules` | `rm -rf node_modules && npm install` |
| Records stuck at *N waiting to save* | Endpoint unreachable | Open the `/exec` URL; check `VITE_SYNC_URL` |
| Push rejected, `Permission denied (publickey)` | SSH key missing on this machine | See `docs/SETUP.md` |
| Vite restarting in a loop | Dropbox syncing the folder | Harmless; or `xattr -w com.dropbox.ignored 1 node_modules` |

---

## Things worth not breaking

- **Never commit `.env.local`.** `.gitignore` covers `.env*` except
  `.env.example`. Before committing anything credential-adjacent:
  `git diff --cached | grep -E "^\+" | grep -E "AIzaSy|github_pat_"`
- **The Form response tab is read-only.** Everything the app writes goes to the
  tabs it owns. Don't point the writer at `Respuestas de formulario 1`.
- **Records are deduplicated by UUID.** Keep sending the id, or retries will
  double-write.
- **Sessions before `PROGRAM_START` don't advance blocks** — deliberate, so
  informal training doesn't consume a mesocycle.
