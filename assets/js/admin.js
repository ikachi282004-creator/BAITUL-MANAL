document.addEventListener('DOMContentLoaded', () => {
  // Use your live Render Web Service URL
  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://your-render-backend-name.onrender.com'; // Replace with your Render backend URL

  let catalog = [];
  let ordersList = [];

  const gateCard = document.getElementById('gateCard');
  const dashboardView = document.getElementById('dashboardView');
  const adminPasswordInput = document.getElementById('adminPassword');
  const loginBtn = document.getElementById('loginBtn');
  const gateError = document.getElementById('gateError');
  const logoutBtn = document.getElementById('logoutBtn');

  // Check saved token
  const token = localStorage.getItem('bm_admin_token');
  if (token) {
    unlockPortal();
  }

  loginBtn.addEventListener('click', async () => {
    const password = adminPasswordInput.value.trim();
    if (!password) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('bm_admin_token', data.token);
        unlockPortal();
      } else {
        gateError.textContent = data.message || 'Incorrect password.';
      }
    } catch (e) {
      gateError.textContent = 'Failed to connect to backend server.';
    }
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('bm_admin_token');
    location.reload();
  });

  async function unlockPortal() {
    gateCard.style.display = 'none';
    dashboardView.style.display = 'block';
    await Promise.all([loadOrders(), loadCatalog()]);
  }

  // Fetch Orders
  async function loadOrders() {
    try {
      const res = await fetch(`${API_BASE}/api/orders`);
      ordersList = await res.json();
      renderOrders();
    } catch (e) {
      console.warn('Orders fetch error:', e);
    }
  }

  function renderOrders() {
    const tbody = document.getElementById('ordersTableBody');
    if (!ordersList.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#777;">No customer orders found.</td></tr>';
      return;
    }
    tbody.innerHTML = ordersList.map(o => `
      <tr>
        <td><strong>${o.orderId}</strong><br><small style="color:#888;">${o.date || ''}</small></td>
        <td>${o.recipient?.name || 'Guest'}<br><small style="color:#888;">${o.recipient?.phone || ''}</small></td>
        <td>${o.recipient?.governorate || ''}<br><small style="color:#888;">${o.recipient?.address || ''}</small></td>
        <td>${o.paymentMethod || 'K-Net'}</td>
        <td><strong>KD ${Number(o.total || 0).toFixed(3)}</strong></td>
        <td><span style="color:#c5a880;">${o.status || 'Pending'}</span></td>
        <td><button class="btn" style="padding:4px 8px; font-size:12px;" onclick="alert('Dispatch confirmed for ${o.orderId}')">Ship</button></td>
      </tr>
    `).join('');
  }

  // Fetch Products
  async function loadCatalog() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/products`);
      catalog = await res.json();
      renderInventoryTable();
      renderRawJson();
    } catch (e) {
      console.error('Catalog fetch error:', e);
    }
  }

  function renderInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = catalog.map((p, index) => `
      <tr data-index="${index}">
        <td><input type="text" value="${p.sku || p.id}" class="row-sku"></td>
        <td><input type="text" value="${p.name?.en || p.name || ''}" class="row-name"></td>
        <td><input type="text" value="${p.category || ''}" class="row-cat"></td>
        <td><input type="number" step="0.001" value="${p.price || 0}" class="row-price"></td>
        <td><input type="number" step="0.001" value="${p.salePrice || ''}" class="row-saleprice"></td>
        <td><input type="text" value="${(p.sizes || []).join(', ')}" class="row-sizes"></td>
        <td><button class="btn btn-danger" style="padding:4px 8px;" onclick="deleteProduct('${p.id || p.sku}')">✕</button></td>
      </tr>
    `).join('');
  }

  function renderRawJson() {
    const textarea = document.getElementById('rawJsonTextarea');
    textarea.value = JSON.stringify(catalog, null, 2);
  }

  // Save Inline Changes
  document.getElementById('saveInlineChangesBtn').addEventListener('click', async () => {
    const rows = document.querySelectorAll('#inventoryTableBody tr');
    rows.forEach(row => {
      const idx = row.dataset.index;
      if (catalog[idx]) {
        catalog[idx].sku = row.querySelector('.row-sku').value;
        if (typeof catalog[idx].name === 'object') {
          catalog[idx].name.en = row.querySelector('.row-name').value;
        } else {
          catalog[idx].name = row.querySelector('.row-name').value;
        }
        catalog[idx].category = row.querySelector('.row-cat').value;
        catalog[idx].price = parseFloat(row.querySelector('.row-price').value) || 0;
        const saleVal = row.querySelector('.row-saleprice').value;
        catalog[idx].salePrice = saleVal ? parseFloat(saleVal) : null;
        catalog[idx].sizes = row.querySelector('.row-sizes').value.split(',').map(s => s.trim()).filter(Boolean);
      }
    });

    await syncRawJson(catalog);
  });

  // Save Raw JSON Editor
  document.getElementById('saveRawJsonBtn').addEventListener('click', async () => {
    const status = document.getElementById('jsonStatus');
    const rawVal = document.getElementById('rawJsonTextarea').value;
    try {
      const parsed = JSON.parse(rawVal);
      await syncRawJson(parsed);
      status.style.color = '#2ecc71';
      status.textContent = '✓ Saved successfully!';
      setTimeout(() => status.textContent = '', 3000);
    } catch (err) {
      status.style.color = '#ff5252';
      status.textContent = '✕ Invalid JSON syntax. Please verify commas, brackets, and quotes.';
    }
  });

  async function syncRawJson(data) {
    const authToken = localStorage.getItem('bm_admin_token');
    const res = await fetch(`${API_BASE}/api/admin/products/raw`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      catalog = data;
      renderInventoryTable();
      renderRawJson();
      alert('Inventory saved successfully!');
    } else {
      alert('Failed to save inventory updates. Check permissions.');
    }
  }

  window.deleteProduct = async (id) => {
    if (!confirm(`Are you sure you want to delete item ${id}?`)) return;
    const authToken = localStorage.getItem('bm_admin_token');
    const res = await fetch(`${API_BASE}/api/admin/products/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      loadCatalog();
    }
  };

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('paneOrders').style.display = tab === 'orders' ? 'block' : 'none';
      document.getElementById('paneInventory').style.display = tab === 'inventory' ? 'block' : 'none';
      document.getElementById('paneRawJson').style.display = tab === 'raw-json' ? 'block' : 'none';
    });
  });

  document.getElementById('refreshOrdersBtn')?.addEventListener('click', loadOrders);
});