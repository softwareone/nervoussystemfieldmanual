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
