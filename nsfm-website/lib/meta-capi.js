const crypto = require('crypto');

function hashEmail(email) {
  if (!email) return null;
  const normalized = String(email).trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

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
