// ─── SHEET FIXTURE CACHE ─────────────────────────────────────────────────────
//
// The tests need the real log, but once the API key carries an HTTP-referrer
// restriction Google rejects requests from Node — there is no Referer header to
// match. So the sheet is fetched once and cached to scripts/.fixture.json
// (git-ignored); every later run reads the cache and touches no network.
//
//   npm test              use the cache, fetch only if there isn't one
//   npm run test:refresh  force a fetch and rewrite the cache
//

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { sheetsUrl } from '../src/sheets.js';

const ENV_PATH = new URL('../.env.local', import.meta.url);
const FIXTURE_PATH = new URL('./.fixture.json', import.meta.url);

export function loadEnv() {
  if (!existsSync(ENV_PATH)) {
    throw new Error('.env.local not found — copy .env.example to .env.local first');
  }
  return Object.fromEntries(
    readFileSync(ENV_PATH, 'utf8')
      .split('\n')
      .filter((line) => line.includes('=') && !line.trimStart().startsWith('#'))
      .map((line) => {
        const i = line.indexOf('=');
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      }),
  );
}

function readFixture() {
  if (!existsSync(FIXTURE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeFixture(values) {
  const payload = { fetchedAt: new Date().toISOString(), rows: values.length, values };
  writeFileSync(FIXTURE_PATH, JSON.stringify(payload));
  return payload;
}

// A referrer-restricted key rejects Node, which sends no Referer header at all
// ("Requests from referer <empty> are blocked"). Declaring the origin the app
// is actually served from satisfies the restriction — set TEST_REFERER in
// .env.local to one of the referrers allowed on the key.
const DEFAULT_REFERER = 'http://localhost:5173/';

async function fetchValues() {
  const env = loadEnv();
  const referer = env.TEST_REFERER || DEFAULT_REFERER;

  const response = await fetch(sheetsUrl({
    SHEET_ID: env.VITE_SHEETS_ID,
    API_KEY: env.VITE_SHEETS_API_KEY,
    SHEET_NAME: env.VITE_SHEETS_TAB,
  }), { headers: { Referer: referer } });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.error?.message || response.statusText;
    const hint = response.status === 403
      ? `\n    Referer sent: ${referer}\n    Add that origin to the key's website restrictions, or set TEST_REFERER in .env.local.`
      : '';
    throw new Error(`Sheets API ${response.status}: ${detail}${hint}`);
  }

  const { values = [] } = await response.json();
  if (!values.length) throw new Error('Sheet returned no rows');
  return values;
}

const age = (iso) => {
  const days = (Date.now() - new Date(iso)) / 86400000;
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  return `${Math.floor(days)} days old`;
};

/**
 * Raw sheet values, from cache when possible.
 * Pass --refresh (or REFRESH=1) to force a network fetch.
 */
export async function sheetValues({ refresh = false } = {}) {
  const force = refresh || process.argv.includes('--refresh') || process.env.REFRESH === '1';
  const cached = readFixture();

  if (cached && !force) {
    return { values: cached.values, source: `cache, ${age(cached.fetchedAt)}` };
  }

  try {
    const values = await fetchValues();
    const saved = writeFixture(values);
    return {
      values,
      source: cached ? 'network, cache refreshed' : 'network, cache created',
      fetchedAt: saved.fetchedAt,
    };
  } catch (err) {
    if (cached) {
      console.warn(`  ! ${err.message}`);
      console.warn(`  ! falling back to the cached fixture (${age(cached.fetchedAt)})`);
      return { values: cached.values, source: `cache, ${age(cached.fetchedAt)}` };
    }
    throw new Error(
      `${err.message}\n\n` +
      'No cached fixture to fall back on, so there is nothing to test against.\n' +
      'Once one run succeeds the cache covers every later run, online or not.',
    );
  }
}
