const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../lib/db');
const { stripe, webhookSecret } = require('../lib/stripe');
const { sendDownloadEmail } = require('../lib/mailer');
const { createKlaviyoContact } = require('../lib/klaviyo');

// Mounted in server.js with express.raw() BEFORE express.json():
//   app.use('/webhook', express.raw({ type: 'application/json' }), webhookRouter);

const MAX_USES = parseInt(process.env.DOWNLOAD_MAX_USES || '3', 10);
const EXPIRY_HOURS = parseInt(process.env.DOWNLOAD_EXPIRY_HOURS || '48', 10);

const insertOrder = db.prepare(`
  INSERT INTO orders (stripe_session_id, stripe_payment_intent, customer_email, customer_name, amount_paid, currency, fulfilled_at)
  VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
`);
const insertToken = db.prepare(`
  INSERT INTO download_tokens (order_id, token, customer_email, uses_remaining, expires_at)
  VALUES (?, ?, ?, ?, ?)
`);
const findOrder = db.prepare('SELECT id FROM orders WHERE stripe_session_id = ?');

// Order insert + token insert happen atomically so a failure can't leave a half-fulfilled order.
const fulfill = db.transaction((session, token, expiresAt) => {
  const customerEmail = session.customer_details?.email;
  const customerName =
    session.custom_fields?.find((f) => f.key === 'customer_name')?.text?.value || '';

  const orderResult = insertOrder.run(
    session.id,
    session.payment_intent,
    customerEmail,
    customerName,
    session.amount_total,
    session.currency
  );

  insertToken.run(orderResult.lastInsertRowid, token, customerEmail, MAX_USES, expiresAt);
  return { customerEmail, customerName };
});

router.post('/', async (req, res) => {
  if (!stripe || !webhookSecret) {
    console.error('Webhook hit but Stripe is not configured.');
    return res.status(503).send('Webhook not configured.');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Idempotency — Stripe may deliver the same event more than once.
    if (findOrder.get(session.id)) {
      return res.json({ received: true });
    }

    try {
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

      const { customerEmail, customerName } = fulfill(session, token, expiresAt);

      const downloadUrl = `${process.env.BASE_URL}/download/${token}`;
      await sendDownloadEmail({
        email: customerEmail,
        name: customerName,
        downloadUrl,
        maxUses: MAX_USES,
        expiryHours: EXPIRY_HOURS
      });

      createKlaviyoContact({ email: customerEmail, name: customerName }).catch((err) =>
        console.error('Klaviyo sync failed:', err)
      );

      console.log(`✓ Order fulfilled: ${customerEmail} → token ${token}`);
    } catch (err) {
      // Log and still 200 so Stripe doesn't retry forever; recover manually via /admin.
      console.error('Fulfillment error:', err);
    }
  }

  res.json({ received: true });
});

module.exports = router;
