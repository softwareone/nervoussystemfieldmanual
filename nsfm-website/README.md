# The Nervous System Field Manual — Website

Landing page for *The Nervous System Field Manual: A Corpsman's Guide to the War Within* by Bobby L. Harris, published under the **Battlefield Essentials** brand.

Built with Node.js + Express + EJS. Vanilla CSS, no build step.

## Setup

```bash
npm install
npm start
```

Then open <http://localhost:3000>.

For live-reload during development:

```bash
npm run dev
```

## Structure

```
nsfm-website/
├── server.js              Express server
├── package.json
├── public/
│   ├── css/styles.css     All styling (brand tokens + layout)
│   ├── js/main.js         Mobile nav + scroll reveals
│   └── images/            Placeholder asset folder
└── views/
    ├── index.ejs          Landing page (all 11 sections)
    └── partials/
        ├── header.ejs      <head>, fonts, sticky nav
        └── footer.ejs      Footer + crisis line + scripts
```

## Sections

Hero · Authority Bar · The North Star · Letter from Bobby · Six Pillars ·
Seven Tools · Who This Is For · Deliverables · Pricing · Crisis Notice · Footer

## Notes

- The Veterans Crisis Line (dial **988**, press **1**, or text **838255**) appears in the crisis notice, the footer, the download page, and the delivery email.

---

# Ebook Purchase & Delivery System

A customer pays via Stripe → a secure, single-use, time-limited download link is
emailed → they download the PDF. Owned infrastructure, no third-party fulfillment.

```
GET THE MANUAL → /checkout → Stripe Checkout → webhook fulfills order
  → token created → delivery email sent → /download/:token → PDF stream
  → link dies after DOWNLOAD_MAX_USES uses or DOWNLOAD_EXPIRY_HOURS hours
```

### Added structure

```
nsfm-website/
├── private/                         The paid PDF lives here (gitignored, never served statically)
│   └── nervous-system-field-manual.pdf
├── db/nsfm.db                        SQLite (auto-created; gitignored)
├── routes/{checkout,webhook,download,admin}.js
├── lib/{db,stripe,mailer,klaviyo}.js
├── views/{checkout,success,download,expired}.ejs
└── .env.example
```

### Environment

Copy `.env.example` to `.env` and fill in the values. See that file for the full
reference. The site boots without Stripe/SMTP/Klaviyo keys — those features simply
return a "not configured" response until their keys are set.

### Stripe setup

1. Create a Stripe account at stripe.com.
2. Dashboard → Products → Create product:
   - Name: "The Nervous System Field Manual — Digital Edition"
   - Price: **$27.00 USD, one-time** → copy the Price ID (`price_…`) into `STRIPE_PRICE_ID`.
3. Copy your Secret (`sk_…`) and Publishable (`pk_…`) keys into `.env`.
4. Webhook: Dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://yourdomain.com/webhook`
   - Event: `checkout.session.completed`
   - Copy the Signing Secret (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.
5. Local testing: `stripe listen --forward-to localhost:3000/webhook`
   (the CLI prints a `whsec_…` to use locally).

### The PDF

Place the real PDF at `private/<PDF_FILENAME>` on the server. It is gitignored and
must **never** be committed or placed in `/public`. It is served only through the
authenticated token route.

### Admin panel

`GET /admin?key=<ADMIN_SECRET>` — orders, token status, total revenue. Set a long
random `ADMIN_SECRET` before deploying. The panel is disabled if it's unset.

### Security notes

- `/private` and `/db` are never served statically — only `/public` is.
- Stripe webhook signature is verified against the **raw** body (mounted before `express.json()`).
- Tokens are UUID v4 (122 bits of entropy). Use is decremented atomically.
- All SQL uses prepared statements. Admin output is HTML-escaped.
- `helmet` sets security headers with a CSP tuned for Google Fonts + Stripe.
- Rate limits: `/download` 10/15min, `/checkout/create-session` 5/hr per IP.

## Pre-launch testing

- [ ] Place a test order with Stripe test card `4242 4242 4242 4242`.
- [ ] Confirm the webhook fires and the order appears in `/admin`.
- [ ] Confirm the email arrives with a working download link.
- [ ] Open the link — confirm the landing page shows correct uses/expiry.
- [ ] Click "Download Now" — confirm the PDF streams and saves.
- [ ] Exhaust the downloads — confirm the next attempt shows the exhausted page.
- [ ] Force-expire a token in the DB — confirm the expired page shows.
- [ ] Confirm `private/<PDF>` is NOT reachable via a direct URL.
- [ ] Confirm the Klaviyo contact appears in the NSFM Buyers list.
- [ ] Test `/admin?key=<ADMIN_SECRET>`.

---

Battlefield Essentials — *Forged by Discipline.*
