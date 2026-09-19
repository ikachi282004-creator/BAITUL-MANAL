/**
 * BAITUL MANAL — Master Application Controller (app.js)
 * Live Backend Sync, Multi-Device Cache-Busting & Reactive Navigation
 */

// Instant State Refresh on Browser Back/Forward Navigation (bfcache bypass)
window.addEventListener('pageshow', function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const FREE_DELIVERY_THRESHOLD = 20.000;
  const ITEMS_PER_ROW = 4;
  let currentVisibleCount = 4;
  let productCache = [];
  let drawerDiscount = 0;
  let currentArrivalFilter = 'all';

  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://baitul-manal-1.onrender.com';

  const STATIC_FALLBACK = 'assets/data/products.json';

  const KUWAIT_AREAS = [
    { id: 'ahmadi', nameEn: 'Al Ahmadi & Fahaheel (Fast Hub)', fee: 1.500 },
    { id: 'capital', nameEn: 'Kuwait City & Al Asimah', fee: 2.000 },
    { id: 'hawally', nameEn: 'Hawally & Salmiya', fee: 2.000 },
    { id: 'farwaniya', nameEn: 'Farwaniya & Khaitan', fee: 2.000 },
    { id: 'mubarak', nameEn: 'Mubarak Al-Kabeer', fee: 2.000 },
    { id: 'jahra', nameEn: 'Al Jahra & Suburbs', fee: 2.500 }
  ];

  let activeAreaId = localStorage.getItem('bm_selected_area') || 'ahmadi';

  // =========================================================================
  // 1. GLOBAL BADGE SYNCHRONIZATION ENGINE
  // =========================================================================
  function getSafeCartCount() {
    try {
      const raw = localStorage.getItem('bm_cart');
      if (!raw) return 0;
      const cart = JSON.parse(raw);
      if (!Array.isArray(cart)) return 0;
      return cart.reduce((total, item) => {
        const qty = parseInt(item.qty, 10);
        return total + (isNaN(qty) || qty <= 0 ? 1 : qty);
      }, 0);
    } catch (e) {
      return 0;
    }
  }

  function getSafeWishlistCount() {
    try {
      const raw = localStorage.getItem('bm_wishlist');
      if (!raw) return 0;
      const wishlist = JSON.parse(raw);
      if (!Array.isArray(wishlist)) return 0;
      return wishlist.length;
    } catch (e) {
      return 0;
    }
  }

  window.syncGlobalBadges = function () {
    const cartCount = getSafeCartCount();
    const wishlistCount = getSafeWishlistCount();

    const cartBadges = document.querySelectorAll('#cartCount, #dockCartCount, .cart-count-badge, [data-badge="cart"]');
    const wishlistBadges = document.querySelectorAll('#wishlistCount, #dockWishlistCount, .wishlist-count-badge, [data-badge="wishlist"]');

    cartBadges.forEach(el => {
      el.textContent = cartCount;
      el.classList.add('badge-bump');
      setTimeout(() => el.classList.remove('badge-bump'), 250);
    });

    wishlistBadges.forEach(el => {
      el.textContent = wishlistCount;
      el.classList.add('badge-bump');
      setTimeout(() => el.classList.remove('badge-bump'), 250);
    });
  };

  window.syncGlobalBadges();
  window.addEventListener('storage', window.syncGlobalBadges);
  window.addEventListener('bm_cart_updated', window.syncGlobalBadges);
  window.addEventListener('bm_wishlist_updated', window.syncGlobalBadges);

  // =========================================================================
  // 2. SLIDE-IN ANNOUNCEMENT BAR TICKER
  // =========================================================================
  const slides = document.querySelectorAll('.top-bar__slide');
  let currentSlideIndex = 0;

  function showNextSlide() {
    if (slides.length <= 1) return;
    const current = slides[currentSlideIndex];
    current.classList.remove('active');
    current.classList.add('exit');

    currentSlideIndex = (currentSlideIndex + 1) % slides.length;
    const next = slides[currentSlideIndex];

    setTimeout(() => current.classList.remove('exit'), 500);
    next.classList.add('active');
  }

  if (slides.length > 1) {
    setInterval(showNextSlide, 3800);
  }

  // =========================================================================
  // 3. FLOATING CONCIERGE & SCROLL-TO-TOP
  // =========================================================================
  const scrollTopBtn = document.getElementById('scrollTopBtn');
  window.addEventListener('scroll', () => {
    if (scrollTopBtn) {
      scrollTopBtn.classList.toggle('visible', window.scrollY > 380);
    }
  }, { passive: true });

  scrollTopBtn?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // =========================================================================
  // 4. STICKY HEADER ELEVATION
  // =========================================================================
  const siteHeader = document.getElementById('siteHeader');
  if (siteHeader) {
    const handleScroll = () => siteHeader.classList.toggle('scrolled', window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  // =========================================================================
  // 5. MOBILE NAVIGATION DRAWER
  // =========================================================================
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const drawerOverlay = document.getElementById('drawerOverlay');

  const openNav = () => {
    mobileDrawer?.classList.add('active');
    drawerOverlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeNav = () => {
    mobileDrawer?.classList.remove('active');
    drawerOverlay?.classList.remove('active');
    document.body.style.overflow = '';
  };

  mobileMenuBtn?.addEventListener('click', openNav);
  drawerCloseBtn?.addEventListener('click', closeNav);
  drawerOverlay?.addEventListener('click', closeNav);

  // =========================================================================
  // 6. HERO PROGRESS TICKER ENGINE
  // =========================================================================
  const heroSlides = document.querySelectorAll('.hero-slide');
  const progressTabs = document.querySelectorAll('.progress-tab');
  let currentHeroIdx = 0;
  let heroInterval = null;

  function setHeroSlide(index) {
    if (heroSlides.length === 0) return;
    heroSlides.forEach(slide => slide.classList.remove('active'));
    progressTabs.forEach(tab => {
      tab.classList.remove('active');
      const fill = tab.querySelector('.progress-fill');
      if (fill) fill.style.width = '0%';
    });

    currentHeroIdx = (index + heroSlides.length) % heroSlides.length;
    heroSlides[currentHeroIdx].classList.add('active');
    const activeTab = progressTabs[currentHeroIdx];

    if (activeTab) {
      activeTab.classList.add('active');
      setTimeout(() => {
        const fill = activeTab.querySelector('.progress-fill');
        if (fill) fill.style.width = '100%';
      }, 50);
    }
  }

  if (heroSlides.length > 0) {
    setHeroSlide(0);
    heroInterval = setInterval(() => setHeroSlide(currentHeroIdx + 1), 5000);

    progressTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        clearInterval(heroInterval);
        currentHeroIdx = parseInt(e.currentTarget.dataset.slide, 10);
        setHeroSlide(currentHeroIdx);
        heroInterval = setInterval(() => setHeroSlide(currentHeroIdx + 1), 5000);
      });
    });
  }

  // =========================================================================
  // 7. SCROLL REVEAL & 3D TILT
  // =========================================================================
  function initScrollReveal() {
    const targets = document.querySelectorAll('section, .section-title-wrap, .arch-card, .arrival-card, .promo-hero-banner, .benefit-item');
    targets.forEach(el => el.classList.add('reveal-on-scroll'));

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -60px 0px', threshold: 0.08 });

    targets.forEach(el => observer.observe(el));
  }

  function init3DCardTilt() {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      document.querySelectorAll('.arrival-card, .arch-card').forEach(card => {
        card.classList.add('tilt-card-3d');

        card.onmousemove = (e) => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -6;
          const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 6;
          card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`;
        };

        card.onmouseleave = () => {
          card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)';
        };
      });
    }
  }

  // =========================================================================
  // 8. HOMEPAGE CATALOG WITH LIVE ANTI-CACHE FETCH
  // =========================================================================
  const featuredGrid = document.getElementById('featuredGrid');
  const arrivalTabs = document.querySelectorAll('#arrivalsTabs .tab-pill');

  async function fetchLiveCatalog() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(`${API_BASE}/api/admin/products?_cb=${Date.now()}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store'
        }
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`API status ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
      throw new Error('Empty payload');
    } catch (apiErr) {
      const localRes = await fetch(`${STATIC_FALLBACK}?_cb=${Date.now()}`);
      return await localRes.json();
    }
  }

  async function loadInitialData() {
    try {
      productCache = await fetchLiveCatalog();

      if (featuredGrid) renderArrivals(productCache);

      renderSlider('womenSlider', p => p.category === 'women');
      renderSlider('maidSlider', p => p.category === 'maid' || p.subCategory === 'maid-uniform');
      renderSlider('babySlider', p => p.subCategory === 'baby-essentials');
      renderSlider('darraSlider', p => p.subCategory === 'darra');
      renderSlider('babyInnerSlider', p => p.subCategory === 'baby-innerwear');

      setupSliderArrows('womenPrev', 'womenNext', 'womenSlider');
      setupSliderArrows('maidPrev', 'maidNext', 'maidSlider');
      setupSliderArrows('babyPrev', 'babyNext', 'babySlider');
      setupSliderArrows('darraPrev', 'darraNext', 'darraSlider');
      setupSliderArrows('innerPrev', 'innerNext', 'babyInnerSlider');

      bindInteractionEvents();
      initScrollReveal();
      init3DCardTilt();
    } catch (err) {
      console.error('Failed to load catalog:', err);
    }
  }

  function renderArrivals(products, animateNewRow = false) {
    if (!featuredGrid) return;
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const wishlist = JSON.parse(localStorage.getItem('bm_wishlist') || '[]');

    const filtered = currentArrivalFilter === 'all'
      ? products
      : products.filter(p => p.category === currentArrivalFilter);

    if (currentVisibleCount < ITEMS_PER_ROW) currentVisibleCount = ITEMS_PER_ROW;
    if (currentVisibleCount > filtered.length) currentVisibleCount = filtered.length;

    const displayItems = filtered.slice(0, currentVisibleCount);

    featuredGrid.innerHTML = displayItems.map((p, idx) => {
      const isFav = wishlist.includes(p.id);
      const title = (p.name && typeof p.name === 'object') ? (p.name[lang] || p.name.en) : p.name;
      const onSale = p.salePrice !== null && p.salePrice !== undefined && Number(p.salePrice) < Number(p.price);
      const discount = onSale ? Math.round(((p.price - p.salePrice) / p.price) * 100) : 0;
      const isNewRowItem = animateNewRow && idx >= (currentVisibleCount - ITEMS_PER_ROW);
      const mainImg = p.images?.[0] || p.image || 'assets/images/placeholder.jpg';
      const altImg = p.images?.[1] || mainImg;

      return `
        <article class="arrival-card ${isNewRowItem ? 'arrival-card--animate-in' : ''}" data-id="${p.id}">
          <div class="arrival-card__canvas">
            <div class="arrival-card__badges">
              ${p.isNew ? `<span class="tag-badge tag-badge--new">${lang === 'ar' ? 'جديد' : 'NEW'}</span>` : ''}
              ${onSale ? `<span class="tag-badge tag-badge--sale">-${discount}%</span>` : ''}
            </div>

            <button class="arrival-card__fav ${isFav ? 'active' : ''}" data-id="${p.id}" aria-label="Add to wishlist">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>

            <a href="product.html?id=${p.id}">
              <img src="${mainImg}" alt="${title}" class="arrival-card__img arrival-card__img--main" loading="lazy">
              ${altImg !== mainImg ? `<img src="${altImg}" alt="${title}" class="arrival-card__img arrival-card__img--alt" loading="lazy">` : ''}
            </a>

            <div class="arrival-card__quick-bar">
              <button type="button" class="qa-bar-btn qa-open-btn" data-id="${p.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                <span>${lang === 'ar' ? 'إضافة سريعة' : 'Quick Add'}</span>
              </button>
            </div>
          </div>

          <div class="arrival-card__details">
            <span class="arrival-card__cat">${p.category}</span>
            <h3 class="arrival-card__title"><a href="product.html?id=${p.id}">${title}</a></h3>
            <div class="arrival-card__pricing">
              ${onSale
                ? `<span class="price-curr price-curr--discount">KD ${Number(p.salePrice).toFixed(3)}</span>
                   <span class="price-orig">KD ${Number(p.price).toFixed(3)}</span>`
                : `<span class="price-curr">KD ${Number(p.price).toFixed(3)}</span>`
              }
            </div>
          </div>
        </article>
      `;
    }).join('');

    const moreBtn = document.getElementById('moreArrivalsBtn');
    const lessBtn = document.getElementById('lessArrivalsBtn');
    const moreText = document.getElementById('moreArrivalsText');
    const lessText = document.getElementById('lessArrivalsText');

    if (lessText) lessText.textContent = lang === 'ar' ? 'عرض أقل' : 'Show Less';
    if (lessBtn) lessBtn.style.display = displayItems.length > ITEMS_PER_ROW ? 'inline-flex' : 'none';

    if (moreBtn && moreText) {
      if (displayItems.length >= filtered.length) {
        moreBtn.style.display = 'none';
      } else {
        moreBtn.style.display = 'inline-flex';
        moreText.textContent = lang === 'ar' ? 'عرض المزيد' : 'Load More';
      }
    }

    init3DCardTilt();
  }

  document.getElementById('moreArrivalsBtn')?.addEventListener('click', () => {
    const filtered = currentArrivalFilter === 'all'
      ? productCache
      : productCache.filter(p => p.category === currentArrivalFilter);

    if (currentVisibleCount < filtered.length) {
      currentVisibleCount += ITEMS_PER_ROW;
      renderArrivals(productCache, true);
      bindInteractionEvents();
    }
  });

  document.getElementById('lessArrivalsBtn')?.addEventListener('click', () => {
    if (currentVisibleCount > ITEMS_PER_ROW) {
      currentVisibleCount = Math.max(ITEMS_PER_ROW, currentVisibleCount - ITEMS_PER_ROW);
      renderArrivals(productCache, false);
      bindInteractionEvents();
      document.getElementById('arrivalsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  arrivalTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      arrivalTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentArrivalFilter = tab.dataset.filter;
      currentVisibleCount = ITEMS_PER_ROW;
      renderArrivals(productCache);
      bindInteractionEvents();
    });
  });

  function renderSlider(containerId, filterFn) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const lang = document.documentElement.getAttribute('lang') || 'en';
    const wishlist = JSON.parse(localStorage.getItem('bm_wishlist') || '[]');
    const items = productCache.filter(filterFn);

    container.innerHTML = items.map(p => {
      const isFav = wishlist.includes(p.id);
      const title = (p.name && typeof p.name === 'object') ? (p.name[lang] || p.name.en) : p.name;
      const onSale = p.salePrice !== null && p.salePrice !== undefined && Number(p.salePrice) < Number(p.price);
      const discount = onSale ? Math.round(((p.price - p.salePrice) / p.price) * 100) : 0;
      const mainImg = p.images?.[0] || p.image || 'assets/images/placeholder.jpg';
      const altImg = p.images?.[1] || mainImg;

      return `
        <article class="arrival-card" data-id="${p.id}">
          <div class="arrival-card__canvas">
            <div class="arrival-card__badges">
              ${p.isNew ? `<span class="tag-badge tag-badge--new">${lang === 'ar' ? 'جديد' : 'NEW'}</span>` : ''}
              ${onSale ? `<span class="tag-badge tag-badge--sale">-${discount}%</span>` : ''}
            </div>

            <button class="arrival-card__fav ${isFav ? 'active' : ''}" data-id="${p.id}" aria-label="Add to wishlist">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>

            <a href="product.html?id=${p.id}">
              <img src="${mainImg}" alt="${title}" class="arrival-card__img arrival-card__img--main" loading="lazy">
              ${altImg !== mainImg ? `<img src="${altImg}" alt="${title}" class="arrival-card__img arrival-card__img--alt" loading="lazy">` : ''}
            </a>

            <div class="arrival-card__quick-bar">
              <button type="button" class="qa-bar-btn qa-open-btn" data-id="${p.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                <span>${lang === 'ar' ? 'إضافة سريعة' : 'Quick Add'}</span>
              </button>
            </div>
          </div>

          <div class="arrival-card__details">
            <span class="arrival-card__cat">${p.category}</span>
            <h3 class="arrival-card__title"><a href="product.html?id=${p.id}">${title}</a></h3>
            <div class="arrival-card__pricing">
              ${onSale
                ? `<span class="price-curr price-curr--discount">KD ${Number(p.salePrice).toFixed(3)}</span>
                   <span class="price-orig">KD ${Number(p.price).toFixed(3)}</span>`
                : `<span class="price-curr">KD ${Number(p.price).toFixed(3)}</span>`
              }
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function setupSliderArrows(prevId, nextId, sliderId) {
    const slider = document.getElementById(sliderId);
    document.getElementById(prevId)?.addEventListener('click', () => slider?.scrollBy({ left: -300, behavior: 'smooth' }));
    document.getElementById(nextId)?.addEventListener('click', () => slider?.scrollBy({ left: 300, behavior: 'smooth' }));
  }

  function bindInteractionEvents() {
    document.querySelectorAll('.arrival-card__fav').forEach(btn => {
      btn.onclick = (e) => {
        const id = e.currentTarget.dataset.id;
        let wishlist = JSON.parse(localStorage.getItem('bm_wishlist') || '[]');

        if (wishlist.includes(id)) {
          wishlist = wishlist.filter(item => item !== id);
          e.currentTarget.classList.remove('active');
        } else {
          wishlist.push(id);
          e.currentTarget.classList.add('active');
        }

        localStorage.setItem('bm_wishlist', JSON.stringify(wishlist));
        window.dispatchEvent(new Event('bm_wishlist_updated'));
        window.syncGlobalBadges();
      };
    });

    document.querySelectorAll('.qa-open-btn').forEach(btn => {
      btn.onclick = (e) => {
        const id = e.currentTarget.dataset.id;
        const prod = productCache.find(p => String(p.id) === String(id) || String(p.sku) === String(id));
        if (prod) openQuickAdd(prod);
      };
    });
  }

  // =========================================================================
  // 9. SLIDE-OUT CART DRAWER ENGINE
  // =========================================================================
  const cartDrawer = document.getElementById('cartDrawer');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartDrawerClose = document.getElementById('cartDrawerClose');
  const drawerAreaSelect = document.getElementById('drawerKuwaitArea');
  const drawerCouponBtn = document.getElementById('drawerCouponBtn');

  window.openCartDrawer = function () {
    window.renderCartDrawerItems();
    cartDrawer?.classList.add('active');
    cartDrawer?.setAttribute('aria-hidden', 'false');
    cartOverlay?.classList.add('active');
    document.body.classList.add('drawer-open');
    document.body.style.overflow = 'hidden';
  };

  window.closeCartDrawer = function () {
    cartDrawer?.classList.remove('active');
    cartDrawer?.setAttribute('aria-hidden', 'true');
    cartOverlay?.classList.remove('active');
    document.body.classList.remove('drawer-open');
    document.body.style.overflow = '';
  };
  
  document.addEventListener('click', (e) => {
    const bagTrigger = e.target.closest('#headerCartBtn, #dockCartBtn, .cart-pill-btn, [data-open-drawer="cart"]');
    if (bagTrigger) {
      const isCartOrCheckout = window.location.pathname.includes('cart.html') || window.location.pathname.includes('checkout.html');
      if (!isCartOrCheckout) {
        e.preventDefault();
        window.openCartDrawer();
      }
    }
  });

  cartDrawerClose?.addEventListener('click', window.closeCartDrawer);
  cartOverlay?.addEventListener('click', window.closeCartDrawer);

  drawerAreaSelect?.addEventListener('change', (e) => {
    activeAreaId = e.target.value;
    localStorage.setItem('bm_selected_area', activeAreaId);
    window.renderCartDrawerItems();
  });

  drawerCouponBtn?.addEventListener('click', () => {
    const code = document.getElementById('drawerCouponInput')?.value.trim().toUpperCase();
    const msg = document.getElementById('drawerCouponMsg');
    if (code === 'EID10' || code === 'MANAL10' || code === 'BM10') {
      drawerDiscount = 0.10;
      if (msg) {
        msg.className = 'drawer-coupon-msg success';
        msg.textContent = '10% Voucher Privilege Applied!';
      }
    } else {
      drawerDiscount = 0;
      if (msg) {
        msg.className = 'drawer-coupon-msg error';
        msg.textContent = 'Invalid promo voucher code';
      }
    }
    window.renderCartDrawerItems();
  });

  window.renderCartDrawerItems = function () {
    const cart = JSON.parse(localStorage.getItem('bm_cart') || '[]');
    const container = document.getElementById('cartDrawerItems');
    const drawerItemCount = document.getElementById('drawerItemCount');
    const subtotalEl = document.getElementById('drawerSubtotal');
    const deliveryEl = document.getElementById('drawerDelivery');
    const totalEl = document.getElementById('drawerTotal');
    const freeTag = document.getElementById('drawerFreeTag');
    const fillEl = document.getElementById('drawerShippingFill');
    const msgEl = document.getElementById('drawerShippingMsg');
    const discountRow = document.getElementById('drawerDiscountRow');
    const discountVal = document.getElementById('drawerDiscountVal');
    const currentLang = document.documentElement.getAttribute('lang') || 'en';

    const totalCount = cart.reduce((acc, item) => acc + (parseInt(item.qty, 10) || 1), 0);
    if (drawerItemCount) drawerItemCount.textContent = `(${totalCount})`;
    if (drawerAreaSelect) drawerAreaSelect.value = activeAreaId;

    if (cart.length === 0) {
      if (container) container.innerHTML = `<p style="text-align:center; color: #8c8173; padding: 3rem 0;">Your shopping bag is empty.</p>`;
      if (subtotalEl) subtotalEl.textContent = 'KD 0.000';
      if (deliveryEl) deliveryEl.textContent = 'KD 0.000';
      if (totalEl) totalEl.textContent = 'KD 0.000';
      if (fillEl) fillEl.style.width = '0%';
      if (freeTag) freeTag.classList.remove('active');
      if (discountRow) discountRow.style.display = 'none';
      return;
    }

    let subtotal = 0;

    if (container) {
      container.innerHTML = cart.map((item, idx) => {
        const prod = productCache.find(p => String(p.id) === String(item.id) || String(p.sku) === String(item.id));
        const title = prod ? ((prod.name && typeof prod.name === 'object') ? (prod.name[currentLang] || prod.name.en) : prod.name) : (item.name || item.id);
        const img = prod?.images?.[0] || prod?.image || 'assets/images/placeholder.jpg';
        const regularPrice = prod ? Number(prod.price) : (Number(item.price) || 0);
        const onSale = prod && prod.salePrice !== null && prod.salePrice !== undefined && Number(prod.salePrice) > 0 && Number(prod.salePrice) < regularPrice;
        const unitPrice = onSale ? Number(prod.salePrice) : regularPrice;
        const qty = parseInt(item.qty, 10) || 1;
        const linePrice = unitPrice * qty;
        subtotal += linePrice;

        return `
          <div class="cart-item" style="display: flex; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(214,203,186,0.4);">
            <img src="${img}" alt="${title}" class="cart-item__img" style="width: 52px; height: 68px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(214,203,186,0.5);">
            <div class="cart-item__info" style="flex: 1; min-width: 0;">
              <h4 class="cart-item__title" style="font-family: 'Playfair Display', serif; font-size: 0.88rem; margin: 0 0 3px; color: #181512; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</h4>
              <div class="cart-item__variant" style="font-size: 0.72rem; color: #8c8173; margin-bottom: 6px;">${item.size} • ${item.color}</div>
              <div class="cart-item__bottom" style="display: flex; justify-content: space-between; align-items: center;">
                <div class="qty-stepper" style="display: inline-flex; align-items: center; border: 1px solid #d6cbba; border-radius: 4px; background: #fff;">
                  <button type="button" class="qty-btn drawer-dec-btn" data-idx="${idx}" style="padding: 2px 8px; background: none; border: none; cursor: pointer; font-size: 0.9rem; font-weight: 700;">-</button>
                  <input type="number" value="${qty}" readonly style="width: 24px; text-align: center; border: none; font-size: 0.8rem; font-weight: 700;">
                  <button type="button" class="qty-btn drawer-inc-btn" data-idx="${idx}" style="padding: 2px 8px; background: none; border: none; cursor: pointer; font-size: 0.9rem; font-weight: 700;">+</button>
                </div>
                <span class="cart-item__price" style="font-weight: 700; font-size: 0.85rem; color: #181512;">KD ${linePrice.toFixed(3)}</span>
              </div>
            </div>
            <button type="button" class="drawer-remove-btn" data-idx="${idx}" style="background: none; border: none; color: #b33939; font-size: 1.1rem; cursor: pointer; padding: 4px;">&times;</button>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.drawer-inc-btn').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.idx, 10);
          cart[idx].qty = (parseInt(cart[idx].qty, 10) || 1) + 1;
          localStorage.setItem('bm_cart', JSON.stringify(cart));
          window.dispatchEvent(new Event('bm_cart_updated'));
          window.syncGlobalBadges();
          window.renderCartDrawerItems();
        };
      });

      container.querySelectorAll('.drawer-dec-btn').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.idx, 10);
          const currentQty = parseInt(cart[idx].qty, 10) || 1;
          if (currentQty > 1) {
            cart[idx].qty = currentQty - 1;
          } else {
            cart.splice(idx, 1);
          }
          localStorage.setItem('bm_cart', JSON.stringify(cart));
          window.dispatchEvent(new Event('bm_cart_updated'));
          window.syncGlobalBadges();
          window.renderCartDrawerItems();
        };
      });

      container.querySelectorAll('.drawer-remove-btn').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.idx, 10);
          cart.splice(idx, 1);
          localStorage.setItem('bm_cart', JSON.stringify(cart));
          window.dispatchEvent(new Event('bm_cart_updated'));
          window.syncGlobalBadges();
          window.renderCartDrawerItems();
        };
      });
    }

    const isFree = subtotal >= FREE_DELIVERY_THRESHOLD;
    const selectedArea = KUWAIT_AREAS.find(a => a.id === activeAreaId) || KUWAIT_AREAS[0];
    const deliveryFee = isFree ? 0.000 : selectedArea.fee;
    const discountAmount = subtotal * drawerDiscount;
    const finalTotal = Math.max(0, subtotal - discountAmount + deliveryFee);

    if (subtotalEl) subtotalEl.textContent = `KD ${subtotal.toFixed(3)}`;
    if (deliveryEl) {
      deliveryEl.textContent = isFree ? 'KD 0.000 FREE' : `KD ${deliveryFee.toFixed(3)}`;
      deliveryEl.style.color = isFree ? '#27ae60' : '';
    }
    if (freeTag) freeTag.classList.toggle('active', isFree);

    if (discountRow && discountVal) {
      if (drawerDiscount > 0) {
        discountRow.style.display = 'flex';
        discountVal.textContent = `-KD ${discountAmount.toFixed(3)}`;
      } else {
        discountRow.style.display = 'none';
      }
    }

    if (totalEl) totalEl.textContent = `KD ${finalTotal.toFixed(3)}`;

    const pct = Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100);
    if (fillEl) fillEl.style.width = `${pct}%`;

    const remaining = FREE_DELIVERY_THRESHOLD - subtotal;
    if (msgEl) {
      msgEl.textContent = isFree
        ? 'Free Delivery Unlocked Across Kuwait 🎉'
        : `Add KD ${remaining.toFixed(3)} more for Free Delivery`;
    }

    const waBtn = document.getElementById('drawerWhatsAppBtn');
    if (waBtn) {
      const summary = cart.map(item => {
        const p = productCache.find(prod => String(prod.id) === String(item.id) || String(prod.sku) === String(item.id));
        const nameEn = p ? (p.name?.en || p.name) : item.id;
        return `• ${nameEn} (Size: ${item.size}) x${item.qty}`;
      }).join('\n');

      const feeText = isFree ? 'FREE DELIVERY (KD 0.000)' : `KD ${deliveryFee.toFixed(3)}`;
      const msg = encodeURIComponent(
        `*BAITUL MANAL KUWAIT ORDER*\n\n*Bag Items:*\n${summary}\n\n*Destination:* ${selectedArea.nameEn}\n*Delivery Charge:* ${feeText}\n*Total Payable:* KD ${finalTotal.toFixed(3)}`
      );
      waBtn.href = `https://wa.me/96560454629?text=${msg}`;
    }
  };

  // =========================================================================
  // 10. QUICK ADD CONFIRMATION MODAL
  // =========================================================================
  const qaOverlay = document.getElementById('quickAddOverlay');
  const qaClose = document.getElementById('quickAddClose');
  const qaCancelBtn = document.getElementById('qaCancelBtn');
  const qaSubmit = document.getElementById('qaSubmitBtn');
  let selectedQAProduct = null;
  let selectedSize = null;
  let selectedColor = null;
  let qaQuantity = 1;

  function openQuickAdd(product) {
    selectedQAProduct = product;
    selectedSize = (product.sizes && product.sizes.length) ? product.sizes[0] : 'Standard';
    selectedColor = product.colors?.[0]?.name || 'Standard';
    qaQuantity = 1;

    const currentLang = document.documentElement.getAttribute('lang') || 'en';
    const qaImg = document.getElementById('qaImg');
    const qaTitle = document.getElementById('qaTitle');
    const qaPricing = document.getElementById('qaPricing');

    if (qaImg) qaImg.src = product.images?.[0] || product.image || 'assets/images/placeholder.jpg';
    if (qaTitle) qaTitle.textContent = (product.name && typeof product.name === 'object') ? (product.name[currentLang] || product.name.en) : product.name;

    const regularPrice = Number(product.price) || 0;
    const onSale = product.salePrice !== null && product.salePrice !== undefined && Number(product.salePrice) > 0 && Number(product.salePrice) < regularPrice;
    const activePrice = onSale ? Number(product.salePrice) : regularPrice;

    if (qaPricing) {
      qaPricing.innerHTML = onSale
        ? `<span class="price-curr price-curr--discount">KD ${activePrice.toFixed(3)}</span> <del class="price-orig" style="color: #8c8173; font-size: 0.8rem; margin-left: 4px;">KD ${regularPrice.toFixed(3)}</del>`
        : `<span class="price-curr">KD ${activePrice.toFixed(3)}</span>`;
    }

    const sizesBox = document.getElementById('qaSizes');
    if (sizesBox) {
      const sizes = (product.sizes && product.sizes.length) ? product.sizes : ['Standard'];
      sizesBox.innerHTML = sizes.map((s, idx) => `
        <button type="button" class="qa-size-btn ${idx === 0 ? 'selected' : ''}" data-size="${s}">${s}</button>
      `).join('');

      sizesBox.querySelectorAll('.qa-size-btn').forEach(btn => {
        btn.onclick = () => {
          sizesBox.querySelectorAll('.qa-size-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          selectedSize = btn.dataset.size;
        };
      });
    }

    const colorsBox = document.getElementById('qaColors');
    if (colorsBox) {
      const colors = (product.colors && product.colors.length) ? product.colors : [{ name: 'Standard', hex: '#181512' }];
      colorsBox.innerHTML = colors.map((c, idx) => `
        <button type="button" class="qa-color-btn ${idx === 0 ? 'selected' : ''}" data-color="${c.name}" style="background: ${c.hex};" title="${c.name}"></button>
      `).join('');

      colorsBox.querySelectorAll('.qa-color-btn').forEach(btn => {
        btn.onclick = () => {
          colorsBox.querySelectorAll('.qa-color-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          selectedColor = btn.dataset.color;
        };
      });
    }

    const qaQtyInput = document.getElementById('qaQtyInput');
    if (qaQtyInput) qaQtyInput.value = 1;
    qaOverlay?.classList.add('active');
  }

  function closeQuickAddModal() {
    qaOverlay?.classList.remove('active');
    selectedQAProduct = null;
  }

  qaClose?.addEventListener('click', closeQuickAddModal);
  qaCancelBtn?.addEventListener('click', closeQuickAddModal);
  qaOverlay?.addEventListener('click', (e) => {
    if (e.target === qaOverlay) closeQuickAddModal();
  });

  document.getElementById('qaIncBtn')?.addEventListener('click', () => {
    qaQuantity++;
    const input = document.getElementById('qaQtyInput');
    if (input) input.value = qaQuantity;
  });

  document.getElementById('qaDecBtn')?.addEventListener('click', () => {
    if (qaQuantity > 1) {
      qaQuantity--;
      const input = document.getElementById('qaQtyInput');
      if (input) input.value = qaQuantity;
    }
  });

  qaSubmit?.addEventListener('click', () => {
    if (!selectedQAProduct) return;

    let cart = [];
    try {
      cart = JSON.parse(localStorage.getItem('bm_cart') || '[]');
    } catch {
      cart = [];
    }

    const productId = String(selectedQAProduct.id || selectedQAProduct.sku);
    const existing = cart.find(i => 
      String(i.id).toLowerCase() === productId.toLowerCase() && 
      i.size === selectedSize && 
      i.color === selectedColor
    );

    if (existing) {
      existing.qty = (parseInt(existing.qty, 10) || 1) + qaQuantity;
    } else {
      cart.push({
        id: productId,
        size: selectedSize,
        color: selectedColor,
        qty: qaQuantity
      });
    }

    localStorage.setItem('bm_cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('bm_cart_updated'));
    window.syncGlobalBadges();

    closeQuickAddModal();
    window.openCartDrawer();
  });

  loadInitialData();
});