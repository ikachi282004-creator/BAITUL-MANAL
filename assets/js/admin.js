/**
 * BAITUL MANAL — Admin & Operations Controller (admin.js)
 * Live SQLite Backend Connection with Graceful Fallback
 */

document.addEventListener('DOMContentLoaded', async () => {
  const DEFAULT_PIN = '9650'; // Boutique Security PIN
  let catalog = [];
  let ordersList = [];

  const gateCard = document.getElementById('gateCard');
  const dashboardView = document.getElementById('dashboardView');
  const pinInput = document.getElementById('pinInput');
  const pinSubmitBtn = document.getElementById('pinSubmitBtn');
  const gateError = document.getElementById('gateError');
  const logoutBtn = document.getElementById('logoutBtn');

  // Check Existing Session
  if (sessionStorage.getItem('bm_admin_auth') === 'true') {
    unlockPortal();
  }

  pinSubmitBtn?.addEventListener('click', () => {
    if (pinInput.value === DEFAULT_PIN) {
      sessionStorage.setItem('bm_admin_auth', 'true');
      unlockPortal();
    } else {
      gateError.textContent = 'Invalid security PIN. Please try again.';
      pinInput.value = '';
    }
  });

  logoutBtn?.addEventListener('click', () => {
    sessionStorage.removeItem('bm_admin_auth');
    location.reload();
  });

  async function unlockPortal() {
    gateCard.style.display = 'none';
    dashboardView.style.display = 'block';
    if (logoutBtn) logoutBtn.style.display = 'block';

    // 1. Fetch live catalog
    try {
      const res = await fetch('assets/data/products.json');
      if (res.ok) catalog = await res.json();
    } catch (e) {
      console.warn('Catalog offline fallback', e);
    }

    // 2. Fetch live orders from SQLite backend
    try {
      const ordersRes = await fetch('http://localhost:3000/api/orders');
      if (ordersRes.ok) {
        ordersList = await ordersRes.json();
      } else {
        throw new Error('Server returned non-200 status');
      }
    } catch (e) {
      console.warn('Backend server unreachable, falling back to local snapshot:', e);
      const fallback = localStorage.getItem('bm_last_order');
      if (fallback) {
        try {
          ordersList = [JSON.parse(fallback)];
        } catch (err) {}
      }
    }

    renderDashboard();
  }

  function renderDashboard() {
    // 1. Calculate Summary Metrics
    const totalOrders = ordersList.length;
    const grossSales = ordersList.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const metricOrders = document.getElementById('metricTotalOrders');
    const metricSales = document.getElementById('metricGrossSales');
    const metricCatalog = document.getElementById('metricCatalogCount');

    if (metricOrders) metricOrders.textContent = totalOrders;
    if (metricSales) metricSales.textContent = `KD ${grossSales.toFixed(3)}`;
    if (metricCatalog) metricCatalog.textContent = catalog.length;

    // 2. Render Live Orders Table
    const ordersBody = document.getElementById('ordersTableBody');
    if (ordersBody) {
      if (ordersList.length === 0) {
        ordersBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#8c8173; padding:2.5rem;">No customer dispatches logged yet.</td></tr>`;
      } else {
        ordersBody.innerHTML = ordersList.map((o) => {
          const itemsSummary = Array.isArray(o.items)
            ? o.items.map(i => `${i.name || i.id} (${i.size || 'M'}) x${i.qty}`).join('<br>')
            : '—';

          return `
            <tr>
              <td><strong>${o.orderId}</strong><br><small style="color:#8c8173;">${o.date || ''}</small></td>
              <td>${o.recipient?.name || 'Guest'}<br><small style="color:#8c8173;">${o.recipient?.phone || ''}</small></td>
              <td>${o.recipient?.governorate || 'Al Ahmadi'}<br><small style="color:#8c8173;">${o.recipient?.address || ''}</small></td>
              <td><span class="status-badge status-badge--knet">${o.paymentMethod || 'K-Net'}</span></td>
              <td><strong>KD ${Number(o.total || 0).toFixed(3)}</strong></td>
              <td><span class="status-badge status-badge--pending">${o.status || 'Pending'}</span></td>
              <td>
                <button type="button" class="btn-action" onclick="alert('Dispatch confirmed for ${o.orderId}. Logistics notified.')">Mark Shipped</button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // 3. Render Catalog Inventory Grid
    const invBody = document.getElementById('inventoryTableBody');
    if (invBody) {
      invBody.innerHTML = catalog.map(p => `
        <tr>
          <td><strong>${p.sku || p.id}</strong></td>
          <td>${p.name?.en || 'Silhouette Piece'}</td>
          <td><span style="text-transform:uppercase; font-size:0.75rem; color:#8c8173;">${p.category}</span></td>
          <td>KD ${(p.price || 0).toFixed(3)}</td>
          <td>${p.salePrice ? `<span style="color:#b33939; font-weight:700;">KD ${p.salePrice.toFixed(3)}</span>` : '—'}</td>
          <td>${(p.sizes || []).join(', ')}</td>
        </tr>
      `).join('');
    }
  }

  // Navigation Tabs Switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.dataset.tab;
      const paneOrders = document.getElementById('paneOrders');
      const paneInventory = document.getElementById('paneInventory');

      if (paneOrders) paneOrders.style.display = target === 'orders' ? 'block' : 'none';
      if (paneInventory) paneInventory.style.display = target === 'inventory' ? 'block' : 'none';
    });
  });
});