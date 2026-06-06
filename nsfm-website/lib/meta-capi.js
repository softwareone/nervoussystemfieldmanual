const crypto = require('crypto');

function hashEmail(email) {
  if (!email) return null;
  const normalized = String(email).trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

module.exports = { hashEmail };
