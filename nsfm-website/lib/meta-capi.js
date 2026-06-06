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

module.exports = { hashEmail, buildPurchasePayload };
