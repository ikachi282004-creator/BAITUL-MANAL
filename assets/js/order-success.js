document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');

  let order = null;
  const cachedOrderRaw = localStorage.getItem('bm_last_order');
  if (cachedOrderRaw) {
    try {
      const parsed = JSON.parse(cachedOrderRaw);
      if (!orderId || parsed.orderId === orderId) {
        order = parsed;
      }
    } catch {}
  }

  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://baitul-manal-1.onrender.com';

  if (!order && orderId) {
    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}`);
      if (res.ok) {
        order = await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch order from backend:', e);
    }
  }

  if (!order) {
    document.getElementById('orderRefDisplay').textContent = orderId || 'BM-KW-2026';
    return;
  }

  // Populate UI
  const orderRef = order.orderId || orderId || 'BM-KW-2026';
  document.getElementById('orderRefDisplay').textContent = `#${orderRef}`;
  document.getElementById('orderRecipient').textContent = order.recipient?.name || 'Customer';
  document.getElementById('orderPhone').textContent = order.recipient?.phone || '+965';
  document.getElementById('orderAddress').textContent = order.recipient?.address || order.deliveryArea || 'Kuwait';
  document.getElementById('orderPayment').textContent = order.paymentMethod || 'K-Net Local Debit';
  document.getElementById('orderTotalDisplay').textContent = `KD ${Number(order.total || 0).toFixed(3)}`;

  // Populate Track button
  const trackBtn = document.getElementById('trackOrderBtn');
  if (trackBtn) trackBtn.href = `track-order.html?id=${orderRef}`;

  // Populate Items Summary
  const itemsContainer = document.getElementById('orderItemsSummary');
  if (itemsContainer && Array.isArray(order.items)) {
    itemsContainer.innerHTML = order.items.map(item => `
      <div class="success-item-row">
        <span>${item.name || item.id} (${item.size || 'M'}) x${item.qty || 1}</span>
        <strong>KD ${Number((item.price || 0) * (item.qty || 1)).toFixed(3)}</strong>
      </div>
    `).join('');
  }

  // WhatsApp Concierge Link
  const waBtn = document.getElementById('orderWhatsAppSupport');
  if (waBtn) {
    const msg = encodeURIComponent(`Salam Baitul Manal! I just placed Order #${orderRef} for KD ${Number(order.total || 0).toFixed(3)}. Could you please confirm my dispatch status?`);
    waBtn.href = `https://wa.me/96560454629?text=${msg}`;
  }
});