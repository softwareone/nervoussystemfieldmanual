const express = require('express');
const router = express.Router();
const db = require('../lib/db');

// Key gate. If ADMIN_SECRET is unset, the panel is disabled entirely.
router.use((req, res, next) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.query.key !== secret) {
    return res.status(403).send('Forbidden');
  }
  next();
});

function esc(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

router.get('/', (req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200')
    .all();
  const tokens = db
    .prepare('SELECT * FROM download_tokens ORDER BY created_at DESC LIMIT 200')
    .all();

  const totals = db
    .prepare('SELECT COUNT(*) AS count, COALESCE(SUM(amount_paid), 0) AS revenue FROM orders')
    .get();

  const orderRows = orders
    .map(
      (o) => `<tr>
        <td>${o.id}</td>
        <td>${esc(o.customer_email)}</td>
        <td>${esc(o.customer_name)}</td>
        <td>$${(o.amount_paid / 100).toFixed(2)} ${esc((o.currency || '').toUpperCase())}</td>
        <td>${esc(o.created_at)}</td>
        <td>${o.fulfilled_at ? 'yes' : 'no'}</td>
        <td>${o.klaviyo_synced ? 'yes' : 'no'}</td>
      </tr>`
    )
    .join('');

  const tokenRows = tokens
    .map(
      (t) => `<tr>
        <td>${esc(t.token)}</td>
        <td>${esc(t.customer_email)}</td>
        <td>${t.uses_remaining}</td>
        <td>${esc(t.expires_at)}</td>
        <td>${esc(t.last_used_at || '—')}</td>
        <td>${esc(t.ip_addresses)}</td>
      </tr>`
    )
    .join('');

  res.set('Content-Type', 'text/html').send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>NSFM Admin</title>
<style>
  body { background:#0E0F10; color:#F2EFE8; font-family:system-ui,sans-serif; margin:0; padding:32px; }
  h1 { color:#CC9029; font-size:18px; letter-spacing:0.1em; text-transform:uppercase; }
  h2 { color:#CC9029; font-size:14px; letter-spacing:0.08em; margin-top:40px; }
  .stats { display:flex; gap:32px; margin:24px 0; }
  .stat { background:#1A1B18; border:1px solid #2A2B28; padding:16px 24px; }
  .stat b { display:block; font-size:28px; color:#E8A832; }
  .stat span { color:#8A8578; font-size:12px; text-transform:uppercase; letter-spacing:0.08em; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th,td { text-align:left; padding:8px 10px; border-bottom:1px solid #2A2B28; }
  th { color:#8A8578; text-transform:uppercase; font-size:11px; letter-spacing:0.06em; }
  td { color:#C8C4BC; word-break:break-all; }
</style></head>
<body>
  <h1>NSFM Admin</h1>
  <div class="stats">
    <div class="stat"><b>${totals.count}</b><span>Total Orders</span></div>
    <div class="stat"><b>$${(totals.revenue / 100).toFixed(2)}</b><span>Total Revenue</span></div>
  </div>

  <h2>Recent Orders</h2>
  <table>
    <tr><th>ID</th><th>Email</th><th>Name</th><th>Amount</th><th>Created</th><th>Fulfilled</th><th>Klaviyo</th></tr>
    ${orderRows || '<tr><td colspan="7">No orders yet.</td></tr>'}
  </table>

  <h2>Download Tokens</h2>
  <table>
    <tr><th>Token</th><th>Email</th><th>Uses Left</th><th>Expires</th><th>Last Used</th><th>IPs</th></tr>
    ${tokenRows || '<tr><td colspan="6">No tokens yet.</td></tr>'}
  </table>
</body></html>`);
});

module.exports = router;
