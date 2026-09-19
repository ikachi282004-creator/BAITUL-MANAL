const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.resolve(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'boutique.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to open SQLite database:', err.message);
  } else {
    console.log(`📦 SQLite Connected at: ${dbPath}`);
  }
});

// Auto-initialize orders table
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE,
      customer_name TEXT,
      customer_phone TEXT,
      governorate TEXT,
      full_address TEXT,
      payment_method TEXT,
      items_json TEXT,
      subtotal REAL,
      delivery_fee REAL,
      grand_total REAL,
      fulfillment_status TEXT DEFAULT 'PENDING_DISPATCH',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating orders table:', err.message);
    } else {
      console.log('✅ Orders table ready & verified.');
    }
  });
});

module.exports = db;