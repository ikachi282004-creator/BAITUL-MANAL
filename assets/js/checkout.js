/**
 * BAITUL MANAL — Master Checkout Controller (checkout.js)
 * Live-Hydrated Order Calculation, Customer Profile Sync & Direct Dispatch
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

  // Exact DOM elements mapped to checkout.html
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

  // Customer Contact Fields
  const inputFirstName = document.getElementById('custFirstName');
  const inputLastName = document.getElementById('custLastName');
  const inputPhone = document.getElementById('custPhone');
  const inputEmail = document.getElementById('custEmail');

  // =========================================================================
  // 1. AUTO-SYNC DETAILS FROM CUSTOMER PROFILE SANCTUARY
  // =========================================================================
  function syncCustomerProfileData() {
    try {
      const storedProfile = localStorage.getItem('bm_customer_user');
      if (!storedProfile) return;

      const user = JSON.parse(storedProfile);
      if (!user) return;

      // Extract First and Last Name
      if (user.fullName && inputFirstName && inputLastName) {
        const nameParts = user.fullName.trim().split(' ');
        inputFirstName.value = nameParts[0] || '';
        inputLastName.value = nameParts.slice(1).join(' ') || nameParts[0] || '';
      }

      // Format Kuwait Mobile Number (last 8 digits)
      if (user.phone && inputPhone) {
        const rawDigits = user.phone.replace(/\D/g, '');
        const clean8Digit = rawDigits.length >= 8 ? rawDigits.slice(-8) : rawDigits;
        inputPhone.value = clean8Digit;
      }

      // Populate Email if provided
      if (user.email && inputEmail) {
        inputEmail.value = user.email;
      }

      // Visual Luxury Account Sync Confirmation Badge
      const stepHeader = document.querySelector('#stepCustomer .checkout-card__header');
      if (stepHeader && !document.getElementById('syncedAccountBadge')) {
        const badge = document.createElement('div');
        badge.id = 'syncedAccountBadge';
        badge.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; background: rgba(39, 174, 96, 0.1); border: 1px solid rgba(39, 174, 96, 0.3); color: #27ae60; padding: 4px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; margin-top: 6px; letter-spacing: 0.5px;';
        badge.innerHTML = `<span>✓</span> <span>Profile Synced: ${user.fullName || 'Verified Atelier Member'}</span>`;
        stepHeader.appendChild(badge);
      }
    } catch (e) {
      console.warn('Profile sync skipped:', e);
    }
  }

  syncCustomerProfileData();

  // Interactive Payment Selection
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

  // Fetch Live Catalog
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

  // Restore Saved Delivery Area
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

    if (summaryItemCount) summaryItemCount.textContent = totalItemsCount;

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

    if (checkoutSubtotal) checkoutSubtotal.textContent = `KD ${subtotal.toFixed(3)}`;
    if (checkoutDelivery) {
      checkoutDelivery.textContent = isFree ? 'KD 0.000 (FREE)' : `KD ${deliveryFee.toFixed(3)}`;
      checkoutDelivery.style.color = isFree ? '#27ae60' : '';
    }
    if (checkoutTotal) checkoutTotal.textContent = `KD ${grandTotal.toFixed(3)}`;
    if (btnPayAmount) btnPayAmount.textContent = `KD ${grandTotal.toFixed(3)}`;

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

  custGovernorate?.addEventListener('change', () => {
    localStorage.setItem('bm_selected_area', custGovernorate.value);
    calculateTotals();
  });

  renderOrderItems();

  // Order Submission
  placeOrderBtn?.addEventListener('click', async (e) => {
    e.preventDefault();

    if (!cart.length) {
      alert('Your shopping bag is empty.');
      return;
    }

    const firstName = inputFirstName?.value.trim();
    const lastName = inputLastName?.value.trim();
    const phone = inputPhone?.value.trim();
    const email = inputEmail?.value.trim() || '';
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
      inputFirstName?.focus();
      return;
    }

    if (!phone || phone.length < 8) {
      alert('Please enter a valid 8-digit Kuwait Mobile Number.');
      inputPhone?.focus();
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
        email: email,
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