document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://baitul-manal-1.onrender.com';

  const KUWAIT_AREAS = [
    { id: 'ahmadi', name: 'Al Ahmadi & Fahaheel', fee: 1.500 },
    { id: 'capital', name: 'Kuwait City & Al Asimah', fee: 2.000 },
    { id: 'hawally', name: 'Hawally & Salmiya', fee: 2.000 },
    { id: 'farwaniya', name: 'Farwaniya & Khaitan', fee: 2.000 },
    { id: 'mubarak', name: 'Mubarak Al-Kabeer', fee: 2.000 },
    { id: 'jahra', name: 'Al Jahra & Suburbs', fee: 2.500 }
  ];

  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem('bm_cart') || '[]');
  } catch {
    cart = [];
  }

  // Load products to calculate verified prices
  let catalog = [];
  try {
    const res = await fetch(`${API_BASE}/api/admin/products?t=${new Date().getTime()}`);
    catalog = await res.json();
  } catch {
    try {
      const fallback = await fetch('assets/data/products.json');
      catalog = await fallback.json();
    } catch (e) {
      catalog = [];
    }
  }

  const itemsContainer = document.getElementById('checkoutOrderItems') || document.getElementById('orderSummaryItems');
  const subtotalEl = document.getElementById('checkoutSubtotal') || document.getElementById('summarySubtotal');
  const deliveryEl = document.getElementById('checkoutDelivery') || document.getElementById('summaryDelivery');
  const totalEl = document.getElementById('checkoutTotal') || document.getElementById('summaryTotal');
  const govSelect = document.getElementById('custGov') || document.querySelector('select[name="governorate"]');
  const checkoutForm = document.getElementById('checkoutForm') || document.querySelector('form');
  const submitBtn = document.getElementById('placeOrderBtn') || document.querySelector('button[type="submit"]');

  function calculateTotals() {
    let subtotal = 0;
    cart.forEach(item => {
      const prod = catalog.find(p => String(p.id) === String(item.id) || String(p.sku) === String(item.id));
      const price = prod ? (Number(prod.salePrice) || Number(prod.price)) : 0;
      subtotal += price * (parseInt(item.qty, 10) || 1);
    });

    const selectedGov = govSelect ? govSelect.value.toLowerCase() : 'ahmadi';
    const area = KUWAIT_AREAS.find(a => selectedGov.includes(a.id)) || KUWAIT_AREAS[0];
    const isFree = subtotal >= 20.000;
    const deliveryFee = isFree ? 0.000 : area.fee;
    const grandTotal = subtotal + deliveryFee;

    if (subtotalEl) subtotalEl.textContent = `KD ${subtotal.toFixed(3)}`;
    if (deliveryEl) deliveryEl.textContent = isFree ? 'KD 0.000 (FREE)' : `KD ${deliveryFee.toFixed(3)}`;
    if (totalEl) totalEl.textContent = `KD ${grandTotal.toFixed(3)}`;

    return { subtotal, deliveryFee, grandTotal };
  }

  function renderCheckoutSummary() {
    if (!itemsContainer) return;
    if (!cart.length) {
      itemsContainer.innerHTML = '<p style="color:#888; padding: 1rem 0;">Your shopping bag is empty.</p>';
      return;
    }

    itemsContainer.innerHTML = cart.map(item => {
      const prod = catalog.find(p => String(p.id) === String(item.id) || String(p.sku) === String(item.id));
      const price = prod ? (Number(prod.salePrice) || Number(prod.price)) : 0;
      const title = prod?.name?.en || prod?.name || item.id;
      const img = prod?.images?.[0] || prod?.image || 'assets/images/placeholder.jpg';

      return `
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px; border-bottom:1px solid #eee; padding-bottom:8px;">
          <img src="${img}" style="width:45px; height:60px; object-fit:cover; border-radius:4px;">
          <div style="flex:1;">
            <div style="font-weight:600; font-size:0.85rem;">${title}</div>
            <div style="font-size:0.75rem; color:#888;">${item.size || 'M'} • ${item.color || 'Standard'} (x${item.qty})</div>
          </div>
          <div style="font-weight:700; font-size:0.85rem;">KD ${(price * (item.qty || 1)).toFixed(3)}</div>
        </div>
      `;
    }).join('');

    calculateTotals();
  }

  govSelect?.addEventListener('change', calculateTotals);
  renderCheckoutSummary();

  // Handle Form Submission
  checkoutForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!cart.length) {
      alert('Your shopping bag is empty.');
      return;
    }

    const name = document.getElementById('custName')?.value.trim() || document.querySelector('input[name="name"]')?.value.trim();
    const phone = document.getElementById('custPhone')?.value.trim() || document.querySelector('input[name="phone"]')?.value.trim();
    const governorate = govSelect ? govSelect.value : 'Al Ahmadi';
    const address = document.getElementById('custAddress')?.value.trim() || document.querySelector('textarea[name="address"]')?.value.trim();
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'K-Net Local Debit';

    if (!name || !phone || !address) {
      alert('Please fill in your full name, phone number, and delivery address.');
      return;
    }

    const { subtotal, deliveryFee, grandTotal } = calculateTotals();

    const payload = {
      recipient: { name, phone, governorate, address },
      items: cart,
      paymentMethod,
      deliveryArea: governorate,
      subtotal,
      deliveryFee,
      total: grandTotal
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing Dispatch...';
    }

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.removeItem('bm_cart');
        localStorage.setItem('bm_last_order', JSON.stringify(data.order));
        localStorage.setItem('bm_customer_phone', phone);
        window.dispatchEvent(new Event('bm_cart_updated'));

        window.location.href = `track-order.html?id=${data.order.orderId}`;
      } else {
        alert(data.error || 'Failed to register order. Please try again.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Complete Order';
        }
      }
    } catch (err) {
      alert('Network error connecting to dispatch server.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Complete Order';
      }
    }
  });
});