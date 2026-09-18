/**
 * BAITUL MANAL — Master Product Detail Controller (product.js)
 * Clean, Robust, High-Performance Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  let product = null;
  let allProducts = [];
  let selectedSize = 'Standard';
  let selectedColor = 'Original';
  let quantity = 1;

  // Resolve Product ID from URL (?id=BM-W-02)
  const urlParams = new URLSearchParams(window.location.search);
  const targetId = urlParams.get('id') || 'BM-W-01';

  // Core DOM Elements
  const heroImage = document.getElementById('pdpHeroImage');
  const thumbsTrack = document.getElementById('pdpThumbsTrack');
  const titleEl = document.getElementById('pdpItemTitle');
  const skuEl = document.getElementById('pdpSkuCode');
  const catTag = document.getElementById('pdpCategoryTag');
  const pricingDeck = document.getElementById('pdpPricingDeck');
  const dynamicBtnPrice = document.getElementById('pdpBtnDynamicPrice');
  const sizesMatrix = document.getElementById('pdpSizesMatrix');
  const colorsMatrix = document.getElementById('pdpColorsMatrix');
  const colorLabel = document.getElementById('pdpColorLabel');
  const qtyInput = document.getElementById('pdpQtyValue');
  const favBtn = document.getElementById('pdpFavBtn');
  const addToCartBtn = document.getElementById('pdpAddToCartBtn');
  const whatsAppBtn = document.getElementById('pdpWhatsAppInquiryBtn');
  const relatedRail = document.getElementById('pdpRelatedRail');

  // Breadcrumbs
  const bcCategory = document.getElementById('bcCategory');
  const bcCategoryLink = document.getElementById('bcCategoryLink');
  const bcTitle = document.getElementById('bcTitle');

  // Slide-out Drawer Elements
  const cartDrawer = document.getElementById('cartDrawer');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartDrawerClose = document.getElementById('cartDrawerClose');
  const headerCartBtn = document.getElementById('headerCartBtn');
  const drawerKuwaitArea = document.getElementById('drawerKuwaitArea');

  // =========================================================================
  // 1. GLOBAL BADGE & STORAGE SYNCHRONIZATION
  // =========================================================================
  function getSafeCartCount() {
    try {
      const cart = JSON.parse(localStorage.getItem('bm_cart') || '[]');
      return Array.isArray(cart)
        ? cart.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 1), 0)
        : 0;
    } catch {
      return 0;
    }
  }

  function getSafeWishlistCount() {
    try {
      const wishlist = JSON.parse(localStorage.getItem('bm_wishlist') || '[]');
      return Array.isArray(wishlist) ? wishlist.length : 0;
    } catch {
      return 0;
    }
  }

  function syncBadges() {
    const cartCount = getSafeCartCount();
    const wishCount = getSafeWishlistCount();

    document.querySelectorAll('#cartCount, .cart-count-badge, [data-badge="cart"]').forEach(el => {
      el.textContent = cartCount;
    });

    document.querySelectorAll('#wishlistCount, .wishlist-count-badge, [data-badge="wishlist"]').forEach(el => {
      el.textContent = wishCount;
    });
  }

  syncBadges();
  window.addEventListener('storage', syncBadges);
  window.addEventListener('bm_cart_updated', syncBadges);
  window.addEventListener('bm_wishlist_updated', syncBadges);

  // =========================================================================
  // 2. FETCH & DATA HYDRATION
  // =========================================================================
  try {
    const res = await fetch('assets/data/products.json');
    if (!res.ok) throw new Error('Catalog JSON not accessible');
    allProducts = await res.json();

    product = allProducts.find(p => String(p.id).toLowerCase() === targetId.toLowerCase());
    if (!product && allProducts.length > 0) {
      product = allProducts[0];
    }

    if (!product) return;

    hydrateView();
    renderRelatedRail();
    setupEventListeners();
  } catch (err) {
    console.error('Failed to load product atelier:', err);
  }

  function hydrateView() {
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const name = (product.name && typeof product.name === 'object')
      ? (product.name[lang] || product.name.en)
      : product.name;

    document.title = `${name} | BAITUL MANAL Kuwait`;

    if (titleEl) titleEl.textContent = name;
    if (skuEl) skuEl.textContent = `SKU: ${product.sku || product.id}`;
    if (catTag) catTag.textContent = (product.category || 'Atelier').toUpperCase();

    // Breadcrumbs
    if (bcCategory) bcCategory.textContent = (product.category || 'Shop').toUpperCase();
    if (bcCategoryLink) bcCategoryLink.href = `shop.html?category=${product.category || 'all'}`;
    if (bcTitle) bcTitle.textContent = name;

    // Pricing
    const price = typeof product.price === 'number' ? product.price : 0;
    const salePrice = typeof product.salePrice === 'number' ? product.salePrice : null;
    const onSale = salePrice !== null && salePrice < price;
    const activeUnit = onSale ? salePrice : price;

    if (pricingDeck) {
      pricingDeck.innerHTML = onSale
        ? `<span class="pdp-price-curr discounted">KD ${salePrice.toFixed(3)}</span>
           <span class="pdp-price-strike">KD ${price.toFixed(3)}</span>
           <span class="pdp-discount-pill">-${Math.round(((price - salePrice) / price) * 100)}% OFF</span>`
        : `<span class="pdp-price-curr">KD ${price.toFixed(3)}</span>`;
    }

    if (dynamicBtnPrice) {
      dynamicBtnPrice.textContent = `KD ${(activeUnit * quantity).toFixed(3)}`;
    }

    // Images & Filmstrip
    const images = Array.isArray(product.images) && product.images.length
      ? product.images
      : ['assets/images/placeholder.jpg'];

    if (heroImage) {
      heroImage.src = images[0];
      heroImage.alt = name;
    }

    if (thumbsTrack) {
      thumbsTrack.innerHTML = images.map((src, idx) => `
        <button type="button" class="pdp-thumb-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
          <img src="${src}" alt="Thumbnail ${idx + 1}">
        </button>
      `).join('');

      thumbsTrack.querySelectorAll('.pdp-thumb-item').forEach(btn => {
        btn.addEventListener('click', () => {
          thumbsTrack.querySelectorAll('.pdp-thumb-item').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const i = parseInt(btn.dataset.idx, 10);
          if (heroImage) heroImage.src = images[i];
        });
      });
    }

    // Sizes
    const sizes = Array.isArray(product.sizes) && product.sizes.length ? product.sizes : ['Standard'];
    selectedSize = sizes[0];
    if (sizesMatrix) {
      sizesMatrix.innerHTML = sizes.map((s, idx) => `
        <button type="button" class="pdp-size-btn ${idx === 0 ? 'active' : ''}" data-size="${s}">${s}</button>
      `).join('');

      sizesMatrix.querySelectorAll('.pdp-size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          sizesMatrix.querySelectorAll('.pdp-size-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedSize = btn.dataset.size;
          updateWhatsAppLink();
        });
      });
    }

    // Colors
    const colors = Array.isArray(product.colors) && product.colors.length
      ? product.colors
      : [{ name: 'Original', hex: '#c5a880' }];
    selectedColor = colors[0].name || 'Original';
    if (colorLabel) colorLabel.textContent = selectedColor;

    if (colorsMatrix) {
      colorsMatrix.innerHTML = colors.map((c, idx) => `
        <button type="button" class="pdp-color-swatch ${idx === 0 ? 'active' : ''}" data-color="${c.name}" style="background-color: ${c.hex};" title="${c.name}"></button>
      `).join('');

      colorsMatrix.querySelectorAll('.pdp-color-swatch').forEach(btn => {
        btn.addEventListener('click', () => {
          colorsMatrix.querySelectorAll('.pdp-color-swatch').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedColor = btn.dataset.color;
          if (colorLabel) colorLabel.textContent = selectedColor;
          updateWhatsAppLink();
        });
      });
    }

    // Wishlist Button State
    const wishlist = JSON.parse(localStorage.getItem('bm_wishlist') || '[]');
    if (favBtn) {
      favBtn.classList.toggle('active', wishlist.includes(product.id));
    }

    updateWhatsAppLink();
  }

  function updateWhatsAppLink() {
    if (!whatsAppBtn || !product) return;
    const msg = encodeURIComponent(
      `Salam Baitul Manal! I would like to inquire about this piece:\n` +
      `• ${product.name?.en || 'Baitul Manal Piece'} (SKU: ${product.sku || product.id})\n` +
      `• Size: ${selectedSize}\n` +
      `• Color: ${selectedColor}\n` +
      `URL: ${window.location.href}`
    );
    whatsAppBtn.href = `https://wa.me/96560454629?text=${msg}`;
  }

  // =========================================================================
  // 3. EVENT LISTENERS & GLASS ZOOM
  // =========================================================================
  function setupEventListeners() {
    // Stepper
    document.getElementById('pdpQtyInc')?.addEventListener('click', () => {
      quantity++;
      if (qtyInput) qtyInput.value = quantity;
      updateDynamicPrice();
    });

    document.getElementById('pdpQtyDec')?.addEventListener('click', () => {
      if (quantity > 1) {
        quantity--;
        if (qtyInput) qtyInput.value = quantity;
        updateDynamicPrice();
      }
    });

    function updateDynamicPrice() {
      const activeUnit = product.salePrice || product.price || 0;
      if (dynamicBtnPrice) {
        dynamicBtnPrice.textContent = `KD ${(activeUnit * quantity).toFixed(3)}`;
      }
    }

    // Glass Zoom
    const viewport = document.getElementById('pdpViewport');
    if (viewport && heroImage) {
      viewport.addEventListener('mousemove', (e) => {
        const rect = viewport.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        heroImage.style.transformOrigin = `${x}% ${y}%`;
        heroImage.style.transform = 'scale(2)';
      });

      viewport.addEventListener('mouseleave', () => {
        heroImage.style.transform = 'scale(1)';
      });
    }

    // Wishlist Toggle
    favBtn?.addEventListener('click', () => {
      if (!product) return;
      let wishlist = JSON.parse(localStorage.getItem('bm_wishlist') || '[]');
      if (!Array.isArray(wishlist)) wishlist = [];

      if (wishlist.includes(product.id)) {
        wishlist = wishlist.filter(x => x !== product.id);
        favBtn.classList.remove('active');
      } else {
        wishlist.push(product.id);
        favBtn.classList.add('active');
      }

      localStorage.setItem('bm_wishlist', JSON.stringify(wishlist));
      window.dispatchEvent(new Event('bm_wishlist_updated'));
      window.dispatchEvent(new Event('storage'));
      syncBadges();
    });

    // Add To Bag CTA
    addToCartBtn?.addEventListener('click', () => {
      if (!product) return;
      let cart = JSON.parse(localStorage.getItem('bm_cart') || '[]');
      if (!Array.isArray(cart)) cart = [];

      const existing = cart.find(i => i.id === product.id && i.size === selectedSize && i.color === selectedColor);
      if (existing) {
        existing.qty = (parseInt(existing.qty, 10) || 1) + quantity;
      } else {
        cart.push({ id: product.id, size: selectedSize, color: selectedColor, qty: quantity });
      }

      localStorage.setItem('bm_cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('bm_cart_updated'));
      window.dispatchEvent(new Event('storage'));
      syncBadges();

      openBagDrawer();
    });

    // Drawer Open / Close Triggers
    headerCartBtn?.addEventListener('click', openBagDrawer);
    cartDrawerClose?.addEventListener('click', closeBagDrawer);
    cartOverlay?.addEventListener('click', closeBagDrawer);

    drawerKuwaitArea?.addEventListener('change', renderCartDrawer);
  }

  // =========================================================================
  // 4. SLIDE-OUT CART DRAWER ENGINE
  // =========================================================================
  const KUWAIT_AREAS = [
    { id: 'ahmadi', name: 'Al Ahmadi & Fahaheel', fee: 1.500 },
    { id: 'capital', name: 'Kuwait City & Al Asimah', fee: 2.000 },
    { id: 'hawally', name: 'Hawally & Salmiya', fee: 2.000 },
    { id: 'farwaniya', name: 'Farwaniya & Khaitan', fee: 2.000 },
    { id: 'mubarak', name: 'Mubarak Al-Kabeer', fee: 2.000 },
    { id: 'jahra', name: 'Al Jahra & Suburbs', fee: 2.500 }
  ];

  function openBagDrawer() {
    renderCartDrawer();
    if (cartDrawer) cartDrawer.classList.add('active');
    if (cartOverlay) cartOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeBagDrawer() {
    if (cartDrawer) cartDrawer.classList.remove('active');
    if (cartOverlay) cartOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function renderCartDrawer() {
    const cart = JSON.parse(localStorage.getItem('bm_cart') || '[]');
    const container = document.getElementById('cartDrawerItems');
    const drawerItemCount = document.getElementById('drawerItemCount');
    const subtotalEl = document.getElementById('drawerSubtotal');
    const deliveryEl = document.getElementById('drawerDelivery');
    const totalEl = document.getElementById('drawerTotal');
    const fillEl = document.getElementById('drawerShippingFill');
    const msgEl = document.getElementById('drawerShippingMsg');
    const freeTag = document.getElementById('drawerFreeTag');

    const totalQty = cart.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 1), 0);
    if (drawerItemCount) drawerItemCount.textContent = `(${totalQty})`;

    if (cart.length === 0) {
      if (container) container.innerHTML = `<p style="text-align:center; padding:3rem 0; color:#8c8173;">Your shopping bag is empty.</p>`;
      if (subtotalEl) subtotalEl.textContent = 'KD 0.000';
      if (deliveryEl) deliveryEl.textContent = 'KD 0.000';
      if (totalEl) totalEl.textContent = 'KD 0.000';
      if (fillEl) fillEl.style.width = '0%';
      return;
    }

    let subtotal = 0;

    if (container) {
      container.innerHTML = cart.map((item, idx) => {
        const prod = allProducts.find(p => p.id === item.id) || product;
        const unit = prod?.salePrice || prod?.price || 0;
        const lineTotal = unit * item.qty;
        subtotal += lineTotal;

        return `
          <div class="cart-item" style="display:flex; gap:12px; align-items:center; padding:10px 0; border-bottom:1px solid rgba(214,203,186,0.4);">
            <img src="${prod?.images?.[0] || 'assets/images/placeholder.jpg'}" alt="" style="width:52px; height:68px; object-fit:cover; border-radius:6px;">
            <div style="flex:1;">
              <h4 style="font-family:'Playfair Display',serif; font-size:0.88rem; margin:0 0 2px;">${prod?.name?.en || item.id}</h4>
              <span style="font-size:0.72rem; color:#8c8173;">${item.size} • ${item.color}</span>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
                <span style="font-weight:700; font-size:0.85rem;">KD ${lineTotal.toFixed(3)}</span>
                <div style="display:inline-flex; align-items:center; border:1px solid #ddd; border-radius:4px;">
                  <button type="button" class="drawer-dec" data-idx="${idx}" style="padding:2px 8px; background:none; border:none; cursor:pointer;">-</button>
                  <span style="padding:0 6px; font-size:0.8rem; font-weight:700;">${item.qty}</span>
                  <button type="button" class="drawer-inc" data-idx="${idx}" style="padding:2px 8px; background:none; border:none; cursor:pointer;">+</button>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.drawer-inc').forEach(btn => {
        btn.onclick = () => {
          const i = parseInt(btn.dataset.idx, 10);
          cart[i].qty = (parseInt(cart[i].qty, 10) || 1) + 1;
          localStorage.setItem('bm_cart', JSON.stringify(cart));
          syncBadges();
          renderCartDrawer();
        };
      });

      container.querySelectorAll('.drawer-dec').forEach(btn => {
        btn.onclick = () => {
          const i = parseInt(btn.dataset.idx, 10);
          if (cart[i].qty > 1) {
            cart[i].qty -= 1;
          } else {
            cart.splice(i, 1);
          }
          localStorage.setItem('bm_cart', JSON.stringify(cart));
          syncBadges();
          renderCartDrawer();
        };
      });
    }

    const areaId = drawerKuwaitArea?.value || 'ahmadi';
    const areaData = KUWAIT_AREAS.find(a => a.id === areaId) || KUWAIT_AREAS[0];
    const isFree = subtotal >= 20.000;
    const fee = isFree ? 0 : areaData.fee;

    if (subtotalEl) subtotalEl.textContent = `KD ${subtotal.toFixed(3)}`;
    if (deliveryEl) deliveryEl.textContent = isFree ? 'KD 0.000 (FREE)' : `KD ${fee.toFixed(3)}`;
    if (totalEl) totalEl.textContent = `KD ${(subtotal + fee).toFixed(3)}`;
    if (freeTag) freeTag.style.display = isFree ? 'inline-block' : 'none';

    const pct = Math.min(100, (subtotal / 20.000) * 100);
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (msgEl) {
      msgEl.textContent = isFree
        ? 'Free Delivery Unlocked Across Kuwait 🎉'
        : `Add KD ${(20.000 - subtotal).toFixed(3)} more for Free Delivery`;
    }
  }

  // =========================================================================
  // 5. RELATED PRODUCTS RAIL
  // =========================================================================
  function renderRelatedRail() {
    if (!relatedRail || !product) return;

    const related = allProducts
      .filter(p => p.id !== product.id && p.category === product.category)
      .slice(0, 4);

    if (related.length === 0) return;

    relatedRail.innerHTML = related.map(p => {
      const onSale = p.salePrice !== null && p.salePrice < p.price;
      return `
        <article class="arrival-card" style="background:#fff; border:1px solid rgba(214,203,186,0.5); border-radius:8px; overflow:hidden;">
          <a href="product.html?id=${p.id}" style="display:block; aspect-ratio:3/4; overflow:hidden;">
            <img src="${p.images?.[0] || 'assets/images/placeholder.jpg'}" alt="${p.name?.en || ''}" style="width:100%; height:100%; object-fit:cover;">
          </a>
          <div style="padding:12px;">
            <span style="font-size:0.68rem; text-transform:uppercase; color:#8c8173; font-weight:700;">${p.category}</span>
            <h3 style="font-family:'Playfair Display',serif; font-size:0.9rem; margin:4px 0 6px;">
              <a href="product.html?id=${p.id}" style="text-decoration:none; color:#181512;">${p.name?.en || ''}</a>
            </h3>
            <span style="font-weight:700; font-size:0.85rem;">KD ${(p.salePrice || p.price).toFixed(3)}</span>
          </div>
        </article>
      `;
    }).join('');
  }
});