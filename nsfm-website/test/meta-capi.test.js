const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { hashEmail } = require('../lib/meta-capi');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

test('hashEmail lowercases, trims, and SHA-256 hashes', () => {
  assert.equal(hashEmail('  Test@Example.COM '), sha256('test@example.com'));
});

test('hashEmail returns null for empty/missing input', () => {
  assert.equal(hashEmail(''), null);
  assert.equal(hashEmail(undefined), null);
  assert.equal(hashEmail(null), null);
});

const { buildPurchasePayload } = require('../lib/meta-capi');

const sampleSession = {
  id: 'cs_test_123',
  currency: 'usd',
  amount_total: 2700,
  customer_details: { email: 'Buyer@Example.com' },
};

test('buildPurchasePayload builds a valid Purchase event', () => {
  process.env.BASE_URL = 'https://nervoussystemfieldmanual.com';
  delete process.env.META_TEST_EVENT_CODE;

  const payload = buildPurchasePayload({
    session: sampleSession,
    eventId: 'cs_test_123',
    now: 1_700_000_000_000,
  });

  assert.equal(payload.data.length, 1);
  const e = payload.data[0];
  assert.equal(e.event_name, 'Purchase');
  assert.equal(e.event_time, 1_700_000_000);
  assert.equal(e.event_id, 'cs_test_123');
  assert.equal(e.action_source, 'website');
  assert.equal(e.event_source_url, 'https://nervoussystemfieldmanual.com');
  assert.equal(e.custom_data.currency, 'usd');
  assert.equal(e.custom_data.value, 27);
  assert.equal(e.user_data.em[0], hashEmail('buyer@example.com'));
  assert.equal('test_event_code' in payload, false);
});

test('buildPurchasePayload includes test_event_code when env set', () => {
  process.env.META_TEST_EVENT_CODE = 'TEST12345';
  const payload = buildPurchasePayload({ session: sampleSession, eventId: 'x' });
  assert.equal(payload.test_event_code, 'TEST12345');
  delete process.env.META_TEST_EVENT_CODE;
});
