document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://baitul-manal-1.onrender.com';

  const trackForm = document.getElementById('trackOrderForm') || document.querySelector('form');
  const queryInput = document.getElementById('orderTrackingInput') || document.getElementById('orderIdInput') || document.querySelector('input[type="text"]');
  const resultsCard = document.getElementById('trackingResultsCard') || document.getElementById('orderStatusContainer');

  trackForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = queryInput?.value.trim();
    if (!query) return;

    if (resultsCard) {
      resultsCard.style.display = 'block';
      resultsCard.innerHTML = '<p style="text-align:center; color:#c5a880; padding:2rem 0;">Locating order details...</p>';
    }

    try {
      const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(query)}?t=${new Date().getTime()}`);
      if (!res.ok) throw new Error('Order not found');
      const order = await res.json();

      renderTrackingResult(order);
    } catch (err) {
      if (resultsCard) {
        resultsCard.innerHTML = `
          <div style="text-align:center; padding:2rem 0; color:#e74c3c;">
            <h3>Order Not Found</h3>
            <p style="color:#888; font-size:0.9rem;">Please verify your Order Reference (e.g. BM-KW-2026-XXXX) or Contact Number.</p>
          </div>
        `;
      }
    }
  });

  function renderTrackingResult(order) {
    if (!resultsCard) return;

    const items = Array.isArray(order.items) ? order.items : [];
    const itemsHtml = items.map(i => `
      <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee; font-size:0.85rem;">
        <span>${i.name || i.id} (${i.size || 'M'}) x${i.qty || 1}</span>
        <strong>KD ${(i.lineTotal || i.unitPrice || 0).toFixed(3)}</strong>
      </div>
    `).join('');

    resultsCard.innerHTML = `
      <div style="background:#fff; border:1px solid #d6cbba; border-radius:8px; padding:24px; margin-top:20px;">
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:12px; margin-bottom:12px;">
          <div>
            <h3 style="margin:0; font-family:'Playfair Display',serif; color:#181512;">Order #${order.orderId}</h3>
            <small style="color:#888;">Recipient: ${order.recipient?.name || 'Customer'} (${order.recipient?.phone || ''})</small>
          </div>
          <div>
            <span style="background:#c5a880; color:#000; padding:6px 12px; border-radius:4px; font-weight:bold; font-size:0.75rem; text-transform:uppercase;">
              ${order.status || 'PENDING_DISPATCH'}
            </span>
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <h4 style="font-size:0.85rem; text-transform:uppercase; color:#888; margin-bottom:8px;">Shipping Destination</h4>
          <p style="margin:0; font-size:0.9rem;">${order.recipient?.governorate || ''}, ${order.recipient?.address || ''}</p>
        </div>

        <div style="margin-bottom:16px;">
          <h4 style="font-size:0.85rem; text-transform:uppercase; color:#888; margin-bottom:8px;">Purchased Garments</h4>
          ${itemsHtml}
        </div>

        <div style="display:flex; justify-content:space-between; border-top:1px solid #eee; padding-top:12px; font-size:1rem;">
          <strong>Total Payable</strong>
          <strong style="color:#181512;">KD ${Number(order.total || 0).toFixed(3)}</strong>
        </div>
      </div>
    `;
  }
});