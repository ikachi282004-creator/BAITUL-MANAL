/**
 * BAITUL MANAL — Order Success & Receipt Controller (order-success.js)
 * Reads latest placed order from localStorage('bm_last_order')
 * Calculates voucher metrics, clears shopping bag, and binds WhatsApp concierge.
 */

document.addEventListener('DOMContentLoaded', async () => {
  let catalog = [];

  try {
    const res = await fetch('assets/data/products.json');
    if (res.ok) catalog = await res.json();
  } catch (e) {
    console.warn('Catalog fetch fallback:', e);
  }

  // Load Order Record
  let order = null;
  try {
    const raw = localStorage.getItem('bm_last_order');
    if (raw) order = JSON.parse(raw);
  } catch (e) {
    console.warn('Order read error:', e);
  }

  // If no order exists, build a demo fallback
  if (!order) {
    const fallbackId = 'BM-KW-' + Math.floor(100000 + Math.random() * 900000);
    order = {
      orderId: fallbackId,
      date: new Date().toLocaleDateString('en-GB'),
      recipient: {
        name: 'Kuwait Guest Customer',
        phone: '+965 6045 4629',
        governorate: 'Al Ahmadi & Fahaheel (Fast Hub)',
        address: 'Block 2, Street 15, Villa 4'
      },
      paymentMethod: 'K-Net / Card',
      items: [
        { id: 'BM-W-01', name: 'Golden Thread Jacquard Darra', size: 'M', color: 'Gold Silk', price: 16.500, qty: 1 }
      ],
      subtotal: 16.500,
      deliveryFee: 1.500,
      discount: 0.000,
      total: 18.000
    };
  }

  // Clear shopping bag after successful placement
  localStorage.removeItem('bm_cart');
  window.dispatchEvent(new Event('bm_cart_updated'));

  // Hydrate DOM
  document.getElementById('orderRefNumber').textContent = order.orderId;
  document.getElementById('orderDate').textContent = order.date || new Date().toLocaleDateString('en-GB');

  // Meta
  document.getElementById('metaName').textContent = order.recipient?.name || 'Valued Guest';
  document.getElementById('metaPhone').textContent = order.recipient?.phone || '+965 --------';
  document.getElementById('metaArea').textContent = order.recipient?.governorate || 'Kuwait Governorate';
  document.getElementById('metaAddress').textContent = order.recipient?.address || 'Kuwait Delivery Address';
  document.getElementById('metaPayment').textContent = order.paymentMethod || 'K-Net Debit';

  // Items List
  const itemsContainer = document.getElementById('receiptItemsList');
  if (itemsContainer && Array.isArray(order.items)) {
    itemsContainer.innerHTML = order.items.map(item => {
      const match = catalog.find(p => p.id === item.id);
      const title = item.name || match?.name?.en || item.id;
      const unit = item.price || match?.salePrice || match?.price || 0;
      const lineTotal = unit * item.qty;

      return `
        <div class="receipt-item-row">
          <div>
            <span class="receipt-item-name">${title}</span>
            <span class="receipt-item-spec">Size: ${item.size} • Color: ${item.color}</span>
          </div>
          <span style="font-weight:600;">×${item.qty}</span>
          <span style="text-align:right; font-weight:700;">KD ${lineTotal.toFixed(3)}</span>
        </div>
      `;
    }).join('');
  }

  // Totals Ledger
  document.getElementById('ledgerSubtotal').textContent = `KD ${(order.subtotal || 0).toFixed(3)}`;
  document.getElementById('ledgerShipping').textContent = (order.deliveryFee === 0) 
    ? 'KD 0.000 (FREE)' 
    : `KD ${(order.deliveryFee || 0).toFixed(3)}`;

  if (order.discount && order.discount > 0) {
    const discRow = document.getElementById('ledgerDiscountRow');
    if (discRow) discRow.style.display = 'flex';
    document.getElementById('ledgerDiscount').textContent = `-KD ${order.discount.toFixed(3)}`;
  }

  document.getElementById('ledgerTotal').textContent = `KD ${(order.total || 0).toFixed(3)}`;

  // Bind WhatsApp Dispatch Message
  const waBtn = document.getElementById('whatsAppConfirmBtn');
  if (waBtn) {
    const linesSummary = (order.items || []).map(i => `• ${i.name || i.id} (${i.size}) x${i.qty}`).join('\n');
    const msg = encodeURIComponent(
      `*BAITUL MANAL ORDER DISPATCH*\n\n` +
      `*Order ID:* ${order.orderId}\n` +
      `*Customer:* ${order.recipient?.name} (${order.recipient?.phone})\n` +
      `*Destination:* ${order.recipient?.governorate}\n` +
      `*Address:* ${order.recipient?.address}\n\n` +
      `*Items:*\n${linesSummary}\n\n` +
      `*Settlement:* ${order.paymentMethod}\n` +
      `*Total Payable:* KD ${(order.total || 0).toFixed(3)}\n\n` +
      `Kindly confirm dispatch from Fahaheel Bazar Atelier.`
    );
    waBtn.href = `https://wa.me/96560454629?text=${msg}`;
  }

  // Print Handler
  document.getElementById('printReceiptBtn')?.addEventListener('click', () => {
    window.print();
  });
});