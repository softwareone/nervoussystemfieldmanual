const express = require('express');
const router = express.Router();
const { stripe, isConfigured } = require('../lib/stripe');

const META = {
  meta_description: 'Get The Nervous System Field Manual — Digital Edition. Instant download. Secure checkout via Stripe.'
};

function baseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
}

// GET /checkout — pre-checkout page
router.get('/', (req, res) => {
  res.render('checkout', {
    title: 'Get the Manual — Battlefield Essentials',
    meta_description: META.meta_description,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || ''
  });
});

// POST /checkout/create-session — create Stripe Checkout session
router.post('/create-session', async (req, res) => {
  if (!isConfigured || !stripe) {
    return res.status(503).json({ error: 'Checkout is not configured yet.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${baseUrl(req)}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl(req)}/checkout`,
      customer_email: req.body.email || undefined,
      metadata: { product: 'nsfm-ebook', version: '1.0' },
      custom_fields: [
        {
          key: 'customer_name',
          label: { type: 'custom', custom: 'Your name' },
          type: 'text',
          optional: true
        }
      ]
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe session error:', err);
    res.status(500).json({ error: 'Could not create checkout session.' });
  }
});

// GET /checkout/success
router.get('/success', (req, res) => {
  res.render('success', {
    title: 'Order Confirmed — Check Your Email',
    meta_description: 'Your order is confirmed. Your download link is on its way to your inbox.',
    session_id: req.query.session_id || ''
  });
});

module.exports = router;
