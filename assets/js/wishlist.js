/**
 * BAITUL MANAL — Master Wishlist Controller (wishlist.js)
 * Loads saved product IDs from localStorage('bm_wishlist'),
 * cross-references metadata from products.json, and handles 
 * instant Move to Bag or Removal with live badge broadcasting.
 */

document.addEventListener('DOMContentLoaded', async () => {
  let catalog = [];
  let wishlist = [];

  const grid = document.getElementById('wishlistGrid');
  const emptyBox = document.getElementById('wishlistEmptyBox');
  const totalCountEl = document.getElementById('wishlistItemsTotal');
  const clearAllBtn = document.getElementById('clearAllWishlistBtn');

  // Badge Synchronization
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
  window.addEventListener('bm_wishlist_updated', refreshBadges);

  // Fetch Catalog
  try {
    const res = await fetch('assets/data/products.json');
    if (res.ok) catalog = await res.json();
  } catch (err) {
    console.error('Failed to load products.json:', err);
  }

  function loadWishlist() {
    try {
      wishlist = JSON.parse(localStorage.getItem('bm_wishlist') || '[]');
      if (!Array.isArray(wishlist)) wishlist = [];
    } catch {
      wishlist = [];
    }
    renderWishlist();
  }

  function renderWishlist() {
    refreshBadges();

    if (totalCountEl) totalCountEl.textContent = wishlist.length;

    if (wishlist.length === 0) {
      if (grid) grid.innerHTML = '';
      if (emptyBox) emptyBox.style.display = 'block';
      if (clearAllBtn) clearAllBtn.style.display = 'none';
      return;
    }

    if (emptyBox) emptyBox.style.display = 'none';
    if (clearAllBtn) clearAllBtn.style.display = 'block';

    const lang = document.documentElement.getAttribute('lang') || 'en';

    // Map saved IDs to catalog items
    const savedItems = wishlist
      .map(id => catalog.find(p => p.id === id))
      .filter(Boolean);

    if (grid) {
      grid.innerHTML = savedItems.map(p => {
        const title = (p.name && typeof p.name === 'object') ? (p.name[lang] || p.name.en) : p.name;
        const onSale = p.salePrice !== null && p.salePrice < p.price;
        const discount = onSale ? Math.round(((p.price - p.salePrice) / p.price) * 100) : 0;
        const mainImg = p.images?.[0] || 'assets/images/placeholder.jpg';

        return `
          <article class="arrival-card" data-id="${p.id}">
            <div class="arrival-card__canvas">
              <div class="arrival-card__badges">
                ${p.isNew ? `<span class="tag-badge tag-badge--new">NEW</span>` : ''}
                ${onSale ? `<span class="tag-badge tag-badge--sale">-${discount}%</span>` : ''}
              </div>

              <a href="product.html?id=${p.id}">
                <img src="${mainImg}" alt="${title}" class="arrival-card__img" loading="lazy">
              </a>
            </div>

            <div class="arrival-card__details">
              <span class="arrival-card__cat">${p.category}</span>
              <h3 class="arrival-card__title"><a href="product.html?id=${p.id}">${title}</a></h3>
              <div class="arrival-card__pricing">
                ${onSale
                  ? `<span class="price-curr price-curr--discount">KD ${p.salePrice.toFixed(3)}</span>
                     <span class="price-orig">KD ${p.price.toFixed(3)}</span>`
                  : `<span class="price-curr">KD ${p.price.toFixed(3)}</span>`
                }
              </div>

              <div class="wishlist-action-bar">
                <button type="button" class="btn-move-to-bag" data-id="${p.id}">
                  Move to Bag
                </button>
                <button type="button" class="btn-remove-wishlist" data-id="${p.id}" aria-label="Remove item">
                  ✕
                </button>
              </div>
            </div>
          </article>
        `;
      }).join('');

      bindWishlistActions();
    }
  }

  function bindWishlistActions() {
    // Move to Bag
    document.querySelectorAll('.btn-move-to-bag').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const prod = catalog.find(p => p.id === id);
        const size = prod?.sizes?.[0] || 'Standard';
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

        // Remove from wishlist
        wishlist = wishlist.filter(x => x !== id);
        localStorage.setItem('bm_wishlist', JSON.stringify(wishlist));
        window.dispatchEvent(new Event('bm_wishlist_updated'));

        renderWishlist();
      };
    });

    // Remove from Wishlist
    document.querySelectorAll('.btn-remove-wishlist').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        wishlist = wishlist.filter(x => x !== id);
        localStorage.setItem('bm_wishlist', JSON.stringify(wishlist));
        window.dispatchEvent(new Event('bm_wishlist_updated'));
        renderWishlist();
      };
    });
  }

  // Clear All Saved
  clearAllBtn?.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all saved pieces?')) {
      wishlist = [];
      localStorage.setItem('bm_wishlist', JSON.stringify(wishlist));
      window.dispatchEvent(new Event('bm_wishlist_updated'));
      renderWishlist();
    }
  });

  loadWishlist();
});