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

  logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem('bm_admin_token');
    location.reload();
  });

  async function unlockPortal() {
    if (gateCard) gateCard.style.display = 'none';
    if (dashboardView) dashboardView.style.display = 'block';
    await Promise.all([loadCatalog(), loadOrders()]);
  }

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

  function renderInventoryGrid() {
    if (!inventoryGrid) return;
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
      const isNew = p.isNew === true;
      const customSaleTag = p.saleTag || (isSale ? `-${Math.round(((regularPrice - salePrice) / regularPrice) * 100)}% OFF` : 'SALE');

      const imgMain = p.images?.[0] || p.image || 'assets/images/placeholder.jpg';
      const imgAlt = p.images?.[1] || '';
      const sizesStr = Array.isArray(p.sizes) ? p.sizes.join(', ') : (p.sizes || 'S, M, L, XL');

      const colorsStr = Array.isArray(p.colors)
        ? p.colors.map(c => `${c.name || 'Color'} ${c.hex || '#000'}`).join(', ')
        : 'Standard #c5a880';

      return `
        <div class="product-editor-card" data-index="${idx}">
          <div class="preview-header">
            <img src="${imgMain}" alt="${titleEn}" id="previewImg_${idx}" onerror="this.src='https://via.placeholder.com/350x240?text=No+Image';">
            <span class="badge-preview-sale" id="saleBadgePreview_${idx}" style="${isSale ? '' : 'display:none;'}">${customSaleTag}</span>
            <span class="badge-preview-new" id="newBadgePreview_${idx}" style="${isNew ? '' : 'display:none;'}">NEW</span>
            <span class="badge-preview-cat" id="catBadgePreview_${idx}">${p.category || 'Collection'}</span>
          </div>

          <div class="card-fields">
            <div class="field-row">
              <label class="checkbox-row" style="flex: 1;">
                <input type="checkbox" class="field-is-new" ${isNew ? 'checked' : ''} 
                  onchange="document.getElementById('newBadgePreview_${idx}').style.display = this.checked ? 'inline-block' : 'none'">
                <span>Mark as NEW</span>
              </label>

              <div class="field-group" style="flex: 2;">
                <label>Custom Sale Tag Text</label>
                <input type="text" value="${customSaleTag}" class="field-saletag" placeholder="-30% OFF / SALE"
                  oninput="document.getElementById('saleBadgePreview_${idx}').textContent = this.value">
              </div>
            </div>

            <div class="field-row">
              <div class="field-group" style="flex: 1.5;">
                <label>SKU / ID</label>
                <input type="text" value="${p.id || p.sku || ''}" class="field-id">
              </div>
              <div class="field-group" style="flex: 2;">
                <label>Category</label>
                <input type="text" value="${p.category || 'women'}" class="field-category" 
                  oninput="document.getElementById('catBadgePreview_${idx}').textContent = this.value">
              </div>
              <div class="field-group" style="flex: 2;">
                <label>SubCategory Tag</label>
                <input type="text" value="${p.subCategory || ''}" class="field-subcategory" placeholder="darra / maid-uniform">
              </div>
            </div>

            <div class="field-row">
              <div class="field-group" style="flex: 1;">
                <label>Main Image URL</label>
                <input type="text" value="${imgMain}" class="field-image-main" 
                  oninput="document.getElementById('previewImg_${idx}').src = this.value">
              </div>
              <div class="field-group" style="flex: 1;">
                <label>Hover Flip Image URL (Alt)</label>
                <input type="text" value="${imgAlt}" class="field-image-alt">
              </div>
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
              <div class="field-group">
                <label>Stock Count</label>
                <input type="number" value="${p.stock !== undefined ? p.stock : 10}" class="field-stock">
              </div>
            </div>

            <div class="field-group">
              <label>Sizes (comma separated)</label>
              <input type="text" value="${sizesStr}" class="field-sizes">
            </div>

            <div class="field-group">
              <label>Color Swatches (Name #hex, separated by comma)</label>
              <input type="text" value="${colorsStr}" class="field-colors" placeholder="Black #000000, Gold #c5a880">
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

  document.getElementById('saveAllInventoryBtn')?.addEventListener('click', async () => {
    const cards = document.querySelectorAll('.product-editor-card');
    const updatedCatalog = [];

    cards.forEach(card => {
      const id = card.querySelector('.field-id').value.trim();
      const isNew = card.querySelector('.field-is-new').checked;
      const saleTag = card.querySelector('.field-saletag').value.trim();
      const category = card.querySelector('.field-category').value.trim();
      const subCategory = card.querySelector('.field-subcategory').value.trim();
      const imageMain = card.querySelector('.field-image-main').value.trim();
      const imageAlt = card.querySelector('.field-image-alt').value.trim();
      const nameEn = card.querySelector('.field-name-en').value.trim();
      const nameAr = card.querySelector('.field-name-ar').value.trim();
      const price = parseFloat(card.querySelector('.field-price').value) || 0;
      const saleVal = card.querySelector('.field-saleprice').value.trim();
      const salePrice = saleVal ? parseFloat(saleVal) : null;
      const stock = parseInt(card.querySelector('.field-stock').value, 10) || 0;
      const sizes = card.querySelector('.field-sizes').value.split(',').map(s => s.trim()).filter(Boolean);

      const colors = card.querySelector('.field-colors').value.split(',').map(c => {
        const parts = c.trim().split(' ');
        const hex = parts.find(p => p.startsWith('#')) || '#c5a880';
        const name = parts.filter(p => !p.startsWith('#')).join(' ') || 'Standard';
        return { name, hex };
      }).filter(c => c.name);

      const desc = card.querySelector('.field-desc').value.trim();
      const images = [imageMain];
      if (imageAlt) images.push(imageAlt);

      updatedCatalog.push({
        id,
        sku: id,
        category,
        subCategory,
        isNew,
        saleTag: saleTag || null,
        name: { en: nameEn, ar: nameAr },
        price,
        salePrice,
        images,
        sizes,
        colors: colors.length ? colors : [{ name: 'Original', hex: '#c5a880' }],
        stock,
        description: { en: desc, ar: '' }
      });
    });

    await syncToBackend(updatedCatalog);
  });

  document.getElementById('addNewProductBtn')?.addEventListener('click', () => {
    const newSku = 'BM-KW-' + Math.floor(100 + Math.random() * 900);
    catalog.unshift({
      id: newSku,
      sku: newSku,
      category: 'women',
      subCategory: 'darra',
      isNew: true,
      saleTag: '-20% OFF',
      name: { en: 'New Couture Darra', ar: 'درّاعة كوتور جديدة' },
      price: 25.000,
      salePrice: 20.000,
      images: ['assets/images/placeholder.jpg'],
      sizes: ['S', 'M', 'L', 'XL'],
      colors: [{ name: 'Emerald', hex: '#1b4d3e' }, { name: 'Gold', hex: '#c5a880' }],
      stock: 10,
      description: { en: 'Handcrafted luxury piece from Baitul Manal Atelier.', ar: '' }
    });
    renderInventoryGrid();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.removeProductCard = (idx) => {
    if (confirm(`Are you sure you want to remove ${catalog[idx]?.name?.en || 'this item'}?`)) {
      catalog.splice(idx, 1);
      renderInventoryGrid();
    }
  };

  function renderRawJson() {
    const el = document.getElementById('rawJsonTextarea');
    if (el) el.value = JSON.stringify(catalog, null, 2);
  }

  document.getElementById('saveRawJsonBtn')?.addEventListener('click', async () => {
    const rawVal = document.getElementById('rawJsonTextarea')?.value;
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

  // Interactive Live Stage Selector in Dispatches View
  async function loadOrders() {
    const tbody = document.getElementById('ordersTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#c5a880; padding:20px;">Fetching dispatches...</td></tr>';
    }

    try {
      const res = await fetch(`${API_BASE}/api/orders?t=${new Date().getTime()}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      ordersList = await res.json();

      if (!Array.isArray(ordersList) || !ordersList.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#777; padding:20px;">No dispatches registered yet.</td></tr>';
        return;
      }

      tbody.innerHTML = ordersList.map(o => `
        <tr>
          <td>
            <strong style="color:var(--bm-gold);">${o.orderId}</strong><br>
            <small style="color:#888;">${o.date ? new Date(o.date).toLocaleDateString('en-GB') : ''}</small>
          </td>
          <td>${o.recipient?.name || 'Customer'}<br><small style="color:#888;">${o.recipient?.phone || ''}</small></td>
          <td>${o.recipient?.governorate || ''}<br><small style="color:#888; word-break: break-word;">${o.recipient?.address || ''}</small></td>
          <td>${o.paymentMethod || 'K-Net'}</td>
          <td><strong>KD ${Number(o.total || 0).toFixed(3)}</strong></td>
          <td>
            <!-- Interactive Stage Selector -->
            ${o.status === 'CANCELLED' ? `
  <div style="display:inline-flex; align-items:center; gap:6px; background: rgba(231,76,60,0.15); border: 1px solid #e74c3c; color: #e74c3c; padding: 6px 12px; border-radius: 4px; font-size: 0.78rem; font-weight: 700; text-transform: uppercase;">
    <span>🔒 Cancelled (Locked)</span>
  </div>
` : `
  <select class="admin-status-dropdown" data-order-id="${o.orderId}" style="background: #181512; color: #c5a880; border: 1px solid rgba(197, 168, 128, 0.4); border-radius: 4px; padding: 6px 10px; font-size: 0.8rem; font-weight: 700; cursor: pointer; outline: none;">
    <option value="PENDING_DISPATCH" ${o.status === 'PENDING_DISPATCH' ? 'selected' : ''}>🟡 Pending Dispatch</option>
    <option value="PROCESSING" ${o.status === 'PROCESSING' ? 'selected' : ''}>🟠 Atelier Tailoring</option>
    <option value="OUT_FOR_DELIVERY" ${o.status === 'OUT_FOR_DELIVERY' ? 'selected' : ''}>🔵 Out for Delivery</option>
    <option value="DELIVERED" ${o.status === 'DELIVERED' ? 'selected' : ''}>🟢 Delivered</option>
    <option value="CANCELLED" ${o.status === 'CANCELLED' ? 'selected' : ''}>🔴 Cancelled</option>
  </select>
`}
          </td>
        </tr>
      `).join('');

      // Attach Live Change Listeners
      tbody.querySelectorAll('.admin-status-dropdown').forEach(select => {
        select.onchange = async (e) => {
          const orderId = e.target.dataset.orderId;
          const newStatus = e.target.value;
          e.target.style.opacity = '0.5';

          try {
            const patchRes = await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus })
            });

            const patchData = await patchRes.json();
            if (patchRes.ok && patchData.success) {
              e.target.style.border = '1px solid #27ae60';
              setTimeout(() => {
                e.target.style.border = '1px solid rgba(197, 168, 128, 0.4)';
                e.target.style.opacity = '1';
              }, 600);
            } else {
              alert(patchData.error || 'Failed to update order status.');
              e.target.style.border = '1px solid #b33939';
              e.target.style.opacity = '1';
            }
          } catch {
            alert('Network error connecting to backend service.');
            e.target.style.border = '1px solid #b33939';
            e.target.style.opacity = '1';
          }
        };
      });

    } catch (e) {
      console.error('Orders fetch error:', e);
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#e74c3c; padding:20px;">Failed to load dispatches from server.</td></tr>';
    }
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('paneInventory').style.display = tab === 'inventory' ? 'block' : 'none';
      document.getElementById('paneOrders').style.display = tab === 'orders' ? 'block' : 'none';
      document.getElementById('paneRawJson').style.display = tab === 'raw-json' ? 'block' : 'none';
      if (tab === 'orders') loadOrders();
    });
  });

  const refreshBtn = document.getElementById('refreshOrdersBtn');
  if (refreshBtn) {
    refreshBtn.onclick = (e) => {
      e.preventDefault();
      loadOrders();
    };
  }
});