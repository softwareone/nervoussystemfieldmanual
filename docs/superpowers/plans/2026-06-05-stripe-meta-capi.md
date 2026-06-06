# Stripe → Meta CAPI Purchase Event Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fire a server-side `Purchase` event to Meta's Conversions API (v21.0) on every Stripe `checkout.session.completed`, integrated into the existing Express webhook, with results logged to SQLite.

**Architecture:** A new network-only module `lib/meta-capi.js` (SHA-256 email hash + payload builder + `fetch` POST with timeout) is called fire-and-forget from the existing `routes/webhook.js` right after `fulfill()`, using `event_id = session.id` for dedup. Results are written to a new `meta_capi_events` SQLite table. No second webhook, no Edge Function.

**Tech Stack:** Node.js, Express, `better-sqlite3`, built-in `crypto`, built-in `fetch` (Node 18+), Node built-in test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-06-05-stripe-meta-capi-design.md`

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `nsfm-website/lib/meta-capi.js` | Hash email, build Meta Purchase payload, POST to CAPI with timeout. Network-only — no DB dependency. | Create |
| `nsfm-website/routes/webhook.js` | Call `sendPurchaseEvent` fire-and-forget after fulfillment; log result to `meta_capi_events`. | Modify (`webhook.js:3-7` imports, after `:87`) |
| `nsfm-website/lib/db.js` | Add `meta_capi_events` table to schema. | Modify (`lib/db.js:11-36`) |
| `nsfm-website/.env.example` | Document the four Meta env vars. | Modify (append) |
| `nsfm-website/package.json` | Add `"test": "node --test"` script. | Modify (`package.json:6-9`) |
| `nsfm-website/test/meta-capi.test.js` | Unit tests for the module's pure + network logic. | Create |
| `nsfm-website/test/db-capi.test.js` | Verify `meta_capi_events` schema accepts inserts. | Create |

**All commands below are run from `nsfm-website/`** (the Node project root), e.g. `cd "/Users/bobbyharris/Documents/nervoussystemfieldmanual/nsfm-website"`.

---

## Task 1: Add the test script

**Files:**
- Modify: `nsfm-website/package.json:6-9`

- [ ] **Step 1: Add the `test` script**

In `package.json`, change the `scripts` block from:

```json
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
```

to:

```json
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "node --test"
  },
```

- [ ] **Step 2: Verify the runner works (no tests yet)**

Run: `npm test`
Expected: exits `0` with `tests 0` / `pass 0` (Node's runner reports zero tests, no error).

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add node --test script"
```

---

## Task 2: `hashEmail` — SHA-256 of normalized email

**Files:**
- Create: `nsfm-website/lib/meta-capi.js`
- Test: `nsfm-website/test/meta-capi.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/meta-capi.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/meta-capi'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/meta-capi.js`:

```js
const crypto = require('crypto');

function hashEmail(email) {
  if (!email) return null;
  const normalized = String(email).trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

module.exports = { hashEmail };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/meta-capi.js test/meta-capi.test.js
git commit -m "feat: add hashEmail for Meta CAPI"
```

---

## Task 3: `buildPurchasePayload` — Meta Purchase event body

**Files:**
- Modify: `nsfm-website/lib/meta-capi.js`
- Test: `nsfm-website/test/meta-capi.test.js`

- [ ] **Step 1: Write the failing test**

Append to `test/meta-capi.test.js`:

```js
const { buildPurchasePayload } = require('../lib/meta-capi');

const sampleSession = {
  id: 'cs_test_123',
  currency: 'usd',
  amount_total: 2700, // cents
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
  assert.equal(e.event_time, 1_700_000_000); // seconds
  assert.equal(e.event_id, 'cs_test_123');
  assert.equal(e.action_source, 'website');
  assert.equal(e.event_source_url, 'https://nervoussystemfieldmanual.com');
  assert.equal(e.custom_data.currency, 'usd');
  assert.equal(e.custom_data.value, 27); // 2700 / 100
  assert.equal(e.user_data.em[0], hashEmail('buyer@example.com'));
  assert.equal('test_event_code' in payload, false);
});

test('buildPurchasePayload includes test_event_code when env set', () => {
  process.env.META_TEST_EVENT_CODE = 'TEST12345';
  const payload = buildPurchasePayload({ session: sampleSession, eventId: 'x' });
  assert.equal(payload.test_event_code, 'TEST12345');
  delete process.env.META_TEST_EVENT_CODE;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `buildPurchasePayload is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `lib/meta-capi.js`, add the function and export it. Replace the `module.exports` line:

```js
function buildPurchasePayload({ session, eventId, now = Date.now() }) {
  const hashedEmail = hashEmail(session.customer_details?.email);
  const userData = {};
  if (hashedEmail) userData.em = [hashedEmail];

  const payload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(now / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: process.env.BASE_URL,
        user_data: userData,
        custom_data: {
          currency: session.currency,
          value: session.amount_total / 100,
        },
      },
    ],
  };

  const testCode = process.env.META_TEST_EVENT_CODE;
  if (testCode) payload.test_event_code = testCode;

  return payload;
}

module.exports = { hashEmail, buildPurchasePayload };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/meta-capi.js test/meta-capi.test.js
git commit -m "feat: add buildPurchasePayload for Meta CAPI"
```

