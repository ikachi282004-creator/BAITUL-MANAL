document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://baitul-manal-1.onrender.com';

  let catalog = [];
  let ordersList = [];

  const gateCard = document.getElementById('gateCard');
  const dashboardView = document.getElementById('dashboardView');
  const adminPasswordInput = document.getElementById('adminPassword');
  const loginBtn = document.getElementById('loginBtn');
  const gateError = document.getElementById('gateError');
  const logoutBtn = document.getElementById('logoutBtn');
  const inventoryGrid = document.getElementById('inventoryGridContainer');

  // Check persisted session token
  const token = localStorage.getItem('bm_admin_token');
  if (token) {
    unlockPortal();
  }

  loginBtn.addEventListener('click', handleLogin);
  adminPasswordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  async function handleLogin() {
    const password = adminPasswordInput.value.trim();
    if (!password) return;
    gateError.textContent = 'Verifying credentials...';

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
        gateError.textContent = data.message || 'Invalid Admin Password.';
      }
    } catch (e) {
      gateError.textContent = 'Failed to connect to backend service. (Server may be waking up...)';
    }
  }

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('bm_admin_token');
    location.reload();
  });

  async function unlockPortal() {
    gateCard.style.display = 'none';
    dashboardView.style.display = 'block';
    await Promise.all([loadCatalog(), loadOrders()]);
  }

  // Fetch Catalog with Cache-Buster
  async function loadCatalog() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/products?t=${new Date().getTime()}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      catalog = await res.json();
      renderInventoryGrid();
      renderRawJson();
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  }

  // Render Full Visual Card Editor
  function renderInventoryGrid() {
    if (!catalog.length) {
      inventoryGrid.innerHTML = '<p style="color:#888;">No items in catalog. Click "+ Add New Dress" to begin.</p>';
      return;
    }

    inventoryGrid.innerHTML = catalog.map((p, idx) => {
      const titleEn = p.name?.en || (typeof p.name === 'string' ? p.name : '');
      const titleAr = p.name?.ar || '';
      const descEn = p.description?.en || (typeof p.description === 'string' ? p.description : '');
      const regularPrice = p.price || 0;
      const salePrice = p.salePrice !== undefined && p.salePrice !== null ? p.salePrice : '';
      const isSale = salePrice !== '' && Number(salePrice) < Number(regularPrice);
      const imgUrl = p.images?.[0] || p.image || 'assets/images/placeholder.jpg';
      const sizesStr = Array.isArray(p.sizes) ? p.sizes.join(', ') : (p.sizes || 'S, M, L, XL');

      return `
        <div class="product-editor-card" data-index="${idx}">
          <div class="preview-header">
            <img src="${imgUrl}" alt="${titleEn}" id="previewImg_${idx}" onerror="this.src='https://via.placeholder.com/350x240?text=No+Image';">
            <span class="badge-preview-sale" id="saleBadgePreview_${idx}" style="${isSale ? '' : 'display:none;'}">SALE</span>
            <span class="badge-preview-cat" id="catBadgePreview_${idx}">${p.category || 'Collection'}</span>
          </div>

          <div class="card-fields">
            <div class="field-row">
              <div class="field-group" style="flex: 2;">
                <label>SKU / ID</label>
                <input type="text" value="${p.id || p.sku || ''}" class="field-id">
              </div>
              <div class="field-group" style="flex: 3;">
                <label>Category Tag</label>
                <input type="text" value="${p.category || ''}" class="field-category" oninput="document.getElementById('catBadgePreview_${idx}').textContent = this.value">
              </div>
            </div>

            <div class="field-group">
              <label>Image URL</label>
              <input type="text" value="${imgUrl}" class="field-image" oninput="document.getElementById('previewImg_${idx}').src = this.value">
            </div>

            <div class="field-row">
              <div class="field-group">
                <label>Title (English)</label>
                <input type="text" value="${titleEn}" class="field-name-en">
              </div>
              <div class="field-group">
                <label>Title (Arabic)</label>
                <input type="text" value="${titleAr}" class="field-name-ar" dir="rtl">
              </div>
            </div>

            <div class="field-row">
              <div class="field-group">
                <label>Regular Price (KD)</label>
                <input type="number" step="0.001" value="${regularPrice}" class="field-price">
              </div>
              <div class="field-group">
                <label>Sale Price (KD)</label>
                <input type="number" step="0.001" placeholder="Empty if regular" value="${salePrice}" class="field-saleprice" 
                  oninput="document.getElementById('saleBadgePreview_${idx}').style.display = (this.value && Number(this.value) > 0) ? 'inline-block' : 'none'">
              </div>
            </div>

            <div class="field-row">
              <div class="field-group">
                <label>Sizes (comma separated)</label>
                <input type="text" value="${sizesStr}" class="field-sizes">
              </div>
              <div class="field-group">
                <label>Stock Count</label>
                <input type="number" value="${p.stock !== undefined ? p.stock : 10}" class="field-stock">
              </div>
            </div>

            <div class="field-group">
              <label>Product Description</label>
              <textarea class="field-desc">${descEn}</textarea>
            </div>
          </div>

          <div class="card-actions">
            <button class="btn-danger" style="padding: 6px 12px;" onclick="removeProductCard(${idx})">Delete Item</button>
            <span style="font-size: 0.75rem; color:#888;">Item #${idx + 1}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Harvest data from grid and save
  document.getElementById('saveAllInventoryBtn').addEventListener('click', async () => {
    const cards = document.querySelectorAll('.product-editor-card');
    const updatedCatalog = [];

    cards.forEach(card => {
      const id = card.querySelector('.field-id').value.trim();
      const category = card.querySelector('.field-category').value.trim();
      const image = card.querySelector('.field-image').value.trim();
      const nameEn = card.querySelector('.field-name-en').value.trim();
      const nameAr = card.querySelector('.field-name-ar').value.trim();
      const price = parseFloat(card.querySelector('.field-price').value) || 0;
      const saleVal = card.querySelector('.field-saleprice').value.trim();
      const salePrice = saleVal ? parseFloat(saleVal) : null;
      const sizes = card.querySelector('.field-sizes').value.split(',').map(s => s.trim()).filter(Boolean);
      const stock = parseInt(card.querySelector('.field-stock').value, 10) || 0;
      const desc = card.querySelector('.field-desc').value.trim();

      updatedCatalog.push({
        id,
        sku: id,
        category,
        name: { en: nameEn, ar: nameAr },
        price,
        salePrice,
        images: [image],
        sizes,
        stock,
        description: { en: desc, ar: '' }
      });
    });

    await syncToBackend(updatedCatalog);
  });

  // Add Product Button
  document.getElementById('addNewProductBtn').addEventListener('click', () => {
    const newSku = 'BM-DRESS-' + Math.floor(100 + Math.random() * 900);
    catalog.unshift({
      id: newSku,
      sku: newSku,
      category: 'Abayas',
      name: { en: 'New Couture Dress', ar: 'فستان جديد' },
      price: 25.000,
      salePrice: null,
      images: ['assets/images/placeholder.jpg'],
      sizes: ['S', 'M', 'L', 'XL'],
      stock: 12,
      description: { en: 'Luxury tailored silhouette from Fahaheel boutique.', ar: '' }
    });
    renderInventoryGrid();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.removeProductCard = (idx) => {
    if (confirm(`Are you sure you want to remove ${catalog[idx]?.name?.en || 'this dress'}?`)) {
      catalog.splice(idx, 1);
      renderInventoryGrid();
    }
  };

  // Raw JSON sync
  function renderRawJson() {
    document.getElementById('rawJsonTextarea').value = JSON.stringify(catalog, null, 2);
  }

  document.getElementById('saveRawJsonBtn').addEventListener('click', async () => {
    const rawVal = document.getElementById('rawJsonTextarea').value;
    try {
      const parsed = JSON.parse(rawVal);
      await syncToBackend(parsed);
    } catch (e) {
      alert('Invalid JSON syntax: Please check quotes and commas.');
    }
  });

  async function syncToBackend(data) {
    const authToken = localStorage.getItem('bm_admin_token');
    try {
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
        renderInventoryGrid();
        renderRawJson();
        alert('Catalog saved live successfully! Changes are immediately active on the shop.');
      } else {
        alert('Failed to save to server. Check admin authorization.');
      }
    } catch (e) {
      alert('Network error connecting to backend.');
    }
  }

  // Orders Retrieval
  async function loadOrders() {
    try {
      const res = await fetch(`${API_BASE}/api/orders`);
      ordersList = await res.json();
      const tbody = document.getElementById('ordersTableBody');
      if (!ordersList.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#777; padding:20px;">No dispatches registered.</td></tr>';
        return;
      }
      tbody.innerHTML = ordersList.map(o => `
        <tr>
          <td><strong>${o.orderId}</strong></td>
          <td>${o.recipient?.name || 'Customer'}<br><small style="color:#888;">${o.recipient?.phone || ''}</small></td>
          <td>${o.recipient?.governorate || ''}<br><small style="color:#888;">${o.recipient?.address || ''}</small></td>
          <td>${o.paymentMethod || 'K-Net'}</td>
          <td><strong>KD ${Number(o.total || 0).toFixed(3)}</strong></td>
          <td><span style="color:var(--bm-gold);">${o.status || 'Pending'}</span></td>
        </tr>
      `).join('');
    } catch (e) {
      console.warn('Orders fetch error:', e);
    }
  }

  // Tabs navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('paneInventory').style.display = tab === 'inventory' ? 'block' : 'none';
      document.getElementById('paneOrders').style.display = tab === 'orders' ? 'block' : 'none';
      document.getElementById('paneRawJson').style.display = tab === 'raw-json' ? 'block' : 'none';
    });
  });

  document.getElementById('refreshOrdersBtn')?.addEventListener('click', loadOrders);
});