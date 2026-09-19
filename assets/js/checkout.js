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
    { id: 'ahmadi', nameEn: 'Al Ahmadi (Fast Hub)', fee: 1.500 },
    { id: 'capital', nameEn: 'Capital / Al Asimah', fee: 2.000 },
    { id: 'hawally', nameEn: 'Hawally & Salmiya', fee: 2.000 },
    { id: 'farwaniya', nameEn: 'Farwaniya & Khaitan', fee: 2.000 },
    { id: 'mubarak', nameEn: 'Mubarak Al-Kabeer', fee: 2.000 },
    { id: 'jahra', nameEn: 'Al Jahra & Suburbs', fee: 2.500 }
  ];

  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem('bm_cart') || '[]');
  } catch {
    cart = [];
  }

  // Exact DOM mapping matching checkout.html
  const summaryItemCount = document.getElementById('summaryItemCount');
  const summaryItemsList = document.getElementById('summaryItemsList');
  const tierNoticeText = document.getElementById('tierNoticeText');
  const tierStatusPill = document.getElementById('tierStatusPill');
  const tierFill = document.getElementById('tierFill');
  const checkoutSubtotal = document.getElementById('checkoutSubtotal');
  const checkoutDelivery = document.getElementById('checkoutDelivery');
  const checkoutTotal = document.getElementById('checkoutTotal');
  const btnPayAmount = document.getElementById('btnPayAmount');
  const placeOrderBtn = document.getElementById('placeOrderBtn');
  const custGovernorate = document.getElementById('custGovernorate');

  // Interactive Payment Accordion Handlers
  document.querySelectorAll('input[name="payMethod"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.querySelectorAll('.pay-method-card').forEach(card => card.classList.remove('active'));
      e.target.closest('.pay-method-card')?.classList.add('active');

      const knet = document.getElementById('knetDetails');
      const card = document.getElementById('cardDetails');
      const cod = document.getElementById('codDetails');

      if (knet) knet.style.display = e.target.value === 'knet' ? 'block' : 'none';
      if (card) card.style.display = e.target.value === 'card' ? 'block' : 'none';
      if (cod) cod.style.display = e.target.value === 'cod' ? 'block' : 'none';
    });
  });

  // Fetch Live Catalog with Cache-Buster
  let catalog = [];
  async function fetchCatalog() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/products?t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) throw new Error('API unreachable');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
      throw new Error('Empty API response');
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
  if (savedArea && custGovernorate) {
    custGovernorate.value = savedArea;
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

    const selectedGov = custGovernorate ? custGovernorate.value.toLowerCase() : (savedArea || 'ahmadi');
    const area = KUWAIT_AREAS.find(a => selectedGov.includes(a.id)) || KUWAIT_AREAS[0];
    const isFree = subtotal >= FREE_SHIPPING_THRESHOLD;
    const deliveryFee = (subtotal === 0 || isFree) ? 0.000 : area.fee;
    const grandTotal = subtotal + deliveryFee;

    // 1. Update Title Count
    if (summaryItemCount) {
      summaryItemCount.textContent = totalItemsCount;
    }

    // 2. Update Progress Milestone
    if (tierNoticeText) {
      tierNoticeText.textContent = isFree
        ? 'Free Delivery Unlocked Across Kuwait 🎉'
        : `Add KD ${(FREE_SHIPPING_THRESHOLD - subtotal).toFixed(3)} for Free Delivery`;
    }

    if (tierStatusPill) {
      tierStatusPill.textContent = isFree ? 'FREE ELIGIBLE' : 'DISPATCH FEE';
      tierStatusPill.style.color = isFree ? '#27ae60' : '#8c8173';
    }

    if (tierFill) {
      const pct = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
      tierFill.style.width = `${pct}%`;
    }

    // 3. Update Ledger Amounts
    if (checkoutSubtotal) checkoutSubtotal.textContent = `KD ${subtotal.toFixed(3)}`;
    if (checkoutDelivery) {
      checkoutDelivery.textContent = isFree ? 'KD 0.000 (FREE)' : `KD ${deliveryFee.toFixed(3)}`;
      checkoutDelivery.style.color = isFree ? '#27ae60' : '';
    }
    if (checkoutTotal) checkoutTotal.textContent = `KD ${grandTotal.toFixed(3)}`;

    // 4. Update Place Order & Pay Button Price Tag
    if (btnPayAmount) {
      btnPayAmount.textContent = `KD ${grandTotal.toFixed(3)}`;
    }

    return { subtotal, deliveryFee, grandTotal, totalItemsCount };
  }

  function renderOrderItems() {
    if (!summaryItemsList) return;

    if (!cart.length) {
      summaryItemsList.innerHTML = '<p style="color:#8c8173; text-align:center; padding:1.5rem 0; font-size:0.88rem;">Your shopping bag is empty.</p>';
      calculateTotals();
      return;
    }

    summaryItemsList.innerHTML = cart.map(item => {
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
        <div class="summary-item-row" style="display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(214,203,186,0.4);">
          <img src="${img}" alt="${title}" style="width: 48px; height: 64px; object-fit: cover; border-radius: 4px; border: 1px solid rgba(214,203,186,0.6);">
          <div style="flex: 1; min-width: 0;">
            <h4 style="margin: 0 0 2px; font-family: 'Playfair Display', serif; font-size: 0.88rem; color: #181512; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</h4>
            <div style="font-size: 0.74rem; color: #8c8173; margin-bottom: 2px;">${item.size || 'M'} • ${item.color || 'Standard'} (Qty: ${qty})</div>
            <div style="font-size: 0.8rem; font-weight: 600; color: #181512;">
              ${onSale ? `<span style="color: #b33939;">KD ${unit.toFixed(3)}</span>` : `KD ${unit.toFixed(3)}`}
            </div>
          </div>
          <div style="font-weight: 700; font-size: 0.88rem; color: #181512;">KD ${lineTotal.toFixed(3)}</div>
        </div>
      `;
    }).join('');

    calculateTotals();
  }

  // Handle Governorate Dropdown Changes
  custGovernorate?.addEventListener('change', () => {
    localStorage.setItem('bm_selected_area', custGovernorate.value);
    calculateTotals();
  });

  renderOrderItems();

  // Master Order Placement Event Handler
  placeOrderBtn?.addEventListener('click', async (e) => {
    e.preventDefault();

    if (!cart.length) {
      alert('Your shopping bag is empty.');
      return;
    }

    const firstName = document.getElementById('custFirstName')?.value.trim();
    const lastName = document.getElementById('custLastName')?.value.trim();
    const phone = document.getElementById('custPhone')?.value.trim();
    const area = document.getElementById('custArea')?.value.trim();
    const block = document.getElementById('custBlock')?.value.trim();
    const street = document.getElementById('custStreet')?.value.trim();
    const house = document.getElementById('custHouse')?.value.trim();
    const avenue = document.getElementById('custAvenue')?.value.trim() || '';
    const flat = document.getElementById('custFlat')?.value.trim() || '';
    const notes = document.getElementById('custNotes')?.value.trim() || '';
    const govOption = custGovernorate?.options[custGovernorate.selectedIndex]?.text || 'Al Ahmadi';

    if (!firstName || !lastName) {
      alert('Please enter your First and Last Name.');
      document.getElementById('custFirstName')?.focus();
      return;
    }

    if (!phone || phone.length < 8) {
      alert('Please enter a valid 8-digit Kuwait Mobile Number.');
      document.getElementById('custPhone')?.focus();
      return;
    }

    if (!area || !block || !street || !house) {
      alert('Please fill in your Delivery Address details (Area, Block, Street, House/Building).');
      return;
    }

    const fullAddress = `Gov: ${govOption}, Area: ${area}, Block: ${block}, Street: ${street}${avenue ? ', Ave: ' + avenue : ''}, House: ${house}${flat ? ', Flat: ' + flat : ''}${notes ? ' (Notes: ' + notes + ')' : ''}`;

    const payMethodRadio = document.querySelector('input[name="payMethod"]:checked');
    const paymentMethod = payMethodRadio ? payMethodRadio.value.toUpperCase() : 'KNET';

    const { subtotal, deliveryFee, grandTotal } = calculateTotals();

    const payload = {
      recipient: {
        name: `${firstName} ${lastName}`,
        phone: phone,
        governorate: govOption,
        address: fullAddress
      },
      items: cart,
      paymentMethod,
      deliveryArea: govOption,
      subtotal,
      deliveryFee,
      total: grandTotal
    };

    placeOrderBtn.disabled = true;
    const originalText = placeOrderBtn.innerHTML;
    placeOrderBtn.innerHTML = `<span>Processing Order...</span><span>KD ${grandTotal.toFixed(3)}</span>`;

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

        // DIRECT REDIRECT TO DEDICATED MOBILE-FRIENDLY ORDER SUCCESS RECEIPT
        window.location.href = `order-success.html?id=${data.order.orderId}`;
      } else {
        alert(data.error || 'Failed to place order. Please check your network connection.');
        placeOrderBtn.disabled = false;
        placeOrderBtn.innerHTML = originalText;
      }
    } catch {
      alert('Network error connecting to dispatch server.');
      placeOrderBtn.disabled = false;
      placeOrderBtn.innerHTML = originalText;
    }
  });
});