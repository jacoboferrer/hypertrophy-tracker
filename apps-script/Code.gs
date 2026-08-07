/**
 * Hypertrophy Tracker — write endpoint
 * ────────────────────────────────────────────────────────────────────────────
 * Deployed as a Web App bound to the training log spreadsheet. The app POSTs
 * batches of records here; this appends them to tabs it owns, leaving the
 * Google Form's response tab untouched as the historical archive.
 *
 * Records carry a client-generated id. Appends are deduplicated on that id, so
 * a retry after a lost response cannot double-write.
 *
 * SETUP — see README, or:
 *   1. In the Sheet: Extensions → Apps Script, replace everything with this.
 *   2. Set SHARED_TOKEN below to a long random string.
 *   3. Deploy → New deployment → Web app
 *        Execute as:      Me
 *        Who has access:  Anyone
 *   4. Authorise when prompted, then copy the /exec URL.
 */

// Must match VITE_SYNC_TOKEN in the app. Change both together.
const SHARED_TOKEN = 'CHANGE_ME';

// Leave empty when the script is bound to the Sheet (Extensions → Apps Script).
// If you created it standalone at script.google.com instead, put the Sheet ID
// here — the part of the Sheet URL between /d/ and /edit.
const SHEET_ID = '';

function book() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('No bound spreadsheet — set SHEET_ID at the top of this script');
  }
  return active;
}

const TABS = {
  sets: {
    name: 'App Log',
    headers: ['id', 'date', 'day', 'exercise', 'set', 'reps', 'weight', 'rir', 'block', 'rotation', 'note', 'loggedAt'],
    fields: ['id', 'date', 'day', 'exercise', 'set', 'reps', 'weight', 'rir', 'block', 'rotation', 'note', 'loggedAt'],
  },
  grappling: {
    name: 'Grappling',
    headers: ['id', 'date', 'minutes', 'hardness', 'note', 'loggedAt'],
    fields: ['id', 'date', 'minutes', 'hardness', 'note', 'loggedAt'],
  },
  bodyweight: {
    name: 'Bodyweight',
    headers: ['id', 'date', 'kg', 'loggedAt'],
    fields: ['id', 'date', 'value', 'loggedAt'],
  },
  notes: {
    name: 'Notes',
    headers: ['id', 'date', 'day', 'block', 'note', 'loggedAt'],
    fields: ['id', 'date', 'day', 'block', 'note', 'loggedAt'],
  },
};

function sheetFor(key) {
  const config = TABS[key];
  if (!config) throw new Error('Unknown record type: ' + key);

  const target = book();
  let sheet = target.getSheetByName(config.name);
  if (!sheet) {
    sheet = target.insertSheet(config.name);
    sheet.appendRow(config.headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, config.headers.length).setFontWeight('bold');
  }
  return { sheet, config };
}

function existingIds(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return {};
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  const seen = {};
  for (let i = 0; i < ids.length; i++) {
    const id = String(ids[i][0]).trim();
    if (id) seen[id] = true;
  }
  return seen;
}

function reply(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(request) {
  // Serialise concurrent writes so two tabs cannot interleave appends.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return reply({ ok: false, error: 'busy' });
  }

  try {
    // Sent as text/plain to keep the request "simple" and avoid a CORS
    // preflight, which Apps Script web apps cannot answer.
    const body = JSON.parse(request.postData.contents);

    if (SHARED_TOKEN !== 'CHANGE_ME' && body.token !== SHARED_TOKEN) {
      return reply({ ok: false, error: 'unauthorised' });
    }

    const type = body.type;
    const records = body.records || [];
    if (!records.length) return reply({ ok: true, written: 0, ids: [] });

    const { sheet, config } = sheetFor(type);
    const seen = existingIds(sheet);

    const rows = [];
    const accepted = [];
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (!record.id || seen[record.id]) {
        // Already stored: acknowledge so the client clears it from the queue.
        if (record.id) accepted.push(record.id);
        continue;
      }
      seen[record.id] = true;
      const row = config.fields.map(function (field) {
        const value = record[field];
        return value === undefined || value === null ? '' : value;
      });
      rows.push(row);
      accepted.push(record.id);
    }

    if (rows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    return reply({ ok: true, written: rows.length, ids: accepted });
  } catch (err) {
    return reply({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

/** Health check — open the /exec URL in a browser to confirm the deployment. */
function doGet() {
  const target = book();
  const counts = {};
  for (const key in TABS) {
    const sheet = target.getSheetByName(TABS[key].name);
    counts[key] = sheet ? Math.max(sheet.getLastRow() - 1, 0) : 0;
  }
  return reply({
    ok: true,
    spreadsheet: target.getName(),
    rows: counts,
    tokenRequired: SHARED_TOKEN !== 'CHANGE_ME',
  });
}
