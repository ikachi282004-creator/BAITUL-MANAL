/* ==========================================================================
   BAITUL MANAL — Customer Sanctuary Controller (assets/js/profile.js)
   Live Order Synchronizer, Transparent Invoicing & Order Management
   ========================================================================== */

function printOrderInvoice(orderId, subtotal, delivery, total) {
  var printWindow = window.open('', '_blank', 'width=680,height=720');
  if (!printWindow) {
    alert('Please allow pop-ups to print your atelier invoice receipt.');
    return;
  }

  var htmlContent = [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '<meta charset="UTF-8">',
    '<title>Invoice #' + orderId + ' — BAITUL MANAL</title>',
    '<style>',
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #181512; }',
    'h1 { font-family: Georgia, serif; font-size: 24px; margin: 0 0 6px; letter-spacing: 1px; }',
    '.meta { color: #8c8173; font-size: 13px; margin-bottom: 24px; }',
    'table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }',
    'td { padding: 10px 0; border-bottom: 1px solid #eee; }',
    '.total-row { font-size: 17px; font-weight: bold; border-top: 2px solid #181512; padding-top: 14px; display: flex; justify-content: space-between; }',
    '.footer-note { margin-top: 40px; font-size: 12px; color: #888; text-align: center; }',
    '</style>',
    '</head>',
    '<body>',
    '<h1>BAITUL MANAL ATELIER</h1>',
    '<div class="meta">Invoice Reference: #' + orderId + ' • Date: ' + new Date().toLocaleDateString('en-GB') + '</div>',
    '<table>',
    '<tr><td>Garments Subtotal</td><td style="text-align:right;">KD ' + Number(subtotal).toFixed(3) + '</td></tr>',
    '<tr><td>Kuwait Express Courier Dispatch</td><td style="text-align:right;">KD ' + Number(delivery).toFixed(3) + '</td></tr>',
    '</table>',
    '<div class="total-row"><span>Total Payable / Paid</span><span>KD ' + Number(total).toFixed(3) + '</span></div>',
    '<div class="footer-note">Handcrafted Luxury Fashion • State of Kuwait</div>',
    '</body>',
    '</html>'
  ].join('\n');

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(function () {
    printWindow.print();
  }, 300);
}

window.printOrderInvoice = printOrderInvoice;

