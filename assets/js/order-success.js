/**
 * BAITUL MANAL — Order Success Receipt Controller (order-success.js)
 * Itemized Invoice Ledger, Address Sanitizer & Support Syncer
 */

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');

  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://baitul-manal-1.onrender.com';

  let order = null;

  // 1. Session Storage cache check
  const cachedOrderRaw = localStorage.getItem('bm_last_order');
  if (cachedOrderRaw) {
    try {
      const parsed = JSON.parse(cachedOrderRaw);
      if (!orderId || parsed.orderId === orderId) {
        order = parsed;
      }
    } catch {}
  }

  // 2. Fetch fresh order if missing from session
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

  // 3. Fallback catalog for product resolution
  let catalog = [];
  try {
    const catRes = await fetch(`${API_BASE}/api/admin/products?t=${Date.now()}`);
    if (catRes.ok) catalog = await catRes.json();
  } catch {}

  const orderRef = order?.orderId || orderId || 'BM-KW-2026';
  const orderRefEl = document.getElementById('orderRefDisplay');
  if (orderRefEl) orderRefEl.textContent = `#${orderRef}`;

  if (!order) return;

  // Compute Itemized Totals
  const rawItems = Array.isArray(order.items) ? order.items : [];
  let calculatedSubtotal = 0;

  const itemsContainer = document.getElementById('orderItemsSummary');
  if (itemsContainer) {
    itemsContainer.innerHTML = rawItems.map(item => {
      const matchedProd = catalog.find(p => String(p.id) === String(item.id) || String(p.sku) === String(item.id));
      const title = item.name || matchedProd?.name?.en || (typeof matchedProd?.name === 'string' ? matchedProd.name : item.id);
      const qty = parseInt(item.qty, 10) || 1;

      let linePrice = 0;
      if (item.lineTotal !== undefined && Number(item.lineTotal) > 0) {
        linePrice = Number(item.lineTotal);
      } else if (item.unitPrice !== undefined && Number(item.unitPrice) > 0) {
        linePrice = Number(item.unitPrice) * qty;
      } else if (item.price !== undefined && Number(item.price) > 0) {
        linePrice = Number(item.price) * qty;
      } else if (matchedProd) {
        const prodPrice = matchedProd.salePrice ? Number(matchedProd.salePrice) : Number(matchedProd.price || 0);
        linePrice = prodPrice * qty;
      }

      calculatedSubtotal += linePrice;

      return `
        <div class="success-item-row">
          <div>
            <strong style="color: #181512; display: block;">${title}</strong>
            <div class="success-item-meta">Size: ${item.size || 'M'} • Color: ${item.color || 'Standard'} • Qty: ${qty}</div>
          </div>
          <strong style="color: #181512;">KD ${linePrice.toFixed(3)}</strong>
        </div>
      `;
    }).join('');
  }

  // Invoice Ledger Elements
  const grandTotal = Number(order.total || order.grand_total || 0);
  const explicitSubtotal = Number(order.subtotal || calculatedSubtotal);
  const deliveryFee = Number(order.deliveryFee !== undefined ? order.deliveryFee : (grandTotal - explicitSubtotal));

  const invoiceSubtotalEl = document.getElementById('invoiceSubtotal');
  const invoiceDeliveryEl = document.getElementById('invoiceDelivery');
  const orderTotalDisplayEl = document.getElementById('orderTotalDisplay');

  if (invoiceSubtotalEl) invoiceSubtotalEl.textContent = `KD ${explicitSubtotal.toFixed(3)}`;
  if (invoiceDeliveryEl) {
    if (deliveryFee <= 0) {
      invoiceDeliveryEl.textContent = 'KD 0.000 (FREE)';
      invoiceDeliveryEl.style.color = '#27ae60';
    } else {
      invoiceDeliveryEl.textContent = `KD ${deliveryFee.toFixed(3)}`;
    }
  }
  if (orderTotalDisplayEl) orderTotalDisplayEl.textContent = `KD ${grandTotal.toFixed(3)}`;

  // Clean Address Formatter
  let cleanAddress = order.recipient?.address || order.deliveryArea || 'Kuwait';
  cleanAddress = cleanAddress.replace(/Gov:\s*[^,]+,\s*/i, ''); // Strip redundant internal tags

  // Populate Snapshot
  const recipientEl = document.getElementById('orderRecipient');
  const phoneEl = document.getElementById('orderPhone');
  const addressEl = document.getElementById('orderAddress');
  const paymentEl = document.getElementById('orderPayment');
  const trackBtn = document.getElementById('trackOrderBtn');

  if (recipientEl) recipientEl.textContent = order.recipient?.name || 'Customer';
  if (phoneEl) phoneEl.textContent = `🇰🇼 ${order.recipient?.phone || ''}`;
  if (addressEl) addressEl.textContent = cleanAddress;
  if (paymentEl) paymentEl.textContent = order.paymentMethod || 'Cash on Delivery (COD)';
  if (trackBtn) trackBtn.href = `track-order.html?id=${orderRef}`;

  // Direct Concierge WhatsApp Link
  const waBtn = document.getElementById('orderWhatsAppSupport');
  if (waBtn) {
    const msg = encodeURIComponent(
      `Salam Baitul Manal! I placed Order #${orderRef}.\n\nItems: KD ${explicitSubtotal.toFixed(3)}\nDelivery: KD ${deliveryFee.toFixed(3)}\nTotal Paid: KD ${grandTotal.toFixed(3)}\n\nDestination: ${cleanAddress}`
    );
    waBtn.href = `https://wa.me/96560454629?text=${msg}`;
  }
});