/**
 * BAITUL MANAL — Master Shop Catalog Controller (shop.js)
 * Fully mapped to shop.html markup with Dynamic API Sync & Static Fallback
 */

document.addEventListener('DOMContentLoaded', async () => {
  let allProducts = [];
  let filteredProducts = [];

  // Backend API URL mapping
  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://baitul-manal.onrender.com'; // Adjust if your Render Web Service name differs

  const STATIC_FALLBACK = 'assets/data/products.json';

  const state = {
    category: 'all',
    searchQuery: '',
    maxPrice: 30.000,
    selectedSizes: [],
    sortBy: 'featured',
    density: 4
  };

  // Exact DOM Mappings from shop.html
  const catalogGrid = document.getElementById('shopCatalogGrid');
  const resultsCount = document.getElementById('productResultsCount');
  const searchInput = document.getElementById('catalogSearch');
  const sortSelect = document.getElementById('sortSelect');
  const priceRange = document.getElementById('priceRange');
  const priceDisplay = document.getElementById('priceDisplay');
  const activeChipsStrip = document.getElementById('activeChipsStrip');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const shopTitle = document.getElementById('shopTitle');

  // Mobile Filter Drawer Mappings
  const filtersSidebar = document.getElementById('filtersSidebar');
  const filterOverlay = document.getElementById('filterOverlay');
  const openFiltersBtn = document.getElementById('openFiltersBtn');
  const closeFiltersBtn = document.getElementById('closeFiltersBtn');

  // =========================================================================
  // 1. BADGE SYNCHRONIZATION
  // =========================================================================
  function refreshBadges() {
    try {
      const cart = JSON.parse(localStorage.getItem('bm_cart') || '[]');
      const wishlist = JSON.parse(localStorage.getItem('bm_wishlist') || '[]');
      
      const totalQty = Array.isArray(cart) 
        ? cart.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 1), 0) 
        : 0;

      document.querySelectorAll('#cartCount, .cart-count-badge, [data-badge="cart"]').forEach(el => {
        el.textContent = totalQty;
      });
      document.querySelectorAll('#wishlistCount, .wishlist-count-badge, [data-badge="wishlist"]').forEach(el => {
        el.textContent = Array.isArray(wishlist) ? wishlist.length : 0;
      });
    } catch (e) {
      console.warn(e);
    }
  }

  refreshBadges();
  window.addEventListener('storage', refreshBadges);
  window.addEventListener('bm_cart_updated', refreshBadges);
  window.addEventListener('bm_wishlist_updated', refreshBadges);

  // =========================================================================
  // 2. FETCH CATALOG (NETWORK-FIRST WITH STATIC FALLBACK) & INITIALIZE
  // =========================================================================
  async function fetchLiveCatalog() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout for sleepy cold starts

    try {
      // 1. Attempt to fetch live products directly from backend
      const res = await fetch(`${API_BASE}/api/admin/products`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`API status ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log(`[Catalog] Synced ${data.length} live items from Render backend.`);
        return data;
      }
      throw new Error('API returned empty catalog payload');
    } catch (apiErr) {
      console.warn('[Catalog] Backend unreachable or booting up. Loading local fallback...', apiErr.message);
      
      // 2. Fallback to bundled static JSON file
      const localRes = await fetch(STATIC_FALLBACK);
      if (!localRes.ok) throw new Error('Local fallback products.json missing');
      const localData = await localRes.json();
      console.log(`[Catalog] Loaded ${localData.length} items from local static archive.`);
      return localData;
    }
  }

  try {
    allProducts = await fetchLiveCatalog();

    // Parse URL parameters (?category=women, ?category=girls, etc.)
    const urlParams = new URLSearchParams(window.location.search);
    const cat = urlParams.get('category');
    const search = urlParams.get('search') || urlParams.get('q');

    if (cat) state.category = cat.toLowerCase();
    if (search) state.searchQuery = search.toLowerCase();

    if (searchInput && state.searchQuery) {
      searchInput.value = state.searchQuery;
    }

    if (priceRange) {
      const highestPrice = Math.ceil(Math.max(...allProducts.map(p => p.price || 0), 30));
      priceRange.max = highestPrice;
      priceRange.value = highestPrice;
      state.maxPrice = highestPrice;
      if (priceDisplay) priceDisplay.textContent = `KD ${highestPrice.toFixed(3)}`;
    }

    bindFilterEvents();
    syncActiveCategoryUI();
    runFiltering();
  } catch (err) {
    console.error('Error loading shop catalog:', err);
    if (catalogGrid) {
      catalogGrid.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:3rem 0; color:#8c8173;">Unable to load boutique items. Please refresh.</p>`;
    }
  }

  // =========================================================================
  // 3. CATEGORY MATCHING & FILTER ENGINE
  // =========================================================================
  function matchesCategory(p, targetCat) {
    if (!targetCat || targetCat === 'all') return true;
    const cat = (p.category || '').toLowerCase();
    const sub = (p.subCategory || '').toLowerCase();
    const target = targetCat.toLowerCase();

    if (target === 'girls' || target === 'boys' || target === 'baby' || target === 'kids') {
      return cat === target || cat === 'baby' || cat === 'kids' || sub.includes(target);
    }
    if (target === 'maid') {
      return cat === 'maid' || sub.includes('maid') || sub.includes('uniform');
    }
    if (target === 'women') {
      return cat === 'women' || sub.includes('darra') || sub.includes('kaftan') || sub.includes('jalabiya');
    }
    return cat === target || sub.includes(target);
  }

  function runFiltering() {
    filteredProducts = allProducts.filter(p => {
      // Category Match
      if (!matchesCategory(p, state.category)) return false;

      // Live Search Query Match
      if (state.searchQuery) {
        const titleEn = (p.name?.en || (typeof p.name === 'string' ? p.name : '')).toLowerCase();
        const titleAr = (p.name?.ar || '').toLowerCase();
        const sku = (p.sku || p.id || '').toLowerCase();
        const q = state.searchQuery.toLowerCase();
        if (!titleEn.includes(q) && !titleAr.includes(q) && !sku.includes(q)) {
          return false;
        }
      }

      // Price Threshold
      const activePrice = p.salePrice || p.price || 0;
      if (activePrice > state.maxPrice) return false;

      // Size Filter
      if (state.selectedSizes.length > 0) {
        const itemSizes = p.sizes || [];
        const hasSize = state.selectedSizes.some(s => itemSizes.includes(s));
        if (!hasSize) return false;
      }

      return true;
    });

    // Sort Handler
    switch (state.sortBy) {
      case 'price-asc':
        filteredProducts.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
        break;
      case 'price-desc':
        filteredProducts.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
        break;
      case 'newest':
        filteredProducts.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
        break;
      default:
        // Handpicked / Featured
        break;
    }

    renderGrid();
    renderActiveChips();
  }

  // =========================================================================
  // 4. RENDER GRID CARDS INTO #shopCatalogGrid
  // =========================================================================
  function renderGrid() {
    if (!catalogGrid) return;

    if (resultsCount) {
      resultsCount.textContent = `${filteredProducts.length} items`;
    }

    if (filteredProducts.length === 0) {
      catalogGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 5rem 1rem;">
          <p style="font-size: 2rem; margin-bottom: 0.5rem;">🏷️</p>
          <h3 style="font-family: 'Playfair Display', serif; font-size: 1.4rem; margin-bottom: 0.5rem; color: #181512;">No Pieces Found</h3>
          <p style="color: #8c8173; font-size: 0.85rem; margin-bottom: 1.5rem;">Try clearing your active filters or adjusting the price ceiling.</p>
          <button type="button" class="btn-clear-all" id="emptyResetBtn" style="padding: 10px 24px; cursor: pointer;">
            Reset All Parameters
          </button>
        </div>
      `;
      document.getElementById('emptyResetBtn')?.addEventListener('click', resetAllFilters);
      return;
    }

    const lang = document.documentElement.getAttribute('lang') || 'en';
    const wishlist = JSON.parse(localStorage.getItem('bm_wishlist') || '[]');

    catalogGrid.innerHTML = filteredProducts.map(p => {
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
              ${p.isNew ? `<span class="tag-badge tag-badge--new">NEW</span>` : ''}
              ${onSale ? `<span class="tag-badge tag-badge--sale">-${discount}%</span>` : ''}
            </div>

            <button type="button" class="arrival-card__fav ${isFav ? 'active' : ''}" data-id="${p.id}" aria-label="Add to wishlist">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="${isFav ? '#b33939' : 'none'}" stroke="${isFav ? '#b33939' : 'currentColor'}" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>

            <a href="product.html?id=${p.id}">
              <img src="${mainImg}" alt="${title}" class="arrival-card__img arrival-card__img--main" loading="lazy">
              ${altImg !== mainImg ? `<img src="${altImg}" alt="${title}" class="arrival-card__img arrival-card__img--alt" loading="lazy">` : ''}
            </a>

            <div class="arrival-card__quick">
              ${(p.sizes || []).map(s => `
                <button type="button" class="size-tag-btn catalog-quick-size-btn" data-id="${p.id}" data-size="${s}">${s}</button>
              `).join('')}
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

    bindCardEvents();
  }

  // =========================================================================
  // 5. INTERACTIVE CARD ACTIONS (DIRECT ADD & WISHLIST)
  // =========================================================================
  function bindCardEvents() {
    // 1-Tap Quick Size selection directly to Bag
    document.querySelectorAll('.catalog-quick-size-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.id;
        const size = btn.dataset.size;
        const prod = allProducts.find(p => String(p.id) === String(id) || String(p.sku) === String(id));
        const color = prod?.colors?.[0]?.name || 'Standard';

        let cart = [];
        try {
          cart = JSON.parse(localStorage.getItem('bm_cart') || '[]');
          if (!Array.isArray(cart)) cart = [];
        } catch {
          cart = [];
        }

        const found = cart.find(i => i.id === id && i.size === size && i.color === color);
        if (found) {
          found.qty = (parseInt(found.qty, 10) || 1) + 1;
        } else {
          cart.push({ id, size, color, qty: 1 });
        }

        localStorage.setItem('bm_cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('bm_cart_updated'));
        window.dispatchEvent(new Event('storage'));
        refreshBadges();

        const original = btn.textContent;
        btn.textContent = '✓';
        btn.style.background = '#27ae60';
        btn.style.color = '#ffffff';
        setTimeout(() => {
          btn.textContent = original;
          btn.style.background = '';
          btn.style.color = '';
        }, 800);
      };
    });

    // Wishlist Toggle
    document.querySelectorAll('.arrival-card__fav').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.id;
        let wishlist = [];
        try {
          wishlist = JSON.parse(localStorage.getItem('bm_wishlist') || '[]');
          if (!Array.isArray(wishlist)) wishlist = [];
        } catch {
          wishlist = [];
        }

        if (wishlist.includes(id)) {
          wishlist = wishlist.filter(x => x !== id);
          btn.classList.remove('active');
        } else {
          wishlist.push(id);
          btn.classList.add('active');
        }

        localStorage.setItem('bm_wishlist', JSON.stringify(wishlist));
        window.dispatchEvent(new Event('bm_wishlist_updated'));
        window.dispatchEvent(new Event('storage'));
        refreshBadges();
        renderGrid();
      };
    });
  }

  // =========================================================================
  // 6. EVENT LISTENERS SETUP
  // =========================================================================
  function bindFilterEvents() {
    // 1. Department Top Pills (#deptPills .cat-pill)
    document.querySelectorAll('.cat-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        state.category = (btn.dataset.cat || 'all').toLowerCase();
        syncActiveCategoryUI();
        runFiltering();
      });
    });

    // 2. Sidebar Department Links (#sidebarDeptList .sidebar-dept-btn)
    document.querySelectorAll('.sidebar-dept-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        state.category = (btn.dataset.cat || 'all').toLowerCase();
        syncActiveCategoryUI();
        runFiltering();
        closeMobileDrawer();
      });
    });

    // 3. Size Filter Matrix Chips (#sizeChipsBox .chip-item)
    document.querySelectorAll('.chip-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const size = btn.dataset.size;
        
        if (state.selectedSizes.includes(size)) {
          state.selectedSizes = state.selectedSizes.filter(s => s !== size);
          btn.classList.remove('active');
        } else {
          state.selectedSizes.push(size);
          btn.classList.add('active');
        }

        runFiltering();
      });
    });

    // 4. Live Search Input
    searchInput?.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      runFiltering();
    });

    // 5. Price Spectrum Range Slider
    priceRange?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.maxPrice = val;
      if (priceDisplay) priceDisplay.textContent = `KD ${val.toFixed(3)}`;
      runFiltering();
    });

    // 6. Sorting Select Dropdown
    sortSelect?.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      runFiltering();
    });

    // 7. Density Toggles (.density-btn[data-cols])
    document.querySelectorAll('.density-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.density-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cols = btn.dataset.cols;
        state.density = cols;
        if (catalogGrid) {
          catalogGrid.classList.remove('density-2', 'density-3', 'density-4');
          catalogGrid.classList.add(`density-${cols}`);
        }
      });
    });

    // 8. Mobile Filter Drawer Open/Close
    openFiltersBtn?.addEventListener('click', () => {
      filtersSidebar?.classList.add('active');
      filterOverlay?.classList.add('active');
      document.body.style.overflow = 'hidden';
    });

    function closeMobileDrawer() {
      filtersSidebar?.classList.remove('active');
      filterOverlay?.classList.remove('active');
      document.body.style.overflow = '';
    }

    closeFiltersBtn?.addEventListener('click', closeMobileDrawer);
    filterOverlay?.addEventListener('click', closeMobileDrawer);

    // 9. Reset Button
    resetFiltersBtn?.addEventListener('click', resetAllFilters);
  }

  function syncActiveCategoryUI() {
    document.querySelectorAll('.cat-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.cat.toLowerCase() === state.category);
    });

    document.querySelectorAll('.sidebar-dept-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat.toLowerCase() === state.category);
    });

    if (shopTitle) {
      const titles = {
        all: 'All Collections',
        women: "Women's Darra & Couture",
        girls: 'Girls Frocks & Sets',
        boys: 'Boys Casual & Sets',
        baby: 'Baby & Innerwear',
        maid: 'Maid Uniforms'
      };
      shopTitle.textContent = titles[state.category] || 'Curated Collection';
    }
  }

  function renderActiveChips() {
    if (!activeChipsStrip) return;

    const chips = [];

    if (state.category !== 'all') {
      chips.push({
        label: `Category: ${state.category.toUpperCase()}`,
        clear: () => { state.category = 'all'; syncActiveCategoryUI(); }
      });
    }

    if (state.searchQuery) {
      chips.push({
        label: `"${state.searchQuery}"`,
        clear: () => { state.searchQuery = ''; if (searchInput) searchInput.value = ''; }
      });
    }

    if (state.selectedSizes.length > 0) {
      chips.push({
        label: `Sizes: ${state.selectedSizes.join(', ')}`,
        clear: () => {
          state.selectedSizes = [];
          document.querySelectorAll('.chip-item').forEach(c => c.classList.remove('active'));
        }
      });
    }

    if (chips.length === 0) {
      activeChipsStrip.innerHTML = '';
      activeChipsStrip.style.display = 'none';
      return;
    }

    activeChipsStrip.style.display = 'flex';
    activeChipsStrip.innerHTML = `
      <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding: 8px 0;">
        ${chips.map((chip, idx) => `
          <button type="button" class="chip-item active" data-chip-idx="${idx}" style="cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
            <span>${chip.label}</span>
            <span>&times;</span>
          </button>
        `).join('')}
        <button type="button" id="clearAllChipsLink" style="background:none; border:none; color:#b33939; font-weight:700; font-size:0.75rem; cursor:pointer; text-decoration:underline;">
          Clear All
        </button>
      </div>
    `;

    activeChipsStrip.querySelectorAll('[data-chip-idx]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.chipIdx, 10);
        chips[idx].clear();
        runFiltering();
      });
    });

    document.getElementById('clearAllChipsLink')?.addEventListener('click', resetAllFilters);
  }

  function resetAllFilters() {
    state.category = 'all';
    state.searchQuery = '';
    state.selectedSizes = [];
    state.sortBy = 'featured';

    if (searchInput) searchInput.value = '';
    document.querySelectorAll('.chip-item').forEach(c => c.classList.remove('active'));

    if (priceRange) {
      const highestPrice = Math.ceil(Math.max(...allProducts.map(p => p.price || 0), 30));
      priceRange.value = highestPrice;
      state.maxPrice = highestPrice;
      if (priceDisplay) priceDisplay.textContent = `KD ${highestPrice.toFixed(3)}`;
    }

    syncActiveCategoryUI();
    runFiltering();
  }
});