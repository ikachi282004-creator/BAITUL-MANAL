/**
 * BAITUL MANAL — Order Success Receipt Controller (order-success.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');

  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://baitul-manal-1.onrender.com';

  let order = null;

  // 1. Check local session cache first
  const cachedOrderRaw = localStorage.getItem('bm_last_order');
  if (cachedOrderRaw) {
    try {
      const parsed = JSON.parse(cachedOrderRaw);
      if (!orderId || parsed.orderId === orderId) {
        order = parsed;
      }
    } catch {}
  }

  // 2. Fetch fresh order if not in cache or if missing fields
  if (!order && orderId) {
    try {
      const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderId)}?t=${Date.now()}`);
      if (res.ok) {
        order = await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch order from backend:', e);
    }
  }

  // 3. Fallback catalog for price resolution if needed
  let catalog = [];
  try {
    const catRes = await fetch(`${API_BASE}/api/admin/products?t=${Date.now()}`);
    if (catRes.ok) catalog = await catRes.json();
  } catch {}

  const orderRef = order?.orderId || orderId || 'BM-KW-2026';
  const orderRefEl = document.getElementById('orderRefDisplay');
  if (orderRefEl) orderRefEl.textContent = `#${orderRef}`;

  if (!order) return;

  // Populate Customer & Ledger Details
  const recipientName = order.recipient?.name || 'Customer';
  const phone = order.recipient?.phone || '';
  const address = order.recipient?.address || order.deliveryArea || 'Kuwait';
  const payment = order.paymentMethod || 'COD';
  const grandTotal = Number(order.total || order.grand_total || 0);

  const recipientEl = document.getElementById('orderRecipient');
  const phoneEl = document.getElementById('orderPhone');
  const addressEl = document.getElementById('orderAddress');
  const paymentEl = document.getElementById('orderPayment');
  const totalEl = document.getElementById('orderTotalDisplay');
  const trackBtn = document.getElementById('trackOrderBtn');

  if (recipientEl) recipientEl.textContent = recipientName;
  if (phoneEl) phoneEl.textContent = phone;
  if (addressEl) addressEl.textContent = address;
  if (paymentEl) paymentEl.textContent = payment;
  if (totalEl) totalEl.textContent = `KD ${grandTotal.toFixed(3)}`;
  if (trackBtn) trackBtn.href = `track-order.html?id=${orderRef}`;

  // Render Items with Accurate Pricing
  const itemsContainer = document.getElementById('orderItemsSummary');
  if (itemsContainer) {
    const rawItems = Array.isArray(order.items) ? order.items : [];
    
    itemsContainer.innerHTML = rawItems.map(item => {
      const matchedProd = catalog.find(p => String(p.id) === String(item.id) || String(p.sku) === String(item.id));
      const title = item.name || matchedProd?.name?.en || (typeof matchedProd?.name === 'string' ? matchedProd.name : item.id);
      const qty = parseInt(item.qty, 10) || 1;

      // Extract price from lineTotal -> unitPrice -> price -> catalog match
      let computedLineTotal = 0;
      if (item.lineTotal !== undefined && Number(item.lineTotal) > 0) {
        computedLineTotal = Number(item.lineTotal);
      } else if (item.unitPrice !== undefined && Number(item.unitPrice) > 0) {
        computedLineTotal = Number(item.unitPrice) * qty;
      } else if (item.price !== undefined && Number(item.price) > 0) {
        computedLineTotal = Number(item.price) * qty;
      } else if (matchedProd) {
        const prodPrice = matchedProd.salePrice ? Number(matchedProd.salePrice) : Number(matchedProd.price || 0);
        computedLineTotal = prodPrice * qty;
      }

      return `
        <div class="success-item-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f2ede4; font-size: 0.9rem;">
          <div>
            <strong style="color: #181512; display: block;">${title}</strong>
            <span style="font-size: 0.78rem; color: #8c8173;">Size: ${item.size || 'M'} • Color: ${item.color || 'Standard'} • Qty: ${qty}</span>
          </div>
          <strong style="color: #181512; font-size: 0.95rem;">KD ${computedLineTotal.toFixed(3)}</strong>
        </div>
      `;
    }).join('');
  }

  // Direct WhatsApp Concierge Link
  const waBtn = document.getElementById('orderWhatsAppSupport');
  if (waBtn) {
    const msg = encodeURIComponent(
      `Salam Baitul Manal! I placed Order #${orderRef} for KD ${grandTotal.toFixed(3)}. Can you confirm dispatch to ${address}?`
    );
    waBtn.href = `https://wa.me/96560454629?text=${msg}`;
  }
});