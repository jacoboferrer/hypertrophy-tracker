# Hypertrophy Tracker

Personal hypertrophy training dashboard with Google Sheets sync.

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/hypertrophy-tracker.git
cd hypertrophy-tracker
npm install
```

### 2. Configure Google Sheets sync

Edit `src/config.js` with your Sheet ID and API key (see setup guide below).

### 3. Run locally

```bash
npm run dev
```

### 4. Deploy to GitHub Pages

Push to GitHub → the included GitHub Actions workflow builds and deploys automatically.

---

## Google Sheets Setup Guide

### Step 1: Make your Sheet publicly readable

1. Open the Google Sheet that receives your form responses
2. Click **Share** (top-right)
3. Under "General access", change to **"Anyone with the link"** → **Viewer**
4. Copy the Sheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/THIS_PART_IS_YOUR_SHEET_ID/edit
   ```
5. Paste it in `src/config.js` as the `SHEET_ID` value

### Step 2: Get a Google Sheets API key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Go to **APIs & Services** → **Library**
4. Search for **"Google Sheets API"** → click **Enable**
5. Go to **APIs & Services** → **Credentials**
6. Click **Create Credentials** → **API Key**
7. (Recommended) Click **Edit API key** → under "API restrictions", select **Google Sheets API** only
8. Copy the key and paste it in `src/config.js` as the `API_KEY` value

### Step 3: Set the sheet tab name

In `src/config.js`, set `SHEET_NAME` to match your form responses tab name.
Common values:
- `"Form Responses 1"` (English)
- `"Respuestas de formulario 1"` (Spanish)

### Step 4: Test locally

```bash
npm run dev
```

Open the app. The sync banner at the top should show "● Connected to Google Sheets".

---

## GitHub Pages Deployment

### Option A: Automatic (GitHub Actions) — Recommended

1. Create a repo on GitHub named `hypertrophy-tracker`
2. Push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/hypertrophy-tracker.git
   git push -u origin main
   ```
3. In your repo → **Settings** → **Pages**:
   - Source: **GitHub Actions**
4. The workflow runs automatically on push. Your site will be at:
   ```
   https://YOUR_USERNAME.github.io/hypertrophy-tracker/
   ```

### Option B: Manual (`gh-pages` branch)

```bash
npm run deploy
```

Then in Settings → Pages, set source to `gh-pages` branch.

### Important: Update the base path

In `vite.config.js`, the `base` value must match your repo name:

```js
base: '/hypertrophy-tracker/',  // ← must match your GitHub repo name
```

If your repo has a different name, update this value.

---

## Google Form Column Mapping

The app expects your form to have these columns (in order):

| Col | Field | Description |
|-----|-------|-------------|
| 0 | Marca temporal | Timestamp (auto) |
| 1 | Routine | "Day A" / "Day B" / "Day C" |
| 2 | Day A exercise | Conditional: shown when Routine = Day A |
| 3 | Day B exercise | Conditional: shown when Routine = Day B |
| 4 | Day C exercise | Conditional: shown when Routine = Day C |
| 5-8 | Extra selections | Optional fallback exercise columns |
| 9 | Working Set | 1, 2, 3, 4 or "Warmup" |
| 10 | Repetitions | Number |
| 11 | Weight (kg) | Number |
| 12 | Comment | Optional text |
| 13 | RPE | Optional 1-10 |
| 14 | RIR | Optional 0-5 |
| 15 | Technical Quality | Optional |
| 16 | Rest Time | Optional |

Legacy routine names ("Push day", "Pull day", "Upper body") are also supported.

---

## Project Structure

```
hypertrophy-tracker/
├── index.html              # Entry point
├── vite.config.js          # Vite config with GitHub Pages base path
├── package.json
├── src/
│   ├── main.jsx            # React mount
│   ├── App.jsx             # Main app (5 views)
│   ├── config.js           # ← EDIT THIS: Sheet ID, API key, program config
│   └── sheets.js           # Google Sheets fetch + column parser
└── .github/
    └── workflows/
        └── deploy.yml      # Auto-deploy on push to main
```
