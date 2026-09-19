/**
 * BAITUL MANAL — Core API & Admin Operations Server (server.js)
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
  // Default target path
  return path.join(__dirname, '../assets/data/products.json');
}

const catalogPath = resolveCatalogPath();

function getProductsData() {
  try {
    if (fs.existsSync(catalogPath)) {
      const rawCatalog = fs.readFileSync(catalogPath, 'utf8');
      return JSON.parse(rawCatalog);
    }
  } catch (err) {
    console.error('Error reading catalog file:', err.message);
  }
  return [];
}

function saveProductsData(data) {
  const dir = path.dirname(catalogPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(catalogPath, JSON.stringify(data, null, 2), 'utf8');
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

// Root Landing
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

// Health Check
app.get('/api/health', (req, res) => {
  const currentCatalog = getProductsData();
  res.json({
    status: 'Online',
    boutique: 'Baitul Manal Fahaheel',
    catalogItemsLoaded: currentCatalog.length,
    timestamp: new Date()
  });
});

// Create Order (Checkout Flow)
app.post('/api/orders', (req, res) => {
  const { recipient, items, paymentMethod, deliveryArea } = req.body;

  if (!recipient || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing customer details or items.' });
  }

  const products = getProductsData();

  // Price verification against catalog
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

// Retrieve Orders
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

// -------------------------------------------------------------
// Admin Inventory & Catalog Control Endpoints
// -------------------------------------------------------------

// Fetch raw catalog
app.get('/api/admin/products', (req, res) => {
  try {
    const products = getProductsData();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read catalog file.' });
  }
});

// Save complete raw JSON payload
app.put('/api/admin/products/raw', requireAdmin, (req, res) => {
  try {
    const updatedData = req.body;
    if (!Array.isArray(updatedData)) {
      return res.status(400).json({ error: 'Payload must be a JSON array of products.' });
    }
    saveProductsData(updatedData);
    res.json({ success: true, message: 'Inventory JSON updated successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to write catalog file.' });
  }
});

// Update specific product entry
app.patch('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    const productId = req.params.id;
    const updates = req.body;
    let products = getProductsData();

    const index = products.findIndex((p) => String(p.id) === String(productId) || String(p.sku) === String(productId));
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    products[index] = { ...products[index], ...updates };
    saveProductsData(products);
    res.json({ success: true, product: products[index] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

// Add new product
app.post('/api/admin/products', requireAdmin, (req, res) => {
  try {
    const newProduct = req.body;
    let products = getProductsData();
    products.push(newProduct);
    saveProductsData(products);
    res.json({ success: true, message: 'Product added successfully.', product: newProduct });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add product.' });
  }
});

// Delete product
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    const productId = req.params.id;
    let products = getProductsData();
    const filtered = products.filter((p) => String(p.id) !== String(productId) && String(p.sku) !== String(productId));
    saveProductsData(filtered);
    res.json({ success: true, message: 'Product removed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product.' });
  }
});

// -------------------------------------------------------------
// Initialize Database and Start Server
// -------------------------------------------------------------
const startServer = () => {
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