---

## Task 4: `sendPurchaseEvent` — POST with config guard, timeout, error handling

**Files:**
- Modify: `nsfm-website/lib/meta-capi.js`
- Test: `nsfm-website/test/meta-capi.test.js`

- [ ] **Step 1: Write the failing test**

Append to `test/meta-capi.test.js`:

```js
const { sendPurchaseEvent } = require('../lib/meta-capi');

function withFetch(fn, body) {
  const original = global.fetch;
  global.fetch = fn;
  return () => { global.fetch = original; };
}

test('sendPurchaseEvent skips when not configured', async () => {
  const restore = withFetch(async () => { throw new Error('should not be called'); });
  delete process.env.META_PIXEL_ID;
  delete process.env.META_CAPI_ACCESS_TOKEN;

  const result = await sendPurchaseEvent({ session: sampleSession, eventId: 'x' });
  assert.equal(result.skipped, true);
  assert.equal(result.ok, false);
  restore();
});

test('sendPurchaseEvent POSTs and returns parsed result on success', async () => {
  process.env.META_PIXEL_ID = '26871724739163641';
  process.env.META_CAPI_ACCESS_TOKEN = 'token_abc';
  process.env.META_API_VERSION = 'v21.0';

  let calledUrl;
  let calledInit;
  const restore = withFetch(async (url, init) => {
    calledUrl = url;
    calledInit = init;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ events_received: 1, fbtrace_id: 'trace_xyz' }),
    };
  });

  const result = await sendPurchaseEvent({ session: sampleSession, eventId: 'cs_test_123' });

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.fbTraceId, 'trace_xyz');
  assert.match(calledUrl, /graph\.facebook\.com\/v21\.0\/26871724739163641\/events/);
  assert.match(calledUrl, /access_token=token_abc/);
  assert.equal(calledInit.method, 'POST');
  const sentBody = JSON.parse(calledInit.body);
  assert.equal(sentBody.data[0].event_id, 'cs_test_123');
  restore();
});

test('sendPurchaseEvent returns error object on network failure', async () => {
  process.env.META_PIXEL_ID = '26871724739163641';
  process.env.META_CAPI_ACCESS_TOKEN = 'token_abc';
  const restore = withFetch(async () => { throw new Error('boom'); });

  const result = await sendPurchaseEvent({ session: sampleSession, eventId: 'x' });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'boom');
  restore();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `sendPurchaseEvent is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `lib/meta-capi.js`, add the function and update exports:

```js
const TIMEOUT_MS = 10000;

async function sendPurchaseEvent({ session, eventId }) {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  const apiVersion = process.env.META_API_VERSION || 'v21.0';

  if (!pixelId || !accessToken) {
    console.warn('Meta CAPI not configured — skipping Purchase event.');
    return { ok: false, skipped: true };
  }

  const payload = buildPurchasePayload({ session, eventId });
  const url =
    `https://graph.facebook.com/${apiVersion}/${pixelId}/events` +
    `?access_token=${encodeURIComponent(accessToken)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* non-JSON body */ }
    return {
      ok: res.ok,
      status: res.status,
      body: text.slice(0, 1000),
      fbTraceId: parsed?.fbtrace_id || null,
    };
  } catch (err) {
    return { ok: false, status: 0, body: null, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { hashEmail, buildPurchasePayload, sendPurchaseEvent };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/meta-capi.js test/meta-capi.test.js
git commit -m "feat: add sendPurchaseEvent with timeout and error handling"
```

---

## Task 5: Add `meta_capi_events` table to SQLite schema

