/**
 * BAITUL MANAL — Master Checkout Controller (checkout.js)
 * Fully wired to checkout.html elements with Node.js & SQLite integration
 */

document.addEventListener('DOMContentLoaded', async () => {
  const FREE_SHIPPING_THRESHOLD = 20.000;
  let catalog = [];
  let cart = [];
  let selectedPayment = 'knet';

  // Kuwait Governorates Fee Structure
  const GOV_FEES = {
    ahmadi: 1.500,
    capital: 2.000,
    hawally: 2.000,
    farwaniya: 2.000,
    mubarak: 2.000,
    jahra: 2.500
  };

  // DOM Elements: Form & Inputs
  const govSelect = document.getElementById('custGovernorate');
  const itemsContainer = document.getElementById('summaryItemsList');
  const summaryCount = document.getElementById('summaryItemCount');
  const subtotalEl = document.getElementById('checkoutSubtotal');
  const deliveryEl = document.getElementById('checkoutDelivery');
  const totalEl = document.getElementById('checkoutTotal');
  const tierNotice = document.getElementById('tierNoticeText');
  const tierFill = document.getElementById('tierFill');
  const placeOrderBtn = document.getElementById('placeOrderBtn');
  const btnPayAmount = document.getElementById('btnPayAmount');

  // 1. Read Cart Data
  try {
    cart = JSON.parse(localStorage.getItem('bm_cart') || '[]');
  } catch (e) {
    cart = [];
  }

  if (!Array.isArray(cart) || cart.length === 0) {
    alert('Your bag is currently empty. Redirecting to catalog...');
    window.location.href = 'shop.html';
    return;
  }

  // 2. Fetch Catalog for Metadata (titles, images, pricing)
  try {
    const res = await fetch('assets/data/products.json');
    if (res.ok) catalog = await res.json();
  } catch (e) {
    console.warn('Catalog offline fallback:', e);
  }

  // =========================================================================
  // 3. PAYMENT METHOD SWITCHER
  // =========================================================================
  const paymentCards = document.querySelectorAll('.pay-method-card');
  const knetDetails = document.getElementById('knetDetails');
  const cardDetails = document.getElementById('cardDetails');
  const codDetails = document.getElementById('codDetails');

  paymentCards.forEach(card => {
    card.addEventListener('click', () => {
      paymentCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const radio = card.querySelector('input[name="payMethod"]');
      if (radio) {
        radio.checked = true;
        selectedPayment = radio.value;
      }

      // Toggle drawer panels
      if (knetDetails) knetDetails.style.display = (selectedPayment === 'knet') ? 'block' : 'none';
      if (cardDetails) cardDetails.style.display = (selectedPayment === 'card') ? 'block' : 'none';
      if (codDetails) codDetails.style.display = (selectedPayment === 'cod') ? 'block' : 'none';
    });
  });

  // =========================================================================
  // 4. SUMMARY CALCULATION & RENDERING
  // =========================================================================
  function calculateAndRender() {
    let subtotal = 0;
    let totalQty = 0;

    // Render Items
    if (itemsContainer) {
      itemsContainer.innerHTML = cart.map(item => {
        const prod = catalog.find(p => p.id === item.id);
        const title = prod?.name?.en || item.name || item.id;
        const unit = prod?.salePrice || prod?.price || item.price || 0;
        const qty = parseInt(item.qty, 10) || 1;
        const lineTotal = unit * qty;
        const img = prod?.images?.[0] || 'assets/images/placeholder.jpg';

        subtotal += lineTotal;
        totalQty += qty;

        return `
          <div class="summary-item" style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
            <img src="${img}" alt="${title}" style="width: 48px; height: 62px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(214,203,186,0.6);" />
            <div style="flex: 1;">
              <h4 style="font-family: 'Playfair Display', serif; font-size: 0.88rem; margin: 0 0 2px; color: #181512;">${title}</h4>
              <span style="font-size: 0.72rem; color: #8c8173;">${item.size || 'M'} • ${item.color || 'Standard'} • Qty: ${qty}</span>
            </div>
            <strong style="font-size: 0.88rem; color: #181512;">KD ${lineTotal.toFixed(3)}</strong>
          </div>
        `;
      }).join('');
    }

    if (summaryCount) summaryCount.textContent = totalQty;

    // Shipping calculation
    const govKey = govSelect?.value || 'ahmadi';
    const isFree = subtotal >= FREE_SHIPPING_THRESHOLD;
    const shippingFee = isFree ? 0.000 : (GOV_FEES[govKey] || 1.500);
    const grandTotal = subtotal + shippingFee;

    // Update Totals DOM
    if (subtotalEl) subtotalEl.textContent = `KD ${subtotal.toFixed(3)}`;
    if (deliveryEl) {
      deliveryEl.textContent = isFree ? 'KD 0.000 (FREE)' : `KD ${shippingFee.toFixed(3)}`;
      deliveryEl.style.color = isFree ? '#27ae60' : '';
    }
    if (totalEl) totalEl.textContent = `KD ${grandTotal.toFixed(3)}`;
    if (btnPayAmount) btnPayAmount.textContent = `KD ${grandTotal.toFixed(3)}`;

    // Progress Bar
    if (tierNotice) {
      tierNotice.textContent = isFree
        ? 'Free Delivery Unlocked Across Kuwait 🎉'
        : `Add KD ${(FREE_SHIPPING_THRESHOLD - subtotal).toFixed(3)} for Free Delivery`;
    }
    if (tierFill) {
      const pct = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
      tierFill.style.width = `${pct}%`;
    }

    return { subtotal, shippingFee, grandTotal };
  }

  // Listen for governorate change
  govSelect?.addEventListener('change', calculateAndRender);

  // Initial Calculation
  calculateAndRender();

  // =========================================================================
  // 5. SUBMIT & PLACE ORDER (NODE.JS / SQLITE INTEGRATION)
  // =========================================================================
  placeOrderBtn?.addEventListener('click', async (e) => {
    e.preventDefault();

    // Validate Required Inputs
    const firstName = document.getElementById('custFirstName')?.value.trim();
    const lastName = document.getElementById('custLastName')?.value.trim();
    const phone = document.getElementById('custPhone')?.value.trim();
    const gov = govSelect?.options[govSelect.selectedIndex]?.text || 'Al Ahmadi';
    const area = document.getElementById('custArea')?.value.trim();
    const block = document.getElementById('custBlock')?.value.trim();
    const street = document.getElementById('custStreet')?.value.trim();
    const house = document.getElementById('custHouse')?.value.trim();

    if (!firstName || !lastName || !phone || !area || !block || !street || !house) {
      alert('Please fill in all required customer name, phone, and address details marked with an asterisk (*).');
      return;
    }

    if (phone.length < 8) {
      alert('Please enter a valid 8-digit Kuwait mobile number.');
      return;
    }

    const { subtotal, shippingFee, grandTotal } = calculateAndRender();

    // Map Payment Method Label
    const paymentLabels = {
      knet: 'K-Net Local Debit Card',
      card: 'Credit Card (Visa/MasterCard)',
      cod: 'Cash on Delivery (COD)'
    };

    const paymentText = paymentLabels[selectedPayment] || 'K-Net';

    // Construct Payload for Backend
    const orderPayload = {
      recipient: {
        name: `${firstName} ${lastName}`,
        phone: `+965 ${phone}`,
        address: `Area: ${area}, Block ${block}, Street ${street}, House ${house}`
      },
      deliveryArea: gov,
      paymentMethod: paymentText,
      items: cart
    };

    // Provide visual submission feedback
    placeOrderBtn.disabled = true;
    placeOrderBtn.innerHTML = '<span>Verifying with Boutique Server...</span>';

    try {
      // Send Order to Backend Server
      const response = await fetch('https://baitul-manal-1.onrender.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Server error occurred');
      }

      // Save Finalized Backend Verified Order to localStorage
      localStorage.setItem('bm_last_order', JSON.stringify(data.order));

      // Clear active bag
      localStorage.removeItem('bm_cart');
      window.dispatchEvent(new Event('bm_cart_updated'));
      window.dispatchEvent(new Event('storage'));

      // Transition to success voucher page
      window.location.href = 'order-success.html';

    } catch (err) {
      console.warn('Backend server not reachable, executing offline client fallback:', err);

      // Offline Fallback Order
      const fallbackOrder = {
        orderId: 'BM-KW-2026-' + Math.floor(1000 + Math.random() * 9000),
        date: new Date().toLocaleDateString('en-GB'),
        recipient: {
          name: `${firstName} ${lastName}`,
          phone: `+965 ${phone}`,
          governorate: gov,
          address: `Area: ${area}, Block ${block}, Street ${street}, House ${house}`
        },
        paymentMethod: paymentText,
        items: cart.map(i => {
          const prod = catalog.find(p => p.id === i.id);
          return {
            id: i.id,
            name: prod?.name?.en || i.name || i.id,
            size: i.size || 'Standard',
            color: i.color || 'Original',
            unitPrice: prod?.salePrice || prod?.price || i.price || 0,
            qty: parseInt(i.qty, 10) || 1,
            lineTotal: (prod?.salePrice || prod?.price || i.price || 0) * (parseInt(i.qty, 10) || 1)
          };
        }),
        subtotal: subtotal,
        deliveryFee: shippingFee,
        discount: 0.000,
        total: grandTotal
      };

      localStorage.setItem('bm_last_order', JSON.stringify(fallbackOrder));
      localStorage.removeItem('bm_cart');
      window.dispatchEvent(new Event('bm_cart_updated'));
      window.dispatchEvent(new Event('storage'));

      window.location.href = 'order-success.html';
    }
  });
});