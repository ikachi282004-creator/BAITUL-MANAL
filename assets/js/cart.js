/**
 * BAITUL MANAL — Master Shopping Bag Controller (cart.js)
 * Features:
 * - Dynamic line-item rendering with products.json metadata resolution
 * - Real-time stepper increments, decrements, and removals
 * - Kuwait delivery area calculations with free delivery threshold at KD 20.000
 * - Privilege coupon validator (e.g. EID10 for 10% off)
 * - Synchronizes across all page badges
 * - Pre-formats direct WhatsApp concierge bag dispatch
 */

document.addEventListener('DOMContentLoaded', async () => {
  const FREE_SHIPPING_THRESHOLD = 20.000;
  let catalog = [];
  let cart = [];
  let appliedDiscountRate = 0; // 0.10 for 10%

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
      document.querySelectorAll('#cartCount, .cart-count-badge').forEach(el => el.textContent = totalQty);
      document.querySelectorAll('#wishlistCount, .wishlist-count-badge').forEach(el => el.textContent = w.length);
    } catch (e) {
      console.warn(e);
    }
  }

  refreshBadges();
  window.addEventListener('storage', refreshBadges);
  window.addEventListener('bm_cart_updated', refreshBadges);

  // Fetch Catalog
  try {
    const res = await fetch('assets/data/products.json');
    if (res.ok) catalog = await res.json();
  } catch (err) {
    console.error('Catalog load failure:', err);
  }

  function loadCart() {
    try {
      cart = JSON.parse(localStorage.getItem('bm_cart') || '[]');
      if (!Array.isArray(cart)) cart = [];
    } catch {
      cart = [];
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

    let subtotal = 0;

    cartList.innerHTML = cart.map((item, idx) => {
      const prod = catalog.find(p => p.id === item.id);
      const title = prod?.name?.en || item.name || item.id;
      const unit = prod?.salePrice || prod?.price || item.price || 0;
      const qty = parseInt(item.qty, 10) || 1;
      const lineTotal = unit * qty;
      const img = prod?.images?.[0] || 'assets/images/placeholder.jpg';

      subtotal += lineTotal;

      return `
        <article class="cart-row" data-idx="${idx}">
          <div class="cart-item-identity">
            <img src="${img}" alt="${title}" class="cart-item-thumb">
            <div>
              <h3 class="cart-item-title"><a href="product.html?id=${item.id}">${title}</a></h3>
              <span class="cart-item-sku">SKU: ${prod?.sku || item.id}</span>
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
        const match = catalog.find(p => p.id === i.id);
        return `• ${match?.name?.en || i.id} (${i.size}) x${i.qty}`;
      }).join('\n');

      const msg = encodeURIComponent(
        `Salam Baitul Manal! I would like to order my shopping bag:\n\n` +
        `${summaryList}\n\n` +
        `Subtotal: KD ${subtotal.toFixed(3)}\n` +
        `Area: ${area.name}\n` +
        `Total: KD ${grandTotal.toFixed(3)}`
      );
      waBtn.href = `https://wa.me/96560454629?text=${msg}`;
    }
  }

  // Governorate Change Listener
  govSelect?.addEventListener('change', () => {
    let subtotal = 0;
    cart.forEach(item => {
      const prod = catalog.find(p => p.id === item.id);
      const unit = prod?.salePrice || prod?.price || item.price || 0;
      subtotal += unit * (item.qty || 1);
    });
    calculateLedger(subtotal);
  });

  // Promo Coupon Engine (e.g. EID10 or BM10 for 10% discount)
  couponBtn?.addEventListener('click', () => {
    const code = couponInput.value.trim().toUpperCase();
    if (code === 'EID10' || code === 'BM10') {
      appliedDiscountRate = 0.10;
      couponMsg.style.color = '#27ae60';
      couponMsg.textContent = 'Privilege 10% discount applied successfully!';
    } else if (!code) {
      appliedDiscountRate = 0;
      couponMsg.textContent = '';
    } else {
      appliedDiscountRate = 0;
      couponMsg.style.color = '#b33939';
      couponMsg.textContent = 'Invalid promo voucher code.';
    }

    let subtotal = 0;
    cart.forEach(item => {
      const prod = catalog.find(p => p.id === item.id);
      const unit = prod?.salePrice || prod?.price || item.price || 0;
      subtotal += unit * (item.qty || 1);
    });
    calculateLedger(subtotal);
  });

  loadCart();
});