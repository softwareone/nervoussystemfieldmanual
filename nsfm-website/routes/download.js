const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { fetchPdfBuffer } = require('../lib/storage');

const PDF_DISPLAY_NAME = process.env.PDF_DISPLAY_NAME || 'The Nervous System Field Manual';

const findToken = db.prepare('SELECT * FROM download_tokens WHERE token = ?');
// Atomic decrement: only succeeds while uses remain and the link is unexpired.
const consumeUse = db.prepare(`
  UPDATE download_tokens
  SET uses_remaining = uses_remaining - 1,
      last_used_at = CURRENT_TIMESTAMP,
      ip_addresses = ?
  WHERE token = ? AND uses_remaining > 0 AND expires_at > CURRENT_TIMESTAMP
`);

// GET /download/:token — download landing page
router.get('/:token', (req, res) => {
  const record = findToken.get(req.params.token);

  if (!record) return res.status(404).render('expired', expiredLocals('invalid'));
  if (new Date(record.expires_at) < new Date()) {
    return res.status(410).render('expired', expiredLocals('expired'));
  }
  if (record.uses_remaining <= 0) {
    return res.status(410).render('expired', expiredLocals('exhausted'));
  }

  res.render('download', {
    title: 'Download Your Manual — Battlefield Essentials',
    meta_description: 'Your secure download for The Nervous System Field Manual.',
    token: record.token,
    uses_remaining: record.uses_remaining,
    expires_at: record.expires_at,
    pdf_name: PDF_DISPLAY_NAME
  });
});

// GET /download/:token/file — actual PDF stream (from Supabase Storage)
router.get('/:token/file', async (req, res) => {
  const { token } = req.params;
  const record = findToken.get(token);

  if (!record) return res.status(404).send('Not found.');
  if (new Date(record.expires_at) < new Date()) return res.status(410).send('Link expired.');
  if (record.uses_remaining <= 0) return res.status(410).send('Download limit reached.');

  // Fetch the file BEFORE consuming a use — a storage failure must never burn a download.
  let pdf;
  try {
    pdf = await fetchPdfBuffer();
  } catch (err) {
    console.error('PDF fetch failed:', err.message);
    return res.status(500).send('File unavailable. Contact support@nervoussystemfieldmanual.com');
  }

  // Consume one use atomically. If 0 rows changed, someone raced us out.
  const ips = JSON.parse(record.ip_addresses || '[]');
  ips.push(req.ip);
  const result = consumeUse.run(JSON.stringify(ips), token);
  if (result.changes === 0) {
    return res.status(410).send('Download limit reached.');
  }

  const downloadName = PDF_DISPLAY_NAME.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', pdf.length);
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(pdf);
});

function expiredLocals(reason) {
  return {
    title: 'Link Unavailable — Battlefield Essentials',
    meta_description: 'This download link is no longer available.',
    reason
  };
}

module.exports = router;
