/**
 * BAITUL MANAL — Live Order Tracker Controller (track-order.js)
 * Multi-Color Stage Badges & Dynamic Visual Progress Stepper
 */

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://baitul-manal-1.onrender.com';

  const trackForm = document.getElementById('trackOrderForm') || document.querySelector('form');
  const queryInput = document.getElementById('orderTrackingInput') || document.getElementById('orderIdInput') || document.querySelector('input[type="text"]');
  const resultsCard = document.getElementById('trackingResultsCard') || document.getElementById('orderStatusContainer');

  // Status Theme Matrix (Colors, Backgrounds & Human Labels)
  const STATUS_THEMES = {
    'PENDING_DISPATCH': {
      label: '🟡 Pending Dispatch',
      text: '#b78103',
      bg: 'rgba(241, 196, 15, 0.15)',
      border: '#f1c40f'
    },
    'PROCESSING': {
      label: '🟠 Atelier Tailoring',
      text: '#d35400',
      bg: 'rgba(230, 126, 34, 0.15)',
      border: '#e67e22'
    },
    'OUT_FOR_DELIVERY': {
      label: '🔵 Out for Delivery',
      text: '#2980b9',
      bg: 'rgba(52, 152, 219, 0.15)',
      border: '#3498db'
    },
    'DELIVERED': {
      label: '🟢 Delivered & Completed',
      text: '#27ae60',
      bg: 'rgba(39, 174, 96, 0.15)',
      border: '#27ae60'
    },
    'CANCELLED': {
      label: '🔴 Order Cancelled',
      text: '#c0392b',
      bg: 'rgba(231, 76, 60, 0.15)',
      border: '#e74c3c'
    }
  };

  trackForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = queryInput?.value.trim();
    if (!query) return;

    if (resultsCard) {
      resultsCard.style.display = 'block';
      resultsCard.innerHTML = '<p style="text-align:center; color:#c5a880; padding:2rem 0; font-weight:600;">Locating order dispatch records...</p>';
    }

    try {
      const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(query)}?t=${Date.now()}`);
      if (!res.ok) throw new Error('Order not found');
      const order = await res.json();

      renderTrackingResult(order);
    } catch (err) {
      if (resultsCard) {
        resultsCard.innerHTML = `
          <div style="text-align:center; padding:2rem 1rem; color:#c0392b; background: #fdf2f2; border-radius: 8px; border: 1px solid #f8b4b4; margin-top: 15px;">
            <h3 style="margin: 0 0 6px;">Order Reference Not Found</h3>
            <p style="color:#7f8c8d; font-size:0.88rem; margin:0;">Please check your Order Number (e.g. BM-KW-2026-XXXX) or 8-digit mobile number.</p>
          </div>
        `;
      }
    }
  });

  function renderTrackingResult(order) {
    if (!resultsCard) return;

    const currentStatus = (order.status || 'PENDING_DISPATCH').toUpperCase();
    const theme = STATUS_THEMES[currentStatus] || STATUS_THEMES['PENDING_DISPATCH'];

    const stages = ['PENDING_DISPATCH', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    const activeIdx = stages.indexOf(currentStatus);
    const isCancelled = currentStatus === 'CANCELLED';

    const items = Array.isArray(order.items) ? order.items : [];
    const itemsHtml = items.map(i => {
      const qty = parseInt(i.qty, 10) || 1;
      const total = Number(i.lineTotal || (i.unitPrice ? i.unitPrice * qty : 0) || (i.price ? i.price * qty : 0));
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f2ede4; font-size:0.88rem;">
          <span style="color: #181512;">${i.name || i.id} (${i.size || 'M'}) x${qty}</span>
          <strong style="color: #181512;">KD ${total.toFixed(3)}</strong>
        </div>
      `;
    }).join('');

    resultsCard.innerHTML = `
      <div style="background:#fff; border:1px solid #d6cbba; border-radius:10px; padding:24px; margin-top:20px; box-shadow:0 4px 16px rgba(0,0,0,0.03);">
        
        <!-- Header Info & Dynamic Multi-Color Status Badge -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #f2ede4; padding-bottom:14px; margin-bottom:16px;">
          <div>
            <h3 style="margin:0 0 4px; font-family:'Playfair Display',serif; color:#181512; font-size:1.3rem;">Order #${order.orderId}</h3>
            <small style="color:#8c8173; font-size:0.84rem;">Client: <strong>${order.recipient?.name || 'Customer'}</strong> • 🇰🇼 ${order.recipient?.phone || ''}</small>
          </div>
          <div>
            <span style="display:inline-block; background: ${theme.bg}; color: ${theme.text}; border: 1px solid ${theme.border}; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.4px;">
              ${theme.label}
            </span>
          </div>
        </div>

        ${isCancelled ? `
          <!-- Cancelled Notice -->
          <div style="background:#fdf2f2; border:1px solid #f8b4b4; color:#c0392b; padding:12px; border-radius:6px; margin-bottom:18px; text-align:center; font-size:0.88rem; font-weight:600;">
            This order has been cancelled by the atelier or customer concierge.
          </div>
        ` : `
          <!-- 4-Stage Visual Progress Stepper -->
          <div class="timeline-wrapper">
            <div class="step-col">
              <div class="step-circle ${activeIdx >= 0 ? 'active' : ''}">${activeIdx >= 0 ? '✓' : '1'}</div>
              <span class="step-label ${activeIdx >= 0 ? 'active' : ''}">Order Placed</span>
              <span class="step-subtext">Hub Queue</span>
            </div>

            <div class="step-col">
              <div class="step-circle ${activeIdx >= 1 ? 'active' : ''}">${activeIdx >= 1 ? '✓' : '2'}</div>
              <span class="step-label ${activeIdx >= 1 ? 'active' : ''}">Tailoring</span>
              <span class="step-subtext">Atelier</span>
            </div>

            <div class="step-col">
              <div class="step-circle ${activeIdx >= 2 ? 'active' : ''}">${activeIdx >= 2 ? '✓' : '3'}</div>
              <span class="step-label ${activeIdx >= 2 ? 'active' : ''}">With Courier</span>
              <span class="step-subtext">Express</span>
            </div>

            <div class="step-col">
              <div class="step-circle ${activeIdx >= 3 ? 'active' : ''}">${activeIdx >= 3 ? '✓' : '4'}</div>
              <span class="step-label ${activeIdx >= 3 ? 'active' : ''}">Delivered</span>
              <span class="step-subtext">Completed</span>
            </div>
          </div>
        `}

        <!-- Delivery Coordinates -->
        <div style="margin-bottom:16px; background:#faf8f5; padding:12px; border-radius:6px; border:1px solid rgba(214,203,186,0.5);">
          <h4 style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; color:#8c8173; margin:0 0 4px;">Delivery Destination</h4>
          <p style="margin:0; font-size:0.86rem; color:#5a5146; word-break: break-word;">${order.recipient?.governorate || ''}, ${order.recipient?.address || ''}</p>
        </div>

        <!-- Purchased Garments -->
        <div style="margin-bottom:16px;">
          <h4 style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; color:#8c8173; margin:0 0 6px;">Purchased Garments</h4>
          ${itemsHtml}
        </div>

        <!-- Total -->
        <div style="display:flex; justify-content:space-between; border-top:1px solid #f2ede4; padding-top:14px; font-size:1.1rem;">
          <strong>Total Payable</strong>
          <strong style="color:#181512;">KD ${Number(order.total || 0).toFixed(3)}</strong>
        </div>

        <div style="margin-top:20px; text-align:center;">
          <a href="https://wa.me/96560454629?text=Hello%20Baitul%20Manal%2C%20I%20am%20inquiring%20about%20Order%20%23${order.orderId}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; background:#25d366; color:#fff; text-decoration:none; padding:10px 20px; border-radius:6px; font-size:0.86rem; font-weight:600;">
            <span>Contact WhatsApp Concierge</span>
          </a>
        </div>

      </div>
    `;
  }
});