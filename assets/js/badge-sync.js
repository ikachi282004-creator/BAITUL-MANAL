/**
 * BAITUL MANAL — Global Badge Synchronizer
 * Accurately calculates and renders Cart & Wishlist counters across desktop & mobile.
 */
(function() {
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
      console.warn('Error reading bm_cart:', e);
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
      console.warn('Error reading bm_wishlist:', e);
      return 0;
    }
  }

  window.syncGlobalBadges = function() {
    const cartCount = getSafeCartCount();
    const wishlistCount = getSafeWishlistCount();

    // Update all matching elements (ID or Class)
    const cartBadges = document.querySelectorAll('#cartCount, .cart-count-badge, [data-badge="cart"]');
    const wishlistBadges = document.querySelectorAll('#wishlistCount, .wishlist-count-badge, [data-badge="wishlist"]');

    cartBadges.forEach(el => {
      el.textContent = cartCount;
      // Animate subtle pop on update
      el.classList.add('badge-bump');
      setTimeout(() => el.classList.remove('badge-bump'), 250);
    });

    wishlistBadges.forEach(el => {
      el.textContent = wishlistCount;
      el.classList.add('badge-bump');
      setTimeout(() => el.classList.remove('badge-bump'), 250);
    });
  };

  // Run on initial script load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.syncGlobalBadges);
  } else {
    window.syncGlobalBadges();
  }

  // Listen to cross-tab storage changes
  window.addEventListener('storage', window.syncGlobalBadges);

  // Listen to in-tab custom update events
  window.addEventListener('bm_cart_updated', window.syncGlobalBadges);
  window.addEventListener('bm_wishlist_updated', window.syncGlobalBadges);
})();