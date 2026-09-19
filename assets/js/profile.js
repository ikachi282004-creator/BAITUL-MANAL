document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://baitul-manal-1.onrender.com';

  const phoneInput = document.getElementById('profilePhoneInput') || document.getElementById('userPhone');
  const fetchOrdersBtn = document.getElementById('fetchProfileOrdersBtn');
  const historyContainer = document.getElementById('profileOrdersList') || document.getElementById('pastOrdersContainer');

  let savedPhone = localStorage.getItem('bm_customer_phone') || '';
  if (savedPhone && phoneInput) {
    phoneInput.value = savedPhone;
    loadCustomerOrders(savedPhone);
  }

  fetchOrdersBtn?.addEventListener('click', () => {
    const phone = phoneInput?.value.trim();
    if (!phone) return;
    localStorage.setItem('bm_customer_phone', phone);
    loadCustomerOrders(phone);
  });

  async function loadCustomerOrders(phone) {
    if (!historyContainer) return;
    historyContainer.innerHTML = '<p style="text-align:center; color:#c5a880; padding:2rem 0;">Synchronizing your orders...</p>';

    try {
      const res = await fetch(`${API_BASE}/api/customer/orders?phone=${encodeURIComponent(phone)}&t=${new Date().getTime()}`);
      const orders = await res.json();

      if (!Array.isArray(orders) || orders.length === 0) {
        historyContainer.innerHTML = '<p style="text-align:center; color:#888; padding:2rem 0;">No dispatches registered under this mobile number.</p>';
        return;
      }

      historyContainer.innerHTML = orders.map(o => `
        <div style="background:#fff; border:1px solid #d6cbba; border-radius:8px; padding:16px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>${o.orderId}</strong>
            <span style="background:rgba(197,168,128,0.2); color:#9e825a; padding:4px 8px; border-radius:4px; font-weight:700; font-size:0.75rem;">
              ${o.status || 'PENDING_DISPATCH'}
            </span>
          </div>
          <div style="margin: 8px 0; font-size:0.85rem; color:#666;">
            ${(o.items || []).map(i => `${i.name \vert{}\vert{} i.id} x${i.qty}`).join(', ')}
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:bold; border-top:1px solid #f0ede6; padding-top:8px;">
            <span>${o.date ? new Date(o.date).toLocaleDateString('en-GB') : ''}</span>
            <span>KD ${Number(o.total || 0).toFixed(3)}</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      historyContainer.innerHTML = '<p style="text-align:center; color:#e74c3c; padding:2rem 0;">Failed to retrieve dispatch records.</p>';
    }
  }
});