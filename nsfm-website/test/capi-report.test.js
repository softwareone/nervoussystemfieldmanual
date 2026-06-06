const { test } = require('node:test');
const assert = require('node:assert/strict');

const { computeSummary, renderReport, truncateMiddle } = require('../lib/capi-report');

const NOW = Date.parse('2026-06-05T20:00:00Z');

// id order tracks time order (as autoincrement does in practice).
const rows = [
  { id: 1, stripe_session_id: 'cs_test_cccc', status: 'skipped', http_status: null, fb_trace_id: null, error: null, created_at: '2026-06-01 10:00:00' },
  { id: 2, stripe_session_id: 'cs_test_aaaaaaaaaaaaaaaa1111', status: 'sent', http_status: 200, fb_trace_id: 'trace_1', error: null, created_at: '2026-06-05 19:50:00' },
  { id: 3, stripe_session_id: 'cs_test_bbbb', status: 'failed', http_status: 400, fb_trace_id: null, error: 'Invalid token', created_at: '2026-06-05 19:55:00' },
];

test('computeSummary tallies statuses, delivery rate, and last 24h', () => {
  const s = computeSummary(rows, NOW);
  assert.equal(s.total, 3);
  assert.equal(s.sent, 1);
  assert.equal(s.failed, 1);
  assert.equal(s.skipped, 1);
  assert.equal(Math.round(s.deliveryRate), 50); // 1 sent / 2 attempted
  assert.equal(s.last24h, 2); // rows 2 & 3 within 24h; row 1 is 4 days old
});

test('computeSummary deliveryRate is null when nothing was attempted', () => {
  const s = computeSummary([{ id: 1, status: 'skipped', created_at: '2026-06-05 19:00:00' }], NOW);
  assert.equal(s.deliveryRate, null);
});

test('renderReport emits frontmatter, summary, and newest-first rows', () => {
  const md = renderReport(rows, NOW, 50);
  assert.match(md, /^---\ntitle: Meta CAPI Admin/);
  assert.match(md, /# Meta CAPI — Purchase Events/);
  assert.match(md, /\| Total events \| 3 \|/);
  assert.match(md, /✅ Sent \| 1/);
  assert.match(md, /Invalid token/); // failed row's error surfaced
  // newest (highest id) first: row 3's error appears before row 2's trace
  assert.ok(md.indexOf('Invalid token') < md.indexOf('trace_1'), 'rows should be newest-first');
});

test('renderReport handles an empty table', () => {
  const md = renderReport([], NOW, 50);
  assert.match(md, /No events recorded yet/);
});

test('truncateMiddle shortens long session ids and leaves short ones', () => {
  assert.equal(truncateMiddle('cs_test_aaaaaaaaaaaaaaaa1111'), 'cs_test_aaaa…1111');
  assert.equal(truncateMiddle('short'), 'short');
});
