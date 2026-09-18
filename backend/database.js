/**
 * BAITUL MANAL — SQLite Database Connector
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'orders.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Could not connect to SQLite database:', err.message);
  } else {
    console.log(' Connected to SQLite database: orders.db');
  }
});

// Setup orders table
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
  `);
});

module.exports = db;