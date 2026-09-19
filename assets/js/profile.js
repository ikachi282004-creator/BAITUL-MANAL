/**
 * BAITUL MANAL — Master Customer Profile Controller (profile.js)
 * Live Order Synchronizer, Self-Cancellation & Mobile Authentication
 */

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://baitul-manal-1.onrender.com';

  const authGate = document.getElementById('authGate');
  const profileDashboard = document.getElementById('profileDashboard');

  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const formLogin = document.getElementById('formLogin');
  const formRegister = document.getElementById('formRegister');
  const formForgot = document.getElementById('formForgot');
  const linkForgot = document.getElementById('linkForgot');
  const linkBackLogin = document.getElementById('linkBackLogin');

  const dashCustomerName = document.getElementById('dashCustomerName');
  const dashCustomerPhone = document.getElementById('dashCustomerPhone');
  const profileLogoutBtn = document.getElementById('profileLogoutBtn');
  const customerOrdersContainer = document.getElementById('customerOrdersContainer');
  const refreshCustomerOrdersBtn = document.getElementById('refreshCustomerOrdersBtn');

  // Status Styling Matrix
  const STATUS_MAP = {
    'PENDING_DISPATCH': { label: '🟡 Pending Dispatch', bg: 'rgba(241, 196, 15, 0.15)', color: '#b78103' },
    'PROCESSING': { label: '🟠 Atelier Tailoring', bg: 'rgba(230, 126, 34, 0.15)', color: '#d35400' },
    'OUT_FOR_DELIVERY': { label: '🔵 Out for Delivery', bg: 'rgba(52, 152, 219, 0.15)', color: '#2980b9' },
    'DELIVERED': { label: '🟢 Delivered', bg: 'rgba(39, 174, 96, 0.15)', color: '#27ae60' },
    'CANCELLED': { label: '🔴 Cancelled', bg: 'rgba(231, 76, 60, 0.15)', color: '#c0392b' }
  };

  // Auth Tabs Switching
  tabLogin?.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.style.display = 'block';
    formRegister.style.display = 'none';
    formForgot.style.display = 'none';
  });

  tabRegister?.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.style.display = 'block';
    formLogin.style.display = 'none';
    formForgot.style.display = 'none';
  });

  linkForgot?.addEventListener('click', (e) => {
    e.preventDefault();
    formLogin.style.display = 'none';
    formForgot.style.display = 'block';
  });

  linkBackLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    formForgot.style.display = 'none';
    formLogin.style.display = 'block';
  });

  // Check Current Session
  let activeUser = null;
  const savedUser = localStorage.getItem('bm_customer_user');
  if (savedUser) {
    try {
      activeUser = JSON.parse(savedUser);
      showDashboard(activeUser);
    } catch {}
  }

  // Handle Register
  formRegister?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('regName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const msgEl = document.getElementById('regMsg');

    msgEl.style.color = '#c5a880';
    msgEl.textContent = 'Creating account...';

    try {
      const res = await fetch(`${API_BASE}/api/customer/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phone, email, password })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('bm_customer_user', JSON.stringify(data.user));
        showDashboard(data.user);
      } else {
        msgEl.style.color = '#c0392b';
        msgEl.textContent = data.error || 'Failed to create account.';
      }
    } catch {
      msgEl.style.color = '#c0392b';
      msgEl.textContent = 'Server connecting error.';
    }
  });

  // Handle Login
  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('loginPhone').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const msgEl = document.getElementById('loginMsg');

    msgEl.style.color = '#c5a880';
    msgEl.textContent = 'Verifying credentials...';

    try {
      const res = await fetch(`${API_BASE}/api/customer/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('bm_customer_user', JSON.stringify(data.user));
        showDashboard(data.user);
      } else {
        msgEl.style.color = '#c0392b';
        msgEl.textContent = data.error || 'Invalid credentials.';
      }
    } catch {
      msgEl.style.color = '#c0392b';
      msgEl.textContent = 'Server connecting error.';
    }
  });

  // Handle Forgot Password
  formForgot?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('forgotPhone').value.trim();
    const newPassword = document.getElementById('forgotNewPass').value.trim();
    const msgEl = document.getElementById('forgotMsg');

    msgEl.style.color = '#c5a880';
    msgEl.textContent = 'Updating password...';

    try {
      const res = await fetch(`${API_BASE}/api/customer/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, newPassword })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        msgEl.style.color = '#27ae60';
        msgEl.textContent = data.message;
        setTimeout(() => {
          formForgot.style.display = 'none';
          formLogin.style.display = 'block';
        }, 1200);
      } else {
        msgEl.style.color = '#c0392b';
        msgEl.textContent = data.error || 'Failed to update.';
      }
    } catch {
      msgEl.style.color = '#c0392b';
      msgEl.textContent = 'Server connecting error.';
    }
  });

  // Logout
  profileLogoutBtn?.addEventListener('click', () => {
    localStorage.removeItem('bm_customer_user');
    location.reload();
  });

  function showDashboard(user) {
    if (authGate) authGate.style.display = 'none';
    if (profileDashboard) profileDashboard.style.display = 'block';

    if (dashCustomerName) dashCustomerName.textContent = user.fullName || 'Customer';
    if (dashCustomerPhone) dashCustomerPhone.textContent = user.phone;

    loadCustomerOrders(user.phone);
  }

  // Fetch and Render Customer Orders
  async function loadCustomerOrders(phone) {
    if (!customerOrdersContainer) return;
    customerOrdersContainer.innerHTML = '<p style="text-align:center; color:#8c8173; padding: 2rem 0;">Synchronizing your orders...</p>';

    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const res = await fetch(`${API_BASE}/api/customer/orders?phone=${cleanPhone}&t=${Date.now()}`);
      const orders = await res.json();

      if (!Array.isArray(orders) || !orders.length) {
        customerOrdersContainer.innerHTML = `
          <div style="text-align:center; padding: 3rem 1rem; background:#fff; border-radius:10px; border:1px solid #e8e2d8;">
            <p style="color:#8c8173; margin:0 0 12px;">No orders found matching phone number <strong>${phone}</strong>.</p>
            <a href="shop.html" style="display:inline-block; background:#181512; color:#fff; padding:10px 20px; border-radius:6px; text-decoration:none; font-weight:700;">Explore Latest Collection</a>
          </div>
        `;
        return;
      }

      customerOrdersContainer.innerHTML = orders.map(order => {
        const st = (order.status || 'PENDING_DISPATCH').toUpperCase();
        const theme = STATUS_MAP[st] || STATUS_MAP['PENDING_DISPATCH'];
        const canCancel = st === 'PENDING_DISPATCH';
        const rawItems = Array.isArray(order.items) ? order.items : [];

        const itemsHtml = rawItems.map(item => {
          const qty = item.qty || 1;
          const total = Number(item.lineTotal || (item.unitPrice ? item.unitPrice * qty : 0) || (item.price ? item.price * qty : 0));
          return `
            <div class="order-item-line">
              <span>${item.name || item.id} (${item.size || 'M'}) x${qty}</span>
              <strong>KD ${total.toFixed(3)}</strong>
            </div>
          `;
        }).join('');

        return `
          <article class="order-card" id="card_${order.orderId}">
            <div class="order-card-head">
              <div>
                <strong style="font-size: 1.05rem; color:#181512;">#${order.orderId}</strong>
                <span style="font-size:0.75rem; color:#8c8173; margin-left:8px;">${order.date ? new Date(order.date).toLocaleDateString('en-GB') : ''}</span>
              </div>
              <span class="order-pill" style="background:${theme.bg}; color:${theme.color};">
                ${theme.label}
              </span>
            </div>

            <div class="order-items-summary">
              ${itemsHtml}
            </div>

            <div class="order-card-foot">
              <div>
                <span style="font-size:0.8rem; color:#8c8173;">Order Total: </span>
                <strong style="font-size:1.05rem; color:#181512;">KD ${Number(order.total || 0).toFixed(3)}</strong>
              </div>
              <div style="display:flex; gap:8px;">
                ${canCancel ? `<button type="button" class="btn-cancel-order" data-id="${order.orderId}">Cancel Order</button>` : ''}
                <a href="track-order.html?id=${order.orderId}" class="btn-track-order">Track Status →</a>
              </div>
            </div>
          </article>
        `;
      }).join('');

      // Attach Self-Cancellation Listeners
      document.querySelectorAll('.btn-cancel-order').forEach(btn => {
        btn.onclick = async (e) => {
          const orderId = e.target.dataset.id;
          if (!confirm(`Are you sure you want to cancel order #${orderId}?`)) return;

          e.target.disabled = true;
          e.target.textContent = 'Cancelling...';

          try {
            const cancelRes = await fetch(`${API_BASE}/api/customer/cancel-order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId, phone })
            });
            const cancelData = await cancelRes.json();

            if (cancelRes.ok && cancelData.success) {
              alert(cancelData.message);
              loadCustomerOrders(phone);
            } else {
              alert(cancelData.error || 'Failed to cancel order.');
              e.target.disabled = false;
              e.target.textContent = 'Cancel Order';
            }
          } catch {
            alert('Network error connecting to backend.');
            e.target.disabled = false;
            e.target.textContent = 'Cancel Order';
          }
        };
      });

    } catch (err) {
      customerOrdersContainer.innerHTML = '<p style="color:#c0392b; text-align:center;">Failed to load dispatches from server.</p>';
    }
  }

  refreshCustomerOrdersBtn?.addEventListener('click', () => {
    if (activeUser?.phone) loadCustomerOrders(activeUser.phone);
  });
});