const Stripe = require('stripe');

const secretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = secretKey ? new Stripe(secretKey) : null;

const isConfigured = Boolean(secretKey && process.env.STRIPE_PRICE_ID);

module.exports = { stripe, webhookSecret, isConfigured };
