/**
 * BAITUL MANAL — Core API, Admin Operations & Order Engine (server.js)
 * Dual-Storage Architecture: SQLite + Permanent JSON Backup Archive
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'BaitulManal@2026';

// Explicit permissive CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));

// Universal Anti-Cache Middleware (Prevents Stale Cache on Mobile & Desktop)
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Helper: Standardize Kuwait & International Phone Numbers (Ensures 8-digit match)
function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  let digits = String(rawPhone).replace(/\D/g, '');
  if (digits.startsWith('00965')) digits = digits.slice(5);
  else if (digits.startsWith('965')) digits = digits.slice(3);
  return digits.length >= 8 ? digits.slice(-8) : digits;
}

// Locate products.json
function resolveCatalogPath() {
  const potentialPaths = [
    path.join(__dirname, '../assets/data/products.json'),
    path.join(__dirname, '../frontend/assets/data/products.json'),
    path.join(__dirname, 'assets/data/products.json'),
    path.join(__dirname, 'products.json')
  ];

  for (const candidate of potentialPaths) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(__dirname, 'products.json');
}

const catalogPath = resolveCatalogPath();
let memoryCatalog = null;

function getProductsData() {
  if (memoryCatalog && Array.isArray(memoryCatalog) && memoryCatalog.length > 0) {
    return memoryCatalog;
  }
  try {
    if (fs.existsSync(catalogPath)) {
      memoryCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      return memoryCatalog;
    }
  } catch (err) {
    console.error('Error reading catalog:', err.message);
  }
  memoryCatalog = [];
  return memoryCatalog;
}

function saveProductsData(data) {
  memoryCatalog = data;
  try {
    const dir = path.dirname(catalogPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(catalogPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Disk write error:', err.message);
  }
}

// -------------------------------------------------------------
// PERMANENT ORDER & CUSTOMER BACKUP STORAGE ENGINE
// -------------------------------------------------------------
const BACKUP_FILE = path.join(__dirname, 'orders_master_archive.json');
const CUSTOMERS_BACKUP_FILE = path.join(__dirname, 'customers_master_archive.json');

function appendOrderToDisk(orderObj) {
  try {
    let list = [];
    if (fs.existsSync(BACKUP_FILE)) {
      const raw = fs.readFileSync(BACKUP_FILE, 'utf8');
      list = JSON.parse(raw || '[]');
    }
    const idx = list.findIndex(o => o.orderId === orderObj.orderId);
    if (idx >= 0) {
      list[idx] = orderObj;
    } else {
      list.unshift(orderObj);
    }
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(list, null, 2), 'utf8');
    console.log(`💾 Master Archive Updated: ${orderObj.orderId} (Total: ${list.length} records)`);
  } catch (e) {
    console.error('Failed to write master backup archive:', e.message);
  }
}

function getMasterBackupList() {
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      return JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8') || '[]');
    }
  } catch (e) {}
  return [];
}

function appendCustomerToDisk(customerObj) {
  try {
    let list = [];
    if (fs.existsSync(CUSTOMERS_BACKUP_FILE)) {
      list = JSON.parse(fs.readFileSync(CUSTOMERS_BACKUP_FILE, 'utf8') || '[]');
    }
    const idx = list.findIndex(c => c.phone === customerObj.phone);
    if (idx >= 0) list[idx] = customerObj;
    else list.unshift(customerObj);
    fs.writeFileSync(CUSTOMERS_BACKUP_FILE, JSON.stringify(list, null, 2), 'utf8');
    console.log(`👤 Customer Directory Updated: ${customerObj.phone} (Total: ${list.length})`);
  } catch (e) {
    console.error('Failed to write customer archive:', e.message);
  }
}

function getMasterCustomerList() {
  try {
    if (fs.existsSync(CUSTOMERS_BACKUP_FILE)) {
      return JSON.parse(fs.readFileSync(CUSTOMERS_BACKUP_FILE, 'utf8') || '[]');
    }
  } catch (e) {}
  return [];
}

// Restore SQLite from Backup Files if DB is empty after a Render restart
function autoRestoreVault() {
  // 1. Orders
  db.get('SELECT COUNT(*) as count FROM orders', (err, row) => {
    if (err) return;
    if (!row || row.count === 0) {
      const backup = getMasterBackupList();
      if (backup.length > 0) {
        console.log(`🔄 Rehydrating ${backup.length} orders from master archive...`);
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO orders (
            order_id, customer_name, customer_phone, governorate, 
            full_address, payment_method, items_json, subtotal, 
            delivery_fee, grand_total, fulfillment_status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        backup.forEach(o => {
          stmt.run([
            o.orderId,
            o.recipient?.name || 'Customer',
            o.recipient?.phone || '',
            o.recipient?.governorate || 'Kuwait',
            o.recipient?.address || '',
            o.paymentMethod || 'COD',
            JSON.stringify(o.items || []),
            o.subtotal || 0,
            o.deliveryFee || 0,
            o.total || 0,
            o.status || 'PENDING_DISPATCH',
            o.date || new Date().toISOString()
          ]);
        });
        stmt.finalize();
        console.log('✅ Master vault successfully restored.');
      }
    }
  });

  // 2. Customers
  db.get('SELECT COUNT(*) as count FROM customers', (err, row) => {
    if (!err && (!row || row.count === 0)) {
      const customers = getMasterCustomerList();
      if (customers.length > 0) {
        console.log(`🔄 Rehydrating ${customers.length} customer accounts...`);
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO customers (full_name, phone, email, password_hash, created_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        customers.forEach(c => {
          stmt.run([c.fullName, c.phone, c.email || '', c.password, c.created_at || new Date().toISOString()]);
        });
        stmt.finalize();
        console.log('✅ Customer directory successfully restored.');
      }
    }
  });
}

function checkAdminAuth(req) {
  const expectedToken = Buffer.from(ADMIN_PASSWORD).toString('base64');
  const authHeader = req.headers['authorization'];
  const queryToken = req.query.token;

  let provided = '';
  if (authHeader) {
    provided = authHeader.replace(/^Bearer\s+/i, '').trim();
  } else if (queryToken) {
    provided = String(queryToken).trim();
  }

  return provided === expectedToken || provided === ADMIN_PASSWORD;
}

function requireAdmin(req, res, next) {
  if (checkAdminAuth(req)) {
    return next();
  }
  return res.status(403).json({ error: 'Unauthorized. Invalid or expired token.' });
}

// -------------------------------------------------------------
// BASE & HEALTH CHECK ROUTES
// -------------------------------------------------------------

app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #121212; color: #f5f5f5; min-height: 100vh;">
      <h1 style="color: #c5a880;">✨ Baitul Manal API is Live</h1>
      <p>Node.js & SQLite Backend Active</p>
    </div>
  `);
});

app.get('/api/health', (req, res) => {
  const currentCatalog = getProductsData();
  const backup = getMasterBackupList();
  const customers = getMasterCustomerList();
  res.json({
    status: 'Online',
    boutique: 'Baitul Manal Fahaheel',
    catalogItemsLoaded: currentCatalog.length,
    ordersArchived: backup.length,
    registeredClients: customers.length,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = Buffer.from(password).toString('base64');
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, message: 'Invalid Admin Password.' });
});

// Admin: View All Registered Customer Accounts (ID & Password Directory)
app.get('/api/admin/customers', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(403).json({ error: 'Unauthorized. Please verify admin credentials.' });
  }

  db.all('SELECT id, full_name, phone, email, password_hash, created_at FROM customers ORDER BY id DESC', [], (err, rows) => {
    let clientList = [];
    if (!err && rows && rows.length > 0) {
      clientList = rows.map(r => ({
        id: r.id,
        fullName: r.full_name,
        phone: r.phone,
        email: r.email || 'None',
        password: r.password_hash,
        createdAt: r.created_at
      }));
    }

    // Merge persistent backup archive
    try {
      const backupClients = getMasterCustomerList();
      backupClients.forEach(bc => {
        if (!clientList.some(c => c.phone === bc.phone)) {
          clientList.push({
            id: 'ARC',
            fullName: bc.fullName,
            phone: bc.phone,
            email: bc.email || 'None',
            password: bc.password,
            createdAt: bc.created_at || 'Archived'
          });
        }
      });
    } catch (e) {
      console.error('Backup archive read warning:', e.message);
    }

    res.json(clientList);
  });
});

// -------------------------------------------------------------
// CUSTOMER AUTH & MANAGEMENT (MOBILE & DESKTOP ALIGNED)
// -------------------------------------------------------------

app.post('/api/customer/register', (req, res) => {
  const { fullName, phone, email, password } = req.body;
  if (!fullName || !phone || !password) {
    return res.status(400).json({ error: 'Missing details.' });
  }
  const cleanPhone = normalizePhone(phone);
  if (cleanPhone.length < 7) {
    return res.status(400).json({ error: 'Please enter a valid mobile number.' });
  }

  const createdAt = new Date().toISOString();
  const customerRecord = { fullName, phone: cleanPhone, email: email || '', password, created_at: createdAt };

  const sql = `INSERT INTO customers (full_name, phone, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`;
  db.run(sql, [fullName, cleanPhone, email || '', password, createdAt], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Phone number already registered.' });
      }
      appendCustomerToDisk(customerRecord);
      return res.status(201).json({ success: true, user: customerRecord });
    }
    appendCustomerToDisk(customerRecord);
    res.status(201).json({ success: true, user: customerRecord });
  });
});

app.post('/api/customer/login', (req, res) => {
  const { phone, password } = req.body;
  const cleanPhone = normalizePhone(phone);

  if (!cleanPhone || cleanPhone.length < 7) {
    return res.status(400).json({ error: 'Invalid mobile number format.' });
  }

  db.get(`SELECT * FROM customers WHERE phone LIKE ? OR phone = ?`, [`%${cleanPhone}%`, cleanPhone], (err, user) => {
    if (user) {
      if (user.password_hash !== password) {
        return res.status(401).json({ error: 'Incorrect password.' });
      }
      return res.json({
        success: true,
        user: { fullName: user.full_name, phone: user.phone, email: user.email }
      });
    }

    // Fallback search in master backup file
    const backupClients = getMasterCustomerList();
    const matched = backupClients.find(c => c.phone.includes(cleanPhone) || cleanPhone.includes(c.phone));
    if (matched) {
      if (matched.password !== password) {
        return res.status(401).json({ error: 'Incorrect password.' });
      }
      return res.json({
        success: true,
        user: { fullName: matched.fullName, phone: matched.phone, email: matched.email }
      });
    }

    return res.status(404).json({ error: 'Account not found.' });
  });
});

app.post('/api/customer/reset-password', (req, res) => {
  const { phone, newPassword } = req.body;
  const cleanPhone = normalizePhone(phone);

  db.run(`UPDATE customers SET password_hash = ? WHERE phone LIKE ?`, [newPassword, `%${cleanPhone}%`], function (err) {
    const backupClients = getMasterCustomerList();
    const matched = backupClients.find(c => c.phone.includes(cleanPhone));
    if (matched) {
      matched.password = newPassword;
      fs.writeFileSync(CUSTOMERS_BACKUP_FILE, JSON.stringify(backupClients, null, 2), 'utf8');
    }
    res.json({ success: true, message: 'Password updated successfully.' });
  });
});

// -------------------------------------------------------------
// ORDER PROCESSING (DUAL STORAGE)
// -------------------------------------------------------------

app.post('/api/orders', (req, res) => {
  const { recipient, items, paymentMethod, deliveryArea } = req.body;
  if (!recipient || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing details.' });
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
  const orderDate = new Date().toISOString();
  const cleanPhone = normalizePhone(recipient.phone);

  const formattedOrder = {
    orderId,
    date: orderDate,
    recipient: { ...recipient, phone: cleanPhone },
    paymentMethod: paymentMethod || 'COD',
    items: verifiedItems,
    subtotal: verifiedSubtotal,
    deliveryFee,
    total: grandTotal,
    status: 'PENDING_DISPATCH'
  };

  const sql = `
    INSERT INTO orders (
      order_id, customer_name, customer_phone, governorate, 
      full_address, payment_method, items_json, subtotal, 
      delivery_fee, grand_total, fulfillment_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    orderId,
    recipient.name,
    cleanPhone,
    deliveryArea || recipient.governorate || 'Al Ahmadi',
    recipient.address,
    paymentMethod || 'COD',
    JSON.stringify(verifiedItems),
    verifiedSubtotal,
    deliveryFee,
    grandTotal,
    'PENDING_DISPATCH',
    orderDate
  ];

  db.run(sql, params, function (err) {
    if (err) {
      console.error('DB Insert failed:', err.message);
      appendOrderToDisk(formattedOrder);
      return res.status(201).json({ success: true, order: formattedOrder });
    }

    appendOrderToDisk(formattedOrder);
    res.status(201).json({
      success: true,
      order: formattedOrder
    });
  });
});

// Admin Live Orders & Vault Reader
app.get('/api/orders', (req, res) => {
  db.all('SELECT * FROM orders ORDER BY id DESC', [], (err, rows) => {
    if (err || !rows || rows.length === 0) {
      const backup = getMasterBackupList();
      return res.json(backup);
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

    const backup = getMasterBackupList();
    backup.forEach(b => {
      if (!formatted.some(f => f.orderId === b.orderId)) {
        formatted.push(b);
      }
    });

    res.json(formatted);
  });
});

// Update Status (Locked if CANCELLED)
app.patch('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  db.get('SELECT * FROM orders WHERE order_id = ? OR id = ?', [id, id], (err, currentOrder) => {
    if (currentOrder && currentOrder.fulfillment_status === 'CANCELLED') {
      return res.status(403).json({ error: 'Order is permanently locked as CANCELLED.' });
    }

    db.run(`UPDATE orders SET fulfillment_status = ? WHERE order_id = ? OR id = ?`, [status, id, id], function () {
      const backupList = getMasterBackupList();
      const matched = backupList.find(o => o.orderId === id);
      if (matched) {
        matched.status = status;
        fs.writeFileSync(BACKUP_FILE, JSON.stringify(backupList, null, 2), 'utf8');
      }
      res.json({ success: true, orderId: id, status });
    });
  });
});

// Customer Self-Cancel Order (Strictly PENDING_DISPATCH)
app.post('/api/customer/cancel-order', (req, res) => {
  const { orderId, phone } = req.body;
  const cleanPhone = normalizePhone(phone);

  db.get(`SELECT * FROM orders WHERE (order_id = ? OR id = ?)`, [orderId, orderId], (err, row) => {
    if (!row) {
      const backup = getMasterBackupList();
      const bOrder = backup.find(o => o.orderId === orderId);
      if (!bOrder) return res.status(404).json({ error: 'Order not found.' });
      bOrder.status = 'CANCELLED';
      fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2), 'utf8');
      return res.json({ success: true, message: `Order #${orderId} has been cancelled.` });
    }

    if (row.fulfillment_status !== 'PENDING_DISPATCH') {
      return res.status(400).json({ error: 'Orders in tailoring or delivery cannot be self-cancelled.' });
    }

    db.run(`UPDATE orders SET fulfillment_status = 'CANCELLED' WHERE order_id = ?`, [orderId], () => {
      const backup = getMasterBackupList();
      const bOrder = backup.find(o => o.orderId === orderId);
      if (bOrder) {
        bOrder.status = 'CANCELLED';
        fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2), 'utf8');
      }
      res.json({ success: true, message: `Order #${orderId} has been cancelled.` });
    });
  });
});

// Track Order Lookup
app.get('/api/orders/:orderId', (req, res) => {
  let rawQuery = (req.params.orderId || '').trim();
  if (rawQuery.startsWith('#')) rawQuery = rawQuery.substring(1).trim();

  const cleanDigits = normalizePhone(rawQuery);

  const sql = `
    SELECT * FROM orders 
    WHERE LOWER(order_id) = LOWER(?) 
       OR order_id LIKE ? 
       OR customer_phone LIKE ?
    ORDER BY id DESC LIMIT 1
  `;

  db.get(sql, [rawQuery, `%${rawQuery}%`, `%${cleanDigits}%`], (err, row) => {
    if (row) {
      return res.json({
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
    }

    const backup = getMasterBackupList();
    const matched = backup.find(o => 
      o.orderId.toLowerCase() === rawQuery.toLowerCase() || 
      (o.recipient?.phone && o.recipient.phone.includes(cleanDigits))
    );

    if (matched) return res.json(matched);
    return res.status(404).json({ error: 'Order reference not found.' });
  });
});

// Customer Dispatches Lookup
app.get('/api/customer/orders', (req, res) => {
  const phone = normalizePhone(req.query.phone || '');
  if (!phone) return res.json([]);

  db.all(`SELECT * FROM orders WHERE customer_phone LIKE ? ORDER BY id DESC`, [`%${phone}%`], (err, rows) => {
    let result = [];
    if (rows && rows.length > 0) {
      result = rows.map(r => ({
        orderId: r.order_id,
        total: r.grand_total,
        status: r.fulfillment_status || 'PENDING_DISPATCH',
        items: JSON.parse(r.items_json || '[]'),
        date: r.created_at
      }));
    }

    const backup = getMasterBackupList();
    backup.forEach(b => {
      const bPhone = normalizePhone(b.recipient?.phone || '');
      if (bPhone.includes(phone) && !result.some(r => r.orderId === b.orderId)) {
        result.push(b);
      }
    });

    res.json(result);
  });
});

// Catalog Admin
app.get('/api/admin/products', (req, res) => {
  res.json(getProductsData());
});

app.put('/api/admin/products/raw', requireAdmin, (req, res) => {
  saveProductsData(req.body);
  res.json({ success: true, count: req.body.length });
});

// Ensure DB schema and start server
const startServer = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  app.listen(PORT, () => {
    console.log(`🚀 Server online at http://localhost:${PORT}`);
    autoRestoreVault();
  });
};

if (typeof db.init === 'function') {
  db.init().then(startServer).catch((err) => {
    console.error('Failed to init DB:', err);
    process.exit(1);
  });
} else {
  startServer();
}