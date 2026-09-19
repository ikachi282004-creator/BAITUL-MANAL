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

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Universal Anti-Cache Middleware
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

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
// PERMANENT ORDER BACKUP STORAGE ENGINE
// -------------------------------------------------------------
const BACKUP_FILE = path.join(__dirname, 'orders_master_archive.json');

function appendOrderToDisk(orderObj) {
  try {
    let list = [];
    if (fs.existsSync(BACKUP_FILE)) {
      const raw = fs.readFileSync(BACKUP_FILE, 'utf8');
      list = JSON.parse(raw || '[]');
    }
    // Update or insert
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

// Restore SQLite from Backup File if DB is empty after a Render restart
function autoRestoreVault() {
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
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const expectedToken = Buffer.from(ADMIN_PASSWORD).toString('base64');
  if (authHeader && authHeader === `Bearer ${expectedToken}`) {
    return next();
  }
  return res.status(403).json({ error: 'Unauthorized' });
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = Buffer.from(password).toString('base64');
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, message: 'Invalid Admin Password.' });
});

app.get('/', (req, res) => {
  res.send('<h1 style="color:#c5a880;text-align:center;padding-top:40px;">Baitul Manal Secure API Live</h1>');
});

// -------------------------------------------------------------
// CUSTOMER AUTH & ORDERS
// -------------------------------------------------------------

app.post('/api/customer/register', (req, res) => {
  const { fullName, phone, email, password } = req.body;
  if (!fullName || !phone || !password) {
    return res.status(400).json({ error: 'Missing details.' });
  }
  const cleanPhone = phone.replace(/\D/g, '');
  const sql = `INSERT INTO customers (full_name, phone, email, password_hash) VALUES (?, ?, ?, ?)`;
  db.run(sql, [fullName, cleanPhone, email || '', password], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Phone number already registered.' });
      }
      return res.status(500).json({ error: 'Failed to create account.' });
    }
    res.status(201).json({ success: true, user: { fullName, phone: cleanPhone, email: email || '' } });
  });
});

app.post('/api/customer/login', (req, res) => {
  const { phone, password } = req.body;
  const cleanPhone = (phone || '').replace(/\D/g, '');
  db.get(`SELECT * FROM customers WHERE phone = ?`, [cleanPhone], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'Account not found.' });
    if (user.password_hash !== password) return res.status(401).json({ error: 'Incorrect password.' });
    res.json({ success: true, user: { fullName: user.full_name, phone: user.phone, email: user.email } });
  });
});

app.post('/api/customer/reset-password', (req, res) => {
  const { phone, newPassword } = req.body;
  const cleanPhone = (phone || '').replace(/\D/g, '');
  db.run(`UPDATE customers SET password_hash = ? WHERE phone = ?`, [newPassword, cleanPhone], function (err) {
    if (err || this.changes === 0) return res.status(404).json({ error: 'Account not found.' });
    res.json({ success: true, message: 'Password updated successfully.' });
  });
});

// Place Order (With Double Backup)
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

  const formattedOrder = {
    orderId,
    date: orderDate,
    recipient,
    paymentMethod: paymentMethod || 'COD',
    items: verifiedItems,
    subtotal: verifiedSubtotal,
    deliveryFee,
    total: grandTotal,
    status: 'PENDING_DISPATCH'
  };

  // 1. Save to SQLite
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
    recipient.phone,
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
      // Fallback: save to JSON anyway
      appendOrderToDisk(formattedOrder);
      return res.status(201).json({ success: true, order: formattedOrder });
    }

    // 2. Save directly to Permanent Disk Archive
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
      // Fallback to disk archive if SQLite was cleared by Render restart
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

    // Merge any missing backup records into response
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
      // Update disk backup copy as well
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

// Customer Self-Cancel Order
app.post('/api/customer/cancel-order', (req, res) => {
  const { orderId, phone } = req.body;
  const cleanPhone = (phone || '').replace(/\D/g, '');

  db.get(`SELECT * FROM orders WHERE (order_id = ? OR id = ?)`, [orderId, orderId], (err, row) => {
    if (!row) {
      // Check backup
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

  const cleanDigits = rawQuery.replace(/\D/g, '');
  const last8Digits = cleanDigits.length >= 8 ? cleanDigits.slice(-8) : cleanDigits;

  const sql = `
    SELECT * FROM orders 
    WHERE LOWER(order_id) = LOWER(?) 
       OR order_id LIKE ? 
       OR customer_phone = ? 
       OR (length(?) >= 8 AND customer_phone LIKE ?)
    ORDER BY id DESC LIMIT 1
  `;

  db.get(sql, [rawQuery, `%${rawQuery}%`, rawQuery, last8Digits, `%${last8Digits}%`], (err, row) => {
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

    // Fallback: check backup archive
    const backup = getMasterBackupList();
    const matched = backup.find(o => 
      o.orderId.toLowerCase() === rawQuery.toLowerCase() || 
      (o.recipient?.phone && o.recipient.phone.includes(last8Digits))
    );

    if (matched) return res.json(matched);
    return res.status(404).json({ error: 'Order reference not found.' });
  });
});

// Customer Dispatches Lookup
app.get('/api/customer/orders', (req, res) => {
  const phone = (req.query.phone || '').replace(/\D/g, '');
  if (!phone) return res.json([]);
  const last8 = phone.length >= 8 ? phone.slice(-8) : phone;

  db.all(`SELECT * FROM orders WHERE customer_phone LIKE ? ORDER BY id DESC`, [`%${last8}%`], (err, rows) => {
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

    // Merge backup list
    const backup = getMasterBackupList();
    backup.forEach(b => {
      const bPhone = (b.recipient?.phone || '').replace(/\D/g, '');
      if (bPhone.includes(last8) && !result.some(r => r.orderId === b.orderId)) {
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

// Start Server & Auto-Restore
app.listen(PORT, () => {
  console.log(`🚀 Server online at http://localhost:${PORT}`);
  autoRestoreVault();
});