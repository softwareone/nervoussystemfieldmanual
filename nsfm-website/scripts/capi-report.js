'use strict';

// Generates the Meta CAPI admin dashboard note into the Obsidian vault.
// Usage: npm run capi:report
// Reads the meta_capi_events table from whichever SQLite DB lib/db.js points at
// (local by default; run on the server / against a prod copy to report prod data).
//
// Override the output path or row limit via env:
//   CAPI_REPORT_PATH=/path/to/Note.md  CAPI_REPORT_LIMIT=100

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = require('../lib/db');
const { renderReport } = require('../lib/capi-report');

const DEFAULT_NOTE =
  '/Users/bobbyharris/Documents/Obsidian Vault/03_Nervous_System_Field_Manual/Meta_CAPI_Admin.md';

const notePath = process.env.CAPI_REPORT_PATH || DEFAULT_NOTE;
const limit = parseInt(process.env.CAPI_REPORT_LIMIT || '50', 10);

const rows = db.prepare('SELECT * FROM meta_capi_events').all();
const markdown = renderReport(rows, Date.now(), limit);

fs.mkdirSync(path.dirname(notePath), { recursive: true });
fs.writeFileSync(notePath, markdown, 'utf8');

console.log(`✓ Meta CAPI admin note written: ${notePath}`);
console.log(`  ${rows.length} event(s) rendered (showing up to ${limit}).`);
