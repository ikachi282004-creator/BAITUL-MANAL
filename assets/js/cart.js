/**
 * BAITUL MANAL — Master Shopping Bag Controller (cart.js)
 * Fully Synchronized with Backend Live Catalog & Admin Updates
 */

document.addEventListener('DOMContentLoaded', async () => {
  const FREE_SHIPPING_THRESHOLD = 20.000;
  let catalog = [];
  let cart = [];
  let appliedDiscountRate = 0;

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

  // DOM Elements
  const cartList = document.getElementById('cartItemsList');
  const emptyState = document.getElementById('cartEmptyState');
  const summaryCol = document.getElementById('cartSummaryColumn');
  const itemQtyTitle = document.getElementById('cartItemQuantityTitle');
  const shippingBanner = document.getElementById('shippingBanner');
  const shippingNotice = document.getElementById('shippingNoticeText');
  const shippingBarFill = document.getElementById('shippingBarFill');
  const govSelect = document.getElementById('govAreaSelect');
  const subtotalEl = document.getElementById('ledgerSubtotal');
  const shippingEl = document.getElementById('ledgerShipping');
  const discountRow = document.getElementById('ledgerDiscountRow');
  const discountEl = document.getElementById('ledgerDiscount');
  const grandTotalEl = document.getElementById('ledgerGrandTotal');
  const waBtn = document.getElementById('cartWhatsAppBtn');
  const couponInput = document.getElementById('cartCouponInput');
  const couponBtn = document.getElementById('cartCouponBtn');
  const couponMsg = document.getElementById('cartCouponMsg');

  // Badge Sync Helper
  function refreshBadges() {
    try {
      const c = JSON.parse(localStorage.getItem('bm_cart') || '[]');
      const w = JSON.parse(localStorage.getItem('bm_wishlist') || '[]');
      const totalQty = c.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 1), 0);
      document.querySelectorAll('#cartCount, #dockCartCount, .cart-count-badge').forEach(el => el.textContent = totalQty);
      document.querySelectorAll('#wishlistCount, #dockWishlistCount, .wishlist-count-badge').forEach(el => el.textContent = w.length);
    } catch (e) {
      console.warn(e);
    }
  }

  refreshBadges();
  window.addEventListener('storage', refreshBadges);
  window.addEventListener('bm_cart_updated', refreshBadges);

  // Fetch Live Catalog with Cache Busting
  async function fetchLiveCatalog() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/products?t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) throw new Error(`API status ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
      throw new Error('Empty payload from API');
    } catch (err) {
      console.warn('Backend fetch failed, trying local fallback:', err.message);
      try {
        const local = await fetch(STATIC_FALLBACK);
        return await local.json();
      } catch (e) {
        return [];
      }
    }
  }

  function loadCart() {
    try {
      cart = JSON.parse(localStorage.getItem('bm_cart') || '[]');
      if (!Array.isArray(cart)) cart = [];
    } catch {
      cart = [];
    }

    const savedArea = localStorage.getItem('bm_selected_area');
    if (savedArea && govSelect) {
      govSelect.value = savedArea;
    }

    renderCart();
  }

  function renderCart() {
    refreshBadges();

    const totalQty = cart.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 1), 0);
    if (itemQtyTitle) itemQtyTitle.textContent = totalQty;

    if (cart.length === 0) {
      if (cartList) cartList.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      if (summaryCol) summaryCol.style.display = 'none';
      if (shippingBanner) shippingBanner.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (summaryCol) summaryCol.style.display = 'block';
    if (shippingBanner) shippingBanner.style.display = 'block';

    const lang = document.documentElement.getAttribute('lang') || 'en';
    let subtotal = 0;

    cartList.innerHTML = cart.map((item, idx) => {
      // Cross-reference live catalog data for up-to-date pricing and details
      const prod = catalog.find(p => String(p.id) === String(item.id) || String(p.sku) === String(item.id));
      
      const title = prod ? ((prod.name && typeof prod.name === 'object') ? (prod.name[lang] || prod.name.en) : prod.name) : (item.name || item.id);
      
      const regularPrice = prod ? Number(prod.price) : (Number(item.price) || 0);
      const onSale = prod && prod.salePrice !== null && prod.salePrice !== undefined && Number(prod.salePrice) > 0 && Number(prod.salePrice) < regularPrice;
      const unit = onSale ? Number(prod.salePrice) : regularPrice;

      const qty = parseInt(item.qty, 10) || 1;
      const lineTotal = unit * qty;
      const img = prod?.images?.[0] || prod?.image || 'assets/images/placeholder.jpg';

      subtotal += lineTotal;

      return `
        <article class="cart-row" data-idx="${idx}">
          <div class="cart-item-identity">
            <a href="product.html?id=${item.id}">
              <img src="${img}" alt="${title}" class="cart-item-thumb">
            </a>
            <div>
              <h3 class="cart-item-title"><a href="product.html?id=${item.id}">${title}</a></h3>
              <span class="cart-item-sku">SKU: ${prod?.sku || prod?.id || item.id}</span>
              <div class="cart-item-unit-pricing" style="margin-top: 4px; font-size: 0.85rem; font-weight: 600;">
                ${onSale
                  ? `<span style="color: #b33939;">KD ${unit.toFixed(3)}</span> <del style="color: #8c8173; font-size: 0.78rem; font-weight: normal; margin-left: 4px;">KD ${regularPrice.toFixed(3)}</del>`
                  : `<span>KD ${unit.toFixed(3)}</span>`
                }
              </div>
            </div>
          </div>

          <div class="cart-item-meta-center">
            <strong>${item.size || 'M'}</strong> • <span>${item.color || 'Standard'}</span>
          </div>

          <div style="text-align: center;">
            <div class="cart-stepper">
              <button type="button" class="btn-step-dec" data-idx="${idx}">-</button>
              <span>${qty}</span>
              <button type="button" class="btn-step-inc" data-idx="${idx}">+</button>
            </div>
          </div>

          <div class="cart-item-total-col">
            <span class="cart-line-price">KD ${lineTotal.toFixed(3)}</span>
            <button type="button" class="cart-remove-btn" data-idx="${idx}">Remove</button>
          </div>
        </article>
      `;
    }).join('');

    bindItemEvents();
    calculateLedger(subtotal);
  }

  function bindItemEvents() {
    // Increment
    document.querySelectorAll('.btn-step-inc').forEach(btn => {
      btn.onclick = () => {
        const i = parseInt(btn.dataset.idx, 10);
        cart[i].qty = (parseInt(cart[i].qty, 10) || 1) + 1;
        saveAndRerender();
      };
    });

    // Decrement
    document.querySelectorAll('.btn-step-dec').forEach(btn => {
      btn.onclick = () => {
        const i = parseInt(btn.dataset.idx, 10);
        if (cart[i].qty > 1) {
          cart[i].qty -= 1;
        } else {
          cart.splice(i, 1);
        }
        saveAndRerender();
      };
    });

    // Remove
    document.querySelectorAll('.cart-remove-btn').forEach(btn => {
      btn.onclick = () => {
        const i = parseInt(btn.dataset.idx, 10);
        cart.splice(i, 1);
        saveAndRerender();
      };
    });
  }

  function saveAndRerender() {
    localStorage.setItem('bm_cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('bm_cart_updated'));
    renderCart();
  }

  function calculateLedger(subtotal) {
    const areaId = govSelect?.value || 'ahmadi';
    const area = KUWAIT_AREAS.find(a => a.id === areaId) || KUWAIT_AREAS[0];

    const isFree = subtotal >= FREE_SHIPPING_THRESHOLD;
    const shippingFee = isFree ? 0.000 : area.fee;

    // Milestone Progress
    if (shippingNotice) {
      shippingNotice.textContent = isFree
        ? 'Free Delivery Unlocked Across All Kuwait Governorates 🎉'
        : `Add KD ${(FREE_SHIPPING_THRESHOLD - subtotal).toFixed(3)} more for Free Delivery`;
    }
    if (shippingBarFill) {
      const pct = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
      shippingBarFill.style.width = `${pct}%`;
    }

    // Discounts
    const discountAmount = subtotal * appliedDiscountRate;
    const grandTotal = Math.max(0, subtotal - discountAmount) + shippingFee;

    if (subtotalEl) subtotalEl.textContent = `KD ${subtotal.toFixed(3)}`;
    if (shippingEl) {
      shippingEl.textContent = isFree ? 'KD 0.000 (FREE)' : `KD ${shippingFee.toFixed(3)}`;
      shippingEl.style.color = isFree ? '#27ae60' : '';
    }

    if (discountRow) {
      if (discountAmount > 0) {
        discountRow.style.display = 'flex';
        discountEl.textContent = `-KD ${discountAmount.toFixed(3)}`;
      } else {
        discountRow.style.display = 'none';
      }
    }

    if (grandTotalEl) grandTotalEl.textContent = `KD ${grandTotal.toFixed(3)}`;

    // Store selected governorate for seamless checkout
    localStorage.setItem('bm_selected_area', areaId);

    // Update WhatsApp link
    if (waBtn) {
      const summaryList = cart.map(i => {
        const match = catalog.find(p => String(p.id) === String(i.id) || String(p.sku) === String(i.id));
        const name = match?.name?.en || match?.name || i.id;
        return `• ${name} (${i.size || 'M'}) x${i.qty}`;
      }).join('\n');

      const msg = encodeURIComponent(
        `Salam Baitul Manal! I would like to order my shopping bag:\n\n` +
        `${summaryList}\n\n` +
        `Subtotal: KD ${subtotal.toFixed(3)}\n` +
        `Area: ${area.name}\n` +
        `Delivery Fee: ${isFree ? 'KD 0.000 (FREE)' : `KD ${shippingFee.toFixed(3)}`}\n` +
        `Total: KD ${grandTotal.toFixed(3)}`
      );
      waBtn.href = `https://wa.me/96560454629?text=${msg}`;
    }
  }

  // Governorate Change Listener
  govSelect?.addEventListener('change', () => {
    let subtotal = 0;
    cart.forEach(item => {
      const prod = catalog.find(p => String(p.id) === String(item.id) || String(p.sku) === String(item.id));
      const regularPrice = prod ? Number(prod.price) : (Number(item.price) || 0);
      const onSale = prod && prod.salePrice !== null && prod.salePrice !== undefined && Number(prod.salePrice) > 0 && Number(prod.salePrice) < regularPrice;
      const unit = onSale ? Number(prod.salePrice) : regularPrice;
      subtotal += unit * (parseInt(item.qty, 10) || 1);
    });
    calculateLedger(subtotal);
  });

  // Promo Coupon Engine (e.g. EID10 or BM10 for 10% discount)
  couponBtn?.addEventListener('click', () => {
    const code = couponInput?.value.trim().toUpperCase();
    if (code === 'EID10' || code === 'BM10' || code === 'MANAL10') {
      appliedDiscountRate = 0.10;
      if (couponMsg) {
        couponMsg.style.color = '#27ae60';
        couponMsg.textContent = 'Privilege 10% discount applied successfully!';
      }
    } else if (!code) {
      appliedDiscountRate = 0;
      if (couponMsg) couponMsg.textContent = '';
    } else {
      appliedDiscountRate = 0;
      if (couponMsg) {
        couponMsg.style.color = '#b33939';
        couponMsg.textContent = 'Invalid promo voucher code.';
      }
    }

    let subtotal = 0;
    cart.forEach(item => {
      const prod = catalog.find(p => String(p.id) === String(item.id) || String(p.sku) === String(item.id));
      const regularPrice = prod ? Number(prod.price) : (Number(item.price) || 0);
      const onSale = prod && prod.salePrice !== null && prod.salePrice !== undefined && Number(prod.salePrice) > 0 && Number(prod.salePrice) < regularPrice;
      const unit = onSale ? Number(prod.salePrice) : regularPrice;
      subtotal += unit * (parseInt(item.qty, 10) || 1);
    });
    calculateLedger(subtotal);
  });

  // Fetch live catalog first, then render
  catalog = await fetchLiveCatalog();
  loadCart();
});