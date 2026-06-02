const path = require('path');
// Load .env from this file's directory, not process.cwd().
// Under Passenger/Hostinger the cwd may differ from the app root, so an
// unqualified dotenv.config() silently fails to find the file.
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { supabase, isConfigured: supabaseConfigured } = require('./lib/supabase');
const webhookRouter = require('./routes/webhook');
const checkoutRouter = require('./routes/checkout');
const downloadRouter = require('./routes/download');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Trust the first proxy hop so req.ip and rate limiting are correct behind a host/CDN.
app.set('trust proxy', 1);

// --- Stripe webhook FIRST: needs the raw body for signature verification, before express.json() ---
app.use('/webhook', express.raw({ type: 'application/json' }), webhookRouter);

// --- Security headers. CSP tuned for the site's Google Fonts, inline style attributes, and Stripe. ---
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://js.stripe.com', 'https://connect.facebook.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://www.facebook.com'],
        connectSrc: ["'self'", 'https://api.stripe.com', 'https://www.facebook.com', 'https://connect.facebook.net'],
        frameSrc: ['https://js.stripe.com', 'https://hooks.stripe.com'],
        formAction: ["'self'", 'https://checkout.stripe.com'],
        objectSrc: ["'none'"]
      }
    }
  })
);

// --- Body parsing (after the raw webhook mount) ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- Static assets: /public ONLY. /private and /db are never served. ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Rate limiters ---
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many download attempts. Try again in 15 minutes.'
});
const checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/download', downloadLimiter);
app.use('/checkout/create-session', checkoutLimiter);

// --- Feature routes ---
app.use('/checkout', checkoutRouter);
app.use('/download', downloadRouter);
app.use('/admin', adminRouter);

// --- Homepage ---
app.get('/', (req, res) => {
  res.render('index', {
    title: 'The Nervous System Field Manual | Battlefield Essentials',
    meta_description:
      "A Corpsman's Guide to the War Within. Six pillars. Seven tools. Thirty days. Built for veterans, operators, and anyone carrying it alone."
  });
});

// --- Newsletter signup (Supabase) ---
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/newsletter', async (req, res) => {
  if (!supabaseConfigured) {
    return res.status(503).json({ error: 'Newsletter signup is not configured yet.' });
  }

  const email = String(req.body.email || '').trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const { error } = await supabase
    .from('newsletter_signups')
    .insert({ email, source: 'nsfm-landing' });

  if (error) {
    if (error.code === '23505') {
      return res.status(200).json({ message: "You're already on the list." });
    }
    console.error('Newsletter insert failed:', error);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  return res.status(201).json({ message: "You're on the list." });
});

app.listen(PORT, () => {
  console.log(`NSFM website running on http://localhost:${PORT}`);
});
