# Stripe → Meta Conversions API (CAPI) Purchase Event — Design

**Date:** 2026-06-05
**Project:** nsfm-website (Nervous System Field Manual)
**Status:** Approved — ready for implementation planning

## Goal

Fire a server-side `Purchase` event to Meta's Conversions API (CAPI) every time a
Stripe `checkout.session.completed` webhook is received, so Meta Ads has reliable,
ad-blocker-proof conversion data attributed to the buyer.

## Context / Key Discovery

The original request assumed a standalone **Supabase Edge Function (Deno)**. The actual
codebase is an **Express.js Node app** (`nsfm-website/server.js`, Hostinger-hosted) that
**already has a working Stripe webhook** at `routes/webhook.js`. That handler already:

- Validates the signature via `stripe.webhooks.constructEvent(req.body, sig, webhookSecret)`
- Handles `checkout.session.completed` only
- Returns `400` on bad signature, `200` otherwise
- Is idempotent (skips duplicate `session.id`)
- Extracts email, name, `amount_total`, currency, `payment_intent`
- Fires slow downstream work (Klaviyo) fire-and-forget without blocking the `200`

Orders are stored in **SQLite** (`better-sqlite3`, `lib/db.js`) — not Supabase. Supabase
is used only for PDF storage and newsletter signup.

**Decision:** Integrate CAPI into the existing Express webhook rather than building a
separate Edge Function. This avoids a second Stripe endpoint, duplicate signature
validation, duplicate idempotency, and a split runtime.

A browser Meta Pixel (ID `26871724739163641`) already fires `PageView` only — there is
**no** client-side `Purchase` event, so a server `Purchase` will **not** double-count.

## Architecture

Fire the CAPI `Purchase` from `routes/webhook.js`, fire-and-forget, immediately after
`fulfill()` (next to the existing Klaviyo call). The `200` to Stripe never waits on Meta.

### New module: `lib/meta-capi.js`

Mirrors the `lib/stripe.js` / `lib/supabase.js` pattern (config guard + single export).

- Exports `sendPurchaseEvent({ session, eventId })` and an `isConfigured` flag.
- SHA-256 hashes the email (trim + lowercase) using Node's built-in `crypto`.
- `POST https://graph.facebook.com/{META_API_VERSION}/{META_PIXEL_ID}/events`
  with `access_token` query param.
- Payload:
  ```json
  {
    "data": [{
      "event_name": "Purchase",
      "event_time": "<unix seconds>",
      "event_id": "<session.id>",
      "action_source": "website",
      "event_source_url": "<BASE_URL>",
      "user_data": { "em": ["<sha256(lowercased email)>"] },
      "custom_data": { "currency": "<session.currency>", "value": <amount_total / 100> }
    }],
    "test_event_code": "<META_TEST_EVENT_CODE if set>"
  }
  ```
- Uses built-in `fetch` with a ~10s `AbortController` timeout.
- Returns `{ ok, status, body, fbTraceId }`. **Never throws** into the webhook.

### Wiring in `routes/webhook.js`

- After `fulfill()` succeeds, call `sendPurchaseEvent({ session, eventId: session.id })`
  fire-and-forget (same `.catch()` style as the Klaviyo call).
- `event_id = session.id` — the same value as the idempotency key, so Meta dedupes
  retried webhooks and it is forward-compatible if a client-side `Purchase` is added later.
- The result is written to the log table; failures are logged, never thrown.

### Logging — SQLite (`lib/db.js`)

New table:

```sql
CREATE TABLE IF NOT EXISTS meta_capi_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_session_id TEXT,
  event_id TEXT,
  status TEXT,            -- 'sent' | 'failed'
  http_status INTEGER,
  fb_trace_id TEXT,
  response_excerpt TEXT,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Written after the CAPI call resolves. Queryable from the existing `/admin` panel
(admin surfacing is optional, not required for v1).

## Configuration / Secrets

Added to `nsfm-website/.env` (gitignored) and documented in `.env.example`. These are
standard Express `process.env` vars loaded via dotenv (`server.js:5`) — **not** Supabase
secrets, because there is no Edge Function. Production values must also be set in
Hostinger's environment panel (the `.env` file is not deployed).

| Variable | Value / Source |
| --- | --- |
| `META_PIXEL_ID` | `26871724739163641` (existing Pixel) |
| `META_CAPI_ACCESS_TOKEN` | Events Manager → Settings → Conversions API → Generate token |
| `META_TEST_EVENT_CODE` | Optional. Events Manager → Test Events tab. Testing only. |
| `META_API_VERSION` | `v21.0` (default) |

`STRIPE_WEBHOOK_SECRET` is already configured and reused as-is.

## Error Handling

- `isConfigured` guard: if `META_PIXEL_ID` or `META_CAPI_ACCESS_TOKEN` is missing,
  skip silently (log a warning), never throw.
- Network errors, timeouts, and non-2xx responses are all caught, logged to
  `meta_capi_events` as `failed` with the response/error, and **never** break
  fulfillment or the `200` to Stripe.
- Non-2xx Meta responses are logged with body + `fbtrace_id` for debugging.

## Testing

1. Set `META_TEST_EVENT_CODE` in `.env`.
2. Trigger a test purchase: `stripe trigger checkout.session.completed` or a test-mode checkout.
3. Confirm a `sent` row in `meta_capi_events`.
4. Confirm the event appears in Meta Events Manager → **Test Events** tab.
5. Remove `META_TEST_EVENT_CODE` for production.

## Out of Scope (YAGNI)

- No second Stripe webhook endpoint.
- No Supabase Edge Function / Deno runtime.
- No client-side `Purchase` event.
- No `fbp` / `fbc` / buyer-IP capture at checkout (noted as a future match-quality
  enhancement; the webhook request originates from Stripe's servers, so buyer IP/UA are
  not available there and must not be sent).

## Future Enhancements (not now)

- Capture `fbp`/`fbc` cookies + buyer IP/UA at checkout, stash on Stripe session metadata,
  and include in `user_data` for higher Event Match Quality.
- Optionally add a deduplicated client-side `Purchase` on a thank-you page sharing the
  same `event_id`.
- Surface `meta_capi_events` in the `/admin` panel with a retry button for `failed` rows.