**Files:**
- Modify: `nsfm-website/lib/db.js:11-36`
- Test: `nsfm-website/test/db-capi.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/db-capi.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `no such table: meta_capi_events`.

- [ ] **Step 3: Add the table**

In `lib/db.js`, inside the existing `db.exec(\`...\`)` block (after the `download_tokens` table definition, before the closing backtick), add:

```sql
  CREATE TABLE IF NOT EXISTS meta_capi_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stripe_session_id TEXT,
    event_id TEXT,
    status TEXT,
    http_status INTEGER,
    fb_trace_id TEXT,
    response_excerpt TEXT,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/db.js test/db-capi.test.js
git commit -m "feat: add meta_capi_events log table"
```

---

## Task 6: Wire CAPI into the webhook (fire-and-forget + logging)

**Files:**
- Modify: `nsfm-website/routes/webhook.js` (imports `:3-7`, prepared statements `:15-23`, after `:87`)

This task has no automated test (the existing webhook has no HTTP test harness; mocking Stripe signature verification is out of scope). It is verified manually in Task 8.

- [ ] **Step 1: Add the module import**

In `routes/webhook.js`, after the existing `const { createKlaviyoContact } = require('../lib/klaviyo');` line (`:7`), add:

```js
const { sendPurchaseEvent } = require('../lib/meta-capi');
```

- [ ] **Step 2: Add the prepared insert statement**

After the existing `const findOrder = db.prepare(...)` line (`:23`), add:

```js
const insertCapiEvent = db.prepare(`
  INSERT INTO meta_capi_events
    (stripe_session_id, event_id, status, http_status, fb_trace_id, response_excerpt, error)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
```

- [ ] **Step 3: Fire the event after fulfillment**

In the `try` block of the `checkout.session.completed` handler, immediately after the existing `createKlaviyoContact(...)` call block (after `webhook.js:85`) and before the `console.log(\`✓ Order fulfilled...\`)` line, add:

```js
      // Fire Meta CAPI Purchase fire-and-forget — never block the 200 to Stripe.
      sendPurchaseEvent({ session, eventId: session.id })
        .then((result) => {
          const status = result.skipped ? 'skipped' : result.ok ? 'sent' : 'failed';
          insertCapiEvent.run(
            session.id,
            session.id,
            status,
            result.status ?? null,
            result.fbTraceId ?? null,
            result.body ?? null,
            result.error ?? null
          );
          if (result.ok) {
            console.log(`✓ Meta CAPI Purchase sent: ${session.id}`);
          } else if (!result.skipped) {
            console.error(`Meta CAPI Purchase failed (${session.id}):`, result.error || result.body);
          }
        })
        .catch((err) => console.error('Meta CAPI post-processing error:', err));
```

- [ ] **Step 4: Verify the server boots without error**

Run: `node -e "require('./routes/webhook.js'); console.log('webhook module loads OK')"`
Expected: prints `webhook module loads OK` with no exception (confirms imports + prepared statements are valid).

- [ ] **Step 5: Run the full test suite (no regressions)**

Run: `npm test`
Expected: PASS — all 9 tests still pass.

- [ ] **Step 6: Commit**

```bash
git add routes/webhook.js
git commit -m "feat: fire Meta CAPI Purchase from Stripe webhook"
```

---

## Task 7: Document env vars in `.env.example`

**Files:**
- Modify: `nsfm-website/.env.example` (append)

- [ ] **Step 1: Append the Meta block**

Add to the end of `.env.example`:

```bash

# ── Meta Conversions API (CAPI) ──────────────────────────
META_PIXEL_ID=26871724739163641
META_CAPI_ACCESS_TOKEN=                # Events Manager → Settings → Conversions API → Generate token
META_TEST_EVENT_CODE=                  # Optional — Events Manager → Test Events tab. Testing only; remove for prod.
META_API_VERSION=v21.0
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: document Meta CAPI env vars in .env.example"
```

---

## Task 8: End-to-end verification (manual)

**Files:** none (verification only)

Requires the real `META_CAPI_ACCESS_TOKEN` in `nsfm-website/.env` (already added) and a Stripe test-mode key + webhook secret in `.env`.

- [ ] **Step 1: Set a test event code**

In `nsfm-website/.env`, uncomment/set `META_TEST_EVENT_CODE=` to the code from Meta Events Manager → **Test Events** tab.

- [ ] **Step 2: Start the server and Stripe webhook forwarder**

In one terminal: `npm run dev`
In another: `stripe listen --forward-to localhost:3000/webhook`
(Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET` in `.env` if not already set, then restart the server.)

- [ ] **Step 3: Trigger a test purchase**

Run: `stripe trigger checkout.session.completed`
Expected: server logs `✓ Meta CAPI Purchase sent: cs_...`.

- [ ] **Step 4: Confirm the SQLite log row**

Run: `node -e "const db=require('./lib/db'); console.log(db.prepare('SELECT stripe_session_id,status,http_status,fb_trace_id FROM meta_capi_events ORDER BY id DESC LIMIT 1').get())"`
Expected: one row with `status: 'sent'`, `http_status: 200`.

- [ ] **Step 5: Confirm in Meta**

Open Events Manager → **Test Events** tab. Expected: a `Purchase` event appears with the value and currency from the test session.

- [ ] **Step 6: Disable test mode for production**

In `nsfm-website/.env`, clear/comment `META_TEST_EVENT_CODE`. Ensure `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `META_API_VERSION` are set in **Hostinger's environment panel** for production (the `.env` file is not deployed).

- [ ] **Step 7: Final confirmation**

No commit needed. Verification complete when a real test-mode purchase shows `status: 'sent'` in SQLite and a `Purchase` in Meta Test Events.

---

## Notes for the implementer

- **Run all commands from `nsfm-website/`**, not the repo root.
- **`.env` is gitignored** — never `git add` it. The Meta token already lives there.
- **`session.amount_total` is in cents** — divide by 100 for Meta's `value`.
- **`event_id = session.id`** is intentional: it doubles as the dedup key for retried webhooks and is forward-compatible with a future client-side Purchase.
- **`better-sqlite3` rejects `undefined`** bind params — always coalesce to `null` (`?? null`), as done in Task 6.
