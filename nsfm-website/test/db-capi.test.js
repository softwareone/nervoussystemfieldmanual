const { test } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../lib/db');

test('meta_capi_events table exists and accepts an insert', () => {
  const insert = db.prepare(`
    INSERT INTO meta_capi_events
      (stripe_session_id, event_id, status, http_status, fb_trace_id, response_excerpt, error)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = insert.run('cs_test_db', 'cs_test_db', 'sent', 200, 'trace_1', '{"ok":1}', null);
  assert.ok(info.lastInsertRowid > 0);

  const row = db.prepare('SELECT * FROM meta_capi_events WHERE id = ?').get(info.lastInsertRowid);
  assert.equal(row.stripe_session_id, 'cs_test_db');
  assert.equal(row.status, 'sent');
  assert.equal(row.http_status, 200);
});
