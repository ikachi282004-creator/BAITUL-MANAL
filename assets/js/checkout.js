/**
 * BAITUL MANAL — Master Checkout Controller (checkout.js)
 * Live-Hydrated Order Calculation & Direct Database Dispatch
 */

document.addEventListener('DOMContentLoaded', async () => {
  const FREE_SHIPPING_THRESHOLD = 20.000;

  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://baitul-manal-1.onrender.com';

  const STATIC_FALLBACK = 'assets/data/products.json';

  const KUWAIT_AREAS = [
    { id: 'ahmadi', name: 'Al Ahmadi & Fahaheel (Fast Hub)', fee: 1.500 },
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

  // Target all possible DOM element IDs found in checkout.html
  const summaryTitle = document.querySelector('.summary-card-title, h3, h2') || document.querySelector('aside h3');
  const summaryContainer = document.getElementById('checkoutSummaryItems') || 
                           document.getElementById('checkoutOrderItems') || 
                           document.getElementById('orderSummaryItems') ||
                           document.querySelector('.checkout-items-list') ||
                           document.querySelector('.order-summary-items');

  const subtotalEl = document.getElementById('checkoutSubtotal') || 
                     document.getElementById('summarySubtotal') ||
                     document.querySelector('[data-ledger="subtotal"]');

  const deliveryEl = document.getElementById('checkoutDelivery') || 
                     document.getElementById('summaryDelivery') ||
                     document.getElementById('checkoutDispatchRate') ||
                     document.querySelector('[data-ledger="shipping"]');

  const grandTotalEl = document.getElementById('checkoutTotal') || 
                       document.getElementById('summaryTotal') || 
                       document.getElementById('checkoutGrandTotal') ||
                       document.querySelector('[data-ledger="total"]');

  const btnPayTotal = document.getElementById('btnTotalPayable') || 
                      document.getElementById('placeOrderTotalAmount') ||
                      document.querySelector('.place-order-amount');

  const govSelect = document.getElementById('custGov') || 
                    document.getElementById('governorateSelect') || 
                    document.querySelector('select[name="governorate"]');

  const freeDeliveryNotice = document.getElementById('freeDeliveryNotice') || 
                            document.querySelector('.free-delivery-banner span') ||
                            document.querySelector('.cart-shipping-banner span');

  const checkoutForm = document.getElementById('checkoutForm') || document.querySelector('form');
  const submitBtn = document.getElementById('placeOrderBtn') || document.querySelector('button[type="submit"]');

  // Fetch Live Catalog
  let catalog = [];
  async function fetchCatalog() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/products?t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) throw new Error('API failed');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
      throw new Error('Empty');
    } catch {
      try {
        const fallback = await fetch(STATIC_FALLBACK);
        return await fallback.json();
      } catch {
        return [];
      }
    }
  }

  catalog = await fetchCatalog();

  // Restore saved delivery area if available
  const savedArea = localStorage.getItem('bm_selected_area');
  if (savedArea && govSelect) {
    govSelect.value = savedArea;
  }

  function calculateTotals() {
    let subtotal = 0;
    let totalItemsCount = 0;

    cart.forEach(item => {
      const prod = catalog.find(p => 
        String(p.id).toLowerCase() === String(item.id).toLowerCase() || 
        String(p.sku).toLowerCase() === String(item.id).toLowerCase()
      );
      
      const regularPrice = prod ? Number(prod.price) : (Number(item.price) || 0);
      const onSale = prod && prod.salePrice !== null && prod.salePrice !== undefined && Number(prod.salePrice) > 0 && Number(prod.salePrice) < regularPrice;
      const unit = onSale ? Number(prod.salePrice) : regularPrice;
      const qty = parseInt(item.qty, 10) || 1;

      subtotal += unit * qty;
      totalItemsCount += qty;
    });

    const selectedGov = govSelect ? govSelect.value.toLowerCase() : (savedArea || 'ahmadi');
    const area = KUWAIT_AREAS.find(a => selectedGov.includes(a.id)) || KUWAIT_AREAS[0];
    const isFree = subtotal >= FREE_SHIPPING_THRESHOLD;
    const deliveryFee = (subtotal === 0 || isFree) ? 0.000 : area.fee;
    const grandTotal = subtotal + deliveryFee;

    // Update Text Fields
    if (subtotalEl) subtotalEl.textContent = `KD ${subtotal.toFixed(3)}`;
    if (deliveryEl) {
      deliveryEl.textContent = isFree ? 'KD 0.000 (FREE)' : `KD ${deliveryFee.toFixed(3)}`;
      deliveryEl.style.color = isFree ? '#27ae60' : '';
    }
    if (grandTotalEl) grandTotalEl.textContent = `KD ${grandTotal.toFixed(3)}`;
    if (btnPayTotal) btnPayTotal.textContent = `KD ${grandTotal.toFixed(3)}`;

    // Update order header count
    const headerTitle = document.querySelector('h3:has(+ div), .order-summary-title, aside h3');
    document.querySelectorAll('*').forEach(node => {
      if (node.children.length === 0 && node.textContent.includes('ORDER SUMMARY')) {
        node.textContent = `ORDER SUMMARY (${totalItemsCount})`;
      }
    });

    if (freeDeliveryNotice) {
      freeDeliveryNotice.textContent = isFree 
        ? 'Free Delivery Unlocked Across Kuwait 🎉' 
        : `Add KD ${(FREE_SHIPPING_THRESHOLD - subtotal).toFixed(3)} for Free Delivery`;
    }

    return { subtotal, deliveryFee, grandTotal, totalItemsCount };
  }

  function renderOrderSummary() {
    calculateTotals();

    if (!summaryContainer) return;

    if (!cart.length) {
      summaryContainer.innerHTML = '<p style="color:#8c8173; text-align:center; padding:1.5rem 0;">Your shopping bag is empty.</p>';
      return;
    }

    summaryContainer.innerHTML = cart.map(item => {
      const prod = catalog.find(p => 
        String(p.id).toLowerCase() === String(item.id).toLowerCase() || 
        String(p.sku).toLowerCase() === String(item.id).toLowerCase()
      );
      
      const title = prod ? ((prod.name && typeof prod.name === 'object') ? (prod.name.en || prod.name) : prod.name) : (item.name || item.id);
      const regularPrice = prod ? Number(prod.price) : (Number(item.price) || 0);
      const onSale = prod && prod.salePrice !== null && prod.salePrice !== undefined && Number(prod.salePrice) > 0 && Number(prod.salePrice) < regularPrice;
      const unit = onSale ? Number(prod.salePrice) : regularPrice;
      const qty = parseInt(item.qty, 10) || 1;
      const lineTotal = unit * qty;
      const img = prod?.images?.[0] || prod?.image || 'assets/images/placeholder.jpg';

      return `
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid rgba(214,203,186,0.5);">
          <img src="${img}" alt="${title}" style="width:50px; height:65px; object-fit:cover; border-radius:6px; border:1px solid rgba(214,203,186,0.6);">
          <div style="flex:1; min-width:0;">
            <div style="font-family:'Playfair Display', serif; font-weight:600; font-size:0.9rem; color:#181512; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title}</div>
            <div style="font-size:0.75rem; color:#8c8173; margin-top:2px;">${item.size || 'M'} • ${item.color || 'Standard'} (Qty: ${qty})</div>
            <div style="font-size:0.8rem; font-weight:600; color:#181512; margin-top:2px;">
              ${onSale ? `<span style="color:#b33939;">KD ${unit.toFixed(3)}</span>` : `KD ${unit.toFixed(3)}`}
            </div>
          </div>
          <div style="font-weight:700; font-size:0.9rem; color:#181512;">KD ${lineTotal.toFixed(3)}</div>
        </div>
      `;
    }).join('');
  }

  govSelect?.addEventListener('change', () => {
    localStorage.setItem('bm_selected_area', govSelect.value);
    calculateTotals();
  });

  renderOrderSummary();

  // Handle Form Submission
  checkoutForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!cart.length) {
      alert('Your shopping bag is empty.');
      return;
    }

    const firstName = document.getElementById('firstName')?.value.trim() || document.querySelector('input[name="firstName"]')?.value.trim() || '';
    const lastName = document.getElementById('lastName')?.value.trim() || document.querySelector('input[name="lastName"]')?.value.trim() || '';
    const rawName = document.getElementById('custName')?.value.trim() || document.querySelector('input[name="name"]')?.value.trim() || '';
    const fullName = rawName || `${firstName} ${lastName}`.trim();

    const phone = document.getElementById('custPhone')?.value.trim() || 
                  document.getElementById('mobileNumber')?.value.trim() || 
                  document.querySelector('input[name="phone"]')?.value.trim() || 
                  document.querySelector('input[type="tel"]')?.value.trim();

    const governorate = govSelect ? govSelect.value : 'Al Ahmadi';
    const address = document.getElementById('custAddress')?.value.trim() || 
                    document.getElementById('streetAddress')?.value.trim() || 
                    document.querySelector('textarea[name="address"]')?.value.trim() || 
                    document.querySelector('textarea')?.value.trim();

    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'K-Net Local Debit';

    if (!fullName || !phone) {
      alert('Please fill in your contact name and mobile number.');
      return;
    }

    const { subtotal, deliveryFee, grandTotal } = calculateTotals();

    const payload = {
      recipient: { name: fullName, phone, governorate, address: address || governorate },
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
        alert(data.error || 'Failed to place order. Please try again.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Place Order & Pay';
        }
      }
    } catch {
      alert('Network error connecting to dispatch server.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Place Order & Pay';
      }
    }
  });
});