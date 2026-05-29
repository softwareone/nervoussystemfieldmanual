const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../db');
fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, 'nsfm.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stripe_session_id TEXT UNIQUE NOT NULL,
    stripe_payment_intent TEXT,
    customer_email TEXT NOT NULL,
    customer_name TEXT,
    amount_paid INTEGER,
    currency TEXT DEFAULT 'usd',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    fulfilled_at DATETIME,
    klaviyo_synced INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS download_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id),
    token TEXT UNIQUE NOT NULL,
    customer_email TEXT NOT NULL,
    uses_remaining INTEGER DEFAULT 3,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,
    ip_addresses TEXT DEFAULT '[]'
  );
`);

module.exports = db;
