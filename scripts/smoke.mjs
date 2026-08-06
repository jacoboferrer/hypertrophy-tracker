// Server-renders every view against the real log, then against an empty store.
//   npm run smoke              cached sheet (offline, no network)
//   npm run smoke -- --refresh re-fetch and rewrite the cache

import { rmSync } from 'node:fs';
import { build } from 'esbuild';
import { parseRows } from '../src/sheets.js';
import { sheetValues } from './fixture.mjs';

const { values, source } = await sheetValues();
const { sets: rows, bodyweight: logged } = parseRows(values);

const out = new URL('./.smoke-bundle.mjs', import.meta.url).pathname;
await build({
  entryPoints: [new URL('./smoke.jsx', import.meta.url).pathname],
  bundle: true, format: 'esm', platform: 'node', outfile: out,
  jsx: 'automatic', external: ['react', 'react-dom'], logLevel: 'error',
  define: { 'import.meta.env': '{}' },
});

const { run, runEmpty } = await import(out);

const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
const grappling = [
  { id: 'g1', date: day(1), minutes: 90, hardness: 3 },
  { id: 'g2', date: day(4), minutes: 90, hardness: 2 },
];
// The sheet's bodyweight column has never been filled, so the chart is
// exercised with synthetic readings until real ones exist.
const bodyweight = logged.length ? logged : [
  { date: '2026-07-06', value: 64.8 }, { date: '2026-07-13', value: 65.1 },
  { date: '2026-07-20', value: 65.0 }, { date: '2026-07-27', value: 65.4 },
];

let fail = 0;
const report = (label, { results, meso, day: nextDay, sessions }) => {
  console.log(`\n${label}`);
  console.log(`  block ${meso.block.id} · session ${meso.sessionNumber}/${meso.block.sessions} · ${meso.spec.label} · RIR ${meso.spec.rir} · next day ${nextDay} · ${sessions} sessions`);
  for (const [name, len] of Object.entries(results)) {
    const ok = len > 400;
    if (!ok) fail++;
    console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(9)} rendered ${len.toLocaleString()} chars`);
  }
};

try {
  report(`Real log — ${rows.length} sets · ${source}`, run(rows, grappling, bodyweight));
  report('Empty store — brand new install', runEmpty());
} catch (err) {
  console.error('\n✗ render threw:', err.stack);
  fail++;
} finally {
  rmSync(out, { force: true });
}

console.log(fail ? `\n${fail} failed\n` : '\nAll views render.\n');
process.exit(fail ? 1 : 0);
