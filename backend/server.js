/**
 * BAITUL MANAL — Core API, Admin Operations & Order Engine (server.js)
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Configuration
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'BaitulManal@2026';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// In-Memory Hot Cache
let memoryCatalog = null;

// Locate products.json across project variations
function resolveCatalogPath() {
  const potentialPaths = [
    path.join(__dirname, '../assets/data/products.json'),
    path.join(__dirname, '../frontend/assets/data/products.json'),
    path.join(__dirname, 'assets/data/products.json'),
    path.join(__dirname, 'products.json')
  ];

  for (const candidate of potentialPaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(__dirname, 'products.json');
}

const catalogPath = resolveCatalogPath();

function getProductsData() {
  if (memoryCatalog && Array.isArray(memoryCatalog) && memoryCatalog.length > 0) {
    return memoryCatalog;
  }
  try {
    if (fs.existsSync(catalogPath)) {
      const rawCatalog = fs.readFileSync(catalogPath, 'utf8');
      memoryCatalog = JSON.parse(rawCatalog);
      return memoryCatalog;
    }
  } catch (err) {
    console.error('Error reading catalog file:', err.message);
  }
  memoryCatalog = [];
  return memoryCatalog;
}

function saveProductsData(data) {
  memoryCatalog = data;
  try {
    const dir = path.dirname(catalogPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(catalogPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ Saved ${data.length} items to ${catalogPath}`);
  } catch (err) {
    console.error('Disk write error (retaining in-memory catalog):', err.message);
  }
}

// -------------------------------------------------------------
// Authentication & Security Middleware
// -------------------------------------------------------------
function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const expectedToken = Buffer.from(ADMIN_PASSWORD).toString('base64');

  if (authHeader && authHeader === `Bearer ${expectedToken}`) {
    return next();
  }
  return res.status(403).json({ error: 'Unauthorized: Invalid or missing administrator credentials.' });
}

// Admin Login Endpoint
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = Buffer.from(password).toString('base64');
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, message: 'Invalid Admin Password.' });
});

// -------------------------------------------------------------
// Public Store & Health Endpoints
// -------------------------------------------------------------

app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: -apple-system, sans-serif; text-align: center; padding-top: 50px; background: #121212; color: #f5f5f5; min-height: 100vh;">
      <h1 style="color: #c5a880;">✨ Baitul Manal API is Live</h1>
      <p>Node.js & SQLite Backend Active</p>
      <p>
        <a href="/api/health" style="color: #c5a880; margin-right: 15px;">Check Health</a>
        <a href="/api/orders" style="color: #c5a880;">View Orders</a>
      </p>
    </div>
  `);
});

app.get('/api/health', (req, res) => {
  const currentCatalog = getProductsData();
  res.json({
    status: 'Online',
    boutique: 'Baitul Manal Fahaheel',
    catalogItemsLoaded: currentCatalog.length,
    timestamp: new Date()
  });
});

// -------------------------------------------------------------
// Customer Authentication & Profile Management Endpoints
// -------------------------------------------------------------

// Customer Registration
app.post('/api/customer/register', (req, res) => {
  const { fullName, phone, email, password } = req.body;
  if (!fullName || !phone || !password) {
    return res.status(400).json({ error: 'Name, Kuwait Phone, and Password are required.' });
  }

  const cleanPhone = phone.replace(/\D/g, '');
  const sql = `INSERT INTO customers (full_name, phone, email, password_hash) VALUES (?, ?, ?, ?)`;

  db.run(sql, [fullName, cleanPhone, email || '', password], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'This phone number is already registered. Please log in.' });
      }
      return res.status(500).json({ error: 'Failed to create customer account.' });
    }
    res.status(201).json({
      success: true,
      user: { fullName, phone: cleanPhone, email: email || '' }
    });
  });
});

// Customer Login
app.post('/api/customer/login', (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone and Password are required.' });
  }

  const cleanPhone = phone.replace(/\D/g, '');
  db.get(`SELECT * FROM customers WHERE phone = ?`, [cleanPhone], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'No account registered with this phone number.' });
    }
    if (user.password_hash !== password) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }
    res.json({
      success: true,
      user: { fullName: user.full_name, phone: user.phone, email: user.email }
    });
  });
});

// Customer Password Reset
app.post('/api/customer/reset-password', (req, res) => {
  const { phone, newPassword } = req.body;
  if (!phone || !newPassword) {
    return res.status(400).json({ error: 'Phone and new password are required.' });
  }

  const cleanPhone = phone.replace(/\D/g, '');
  db.run(`UPDATE customers SET password_hash = ? WHERE phone = ?`, [newPassword, cleanPhone], function (err) {
    if (err || this.changes === 0) {
      return res.status(404).json({ error: 'Phone number not found in our customer records.' });
    }
    res.json({ success: true, message: 'Password updated successfully. Please log in.' });
  });
});

// Customer Self-Service Order Cancellation
app.post('/api/customer/cancel-order', (req, res) => {
  const { orderId, phone } = req.body;
  if (!orderId || !phone) {
    return res.status(400).json({ error: 'Order reference and phone number required.' });
  }

  const cleanPhone = phone.replace(/\D/g, '');
  db.get(`SELECT * FROM orders WHERE order_id = ? AND customer_phone = ?`, [orderId, cleanPhone], (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (row.fulfillment_status !== 'PENDING_DISPATCH') {
      return res.status(400).json({
        error: 'Order has already entered tailoring or courier delivery and cannot be self-cancelled. Please contact our WhatsApp concierge.'
      });
    }

    db.run(`UPDATE orders SET fulfillment_status = 'CANCELLED' WHERE order_id = ?`, [orderId], (err2) => {
      if (err2) return res.status(500).json({ error: 'Failed to cancel order.' });
      res.json({ success: true, message: `Order #${orderId} has been successfully cancelled.` });
    });
  });
});

// -------------------------------------------------------------
// Order Management, Dispatch, Tracking & Profile Endpoints
// -------------------------------------------------------------

// Place Order
app.post('/api/orders', (req, res) => {
  const { recipient, items, paymentMethod, deliveryArea } = req.body;

  if (!recipient || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing customer details or items.' });
  }

  const products = getProductsData();

  let verifiedSubtotal = 0;
  const verifiedItems = items.map((cartItem) => {
    const matched = products.find((p) => String(p.id) === String(cartItem.id) || String(p.sku) === String(cartItem.id));
    const unitPrice = matched ? (Number(matched.salePrice) || Number(matched.price)) : (Number(cartItem.price) || 0);
    const qty = parseInt(cartItem.qty, 10) || 1;
    const lineTotal = unitPrice * qty;
    verifiedSubtotal += lineTotal;

    return {
      id: cartItem.id,
      name: matched ? (matched.name?.en || matched.name) : (cartItem.name || cartItem.id),
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
    deliveryArea || recipient.governorate || 'Al Ahmadi',
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

    console.log(`📦 Order Saved: ${orderId} | Customer: ${recipient.name} | Total: KD ${grandTotal.toFixed(3)}`);

    res.status(201).json({
      success: true,
      order: {
        orderId,
        date: new Date().toISOString(),
        recipient,
        paymentMethod,
        items: verifiedItems,
        subtotal: verifiedSubtotal,
        deliveryFee,
        discount: 0.000,
        total: grandTotal,
        status: 'PENDING_DISPATCH'
      }
    });
  });
});

// Update Order Dispatch Status (Stage Confirmation Engine)
// Update Order Dispatch Status (Locked once CANCELLED)
app.patch('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['PENDING_DISPATCH', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid order status stage.' });
  }

  // Check current order status in SQLite first
  db.get('SELECT fulfillment_status FROM orders WHERE order_id = ? OR id = ?', [id, id], (checkErr, currentOrder) => {
    if (checkErr) {
      return res.status(500).json({ error: 'Database verification failed.' });
    }
    if (!currentOrder) {
      return res.status(404).json({ error: 'Order reference not found.' });
    }

    // STRICT LOCK: Once an order is CANCELLED, it can NEVER be modified
    if (currentOrder.fulfillment_status === 'CANCELLED') {
      return res.status(403).json({ 
        error: 'Forbidden: This order was cancelled by the customer/system and is permanently locked.' 
      });
    }

    const sql = `UPDATE orders SET fulfillment_status = ? WHERE order_id = ? OR id = ?`;
    db.run(sql, [status, id, id], function (updateErr) {
      if (updateErr) {
        console.error('Failed to update order status:', updateErr.message);
        return res.status(500).json({ error: 'Database update failed.' });
      }

      console.log(`🚚 Status Updated: Order ${id} -> ${status}`);
      res.json({ success: true, orderId: id, status });
    });
  });
});

// Retrieve All Orders (Admin Dispatches View - Live No-Cache)
app.get('/api/orders', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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
      status: r.fulfillment_status || 'PENDING_DISPATCH',
      date: r.created_at
    }));
    res.json(formatted);
  });
});

// Order Lookup for Track Order Page
app.get('/api/orders/:orderId', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache');
  const orderId = req.params.orderId.trim();

  db.get('SELECT * FROM orders WHERE order_id = ? OR customer_phone = ? ORDER BY id DESC LIMIT 1', [orderId, orderId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Order not found' });

    res.json({
      orderId: row.order_id,
      recipient: {
        name: row.customer_name,
        phone: row.customer_phone,
        governorate: row.governorate,
        address: row.full_address
      },
      paymentMethod: row.payment_method,
      items: JSON.parse(row.items_json || '[]'),
      subtotal: row.subtotal,
      deliveryFee: row.delivery_fee,
      total: row.grand_total,
      status: row.fulfillment_status || 'PENDING_DISPATCH',
      date: row.created_at
    });
  });
});

// Customer Past Orders Lookup for My Profile
app.get('/api/customer/orders', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache');
  const phone = (req.query.phone || '').trim();
  if (!phone) return res.json([]);

  db.all('SELECT * FROM orders WHERE customer_phone = ? ORDER BY id DESC', [phone], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const list = rows.map(r => ({
      orderId: r.order_id,
      total: r.grand_total,
      status: r.fulfillment_status || 'PENDING_DISPATCH',
      items: JSON.parse(r.items_json || '[]'),
      date: r.created_at
    }));
    res.json(list);
  });
});

// -------------------------------------------------------------
// Admin Inventory & Catalog Control Endpoints
// -------------------------------------------------------------

app.get('/api/admin/products', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    const products = getProductsData();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read catalog data.' });
  }
});

app.put('/api/admin/products/raw', requireAdmin, (req, res) => {
  try {
    const updatedData = req.body;
    if (!Array.isArray(updatedData)) {
      return res.status(400).json({ error: 'Payload must be a JSON array of products.' });
    }
    saveProductsData(updatedData);
    res.json({ success: true, message: 'Inventory synced live!', count: updatedData.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to write catalog file.' });
  }
});

// -------------------------------------------------------------
// Initialize Database and Start Server
// -------------------------------------------------------------
const startServer = () => {
  // Ensure customers table exists
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating customers table:', err.message);
    else console.log('🛡️ Customers authentication table verified.');
  });

  app.listen(PORT, () => {
    console.log(`🚀 Server listening at http://localhost:${PORT}`);
    console.log(`📁 Resolved catalog path: ${catalogPath}`);
  });
};

if (typeof db.init === 'function') {
  db.init()
    .then(startServer)
    .catch((err) => {
      console.error('❌ Failed to initialize database:', err);
      process.exit(1);
    });
} else {
  startServer();
}