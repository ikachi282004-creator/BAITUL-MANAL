/**
 * BAITUL MANAL — Typo-Tolerant Search Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  let catalog = [];
  const searchInput = document.getElementById('mainSearchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  const resultsGrid = document.getElementById('searchResultsGrid');
  const feedbackBar = document.getElementById('searchFeedbackBar');
  const resultText = document.getElementById('searchResultText');
  const typoNotice = document.getElementById('typoNotice');

  try {
    const res = await fetch('assets/data/products.json');
    catalog = await res.json();
    initSearch();
  } catch (err) {
    console.error('Failed to load search catalog:', err);
  }

  // Levenshtein distance algorithm for typo tolerance
  function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  function executeSearch(query) {
    const cleanQ = query.trim().toLowerCase();
    if (!cleanQ) {
      resultsGrid.innerHTML = '';
      feedbackBar.style.display = 'none';
      return;
    }

    saveRecentSearch(cleanQ);

    const lang = document.documentElement.getAttribute('lang') || 'en';

    // 1. Direct Search Matching
    let matches = catalog.filter((p) => {
      const name = (p.name[lang] || p.name.en).toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      return name.includes(cleanQ) || sku.includes(cleanQ) || cat.includes(cleanQ);
    });

    let suggestedCorrection = null;

    // 2. Fuzzy Typo Match fallback
    if (matches.length === 0) {
      for (const p of catalog) {
        const words = (p.name[lang] || p.name.en).toLowerCase().split(' ');
        for (const word of words) {
          if (levenshtein(cleanQ, word) <= 2) {
            matches.push(p);
            suggestedCorrection = word;
            break;
          }
        }
      }
    }

    feedbackBar.style.display = 'flex';
    resultText.innerHTML = `Found <strong>${matches.length}</strong> ${matches.length === 1 ? 'item' : 'items'} for "<em>${query}</em>"`;

    if (suggestedCorrection) {
      typoNotice.style.display = 'block';
      typoNotice.innerHTML = `Did you mean: <span id="suggestionPill">${suggestedCorrection}</span>?`;
      document.getElementById('suggestionPill').addEventListener('click', () => {
        searchInput.value = suggestedCorrection;
        executeSearch(suggestedCorrection);
      });
    } else {
      typoNotice.style.display = 'none';
    }

    renderResults(matches);
  }

  function renderResults(items) {
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const wishlist = JSON.parse(localStorage.getItem('bm_wishlist') || '[]');

    if (items.length === 0) {
      resultsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 5rem 1rem;">
          <h3 style="font-family: var(--font-serif); font-size: 1.6rem; margin-bottom: 0.5rem;">No Matching Results</h3>
          <p style="color: var(--text-muted); margin-bottom: 1.5rem; max-width: 440px; margin-left: auto; margin-right: auto;">
            We couldn't find matches for this keyword. Try checking for typos, or explore our curated departments.
          </p>
          <a href="shop.html" class="cat-pill active">Browse Complete Catalog</a>
        </div>
      `;
      return;
    }

    resultsGrid.innerHTML = items.map((p) => {
      const isFav = wishlist.includes(p.id);
      const title = p.name[lang] || p.name.en;
      const onSale = p.salePrice !== null && p.salePrice < p.price;
      const discount = onSale ? Math.round(((p.price - p.salePrice) / p.price) * 100) : 0;

      return `
        <article class="arrival-card" data-id="${p.id}">
          <div class="arrival-card__canvas">
            <div class="arrival-card__badges">
              ${p.isNew ? `<span class="tag-badge tag-badge--new">${lang === 'ar' ? 'جديد' : 'NEW'}</span>` : ''}
              ${onSale ? `<span class="tag-badge tag-badge--sale">-${discount}%</span>` : ''}
            </div>

            <button class="arrival-card__fav ${isFav ? 'active' : ''}" data-id="${p.id}" aria-label="Add to wishlist">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>

            <a href="product.html?id=${p.id}">
              <img src="${p.images[0]}" alt="${title}" class="arrival-card__img arrival-card__img--main" loading="lazy">
              ${p.images[1] ? `<img src="${p.images[1]}" alt="${title}" class="arrival-card__img arrival-card__img--alt" loading="lazy">` : ''}
            </a>

            <div class="arrival-card__quick">
              ${p.sizes.map((s) => `<button class="size-tag-btn" data-size="${s}" data-id="${p.id}">${s}</button>`).join('')}
            </div>
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
          </div>
        </article>
      `;
    }).join('');

    bindInteractions();
  }

  function bindInteractions() {
    document.querySelectorAll('.arrival-card__fav').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        let wishlist = JSON.parse(localStorage.getItem('bm_wishlist') || '[]');

        if (wishlist.includes(id)) {
          wishlist = wishlist.filter((item) => item !== id);
          e.currentTarget.classList.remove('active');
        } else {
          wishlist.push(id);
          e.currentTarget.classList.add('active');
        }

        localStorage.setItem('bm_wishlist', JSON.stringify(wishlist));
        window.dispatchEvent(new Event('storage'));
      });
    });

    document.querySelectorAll('.size-tag-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const size = e.currentTarget.dataset.size;
        let cart = JSON.parse(localStorage.getItem('bm_cart') || '[]');

        const found = cart.find((i) => i.id === id && i.size === size);
        if (found) {
          found.qty += 1;
        } else {
          cart.push({ id, size, color: 'Standard', qty: 1 });
        }

        localStorage.setItem('bm_cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('storage'));

        const prev = e.currentTarget.textContent;
        e.currentTarget.textContent = '✓';
        setTimeout(() => {
          e.currentTarget.textContent = prev;
        }, 800);
      });
    });
  }

  function saveRecentSearch(q) {
    let recent = JSON.parse(localStorage.getItem('bm_recent_searches') || '[]');
    recent = [q, ...recent.filter((item) => item !== q)].slice(0, 5);
    localStorage.setItem('bm_recent_searches', JSON.stringify(recent));
  }

  function initSearch() {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get('q');
    if (initialQuery) {
      searchInput.value = initialQuery;
      executeSearch(initialQuery);
    }

    searchInput.addEventListener('input', (e) => {
      executeSearch(e.target.value);
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      executeSearch('');
      searchInput.focus();
    });

    document.querySelectorAll('.trend-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const val = chip.dataset.query;
        searchInput.value = val;
        executeSearch(val);
      });
    });
  }

  window.addEventListener('languageChanged', () => {
    if (searchInput.value.trim()) {
      executeSearch(searchInput.value.trim());
    }
  });
});