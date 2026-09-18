/**
 * BAITUL MANAL — PWA Service Worker (sw.js)
 * Cache-First Strategy for Static Assets, Network-First with Fallback for Catalog Data
 */

const CACHE_NAME = 'baitul-manal-v1.0';

// Critical Core Shell Assets
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/shop.html',
  '/product.html',
  '/cart.html',
  '/wishlist.html',
  '/checkout.html',
  '/order-success.html',
  '/assets/css/variables.css',
  '/assets/css/base.css',
  '/assets/css/components.css',
  '/assets/css/product.css',
  '/assets/css/cart.css',
  '/assets/css/wishlist.css',
  '/assets/css/checkout.css',
  '/assets/css/order-success.css',
  '/assets/js/i18n.js',
  '/assets/js/shop.js',
  '/assets/js/product.js',
  '/assets/js/cart.js',
  '/assets/js/wishlist.js',
  '/assets/js/checkout.js',
  '/assets/js/order-success.js',
  '/assets/data/products.json'
];

// Install Event: Cache Core App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Cleanup Stale Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-First for JSON Data, Cache-First for Shell & Images
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Data Catalog: Network First, Fallback to Cache
  if (url.pathname.includes('products.json')) {
    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkRes.clone());
            return networkRes;
          });
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. Static Resources & Fonts: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedRes) => {
      if (cachedRes) {
        // Fetch fresh copy in background
        fetch(event.request).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkRes));
          }
        }).catch(() => {});
        return cachedRes;
      }

      return fetch(event.request).then((networkRes) => {
        if (!networkRes || networkRes.status !== 200 || networkRes.type !== 'basic') {
          return networkRes;
        }

        const cloneRes = networkRes.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloneRes));
        return networkRes;
      });
    })
  );
});