document.addEventListener('DOMContentLoaded', function () {
  var API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://baitul-manal-1.onrender.com';

  var authGate = document.getElementById('authGate');
  var profileDashboard = document.getElementById('profileDashboard');

  var tabLogin = document.getElementById('tabLogin');
  var tabRegister = document.getElementById('tabRegister');
  var formLogin = document.getElementById('formLogin');
  var formRegister = document.getElementById('formRegister');
  var formForgot = document.getElementById('formForgot');
  var linkForgot = document.getElementById('linkForgot');
  var linkBackLogin = document.getElementById('linkBackLogin');

  var dashCustomerName = document.getElementById('dashCustomerName');
  var dashCustomerPhone = document.getElementById('dashCustomerPhone');
  var refreshOrdersBtn = document.getElementById('refreshOrdersBtn');
  var logoutBtn = document.getElementById('logoutBtn');
  var ordersFeedContainer = document.getElementById('ordersFeedContainer');
  var transactionsTableBody = document.getElementById('transactionsTableBody');

  var STATUS_CONFIG = {
    'PENDING_DISPATCH': { label: '🟡 Pending Dispatch', color: '#b78103', bg: 'rgba(241, 196, 15, 0.15)', stage: 0 },
    'PROCESSING': { label: '🟠 Atelier Tailoring', color: '#d35400', bg: 'rgba(230, 126, 34, 0.15)', stage: 1 },
    'OUT_FOR_DELIVERY': { label: '🔵 Out for Delivery', color: '#2980b9', bg: 'rgba(52, 152, 219, 0.15)', stage: 2 },
    'DELIVERED': { label: '🟢 Delivered', color: '#27ae60', bg: 'rgba(39, 174, 96, 0.15)', stage: 3 },
    'CANCELLED': { label: '🔴 Cancelled', color: '#c0392b', bg: 'rgba(231, 76, 60, 0.15)', stage: -1 }
  };

  // Safe Tab Switching
  if (tabLogin) {
    tabLogin.addEventListener('click', function () {
      tabLogin.classList.add('active');
      if (tabRegister) tabRegister.classList.remove('active');
      if (formLogin) formLogin.style.display = 'block';
      if (formRegister) formRegister.style.display = 'none';
      if (formForgot) formForgot.style.display = 'none';
    });
  }

  if (tabRegister) {
    tabRegister.addEventListener('click', function () {
      tabRegister.classList.add('active');
      if (tabLogin) tabLogin.classList.remove('active');
      if (formRegister) formRegister.style.display = 'block';
      if (formLogin) formLogin.style.display = 'none';
      if (formForgot) formForgot.style.display = 'none';
    });
  }

  if (linkForgot) {
    linkForgot.addEventListener('click', function (e) {
      e.preventDefault();
      if (formLogin) formLogin.style.display = 'none';
      if (formForgot) formForgot.style.display = 'block';
    });
  }

  if (linkBackLogin) {
    linkBackLogin.addEventListener('click', function (e) {
      e.preventDefault();
      if (formForgot) formForgot.style.display = 'none';
      if (formLogin) formLogin.style.display = 'block';
    });
  }

  // Active Session Verification
  var activeUser = null;
  var savedUser = localStorage.getItem('bm_customer_user');
  if (savedUser) {
    try {
      activeUser = JSON.parse(savedUser);
      showDashboard(activeUser);
    } catch (err) {
      localStorage.removeItem('bm_customer_user');
    }
  }

  // Handle Registration
  if (formRegister) {
    formRegister.addEventListener('submit', async function (e) {
      e.preventDefault();
      var inputName = document.getElementById('regName');
      var inputPhone = document.getElementById('regPhone');
      var inputEmail = document.getElementById('regEmail');
      var inputPass = document.getElementById('regPassword');
      var msgEl = document.getElementById('regMsg');

      var fullName = inputName ? inputName.value.trim() : '';
      var phone = inputPhone ? inputPhone.value.trim() : '';
      var email = inputEmail ? inputEmail.value.trim() : '';
      var password = inputPass ? inputPass.value.trim() : '';

      if (msgEl) {
        msgEl.style.color = '#c5a880';
        msgEl.textContent = 'Creating atelier profile...';
      }

      try {
        var res = await fetch(API_BASE + '/api/customer/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName: fullName, phone: phone, email: email, password: password })
        });
        var data = await res.json();

        if (res.ok && data.success) {
          localStorage.setItem('bm_customer_user', JSON.stringify(data.user));
          activeUser = data.user;
          showDashboard(data.user);
        } else {
          if (msgEl) {
            msgEl.style.color = '#c0392b';
            msgEl.textContent = data.error || 'Registration failed.';
          }
        }
      } catch (err) {
        if (msgEl) {
          msgEl.style.color = '#c0392b';
          msgEl.textContent = 'Network error connecting to backend.';
        }
      }
    });
  }

  // Handle Login
  if (formLogin) {
    formLogin.addEventListener('submit', async function (e) {
      e.preventDefault();
      var inputPhone = document.getElementById('loginPhone');
      var inputPass = document.getElementById('loginPassword');
      var msgEl = document.getElementById('loginMsg');

      var phone = inputPhone ? inputPhone.value.trim() : '';
      var password = inputPass ? inputPass.value.trim() : '';

      if (msgEl) {
        msgEl.style.color = '#c5a880';
        msgEl.textContent = 'Verifying credentials...';
      }

      try {
        var res = await fetch(API_BASE + '/api/customer/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phone, password: password })
        });
        var data = await res.json();

        if (res.ok && data.success) {
          localStorage.setItem('bm_customer_user', JSON.stringify(data.user));
          activeUser = data.user;
          showDashboard(data.user);
        } else {
          if (msgEl) {
            msgEl.style.color = '#c0392b';
            msgEl.textContent = data.error || 'Invalid credentials.';
          }
        }
      } catch (err) {
        if (msgEl) {
          msgEl.style.color = '#c0392b';
          msgEl.textContent = 'Server connection error.';
        }
      }
    });
  }

  // Handle Forgot Password
  if (formForgot) {
    formForgot.addEventListener('submit', async function (e) {
      e.preventDefault();
      var inputPhone = document.getElementById('forgotPhone');
      var inputPass = document.getElementById('forgotNewPass');
      var msgEl = document.getElementById('forgotMsg');

      var phone = inputPhone ? inputPhone.value.trim() : '';
      var newPassword = inputPass ? inputPass.value.trim() : '';

      if (msgEl) {
        msgEl.style.color = '#c5a880';
        msgEl.textContent = 'Updating password...';
      }

      try {
        var res = await fetch(API_BASE + '/api/customer/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phone, newPassword: newPassword })
        });
        var data = await res.json();

        if (res.ok && data.success) {
          if (msgEl) {
            msgEl.style.color = '#27ae60';
            msgEl.textContent = data.message;
          }
          setTimeout(function () {
            if (formForgot) formForgot.style.display = 'none';
            if (formLogin) formLogin.style.display = 'block';
          }, 1200);
        } else {
          if (msgEl) {
            msgEl.style.color = '#c0392b';
            msgEl.textContent = data.error || 'Password update failed.';
          }
        }
      } catch (err) {
        if (msgEl) {
          msgEl.style.color = '#c0392b';
          msgEl.textContent = 'Server connection error.';
        }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      localStorage.removeItem('bm_customer_user');
      location.reload();
    });
  }

  function showDashboard(user) {
    if (authGate) authGate.style.display = 'none';
    if (profileDashboard) profileDashboard.style.display = 'block';

    if (dashCustomerName) dashCustomerName.textContent = user.fullName || 'Client';
    if (dashCustomerPhone) dashCustomerPhone.textContent = user.phone || '';

    loadOrders(user.phone);
  }

  // Section Navigation Switching
  var secButtons = document.querySelectorAll('.sec-nav-btn');
  secButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      secButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var target = btn.getAttribute('data-sec');

      var viewOrders = document.getElementById('viewOrders');
      var viewHistory = document.getElementById('viewHistory');
      var viewPolicies = document.getElementById('viewPolicies');

      if (viewOrders) viewOrders.style.display = target === 'orders' ? 'block' : 'none';
      if (viewHistory) viewHistory.style.display = target === 'history' ? 'block' : 'none';
      if (viewPolicies) viewPolicies.style.display = target === 'policies' ? 'block' : 'none';
    });
  });

  // Fetch and Render Orders
  async function loadOrders(phone) {
    if (!ordersFeedContainer) return;
    ordersFeedContainer.innerHTML = '<p style="text-align:center; color:#8c8173; padding:2rem 0;">Synchronizing dispatches with atelier...</p>';

    try {
      var cleanPhone = phone.replace(/\D/g, '');
      var res = await fetch(API_BASE + '/api/customer/orders?phone=' + encodeURIComponent(cleanPhone) + '&t=' + Date.now());
      var orders = await res.json();

      if (!Array.isArray(orders) || !orders.length) {
        ordersFeedContainer.innerHTML = [
          '<div style="text-align:center; padding:3rem 1rem; background:#fff; border-radius:12px; border:1px solid #e8e2d8;">',
          '<p style="color:#8c8173; margin:0 0 14px;">No dispatches registered for <strong>' + phone + '</strong>.</p>',
          '<a href="shop.html" style="display:inline-block; background:#181512; color:#fff; padding:10px 22px; border-radius:6px; text-decoration:none; font-weight:700;">Explore Boutique Collection</a>',
          '</div>'
        ].join('');

        if (transactionsTableBody) {
          transactionsTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#8c8173;">No transactions recorded.</td></tr>';
        }
        return;
      }

      // Populate Transaction History Table
      if (transactionsTableBody) {
        transactionsTableBody.innerHTML = orders.map(function (o) {
          var dateStr = o.date ? new Date(o.date).toLocaleDateString('en-GB') : '';
          var st = o.status || 'PENDING_DISPATCH';
          var conf = STATUS_CONFIG[st] || STATUS_CONFIG['PENDING_DISPATCH'];

          return [
            '<tr style="border-bottom:1px solid #f6f3ee;">',
            '<td style="padding:10px 8px; font-weight:700; color:#181512;">#' + o.orderId + '</td>',
            '<td style="padding:10px 8px; color:#777;">' + dateStr + '</td>',
            '<td style="padding:10px 8px;">K-Net / COD</td>',
            '<td style="padding:10px 8px; color:' + conf.color + '; font-weight:700;">' + conf.label + '</td>',
            '<td style="padding:10px 8px; text-align:right; font-weight:700;">KD ' + Number(o.total || 0).toFixed(3) + '</td>',
            '</tr>'
          ].join('');
        }).join('');
      }

      // Populate Visual Order Cards
      ordersFeedContainer.innerHTML = orders.map(function (o) {
        var st = (o.status || 'PENDING_DISPATCH').toUpperCase();
        var conf = STATUS_CONFIG[st] || STATUS_CONFIG['PENDING_DISPATCH'];
        var canCancel = st === 'PENDING_DISPATCH';
        var rawItems = Array.isArray(o.items) ? o.items : [];
        var dateStr = o.date ? new Date(o.date).toLocaleDateString('en-GB') : '';

        var subtotal = 0;
        var itemsRows = rawItems.map(function (i) {
          var qty = parseInt(i.qty, 10) || 1;
          var unit = Number(i.unitPrice || i.price || 0);
          var lineTotal = Number(i.lineTotal || (unit * qty));
          subtotal += lineTotal;

          return [
            '<tr>',
            '<td>',
            '<strong style="color:var(--bm-dark);">' + (i.name || i.id) + '</strong>',
            '<div style="color:#8c8173; font-size:0.75rem;">Size: ' + (i.size || 'M') + ' • Color: ' + (i.color || 'Standard') + ' • Qty: ' + qty + '</div>',
            '</td>',
            '<td style="text-align:right; font-weight:700; color:var(--bm-dark);">KD ' + lineTotal.toFixed(3) + '</td>',
            '</tr>'
          ].join('');
        }).join('');

        var grandTotal = Number(o.total || 0);
        var deliveryFee = Math.max(0, grandTotal - subtotal);
        var stage = conf.stage;

        var stepperHtml = '';
        if (st !== 'CANCELLED') {
          stepperHtml = [
            '<div class="order-stepper">',
            '<div class="stepper-step ' + (stage >= 0 ? 'active' : '') + '">',
            '<div class="stepper-dot">' + (stage >= 0 ? '✓' : '1') + '</div>',
            '<span>Placed</span>',
            '</div>',
            '<div class="stepper-step ' + (stage >= 1 ? 'active' : '') + '">',
            '<div class="stepper-dot">' + (stage >= 1 ? '✓' : '2') + '</div>',
            '<span>Tailoring</span>',
            '</div>',
            '<div class="stepper-step ' + (stage >= 2 ? 'active' : '') + '">',
            '<div class="stepper-dot">' + (stage >= 2 ? '✓' : '3') + '</div>',
            '<span>With Courier</span>',
            '</div>',
            '<div class="stepper-step ' + (stage >= 3 ? 'active' : '') + '">',
            '<div class="stepper-dot">' + (stage >= 3 ? '✓' : '4') + '</div>',
            '<span>Delivered</span>',
            '</div>',
            '</div>'
          ].join('');
        }

        var cancelBtnHtml = canCancel
          ? '<button type="button" class="btn-cancel" data-id="' + o.orderId + '">Cancel Order</button>'
          : '';

        return [
          '<article class="order-card" id="card_' + o.orderId + '">',
          '<div class="order-card__header">',
          '<div>',
          '<span class="order-card__id">#' + o.orderId + '</span>',
          '<span style="color:#8c8173; font-size:0.78rem; margin-left:8px;">' + dateStr + '</span>',
          '</div>',
          '<span class="order-badge" style="background:' + conf.bg + '; color:' + conf.color + ';">' + conf.label + '</span>',
          '</div>',

          stepperHtml,

          '<table class="order-items-table"><tbody>' + itemsRows + '</tbody></table>',

          '<div class="order-invoice-box">',
          '<div class="invoice-line"><span>Garments Subtotal</span><strong>KD ' + subtotal.toFixed(3) + '</strong></div>',
          '<div class="invoice-line"><span>Courier Delivery</span><strong>' + (deliveryFee <= 0 ? 'KD 0.000 (FREE)' : ('KD ' + deliveryFee.toFixed(3))) + '</strong></div>',
          '<div class="invoice-line total-line"><span>Total Amount</span><span>KD ' + grandTotal.toFixed(3) + '</span></div>',
          '</div>',

          '<div class="order-card__footer">',
          '<div>',
          '<button type="button" class="btn-invoice" onclick="window.printOrderInvoice(\'' + o.orderId + '\', ' + subtotal + ', ' + deliveryFee + ', ' + grandTotal + ')">📄 Print Invoice</button>',
          '</div>',
          '<div style="display:flex; gap:8px;">',
          cancelBtnHtml,
          '<a href="track-order.html?id=' + o.orderId + '" class="btn-track">Track Status →</a>',
          '</div>',
          '</div>',
          '</article>'
        ].join('');
      }).join('');

      // Cancellation Event Listeners
      document.querySelectorAll('.btn-cancel').forEach(function (btn) {
        btn.onclick = async function (e) {
          var orderId = e.target.getAttribute('data-id');
          if (!confirm('Confirm cancellation of Order #' + orderId + '?')) return;

          e.target.disabled = true;
          e.target.textContent = 'Cancelling...';

          try {
            var cancelRes = await fetch(API_BASE + '/api/customer/cancel-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: orderId, phone: phone })
            });
            var cancelData = await cancelRes.json();

            if (cancelRes.ok && cancelData.success) {
              alert(cancelData.message);
              loadOrders(phone);
            } else {
              alert(cancelData.error || 'Failed to cancel order.');
              e.target.disabled = false;
              e.target.textContent = 'Cancel Order';
            }
          } catch (err) {
            alert('Network error connecting to dispatch server.');
            e.target.disabled = false;
            e.target.textContent = 'Cancel Order';
          }
        };
      });

    } catch (err) {
      ordersFeedContainer.innerHTML = '<p style="color:#c0392b; text-align:center;">Failed to load order history from backend.</p>';
    }
  }

  if (refreshOrdersBtn) {
    refreshOrdersBtn.addEventListener('click', function () {
      if (activeUser && activeUser.phone) {
        loadOrders(activeUser.phone);
      }
    });
  }
});