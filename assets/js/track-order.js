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
      resultsCard.innerHTML = '<p style="text-align:center; color:#c5a880; padding:2rem 0; font-weight:600;">Locating order dispatch details...</p>';
    }

    try {
      const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(query)}?t=${Date.now()}`);
      if (!res.ok) throw new Error('Order not found');
      const order = await res.json();

      renderTrackingResult(order);
    } catch (err) {
      if (resultsCard) {
        resultsCard.innerHTML = `
          <div style="text-align:center; padding:2.5rem 1rem; color:#b33939; background: #fff5f5; border-radius: 8px; border: 1px solid #fed7d7; margin-top: 15px;">
            <h3 style="margin: 0 0 6px;">Order Reference Not Found</h3>
            <p style="color:#718096; font-size:0.88rem; margin:0;">Please verify your Order Number (e.g. BM-KW-2026-XXXX) or 8-digit Kuwait contact mobile.</p>
          </div>
        `;
      }
    }
  });

  function renderTrackingResult(order) {
    if (!resultsCard) return;

    const currentStatus = order.status || 'PENDING_DISPATCH';
    const stages = ['PENDING_DISPATCH', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    const activeIdx = stages.indexOf(currentStatus);

    const items = Array.isArray(order.items) ? order.items : [];
    const itemsHtml = items.map(i => `
      <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f2ede4; font-size:0.86rem;">
        <span style="color: #181512;">${i.name || i.id} (${i.size || 'M'}) x${i.qty || 1}</span>
        <strong style="color: #181512;">KD ${Number(i.lineTotal || (i.unitPrice * (i.qty || 1)) || 0).toFixed(3)}</strong>
      </div>
    `).join('');

    resultsCard.innerHTML = `
      <div style="background:#fff; border:1px solid #d6cbba; border-radius:10px; padding:22px; margin-top:20px; box-shadow:0 4px 16px rgba(0,0,0,0.03);">
        
        <!-- Header Info -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #f2ede4; padding-bottom:14px; margin-bottom:16px;">
          <div>
            <h3 style="margin:0 0 4px; font-family:'Playfair Display',serif; color:#181512; font-size:1.25rem;">Order #${order.orderId}</h3>
            <small style="color:#8c8173; font-size:0.82rem;">Customer: ${order.recipient?.name || 'Client'} • 🇰🇼 ${order.recipient?.phone || ''}</small>
          </div>
          <div>
            <span style="background: rgba(39, 174, 96, 0.12); color: #27ae60; padding: 6px 12px; border-radius: 20px; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">
              ${currentStatus.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        <!-- 4-Stage Visual Progress Stepper -->
        <div class="timeline-wrapper">
          <div class="step-col">
            <div class="step-circle ${activeIdx >= 0 ? 'active' : ''}">${activeIdx >= 0 ? '✓' : '1'}</div>
            <span class="step-label ${activeIdx >= 0 ? 'active' : ''}">Order Placed</span>
            <span class="step-subtext">Received</span>
          </div>

          <div class="step-col">
            <div class="step-circle ${activeIdx >= 1 ? 'active' : ''}">${activeIdx >= 1 ? '✓' : '2'}</div>
            <span class="step-label ${activeIdx >= 1 ? 'active' : ''}">Tailoring</span>
            <span class="step-subtext">In Atelier</span>
          </div>

          <div class="step-col">
            <div class="step-circle ${activeIdx >= 2 ? 'active' : ''}">${activeIdx >= 2 ? '✓' : '3'}</div>
            <span class="step-label ${activeIdx >= 2 ? 'active' : ''}">With Courier</span>
            <span class="step-subtext">Kuwait Express</span>
          </div>

          <div class="step-col">
            <div class="step-circle ${activeIdx >= 3 ? 'active' : ''}">${activeIdx >= 3 ? '✓' : '4'}</div>
            <span class="step-label ${activeIdx >= 3 ? 'active' : ''}">Delivered</span>
            <span class="step-subtext">Completed</span>
          </div>
        </div>

        <!-- Destination Details -->
        <div style="margin-bottom:16px; background:#faf8f5; padding:12px; border-radius:6px; border:1px solid rgba(214,203,186,0.5);">
          <h4 style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; color:#8c8173; margin:0 0 4px;">Delivery Destination</h4>
          <p style="margin:0; font-size:0.86rem; color:#5a5146; word-break: break-word;">${order.recipient?.governorate || ''}, ${order.recipient?.address || ''}</p>
        </div>

        <!-- Garments Summary -->
        <div style="margin-bottom:16px;">
          <h4 style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; color:#8c8173; margin:0 0 6px;">Purchased Garments</h4>
          ${itemsHtml}
        </div>

        <!-- Final Calculation -->
        <div style="display:flex; justify-content:space-between; border-top:1px solid #f2ede4; padding-top:14px; font-size:1.05rem;">
          <strong>Total Payable</strong>
          <strong style="color:#181512;">KD ${Number(order.total || 0).toFixed(3)}</strong>
        </div>

        <div style="margin-top:18px; text-align:center;">
          <a href="https://wa.me/96560454629?text=Hello%20Baitul%20Manal%2C%20I%20am%20inquiring%20about%20Order%20%23${order.orderId}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; background:#25d366; color:#fff; text-decoration:none; padding:10px 18px; border-radius:6px; font-size:0.84rem; font-weight:600;">
            <span>Contact WhatsApp Concierge</span>
          </a>
        </div>
      </div>
    `;
  }
});