/**
 * BAITUL MANAL — API Server (server.js)
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Load catalog for price verification
const catalogPath = path.join(__dirname, '../frontend/assets/data/products.json');
let products = [];
try {
  const rawCatalog = fs.readFileSync(catalogPath, 'utf8');
  products = JSON.parse(rawCatalog);
  console.log(` Loaded ${products.length} products for verification.`);
} catch (err) {
  console.warn('⚠️ Warning: products.json not found at relative path. Fallback active.');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Online', boutique: 'Baitul Manal Fahaheel', timestamp: new Date() });
});

// Receive orders from checkout
app.post('/api/orders', (req, res) => {
  const { recipient, items, paymentMethod, deliveryArea } = req.body;

  if (!recipient || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing customer details or items.' });
  }


  // Calculate verified subtotal
  let verifiedSubtotal = 0;
  const verifiedItems = items.map((cartItem) => {
    const matched = products.find((p) => p.id === cartItem.id);
    const unitPrice = matched ? (matched.salePrice || matched.price) : (cartItem.price || 0);
    const qty = parseInt(cartItem.qty, 10) || 1;
    const lineTotal = unitPrice * qty;
    verifiedSubtotal += lineTotal;

    return {
      id: cartItem.id,
      name: matched ? (matched.name.en || matched.name) : cartItem.id,
      size: cartItem.size || 'M',
      color: cartItem.color || 'Standard',
      unitPrice,
      qty,
      lineTotal
    };
  });

  const isFree = verifiedSubtotal >= 20.000;
  const deliveryFee = isFree ? 0.000 : 1.500;
  const grandTotal = verifiedSubtotal + deliveryFee;
  const orderId = 'BM-KW-2026-' + Math.floor(1000 + Math.random() * 9000);

  const sql = `
    INSERT INTO orders (
      order_id, customer_name, customer_phone, governorate, 
      full_address, payment_method, items_json, subtotal, 
      delivery_fee, grand_total, fulfillment_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    orderId,
    recipient.name,
    recipient.phone,
    deliveryArea || 'Al Ahmadi',
    recipient.address,
    paymentMethod || 'K-Net Local Debit',
    JSON.stringify(verifiedItems),
    verifiedSubtotal,
    deliveryFee,
    grandTotal,
    'PENDING_DISPATCH'
  ];

  db.run(sql, params, function (err) {
    if (err) {
      console.error('❌ Database insert error:', err.message);
      return res.status(500).json({ error: 'Failed to record order.' });
    }

    console.log(` Order Saved: ${orderId} | Customer: ${recipient.name} | Total: KD ${grandTotal.toFixed(3)}`);

    res.status(201).json({
      success: true,
      order: {
        orderId,
        date: new Date().toLocaleDateString('en-GB'),
        recipient,
        paymentMethod,
        items: verifiedItems,
        subtotal: verifiedSubtotal,
        deliveryFee,
        discount: 0.000,
        total: grandTotal
      }
    });
  });
});
// GET /api/orders — Fetch all orders from SQLite database
app.get('/api/orders', (req, res) => {
  db.all('SELECT * FROM orders ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const formatted = rows.map((r) => ({
      orderId: r.order_id,
      recipient: {
        name: r.customer_name,
        phone: r.customer_phone,
        governorate: r.governorate,
        address: r.full_address
      },
      paymentMethod: r.payment_method,
      items: JSON.parse(r.items_json || '[]'),
      subtotal: r.subtotal,
      deliveryFee: r.delivery_fee,
      total: r.grand_total,
      status: r.fulfillment_status,
      date: r.created_at
    }));
    res.json(formatted);
  });
});
// Add right before app.listen()
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
      <h1>✨ Baitul Manal API is Live</h1>
      <p>Node.js & SQLite Backend Active</p>
      <p><a href="/api/health">Check Health</a> | <a href="/api/orders">View Orders</a></p>
    </div>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening at http://localhost:${PORT}`);
});