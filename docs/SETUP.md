# Setting up on a new computer

From nothing to a working local copy that can also deploy. Allow about 30
minutes the first time.

Nothing secret lives in this repository, so a fresh clone will **not** run
until you supply four values. Step 3 says where each one comes from — all four
are recoverable from your own Google and GitHub accounts; none needs to be
copied off the old machine.

---

## 1. Prerequisites

```bash
node --version    # need 20 or newer
git --version
```

No Node? Install from [nodejs.org](https://nodejs.org) or `brew install node`.

---

## 2. Get the code

### Set up SSH first

Skip this only if `ssh -T git@github.com` already greets you by name.

```bash
ssh-keygen -t ed25519 -C "jacobo.ferrer.hernandez@gmail.com"
```

Press Enter for the default path. Passphrase optional — if you set one, run
`ssh-add --apple-use-keychain ~/.ssh/id_ed25519` so macOS remembers it.

```bash
pbcopy < ~/.ssh/id_ed25519.pub    # nothing prints; it is on the clipboard
```

Paste at [github.com/settings/ssh/new](https://github.com/settings/ssh/new),
title it after the machine, **Add SSH key**. Then:

```bash
ssh -T git@github.com
```

Expect *"Hi jacoboferrer! You've successfully authenticated, but GitHub does not
provide shell access."* — the "but no shell access" half **is** the success
message. On the first connection it asks you to trust the host; the genuine
GitHub ED25519 fingerprint is
`SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`.

> Do not use a personal access token stored in a file. Git's `store` credential
> helper writes tokens to `~/.git-credentials` in plain text.

### Clone and install

```bash
git clone git@github.com:jacoboferrer/hypertrophy-tracker.git
cd hypertrophy-tracker
npm install
```

---

## 3. Create `.env.local`

```bash
cp .env.example .env.local
```

It is git-ignored. Fill in these six values:

```
VITE_SHEETS_ID=...
VITE_SHEETS_API_KEY=...
VITE_SHEETS_TAB=Respuestas de formulario 1
VITE_SYNC_URL=...
VITE_SYNC_TOKEN=...
TEST_REFERER=http://localhost:5173/
```

| Variable | Where to get it |
| --- | --- |
| `VITE_SHEETS_ID` | Open the Sheet. It is the part of the URL between `/d/` and `/edit`. |
| `VITE_SHEETS_API_KEY` | [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials. Click the key → **Show key**. |
| `VITE_SHEETS_TAB` | The tab holding form responses. Currently `Respuestas de formulario 1`. |
| `VITE_SYNC_URL` | Sheet → Extensions → Apps Script → **Implementar → Gestionar implementaciones**. The URL ending `/exec`. |
| `VITE_SYNC_TOKEN` | Line 21 of the same script: `const SHARED_TOKEN = '…'`. |
| `TEST_REFERER` | Any origin allowed on the API key. `http://localhost:5173/` works. |

The two `VITE_SYNC_*` values are optional. Leave them empty and the app runs
read-only: it still shows everything and still logs, but records queue on the
device instead of reaching the Sheet.

### If the Sheet or the key doesn't exist yet

**Sheet** — must be shared **Anyone with the link → Viewer**, or the API cannot
read it.

**API key** — in Google Cloud: select the project → **APIs & Services**, enable
**Google Sheets API**, then **Credentials → + Create credentials → API key**.
Then edit it:

- **Application restrictions → Websites**, adding
  `https://jacoboferrer.github.io/*` and `http://localhost:5173/*`
- **API restrictions → Restrict key → Google Sheets API**

Restrictions take a few minutes to propagate. The key ends up readable in the
public bundle by design — restriction is the control, not secrecy.

**Write endpoint** — see [Deploying the Apps Script](#6-optional-deploying-the-apps-script-endpoint) below.

---

## 4. Run it

```bash
npm run dev
```

Open **<http://localhost:5173/hypertrophy-tracker/>** — the path matters, the
bare root 404s because `vite.config.js` sets `base` for GitHub Pages.

You should see a green banner reading **Saved to the Sheet — N sets**. If it
says *Offline*, the API key or its restrictions are wrong.

---

## 5. Run the tests

```bash
npm test
```

Expect `50 passed, 0 failed` and `All views render.`

The first run fetches the Sheet and caches it to `scripts/.fixture.json`
(git-ignored); every later run reads the cache and touches no network. If that
first fetch 403s with *"Requests from referer &lt;empty&gt; are blocked"*, your
`TEST_REFERER` is not one of the origins allowed on the key — the error message
prints the value it sent.

```bash
npm run test:refresh    # re-fetch the Sheet before testing
```

---

## 6. Optional: deploying the Apps Script endpoint

Only needed if you are setting up a **new** Sheet. An existing deployment works
from any machine — you just need its URL.

1. Open the Sheet → **Extensions → Apps Script**
2. Click in the code area, press **⌘A** so the *whole file* highlights, then
   **⌘V** to paste the contents of `apps-script/Code.gs`
3. **Verify line 1 is `/**`**, not `function myFunction() {`. If the paste
   landed *inside* the stub function, `doGet` and `doPost` end up nested rather
   than top level and the endpoint returns *"Función de script no encontrada"*.
4. Set `SHARED_TOKEN` on line 21 to a long random string:
   `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`
5. **⌘S**
6. Check the dropdown next to ▷ Ejecutar lists
   `book, sheetFor, existingIds, reply, doPost, doGet`
7. **Implementar → Nueva implementación** → gear icon → **Aplicación web**
   - **Ejecutar como**: Yo
   - **Acceso**: Cualquier usuario
8. **Implementar** → authorise. You will get *"Google hasn't verified this
   app"* — expected for your own unpublished script. **Advanced → Go to … →
   Allow**.
9. Copy the `/exec` URL. Open it in a browser; it should return JSON:
   `{"ok":true,"spreadsheet":"…","rows":{…},"tokenRequired":true}`
10. Put the URL and token into `.env.local`

The script creates its tabs — `App Log`, `Grappling`, `Bodyweight`, `Notes` —
on first write, immediately to the right of the form responses tab.

> Later edits need **Implementar → Gestionar implementaciones → ✏️ → Versión:
> Versión nueva**. A deployment is a frozen snapshot; saving the code does not
> update it. Use *New deployment* only if you want a different URL.

---

## 7. Optional: enabling deploys from this machine

Only if this machine will push. The GitHub Actions workflow builds on every
push to `main`, and reads its config from repository secrets — these live on
GitHub, not on your computer, so if the repo is already set up there is
nothing to do.

To check or add them:
[Settings → Secrets and variables → Actions](https://github.com/jacoboferrer/hypertrophy-tracker/settings/secrets/actions)

| Secret | Required? |
| --- | --- |
| `VITE_SHEETS_ID` | Yes — the build fails without it |
| `VITE_SHEETS_API_KEY` | Yes — the build fails without it |
| `VITE_SYNC_URL` | No — absent means a read-only deploy, with a warning |
| `VITE_SYNC_TOKEN` | No |

GitHub Pages should be set to **Source: GitHub Actions** under
[Settings → Pages](https://github.com/jacoboferrer/hypertrophy-tracker/settings/pages).

Test the whole path with an empty commit:

```bash
git commit --allow-empty -m "Test deploy"
git push origin main
```

Watch it at [Actions](https://github.com/jacoboferrer/hypertrophy-tracker/actions),
then hard-reload the live page (⌘⇧R).

---

## Verification checklist

- [ ] `ssh -T git@github.com` greets you by name
- [ ] `npm run dev` serves `/hypertrophy-tracker/` with a green banner
- [ ] `npm test` → 50 passed, all views render
- [ ] `npm run build` finishes without error
- [ ] Logging a set on **Today** shows *N waiting to save*, then clears
- [ ] The new row appears in the Sheet's `App Log` tab
- [ ] `git status` shows no `.env.local` and no `scripts/.fixture.json`

---

## A note on where this lives

The working copy sits inside Dropbox, which syncs `node_modules` (~2,800 files)
and `.git`. That is noisy and mildly risky — Dropbox syncing `.git` mid-write
can corrupt a repository, and it makes Vite restart whenever Dropbox touches a
file. GitHub is the real backup. To exclude them:

```bash
xattr -w com.dropbox.ignored 1 node_modules
xattr -w com.dropbox.ignored 1 .git
```

On a new machine, cloning somewhere outside Dropbox avoids the question
entirely.
