/**
 * ============================================================================
 * SURUHAJA CEPU — FRONTEND APPLICATION LOGIC (app.js)
 * ============================================================================
 * Berjalan 100% di browser (Cloudflare Pages) dengan backend Supabase
 * (supabase-api.js) dan autentikasi Google via Firebase Auth.
 * ============================================================================
 */

var STORAGE_KEYS = {
  THEME: 'suruhaja_theme',
  TOKEN: 'suruhaja_session_token',
  SESSION_META: 'suruhaja_session_meta',
  LOCAL_ORDERS: 'suruhaja_local_orders',
  CUST_NAME: 'suruhaja_customer_name',
  CUST_PHONE: 'suruhaja_customer_phone'
};

function getAuthToken() {
  try {
    return localStorage.getItem(STORAGE_KEYS.TOKEN) || '';
  } catch (e) {
    return '';
  }
}

/* State Global Aplikasi */
var state = {
  appName: 'SuruhAja',
  appTagline: 'Titip Beli & Antar Barang Area Cepu',
  whatsappNumber: '6281234567890',
  logoUrl: '',
  storeStatus: 'OPEN',
  storeStatusNote: 'Kurir Siap Jalan (07.00 - 21.00 WIB)',
  maxDriverQuota: 15,
  driverQuota: null,
  saweriaUrl: '',
  saweriaText: 'Suka dengan layanan SuruhAja? Traktir kopi pengembang agar aplikasi tetap gratis & makin cepat!',
  drivers: [],
  partners: [],
  testimonials: [],
  carousel: [],
  footer: {
    brandName: 'SuruhAja Cepu',
    description: 'Jasa titip beli & antar barang simpel khusus area Cepu. Klik order langsung tersambung ke WhatsApp!',
    address: 'Khusus Area Cepu & Sekitarnya',
    whatsapp: '6281234567890',
    email: 'halo@suruhaja.id',
    instagram: '@suruhaja.cepu',
    copyright: '© ' + new Date().getFullYear() + ' SuruhAja Cepu. All rights reserved.'
  },
  services: [],
  tariffs: [],
  promos: [],
  user: null,
  googleUser: null,
  syncedFirebaseUid: '',
  firebaseReady: false,
  pendingPostLoginAction: null,
  selectedServiceId: '',
  selectedDriverId: '',
  appliedPromo: null,
  adminData: null,
  driverData: null,
  adminOrderFilter: 'ALL',
  driverOrderFilter: 'ALL',
  lastWaUrl: '',
  mapPinMode: 'pickup',
  pickup: { lat: -7.1495, lng: 111.5905, address: 'Pusat Kota Cepu (-7.1495, 111.5905)' },
  dropoff: { lat: -7.1375, lng: 111.6075, address: 'Area Cepu (-7.1375, 111.6075)' },
  distanceKm: 2.6,
  routeLatLngs: [[-7.1495, 111.5905], [-7.1375, 111.6075]],
  routeReqSeq: 0,
  mapSearchResults: [],
  pendingLogoFile: null,
  pendingRegDriverPhoto: null,
  pendingAdminDriverPhoto: null
};

/* ========================================================================
 * 1. INISIALISASI TEMA (DARK / LIGHT MODE PERSISTENT)
 * ======================================================================== */
function initTheme() {
  var saved = 'light';
  try {
    saved = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
  } catch (e) {}
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch (e) {}
  var btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.innerHTML = theme === 'dark'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
  }
}

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ========================================================================
 * 2. UTILITAS UI (FORMAT RUPIAH, TOAST, MODAL, PASSWORD TOGGLE, SCROLL)
 * ======================================================================== */
function formatRp(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function formatDateSafe(val) {
  if (!val) return '-';
  var d = new Date(val);
  return isNaN(d.getTime()) ? String(val) : d.toLocaleString('id-ID');
}

function escHtml(str) {
  return String(str === null || str === undefined ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setElText(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setElVal(id, val) {
  var el = document.getElementById(id);
  if (el) el.value = val;
}

function getElVal(id, fallback) {
  var el = document.getElementById(id);
  return el ? String(el.value || '') : (fallback || '');
}

function bindEventSafe(elOrId, evtName, handler) {
  var el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  if (!el || !handler) return;
  var flagKey = 'saBound_' + evtName;
  if (el.dataset && el.dataset[flagKey]) return;
  if (el.dataset) el.dataset[flagKey] = '1';
  el.addEventListener(evtName, handler);
}

function formatWhatsAppNumber(phone) {
  var digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.indexOf('0') === 0) {
    digits = '62' + digits.substring(1);
  } else if (digits.indexOf('620') === 0) {
    digits = '62' + digits.substring(3);
  } else if (digits.indexOf('8') === 0) {
    digits = '62' + digits;
  }
  return digits;
}

function isValidWhatsAppNumber(phone) {
  var digits = formatWhatsAppNumber(phone);
  return /^62[0-9]{8,13}$/.test(digits);
}

function getWhatsAppIconSvg(size) {
  size = size || 15;
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.766.469 3.484 1.344 5l-1.406 5.156 5.281-1.375c1.469.797 3.109 1.219 4.75 1.219 5.516 0 9.969-4.453 9.969-9.969s-4.453-10-9.969-10zm5.813 14.125c-.25.703-1.453 1.344-2 1.422-.516.078-1.172.109-1.891-.125-.438-.141-1-.328-1.719-.641-3.016-1.312-4.984-4.359-5.141-4.562-.156-.203-1.234-1.641-1.234-3.125 0-1.484.781-2.219 1.063-2.516.281-.297.609-.375.813-.375.203 0 .406 0 .578.016.188.016.438-.078.688.516.25.609.859 2.094.938 2.25.078.156.125.344.016.547-.094.203-.156.328-.313.5-.156.172-.328.391-.469.531-.156.156-.313.328-.141.641.172.313.766 1.266 1.641 2.047 1.125 1 2.078 1.313 2.391 1.469.313.156.5.125.688-.078.188-.203.797-.922 1.016-1.234.219-.313.422-.266.719-.156.297.109 1.875.891 2.203 1.047.328.156.547.234.625.359.078.125.078.734-.172 1.438z"/>' +
  '</svg>';
}

function buildCustomerToDriverWaUrl(orderObj) {
  var o = orderObj || {};
  var drvName = o.DriverName || String(o.RouteName || 'Driver SuruhAja').replace(/\s*\([^)]*\)\s*$/, '').trim() || 'Driver SuruhAja';
  var orderIdLabel = o.OrderCode || o.ID || '-';
  var pickupAddr = o.PickupAddress || o.PickupCoords || 'Titik Jemput';
  var dropoffAddr = o.DropoffAddress || o.DropoffCoords || 'Lokasi Antar';
  var rawPhone = o.DriverPhoneWA || state.whatsappNumber || '6281234567890';
  if (!o.DriverPhoneWA && o.RouteID && o.RouteID !== 'AUTO') {
    var matched = (state.drivers || []).find(function (d) { return d.ID === o.RouteID; });
    if (matched && matched.PhoneWA) rawPhone = matched.PhoneWA;
  }
  var wa = formatWhatsAppNumber(rawPhone || state.whatsappNumber);
  var text = 'Halo Kak ' + drvName + ', saya pelanggan SuruhAja (Order #' + orderIdLabel + '). Lokasi jemput di ' + pickupAddr + ' menuju ' + dropoffAddr + '.';
  return 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text);
}

function buildDriverToCustomerWaUrl(orderObj, drvObj) {
  var o = orderObj || {};
  var custWa = formatWhatsAppNumber(o.CustomerPhone);
  if (!isValidWhatsAppNumber(custWa)) return '';
  var custName = o.CustomerName || 'Pelanggan';
  var drvName = (drvObj && drvObj.FullName) || (state.user && state.user.fullName) || 'Mitra Driver';
  var veh = (drvObj && drvObj.VehicleType) || 'Motor';
  var plate = (drvObj && drvObj.PlateNumber) || '-';
  var text = 'Halo Kak ' + custName + ', saya ' + drvName + ' dari SuruhAja (' + veh + ' - ' + plate + '). Pesanan sudah saya terima dan saya segera menuju titik jemput.';
  return 'https://wa.me/' + custWa + '?text=' + encodeURIComponent(text);
}

function showToast(msg, type) {
  type = type || 'info';
  var container = document.getElementById('toastContainer');
  if (!container) return;
  var el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(function () {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = '0.25s ease';
    setTimeout(function () { el.remove(); }, 260);
  }, 3400);
}

function openModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function togglePasswordVisibility(inputId, btn) {
  var input = document.getElementById(inputId);
  if (!input) return;
  var isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  if (btn) {
    btn.innerHTML = isHidden
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
}

function initScrollReveal() {
  var els = document.querySelectorAll('.scroll-reveal');
  var revealAll = function () {
    els.forEach(function (el) { el.classList.add('is-visible'); });
  };

  if (!('IntersectionObserver' in window)) {
    revealAll();
    return;
  }

  document.documentElement.classList.add('sr-ready');

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry, idx) {
      if (entry.isIntersecting) {
        setTimeout(function () { entry.target.classList.add('is-visible'); }, Math.min(idx * 50, 200));
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.02, rootMargin: '0px 0px 80px 0px' });

  els.forEach(function (el) { observer.observe(el); });
  setTimeout(revealAll, 550);
}

/* ========================================================================
 * 3. NAVIGASI VIEW & BOOTSTRAP APLIKASI (SUPABASE)
 * ======================================================================== */
function switchView(viewName) {
  if (viewName === 'admin') {
    if (!state.user || state.user.role !== 'Admin') {
      showToast('Silakan login sebagai Admin untuk membuka Admin Panel.', 'error');
      openAuthModal('login');
      return;
    }
    loadAdminData();
  }
  if (viewName === 'driver') {
    if (!state.user || state.user.role !== 'Driver') {
      showToast('Silakan login sebagai Driver untuk membuka Dashboard Driver.', 'error');
      openAuthModal('login');
      return;
    }
    loadDriverData();
  }
  if (viewName === 'orders') {
    loadCustomerOrders();
  }

  document.querySelectorAll('.view-section').forEach(function (s) {
    s.classList.remove('active');
  });
  var target = document.getElementById('view-' + viewName);
  if (target) target.classList.add('active');

  document.querySelectorAll('.bnav-item').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  if (viewName === 'home') {
    setTimeout(function () {
      if (cepuMapInstance) cepuMapInstance.invalidateSize();
    }, 160);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToOrderForm() {
  switchView('home');
  setTimeout(function () {
    var el = document.getElementById('orderFormSection');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function handleOrderNowAction() {
  if (!state.googleUser || !state.googleUser.email) {
    state.pendingPostLoginAction = { type: 'orderForm' };
    loginWithGoogleCustomer();
    return;
  }
  scrollToOrderForm();
}

function scrollToServices() {
  switchView('home');
  document.querySelectorAll('.bnav-item').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.view === 'services');
  });
  setTimeout(function () {
    var el = document.getElementById('servicesSection');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

async function bootstrapApp() {
  try { initTheme(); } catch (e0) { console.error('initTheme err:', e0); }
  try { initScrollReveal(); } catch (e1) { console.error('initScrollReveal err:', e1); }
  try { restoreSavedCustomerName(); } catch (e2) {}
  try { initFirebaseGoogleAuth(); } catch (e3) { console.error('initFirebase err:', e3); }
  try { renderGoogleAuthState(); } catch (e4) { console.error('renderGoogleAuthState err:', e4); }

  if (state.googleUser) {
    try { initCepuMap(); } catch (e5) { console.error('initCepuMap err:', e5); }
  }

  var token = getAuthToken();

  try {
    var res = await SuruhAjaAPI.getAppBootstrap(token);
    if (res && res.success && res.data) {
      var d = res.data;
      state.appName = d.appName || 'SuruhAja';
      state.appTagline = d.appTagline || 'Titip Beli & Antar Barang Area Cepu';
      state.whatsappNumber = d.whatsappNumber || '6281234567890';
      state.logoUrl = d.logoUrl || '';
      state.storeStatus = d.storeStatus || 'OPEN';
      state.storeStatusNote = d.storeStatusNote || 'Kurir Siap Jalan (07.00 - 21.00 WIB)';
      state.maxDriverQuota = Number(d.maxDriverQuota || 15);
      state.driverQuota = d.driverQuota || null;
      state.saweriaUrl = d.saweriaUrl || '';
      state.saweriaText = d.saweriaText || 'Suka dengan layanan SuruhAja? Traktir kopi pengembang agar aplikasi tetap gratis & makin cepat!';
      state.drivers = Array.isArray(d.drivers) ? d.drivers : [];
      state.partners = Array.isArray(d.partners) ? d.partners : [];
      state.testimonials = Array.isArray(d.testimonials) ? d.testimonials : [];
      if (d.footer && Object.keys(d.footer).length) state.footer = d.footer;
      state.services = Array.isArray(d.services) ? d.services : [];
      state.tariffs = Array.isArray(d.tariffs) ? d.tariffs : [];
      state.carousel = Array.isArray(d.carousel) ? d.carousel : [];
      state.user = d.user || null;
      state.promos = Array.isArray(d.promos) ? d.promos : [];

      if (!state.user && token) {
        try {
          localStorage.removeItem(STORAGE_KEYS.TOKEN);
          localStorage.removeItem(STORAGE_KEYS.SESSION_META);
        } catch (e) {}
      }

      try { renderAllPublicUI(); } catch (eRender) { console.error('renderAllPublicUI err:', eRender); }
      try { refreshRouteFareBadge(); } catch (eBadge) { console.error('refreshRouteFareBadge err:', eBadge); }
    } else {
      renderAllPublicUI();
      showToast(res ? res.message : 'Gagal memuat data dari Supabase.', 'error');
    }
  } catch (err) {
    renderAllPublicUI();
    showToast('Gagal terhubung ke Supabase: ' + err.message, 'error');
  }
}

function restoreSavedCustomerName() {
  try {
    var nameInput = document.getElementById('orderCustName');
    var phoneInput = document.getElementById('orderCustPhone');
    if (nameInput && !nameInput.value) {
      if (state.googleUser && state.googleUser.displayName) {
        nameInput.value = state.googleUser.displayName;
      } else {
        var savedName = localStorage.getItem(STORAGE_KEYS.CUST_NAME) || '';
        if (savedName) nameInput.value = savedName;
      }
    }
    if (phoneInput && !phoneInput.value) {
      var savedPhone = localStorage.getItem(STORAGE_KEYS.CUST_PHONE) || '';
      if (savedPhone) phoneInput.value = savedPhone;
    }
  } catch (e) {}
}

/* ========================================================================
 * 3B. FIREBASE AUTHENTICATION (SINKRON DENGAN TABEL `users` SUPABASE)
 * ======================================================================== */
var FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCKRf_dhrW_BVzBqoDIX0X2-kJX-mXSj48',
  authDomain: 'suruhaja-45271.firebaseapp.com',
  projectId: 'suruhaja-45271',
  storageBucket: 'suruhaja-45271.firebasestorage.app',
  messagingSenderId: '1034474196450',
  appId: '1:1034474196450:web:d5bccdb20b4f09f605bdbb',
  measurementId: 'G-DEGC63C9QF'
};

function initFirebaseGoogleAuth() {
  if (typeof firebase === 'undefined') {
    state.firebaseReady = false;
    return;
  }
  try {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    try {
      if (typeof firebase.analytics === 'function') {
        firebase.analytics();
      }
    } catch (errAna) {}

    state.firebaseReady = true;
    firebase.auth().onAuthStateChanged(function (user) {
      if (user) {
        state.googleUser = {
          uid: user.uid,
          displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Pelanggan'),
          email: user.email || '',
          photoURL: user.photoURL || ''
        };
        if (state.googleUser.email && state.syncedFirebaseUid !== user.uid) {
          state.syncedFirebaseUid = user.uid;
          SuruhAjaAPI.syncFirebaseUser(state.googleUser);
        }
      } else {
        state.googleUser = null;
        state.syncedFirebaseUid = '';
      }
      renderGoogleAuthState();
    });
  } catch (err) {
    state.firebaseReady = false;
  }
}

function renderGoogleAuthState() {
  var barOut = document.getElementById('googleBarLoggedOut');
  var barIn = document.getElementById('googleBarLoggedIn');
  var navGoogleBtn = document.getElementById('googleNavBtn');
  var gate = document.getElementById('customerGoogleGate');
  var form = document.getElementById('orderForm');
  var avatarEl = document.getElementById('googleUserAvatar');
  var nameEl = document.getElementById('googleUserName');
  var emailEl = document.getElementById('googleUserEmail');
  var custNameInput = document.getElementById('orderCustName');

  if (state.googleUser && state.googleUser.email) {
    if (barOut) barOut.style.display = 'none';
    if (barIn) barIn.style.display = 'flex';
    if (navGoogleBtn) navGoogleBtn.style.display = 'none';
    if (gate) gate.style.display = 'none';
    if (form) form.style.display = 'block';

    var gName = state.googleUser.displayName || 'Pelanggan';
    var initial = escHtml(gName.charAt(0).toUpperCase());
    if (avatarEl) {
      avatarEl.innerHTML = state.googleUser.photoURL
        ? '<img src="' + escHtml(state.googleUser.photoURL) + '" alt="' + escHtml(gName) + '" onerror="this.parentElement.textContent=\'' + initial + '\'" />'
        : initial;
    }
    if (nameEl) nameEl.textContent = gName;
    if (emailEl) emailEl.textContent = state.googleUser.email;
    if (custNameInput && !custNameInput.value.trim()) {
      custNameInput.value = gName;
    }

    setTimeout(function () {
      if (!cepuMapInstance) {
        initCepuMap();
      } else {
        cepuMapInstance.invalidateSize();
        refreshRouteFareBadge();
      }
    }, 120);
  } else {
    if (barOut) barOut.style.display = 'flex';
    if (barIn) barIn.style.display = 'none';
    if (navGoogleBtn) navGoogleBtn.style.display = 'inline-flex';
    if (gate) gate.style.display = 'block';
    if (form) form.style.display = 'none';
  }
}

async function loginWithGoogleCustomer() {
  var btns = [
    { el: document.getElementById('googleLoginGateBtn'), idle: 'Masuk dengan Google' },
    { el: document.getElementById('googleTopLoginBtn'), idle: 'Masuk dengan Google' },
    { el: document.getElementById('googleNavBtn'), idle: 'Masuk Google' }
  ];
  btns.forEach(function (item) {
    if (item.el) {
      item.el.disabled = true;
      var sp = item.el.querySelector('span');
      if (sp) sp.textContent = 'Menghubungkan...';
    }
  });

  try {
    if (!state.firebaseReady || typeof firebase === 'undefined' || !firebase.auth) {
      showToast('SDK Firebase belum siap. Coba muat ulang halaman.', 'error');
      return;
    }

    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    var result = await firebase.auth().signInWithPopup(provider);
    var user = result && result.user;
    if (user) {
      state.googleUser = {
        uid: user.uid,
        displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Pelanggan'),
        email: user.email || '',
        photoURL: user.photoURL || ''
      };
      state.syncedFirebaseUid = user.uid;
      await SuruhAjaAPI.syncFirebaseUser(state.googleUser);
      renderGoogleAuthState();
      runPendingPostLoginAction();
      showToast('Selamat datang, ' + state.googleUser.displayName + '!', 'success');
    }
  } catch (err) {
    var code = err && err.code ? String(err.code) : '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      if (state.pendingPostLoginAction) {
        state.pendingPostLoginAction = null;
        scrollToOrderForm();
      }
      showToast('Login Google dibatalkan. Silakan masuk terlebih dahulu untuk memesan.', 'info');
    } else if (code === 'auth/popup-blocked') {
      if (state.pendingPostLoginAction) {
        state.pendingPostLoginAction = null;
        scrollToOrderForm();
      }
      showToast('Popup login diblokir browser. Klik tombol Masuk dengan Google di layar.', 'error');
    } else if (code === 'auth/unauthorized-domain') {
      state.pendingPostLoginAction = null;
      showToast('Domain situs ini belum diizinkan di Firebase Authentication -> Authorized domains.', 'error');
    } else {
      state.pendingPostLoginAction = null;
      showToast('Gagal login Google: ' + (err.message || code), 'error');
    }
  } finally {
    btns.forEach(function (item) {
      if (item.el) {
        item.el.disabled = false;
        var sp = item.el.querySelector('span');
        if (sp) sp.textContent = item.idle;
      }
    });
  }
}

function runPendingPostLoginAction() {
  var act = state.pendingPostLoginAction;
  state.pendingPostLoginAction = null;
  if (!act) return;
  scrollToOrderForm();
  setTimeout(function () {
    if (cepuMapInstance) cepuMapInstance.invalidateSize();
    if (act.focusDetails) {
      var detailEl = document.getElementById('orderDetails');
      if (detailEl) detailEl.focus();
    }
  }, 280);
}

async function logoutGoogleCustomer() {
  try {
    if (state.firebaseReady && typeof firebase !== 'undefined' && firebase.auth) {
      await firebase.auth().signOut();
    }
  } catch (e) {}
  state.googleUser = null;
  state.syncedFirebaseUid = '';
  var custNameInput = document.getElementById('orderCustName');
  if (custNameInput) custNameInput.value = '';
  renderGoogleAuthState();
  showToast('Anda telah keluar dari akun Google.', 'info');
}

/* ========================================================================
 * 4. RENDER UI PUBLIK
 * ======================================================================== */
function renderAllPublicUI() {
  var headerName = document.getElementById('headerAppName');
  var headerTag = document.getElementById('headerTagline');
  if (headerName) headerName.textContent = state.appName;
  if (headerTag) headerTag.textContent = state.appTagline;
  renderLogoElements();

  var f = state.footer || {};
  var elBrand = document.getElementById('footerBrandName');
  var elDesc = document.getElementById('footerDescription');
  var elAddr = document.getElementById('footerAddress');
  var elWa = document.getElementById('footerWhatsapp');
  var elEmail = document.getElementById('footerEmail');
  var elIg = document.getElementById('footerInstagram');
  var elCopy = document.getElementById('footerCopyright');

  if (elBrand) elBrand.textContent = f.brandName || state.appName;
  if (elDesc) elDesc.textContent = f.description || '';
  if (elAddr) elAddr.textContent = 'Area: ' + (f.address || 'Khusus Area Cepu');
  if (elWa) elWa.textContent = 'WhatsApp: ' + (f.whatsapp || state.whatsappNumber);
  if (elEmail) elEmail.textContent = 'Email: ' + (f.email || '-');
  if (elIg) elIg.textContent = 'Instagram: ' + (f.instagram || '-');
  if (elCopy) elCopy.textContent = f.copyright || ('© ' + new Date().getFullYear() + ' ' + state.appName);

  renderAuthState();
  renderStoreStatus();
  renderHeroSnapshot();
  renderSaweriaSupport();
  renderServices();
  renderDriversSelect();
  renderPromoChips();
  renderPartners();
  renderTestimonials();
  updateFloatingWaButton();
  updateOrderSummary();
}

function renderHeroSnapshot() {
  var minPriceEl = document.getElementById('heroSnapMinPrice');
  var driversEl = document.getElementById('heroSnapDrivers');
  var promoEl = document.getElementById('heroSnapPromo');

  var activeTariffs = (state.tariffs || []).filter(function (t) { return t.Status === 'Aktif' || t.Status === 'Active'; });
  var activePrices = activeTariffs.length
    ? activeTariffs.map(function (t) { return Number(t.Tarif_Minimal || 0); })
    : (state.services || []).map(function (s) { return Number(s.BasePrice || 0); });
  if (minPriceEl) {
    minPriceEl.textContent = activePrices.length ? formatRp(Math.min.apply(null, activePrices)) : 'Rp 6.000';
  }
  var activeDriverList = (state.drivers || []).filter(function (d) {
    var st = String(d.Status || '').toUpperCase();
    var app = String(d.ApprovalStatus || '').toUpperCase();
    return st !== 'PENDING' && st !== 'INACTIVE' && st !== 'NONAKTIF' && app !== 'PENDING' && app !== 'DITOLAK';
  });
  var standbyCount = activeDriverList.filter(function (d) {
    return (d.ApprovalStatus || 'Standby') === 'Standby' || String(d.ApprovalStatus || '').toUpperCase() === 'AKTIF';
  }).length;
  if (driversEl) {
    driversEl.textContent = standbyCount > 0 ? (standbyCount + ' Kurir Siap') : (activeDriverList.length + ' Kurir Aktif');
  }
  var activePromos = (state.promos || []).filter(function (p) { return p.Status === 'Active'; });
  if (promoEl) {
    promoEl.textContent = activePromos.length ? (activePromos[0].Code + ' (-' + formatRp(activePromos[0].DiscountAmount) + ')') : 'Cek Form Order';
  }
}

function renderSaweriaSupport() {
  var sec = document.getElementById('saweriaSupportSection');
  var desc = document.getElementById('saweriaSupportDesc');
  var btn = document.getElementById('saweriaSupportBtn');
  var modalBtn = document.getElementById('succSaweriaLink');
  var url = String(state.saweriaUrl || '').trim();
  var text = state.saweriaText || 'Suka dengan layanan SuruhAja? Traktir kopi pengembang agar aplikasi tetap gratis & makin cepat!';

  if (url && /^https?:\/\/.+/i.test(url)) {
    if (sec) sec.style.display = 'flex';
    if (desc) desc.textContent = text;
    if (btn) btn.href = url;
    if (modalBtn) {
      modalBtn.style.display = 'inline-flex';
      modalBtn.href = url;
    }
  } else {
    if (sec) sec.style.display = 'none';
    if (modalBtn) modalBtn.style.display = 'none';
  }
}

function renderStoreStatus() {
  var pill = document.getElementById('heroStoreStatusPill');
  var txt = document.getElementById('heroStoreStatusText');
  var closedBanner = document.getElementById('closedNoticeBanner');
  var isOpen = state.storeStatus !== 'CLOSED';

  if (pill) {
    pill.className = 'store-status-pill ' + (isOpen ? 'is-open' : 'is-closed');
  }
  if (txt) {
    txt.textContent = isOpen
      ? ('Sedang Buka — ' + (state.storeStatusNote || 'Kurir Siap Jalan'))
      : ('Sedang Tutup — ' + (state.storeStatusNote || 'Istirahat'));
  }
  if (closedBanner) {
    closedBanner.style.display = isOpen ? 'none' : 'block';
  }
}

function updateFloatingWaButton() {
  var btn = document.getElementById('floatingWaBtn');
  if (!btn) return;
  var wa = String(state.whatsappNumber || '6281234567890').replace(/[^0-9]/g, '');
  var text = encodeURIComponent('Halo SuruhAja Cepu, saya mau tanya / pesan jasa suruh...');
  btn.href = 'https://wa.me/' + wa + '?text=' + text;
}

function getPartnerVectorSvg(p) {
  var text = ((p && p.category) || '') + ' ' + ((p && p.name) || '') + ' ' + ((p && p.icon) || '');
  if (/galon|gas|paket|harian|antar|barang/i.test(text)) {
    return '<div class="partner-icon svc-box-paket"><svg width="24" height="24" viewBox="0 0 36 36" fill="none"><rect x="6" y="10" width="24" height="20" rx="4" fill="#0088FF"/><path d="M6 15h24" stroke="#EBF5FF" stroke-width="2.2"/><path d="M15 10h6v10l-3-2-3 2V10z" fill="#60A5FA"/><rect x="10" y="22" width="7" height="3" rx="1.5" fill="#EBF5FF"/></svg></div>';
  }
  return '<div class="partner-icon svc-box-makan"><svg width="24" height="24" viewBox="0 0 36 36" fill="none"><path d="M7 18h22a11 11 0 01-22 0z" fill="#EE2737"/><rect x="13" y="28" width="10" height="2.6" rx="1.3" fill="#B91C1C"/><path d="M12 13c0-1.5 1.2-2.2 1.2-3.5M18 12.5c0-1.6 1.2-2.4 1.2-3.8M24 13c0-1.5 1.2-2.2 1.2-3.5" stroke="#FB923C" stroke-width="2" stroke-linecap="round"/><path d="M9 17.5h18" stroke="#FFF0ED" stroke-width="2" stroke-linecap="round"/></svg></div>';
}

function renderPartners() {
  var sec = document.getElementById('partnersSection');
  var grid = document.getElementById('partnersGrid');
  if (!grid) return;
  var list = (state.partners || []).filter(function (p) { return p.status !== 'Inactive'; });

  if (!list.length) {
    if (sec) sec.style.display = 'none';
    return;
  }
  if (sec) sec.style.display = 'block';
  state._activePartners = list;

  grid.innerHTML = list.map(function (p, idx) {
    return ('\n' +
      '          <div class="partner-card">\n' +
      '            <div class="partner-top">\n' +
      '              ' + (getPartnerVectorSvg(p)) + '\n' +
      '              <span class="partner-badge">' + (escHtml(p.badge || p.category || 'Rekanan')) + '</span>\n' +
      '            </div>\n' +
      '            <h4>' + (escHtml(p.name)) + '</h4>\n' +
      '            <p>' + (escHtml(p.menuHint || 'Nitip beli cepat area Cepu')) + '</p>\n' +
      '            <button type="button" class="btn-pill btn-soft" style="width:100%; padding:8px 12px; font-size:12px;" onclick="orderFromPartnerByIdx(' + (idx) + ')">\n' +
      '              Nitip di Sini\n' +
      '            </button>\n' +
      '          </div>\n' +
      '        ');
  }).join('');
}

function orderFromPartnerByIdx(idx) {
  var p = (state._activePartners || [])[idx];
  if (!p) return;
  var prefix = 'Titip beli di ' + p.name + (p.menuHint ? ' (misal: ' + p.menuHint + ') — Pesanan saya: ' : ' — Pesanan saya: ');
  applyQuickTask('SRV-BELI', prefix);
}

function renderTestimonials() {
  var sec = document.getElementById('testimonialsSection');
  var grid = document.getElementById('testimonialsGrid');
  if (!grid) return;
  var list = (state.testimonials || []).filter(function (t) { return t.status !== 'Inactive'; });

  if (!list.length) {
    if (sec) sec.style.display = 'none';
    return;
  }
  if (sec) sec.style.display = 'block';

  grid.innerHTML = list.map(function (t) {
    var stars = '★'.repeat(Math.min(5, Math.max(1, Number(t.rating || 5))));
    return ('\n' +
      '          <div class="testi-card">\n' +
      '            <div class="testi-stars">' + (escHtml(stars)) + '</div>\n' +
      '            <p class="testi-comment">"' + (escHtml(t.comment || '')) + '"</p>\n' +
      '            <div class="testi-author">' + (escHtml(t.name || 'Warga Cepu')) + '</div>\n' +
      '          </div>\n' +
      '        ');
  }).join('');
}

function getDefaultLogoSvg() {
  return '\n' +
    '        <svg width="24" height="24" viewBox="0 0 36 36" fill="none" aria-label="SuruhAja Cepu">\n' +
    '          <circle cx="10.5" cy="25.5" r="4" stroke="#FFFFFF" stroke-width="2.6"/>\n' +
    '          <circle cx="26.5" cy="25.5" r="4" stroke="#FFFFFF" stroke-width="2.6"/>\n' +
    '          <path d="M10.5 25.5L15.5 18H22.5L26.5 25.5" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>\n' +
    '          <path d="M21 12.5H25L27 18" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>\n' +
    '          <path d="M13 13a4 4 0 018 0v2h-8v-2z" fill="#FFFFFF"/>\n' +
    '        </svg>';
}

function handleLogoImgError(imgEl) {
  if (imgEl && imgEl.parentElement) {
    imgEl.parentElement.innerHTML = getDefaultLogoSvg();
  }
}

function renderLogoElements() {
  var logoHtml = state.logoUrl
    ? ('<img src="' + (escHtml(state.logoUrl)) + '" alt="' + (escHtml(state.appName)) + '" onerror="handleLogoImgError(this)" />')
    : getDefaultLogoSvg();
  var headerBox = document.getElementById('headerLogoBox');
  var footerBox = document.getElementById('footerLogoBox');
  if (headerBox) headerBox.innerHTML = logoHtml;
  if (footerBox) footerBox.innerHTML = logoHtml;
}

/* ========================================================================
 * 5. LAYANAN, PETA CEPU (LEAFLET + OSRM + NOMINATIM), PROMO & ORDER WA
 * ======================================================================== */
var CEPU_CENTER = [-7.1495, 111.5905];
var CEPU_BOUNDS_ARR = [[-7.235, 111.500], [-7.065, 111.680]];
var cepuMapInstance = null;
var pickupMarker = null;
var dropoffMarker = null;
var routeLineShadow = null;
var routeLineMain = null;
var routeFareMarker = null;

function getServiceVectorMeta(service) {
  var id = String((service && (service.ID_Layanan || service.ID)) || '').toLowerCase();
  var name = String((service && (service.Nama_Layanan || service.Name)) || '').toLowerCase();
  var ikon = String((service && (service.Ikon || service.Icon)) || '').toLowerCase();
  var key = id + ' ' + name + ' ' + ikon;

  if (/makan|food|beli|kuliner|minum|🍔|🍜|🛍/.test(key)) {
    return {
      boxClass: 'svc-box-makan',
      label: 'Pesan Makan',
      svg: '<svg width="26" height="26" viewBox="0 0 36 36" fill="none" aria-hidden="true">' +
        '<path d="M6.5 18.5h23a11.5 11.5 0 01-23 0z" fill="#EE2737"/>' +
        '<rect x="13" y="29" width="10" height="2.6" rx="1.3" fill="#B91C1C"/>' +
        '<path d="M7.5 17.5h21" stroke="#FFF0ED" stroke-width="2" stroke-linecap="round"/>' +
        '<path d="M12.5 12.5c0-1.4 1.1-2.2 1.1-3.5M18 11.8c0-1.6 1.1-2.4 1.1-3.8M23.5 12.5c0-1.4 1.1-2.2 1.1-3.5" stroke="#FB923C" stroke-width="2" stroke-linecap="round"/>' +
        '<path d="M26.5 7.5l2.5 2.5-3.5 4.5" stroke="#B91C1C" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>'
    };
  }
  if (/barang|paket|kirim|dokumen|box|📦/.test(key)) {
    return {
      boxClass: 'svc-box-paket',
      label: 'Kirim Paket',
      svg: '<svg width="26" height="26" viewBox="0 0 36 36" fill="none" aria-hidden="true">' +
        '<rect x="6" y="10" width="24" height="20" rx="4.5" fill="#0088FF"/>' +
        '<path d="M6 15.5h24" stroke="#EBF5FF" stroke-width="2.2"/>' +
        '<path d="M14.5 10h7v10.5l-3.5-2.2-3.5 2.2V10z" fill="#60A5FA"/>' +
        '<rect x="10" y="23" width="7.5" height="3" rx="1.5" fill="#EBF5FF"/>' +
      '</svg>'
    };
  }
  return {
    boxClass: 'svc-box-ojek',
    label: 'Ojek',
    svg: '<svg width="26" height="26" viewBox="0 0 36 36" fill="none" aria-hidden="true">' +
      '<circle cx="10.5" cy="25.5" r="4.2" fill="#E8F8EE" stroke="#00AA13" stroke-width="2.6"/>' +
      '<circle cx="26.5" cy="25.5" r="4.2" fill="#E8F8EE" stroke="#00AA13" stroke-width="2.6"/>' +
      '<path d="M10.5 25.5L15 18h7.5l4 7.5" stroke="#008A10" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M21 12.5h4l2 5.5" stroke="#008A10" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M12.5 12a4.5 4.5 0 019 0v2.5h-9V12z" fill="#00AA13"/>' +
      '<path d="M15.5 11.5h5" stroke="#E8F8EE" stroke-width="1.8" stroke-linecap="round"/>' +
    '</svg>'
  };
}

function getDriverVectorSvg(size) {
  size = size || 22;
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
    '<path d="M9 14a7 7 0 0114 0v2.5H9V14z" fill="#064E3B"/>' +
    '<path d="M12.5 13h8.5a2 2 0 010 3h-8.5v-3z" fill="#6EE7B7"/>' +
    '<path d="M7.5 27c0-4.4 3.8-7.5 8.5-7.5s8.5 3.1 8.5 7.5" fill="#047857"/>' +
    '<path d="M16 19.5V27" stroke="#ECFDF5" stroke-width="2" stroke-linecap="round"/>' +
  '</svg>';
}

function getActiveTariffList() {
  var list = (state.tariffs || []).filter(function (t) {
    return t.Status === 'Aktif' || t.Status === 'Active';
  });
  if (!list.length && (state.services || []).length) {
    return state.services.map(function (s) {
      return {
        ID_Layanan: s.ID,
        Nama_Layanan: s.Name,
        Ikon: s.Icon || 'ojek',
        Tarif_Minimal: Number(s.BasePrice || 0),
        Jarak_Minimal_Km: 2,
        Tarif_Per_Km: 2500,
        Status: 'Aktif'
      };
    });
  }
  return list;
}

function getSelectedTariff() {
  var list = getActiveTariffList();
  return list.find(function (t) { return t.ID_Layanan === state.selectedServiceId; }) || list[0] || null;
}

function calculateSelectedFare() {
  var t = getSelectedTariff();
  var minFare = t ? Math.max(0, Number(t.Tarif_Minimal || 0)) : 0;
  var minKm = t ? Math.max(0, Number(t.Jarak_Minimal_Km || 0)) : 0;
  var perKm = t ? Math.max(0, Number(t.Tarif_Per_Km || 0)) : 0;
  var dist = Math.max(0, Math.round(Number(state.distanceKm || 0) * 10) / 10);
  var extraKm = Math.max(0, Math.round((dist - minKm) * 10) / 10);
  var extraFare = Math.round(extraKm * perKm);
  return {
    tariff: t,
    distanceKm: dist,
    baseFare: minFare,
    minKm: minKm,
    perKm: perKm,
    extraKm: extraKm,
    extraFare: extraFare,
    subtotal: minFare + extraFare
  };
}

function renderServices() {
  var grid = document.getElementById('servicesGrid');
  var select = document.getElementById('orderServiceSelect');
  if (!grid || !select) return;
  var list = getActiveTariffList();

  if (!list.length) {
    grid.innerHTML = '<p class="text-muted">Belum ada layanan aktif.</p>';
    select.innerHTML = '';
    return;
  }

  if (!state.selectedServiceId || !list.some(function (s) { return s.ID_Layanan === state.selectedServiceId; })) {
    state.selectedServiceId = list[0].ID_Layanan;
  }

  grid.innerHTML = list.map(function (s) {
    var meta = getServiceVectorMeta(s);
    return ('\n' +
      '          <div class="service-card ' + (s.ID_Layanan === state.selectedServiceId ? 'selected' : '') + '" onclick="chooseServiceAndOrder(\'' + (escHtml(s.ID_Layanan)) + '\')">\n' +
      '            <div class="service-icon-box ' + (meta.boxClass) + '">' + (meta.svg) + '</div>\n' +
      '            <h3>' + (escHtml(s.Nama_Layanan)) + '</h3>\n' +
      '            <p>Mulai ' + (formatRp(s.Tarif_Minimal)) + ' (' + (Number(s.Jarak_Minimal_Km || 0)) + ' km) +' + (formatRp(s.Tarif_Per_Km)) + '/km</p>\n' +
      '            <span class="service-price-tag">' + (formatRp(s.Tarif_Minimal)) + ' · Pesan</span>\n' +
      '          </div>\n' +
      '        ');
  }).join('');

  select.innerHTML = list.map(function (s) {
    return ('\n' +
      '          <option value="' + (escHtml(s.ID_Layanan)) + '" ' + (s.ID_Layanan === state.selectedServiceId ? 'selected' : '') + '>\n' +
      '            ' + (escHtml(s.Nama_Layanan)) + ' — Min ' + (formatRp(s.Tarif_Minimal)) + ' (' + (Number(s.Jarak_Minimal_Km || 0)) + ' km) + ' + (formatRp(s.Tarif_Per_Km)) + '/km\n' +
      '          </option>\n' +
      '        ');
  }).join('');
}

function selectService(id) {
  state.selectedServiceId = id;
  renderServices();
  refreshRouteFareBadge();
  updateOrderSummary();
}

function chooseServiceAndOrder(id) {
  selectService(id);
  if (!state.googleUser || !state.googleUser.email) {
    state.pendingPostLoginAction = { type: 'orderForm', focusDetails: true };
    loginWithGoogleCustomer();
    return;
  }
  var formEl = document.getElementById('orderFormSection');
  if (formEl) {
    formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  setTimeout(function () {
    if (cepuMapInstance) cepuMapInstance.invalidateSize();
  }, 280);
}

function onServiceChange() {
  var sel = document.getElementById('orderServiceSelect');
  if (sel) selectService(sel.value);
}

function isInsideCepuBounds(lat, lng) {
  return lat >= CEPU_BOUNDS_ARR[0][0] && lat <= CEPU_BOUNDS_ARR[1][0] &&
    lng >= CEPU_BOUNDS_ARR[0][1] && lng <= CEPU_BOUNDS_ARR[1][1];
}

function clampToCepuBounds(lat, lng) {
  return [
    Math.min(CEPU_BOUNDS_ARR[1][0], Math.max(CEPU_BOUNDS_ARR[0][0], lat)),
    Math.min(CEPU_BOUNDS_ARR[1][1], Math.max(CEPU_BOUNDS_ARR[0][1], lng))
  ];
}

function haversineKm(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getPolylineMidpoint(latlngs) {
  if (!latlngs || !latlngs.length) return CEPU_CENTER;
  if (latlngs.length === 1) return latlngs[0];
  var total = 0;
  var segLens = [];
  for (var i = 0; i < latlngs.length - 1; i++) {
    var d = haversineKm(latlngs[i][0], latlngs[i][1], latlngs[i + 1][0], latlngs[i + 1][1]);
    segLens.push(d);
    total += d;
  }
  if (total <= 0) return latlngs[0];
  var half = total / 2;
  var acc = 0;
  for (var j = 0; j < segLens.length; j++) {
    if (acc + segLens[j] >= half) {
      var ratio = segLens[j] > 0 ? (half - acc) / segLens[j] : 0;
      var lat = latlngs[j][0] + (latlngs[j + 1][0] - latlngs[j][0]) * ratio;
      var lng = latlngs[j][1] + (latlngs[j + 1][1] - latlngs[j][1]) * ratio;
      return [lat, lng];
    }
    acc += segLens[j];
  }
  return latlngs[Math.floor(latlngs.length / 2)];
}

function makePinIcon(label, type) {
  return L.divIcon({
    className: 'cepu-pin-wrap',
    html: '<div class="cepu-pin-badge pin-' + type + '">' + escHtml(label) + '</div>',
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
}

function initCepuMap() {
  var mapEl = document.getElementById('cepuMap');
  if (!mapEl || typeof L === 'undefined') {
    if (mapEl) mapEl.innerHTML = '<div style="padding:24px; text-align:center; font-size:13px; color:#555;">Peta Leaflet tidak dapat dimuat. Pastikan koneksi internet aktif.</div>';
    refreshRouteFareBadge();
    return;
  }
  if (cepuMapInstance) return;

  var cepuBounds = L.latLngBounds(CEPU_BOUNDS_ARR[0], CEPU_BOUNDS_ARR[1]);
  cepuMapInstance = L.map('cepuMap', {
    center: CEPU_CENTER,
    zoom: 14,
    minZoom: 12,
    maxZoom: 18,
    maxBounds: cepuBounds,
    maxBoundsViscosity: 0.95
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 18
  }).addTo(cepuMapInstance);

  pickupMarker = L.marker([state.pickup.lat, state.pickup.lng], {
    draggable: true,
    icon: makePinIcon('Jemput', 'pickup'),
    zIndexOffset: 500
  }).addTo(cepuMapInstance);

  dropoffMarker = L.marker([state.dropoff.lat, state.dropoff.lng], {
    draggable: true,
    icon: makePinIcon('Tujuan', 'dropoff'),
    zIndexOffset: 500
  }).addTo(cepuMapInstance);

  pickupMarker.on('drag', function () {
    var ll = pickupMarker.getLatLng();
    var clamped = clampToCepuBounds(ll.lat, ll.lng);
    if (clamped[0] !== ll.lat || clamped[1] !== ll.lng) {
      pickupMarker.setLatLng(clamped);
    }
    state.pickup.lat = clamped[0];
    state.pickup.lng = clamped[1];
    drawStraightPreviewAndBadge();
  });
  pickupMarker.on('dragend', function () {
    var ll = pickupMarker.getLatLng();
    setPinPosition('pickup', ll.lat, ll.lng, '', false);
  });

  dropoffMarker.on('drag', function () {
    var ll = dropoffMarker.getLatLng();
    var clamped = clampToCepuBounds(ll.lat, ll.lng);
    if (clamped[0] !== ll.lat || clamped[1] !== ll.lng) {
      dropoffMarker.setLatLng(clamped);
    }
    state.dropoff.lat = clamped[0];
    state.dropoff.lng = clamped[1];
    drawStraightPreviewAndBadge();
  });
  dropoffMarker.on('dragend', function () {
    var ll = dropoffMarker.getLatLng();
    setPinPosition('dropoff', ll.lat, ll.lng, '', false);
  });

  cepuMapInstance.on('click', function (e) {
    closeMapSearchResults();
    setPinPosition(state.mapPinMode, e.latlng.lat, e.latlng.lng, '', false);
  });

  updateCoordDisplays();
  fetchOsrmRoute();
  setTimeout(function () {
    if (cepuMapInstance) cepuMapInstance.invalidateSize();
  }, 250);
}

function setMapPinMode(mode) {
  state.mapPinMode = mode === 'dropoff' ? 'dropoff' : 'pickup';
  var pBtn = document.getElementById('pinModePickupBtn');
  var dBtn = document.getElementById('pinModeDropoffBtn');
  if (pBtn) pBtn.className = 'map-mode-btn' + (state.mapPinMode === 'pickup' ? ' active-pickup' : '');
  if (dBtn) dBtn.className = 'map-mode-btn' + (state.mapPinMode === 'dropoff' ? ' active-dropoff' : '');
}

function updateCoordDisplays() {
  var pEl = document.getElementById('pickupAddrDisplay');
  var dEl = document.getElementById('dropoffAddrDisplay');
  if (pEl) pEl.textContent = state.pickup.address || ('Titik Jemput (' + state.pickup.lat.toFixed(4) + ', ' + state.pickup.lng.toFixed(4) + ')');
  if (dEl) dEl.textContent = state.dropoff.address || ('Titik Tujuan (' + state.dropoff.lat.toFixed(4) + ', ' + state.dropoff.lng.toFixed(4) + ')');
}

function drawStraightPreviewAndBadge() {
  var pts = [[state.pickup.lat, state.pickup.lng], [state.dropoff.lat, state.dropoff.lng]];
  state.routeLatLngs = pts;
  state.distanceKm = Math.round(haversineKm(pts[0][0], pts[0][1], pts[1][0], pts[1][1]) * 1.25 * 10) / 10;
  drawRoutePolylines(pts, true);
  refreshRouteFareBadge();
  updateOrderSummary();
}

function drawRoutePolylines(latlngs, isDashed) {
  if (!cepuMapInstance || typeof L === 'undefined') return;
  if (routeLineShadow) cepuMapInstance.removeLayer(routeLineShadow);
  if (routeLineMain) cepuMapInstance.removeLayer(routeLineMain);

  routeLineShadow = L.polyline(latlngs, {
    color: '#064E3B',
    weight: 8,
    opacity: 0.25,
    lineJoin: 'round',
    dashArray: isDashed ? '8, 8' : null
  }).addTo(cepuMapInstance);

  routeLineMain = L.polyline(latlngs, {
    color: '#00AA13',
    weight: 4.5,
    opacity: 0.96,
    lineJoin: 'round',
    dashArray: isDashed ? '8, 8' : null
  }).addTo(cepuMapInstance);
}

function refreshRouteFareBadge() {
  var fare = calculateSelectedFare();
  var distDisp = document.getElementById('routeDistanceDisplay');
  var fareDisp = document.getElementById('routeFarePreviewDisplay');
  if (distDisp) distDisp.textContent = 'Jarak Rute: ' + fare.distanceKm.toFixed(1) + ' km';
  if (fareDisp) fareDisp.textContent = 'Estimasi: ' + formatRp(fare.subtotal);

  if (!cepuMapInstance || typeof L === 'undefined') return;
  var mid = getPolylineMidpoint(state.routeLatLngs);
  var badgeHtml = '<div class="route-fare-badge">' +
    '<span class="rfb-price">' + escHtml(formatRp(fare.subtotal)) + '</span>' +
    '<span class="rfb-dist">' + escHtml(fare.distanceKm.toFixed(1) + ' km') + '</span>' +
  '</div>';

  var icon = L.divIcon({
    className: 'route-fare-badge-wrap',
    html: badgeHtml,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });

  if (routeFareMarker) {
    routeFareMarker.setLatLng(mid);
    routeFareMarker.setIcon(icon);
  } else {
    routeFareMarker = L.marker(mid, {
      interactive: false,
      zIndexOffset: 1000,
      icon: icon
    }).addTo(cepuMapInstance);
  }
}

async function fetchOsrmRoute() {
  var seq = ++state.routeReqSeq;
  var p = state.pickup;
  var d = state.dropoff;
  var distDisp = document.getElementById('routeDistanceDisplay');
  if (distDisp) distDisp.textContent = 'Menghitung rute jalan raya OSRM...';

  var url = 'https://router.project-osrm.org/route/v1/driving/' +
    p.lng.toFixed(6) + ',' + p.lat.toFixed(6) + ';' +
    d.lng.toFixed(6) + ',' + d.lat.toFixed(6) +
    '?overview=full&geometries=geojson';

  try {
    var resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    if (seq !== state.routeReqSeq) return;
    if (data && data.code === 'Ok' && data.routes && data.routes.length) {
      var route = data.routes[0];
      var latlngs = (route.geometry && route.geometry.coordinates || []).map(function (c) {
        return [c[1], c[0]];
      });
      if (!latlngs.length) latlngs = [[p.lat, p.lng], [d.lat, d.lng]];
      state.routeLatLngs = latlngs;
      state.distanceKm = Math.round((Number(route.distance || 0) / 1000) * 10) / 10;
      drawRoutePolylines(latlngs, false);
      refreshRouteFareBadge();
      updateOrderSummary();
      return;
    }
    throw new Error('Rute tidak ditemukan');
  } catch (err) {
    if (seq !== state.routeReqSeq) return;
    drawStraightPreviewAndBadge();
  }
}

function setPinPosition(which, lat, lng, customAddress, shouldPan) {
  var clamped = clampToCepuBounds(lat, lng);
  var target = which === 'dropoff' ? state.dropoff : state.pickup;
  var marker = which === 'dropoff' ? dropoffMarker : pickupMarker;

  target.lat = clamped[0];
  target.lng = clamped[1];
  target.address = customAddress || ('Area Cepu (' + clamped[0].toFixed(4) + ', ' + clamped[1].toFixed(4) + ')');

  if (marker) marker.setLatLng(clamped);
  if (shouldPan && cepuMapInstance) {
    cepuMapInstance.panTo(clamped, { animate: true });
  }
  updateCoordDisplays();
  fetchOsrmRoute();

  if (!customAddress) {
    reverseGeocodePin(which, clamped[0], clamped[1]);
  }
}

async function reverseGeocodePin(which, lat, lng) {
  try {
    var url = 'https://nominatim.openstreetmap.org/reverse?format=json&zoom=17&addressdetails=1&lat=' +
      encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lng);
    var resp = await fetch(url, { headers: { 'Accept-Language': 'id' } });
    if (!resp.ok) return;
    var data = await resp.json();
    if (data && data.display_name) {
      var shortAddr = data.display_name.split(',').slice(0, 3).join(',').trim();
      var target = which === 'dropoff' ? state.dropoff : state.pickup;
      if (Math.abs(target.lat - lat) < 0.0002 && Math.abs(target.lng - lng) < 0.0002) {
        target.address = shortAddr + ' (' + lat.toFixed(4) + ', ' + lng.toFixed(4) + ')';
        updateCoordDisplays();
      }
    }
  } catch (e) {}
}

function locateUserGPS() {
  if (!navigator.geolocation) {
    showToast('Browser Anda tidak mendukung GPS.', 'error');
    return;
  }
  var btn = document.getElementById('gpsLocateBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Mencari GPS...';
  }
  navigator.geolocation.getCurrentPosition(function (pos) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/></svg> Lokasi Saya';
    }
    var lat = pos.coords.latitude;
    var lng = pos.coords.longitude;
    if (!isInsideCepuBounds(lat, lng)) {
      showToast('Lokasi GPS Anda di luar batas wilayah Cepu. Silakan geser pin langsung di peta Cepu.', 'error');
      return;
    }
    setPinPosition(state.mapPinMode, lat, lng, '', true);
    showToast('Lokasi GPS berhasil dipasang sebagai ' + (state.mapPinMode === 'pickup' ? 'Titik Jemput' : 'Titik Tujuan') + '.', 'success');
  }, function (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/></svg> Lokasi Saya';
    }
    showToast('Gagal mengambil lokasi GPS: ' + (err.message || 'Izin ditolak'), 'error');
  }, { enableHighAccuracy: true, timeout: 10000 });
}

function closeMapSearchResults() {
  var box = document.getElementById('mapSearchResults');
  if (box) box.classList.remove('open');
}

async function searchCepuAddress() {
  var inputEl = document.getElementById('mapSearchInput');
  var box = document.getElementById('mapSearchResults');
  var btn = document.getElementById('mapSearchBtn');
  if (!inputEl || !box) return;
  var q = inputEl.value.trim();
  if (!q) {
    closeMapSearchResults();
    return;
  }
  var queryText = /cepu/i.test(q) ? q : (q + ', Cepu');
  if (btn) btn.disabled = true;
  box.innerHTML = '<div class="map-search-item">Mencari alamat di Cepu...</div>';
  box.classList.add('open');

  try {
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=id&bounded=1&viewbox=111.500,-7.065,111.680,-7.235&q=' + encodeURIComponent(queryText);
    var resp = await fetch(url, { headers: { 'Accept-Language': 'id' } });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var items = await resp.json();
    state.mapSearchResults = Array.isArray(items) ? items : [];
    if (!state.mapSearchResults.length) {
      box.innerHTML = '<div class="map-search-item">Alamat tidak ditemukan di area Cepu. Coba kata kunci lain (mis. Balun, Ngelo, Stasiun Cepu).</div>';
      return;
    }
    box.innerHTML = state.mapSearchResults.map(function (item, idx) {
      return '<button type="button" class="map-search-item" onclick="selectNominatimResult(' + idx + ')">' + escHtml(item.display_name) + '</button>';
    }).join('');
  } catch (err) {
    box.innerHTML = '<div class="map-search-item">Gagal mencari alamat. Silakan klik atau geser pin di peta.</div>';
  } finally {
    if (btn) btn.disabled = false;
  }
}

function selectNominatimResult(idx) {
  var item = (state.mapSearchResults || [])[idx];
  closeMapSearchResults();
  if (!item) return;
  var lat = Number(item.lat);
  var lng = Number(item.lon);
  var shortAddr = String(item.display_name || '').split(',').slice(0, 3).join(',').trim();
  setPinPosition(state.mapPinMode, lat, lng, shortAddr + ' (' + lat.toFixed(4) + ', ' + lng.toFixed(4) + ')', true);
  var inputEl = document.getElementById('mapSearchInput');
  if (inputEl) inputEl.value = shortAddr;
}

function renderDriverAvatarInner(photoUrl, name) {
  var safeAlt = escHtml(name || 'Driver');
  if (photoUrl) {
    return '<img src="' + escHtml(photoUrl) + '" alt="' + safeAlt + '" onerror="this.outerHTML=getDriverVectorSvg(22)" />';
  }
  return getDriverVectorSvg(22);
}

function renderDriversSelect() {
  var hiddenInput = document.getElementById('orderDriverSelect');
  var grid = document.getElementById('driverCardsGrid');
  if (!grid) return;

  var list = (state.drivers || []).filter(function (d) {
    var st = String(d.Status || '').toUpperCase();
    var app = String(d.ApprovalStatus || '').toUpperCase();
    return st !== 'INACTIVE' && st !== 'NONAKTIF' && st !== 'PENDING' && st !== 'DELETED' && app !== 'PENDING' && app !== 'MENUNGGU' && app !== 'DITOLAK' && d.ApprovalStatus !== 'Nonaktif';
  });
  if (hiddenInput) hiddenInput.value = state.selectedDriverId || '';

  var cardsHtml = [
    '<div class="driver-pick-card ' + (!state.selectedDriverId ? 'selected' : '') + '" onclick="selectDriverCard(\'\')">' +
      '<div class="driver-avatar-circle" style="background:#ECFDF5;">' + getDriverVectorSvg(22) + '</div>' +
      '<div class="driver-pick-meta">' +
        '<div class="driver-pick-name">Driver Terdekat</div>' +
        '<div class="driver-pick-sub">Carikan driver otomatis</div>' +
        '<span class="driver-pick-badge">Cepat &amp; Siap</span>' +
      '</div>' +
    '</div>'
  ];

  list.forEach(function (d) {
    var st = d.ApprovalStatus || 'Standby';
    var stCls = st === 'Sibuk' ? 'is-sibuk' : 'is-standby';
    var veh = d.VehicleType ? d.VehicleType : 'Motor';
    var isSel = state.selectedDriverId === d.ID;
    cardsHtml.push(
      '<div class="driver-pick-card ' + (isSel ? 'selected' : '') + '" onclick="selectDriverCard(\'' + escHtml(d.ID) + '\')">' +
        '<div class="driver-avatar-circle" style="background:#ECFDF5;">' + renderDriverAvatarInner(d.PhotoURL, d.FullName) + '</div>' +
        '<div class="driver-pick-meta">' +
          '<div class="driver-pick-name">' + escHtml(d.FullName) + '</div>' +
          '<div class="driver-pick-sub">' + escHtml(veh) + (d.Area ? ' · ' + escHtml(d.Area) : '') + '</div>' +
          '<span class="driver-pick-badge ' + stCls + '">' + escHtml(st) + '</span>' +
        '</div>' +
      '</div>'
    );
  });

  grid.innerHTML = cardsHtml.join('');
  onDriverChange();
}

function selectDriverCard(driverId) {
  state.selectedDriverId = driverId || '';
  var hiddenInput = document.getElementById('orderDriverSelect');
  if (hiddenInput) hiddenInput.value = state.selectedDriverId;
  renderDriversSelect();
}

function onDriverChange() {
  var select = document.getElementById('orderDriverSelect');
  var hint = document.getElementById('driverInfoHint');
  if (!select) return;
  state.selectedDriverId = select.value;
  if (!hint) return;
  if (!state.selectedDriverId) {
    hint.textContent = 'Order langsung diteruskan ke driver Cepu yang sedang standby.';
    return;
  }
  var drv = (state.drivers || []).find(function (d) { return d.ID === state.selectedDriverId; });
  if (drv) {
    hint.textContent = 'Terhubung ke WhatsApp ' + drv.FullName + (drv.Area ? ' (Area: ' + drv.Area + ')' : '') + '.';
  }
}

function applyQuickTask(serviceId, textPrefix) {
  var list = getActiveTariffList();
  var targetSrv = list.find(function (s) { return s.ID_Layanan === serviceId; });
  if (!targetSrv && serviceId === 'SRV-BELI') {
    targetSrv = list.find(function (s) {
      return /makan|beli|belanja|kurir/i.test(String(s.Nama_Layanan || ''));
    });
  } else if (!targetSrv && serviceId === 'SRV-ANTAR') {
    targetSrv = list.find(function (s) {
      return /barang|antar/i.test(String(s.Nama_Layanan || ''));
    });
  }
  if (targetSrv) {
    selectService(targetSrv.ID_Layanan);
  }
  var detailEl = document.getElementById('orderDetails');
  if (detailEl) {
    detailEl.value = textPrefix;
  }
  if (!state.googleUser || !state.googleUser.email) {
    state.pendingPostLoginAction = { type: 'orderForm', focusDetails: true };
    loginWithGoogleCustomer();
    return;
  }
  scrollToOrderForm();
  setTimeout(function () {
    if (detailEl) detailEl.focus();
  }, 250);
}

function renderPromoChips() {
  var row = document.getElementById('promoChipsRow');
  if (!row) return;
  var active = (state.promos || []).filter(function (p) { return p.Status === 'Active'; });
  if (!active.length) {
    row.innerHTML = '';
    return;
  }
  var activeCode = state.appliedPromo ? String(state.appliedPromo.Code).toUpperCase() : '';
  row.innerHTML = active.map(function (p) {
    var code = String(p.Code || '').toUpperCase();
    var isApplied = activeCode === code;
    return '<button type="button" class="promo-chip ' + (isApplied ? 'active' : '') + '" onclick="applyPromoChip(\'' + escHtml(code) + '\')">' + escHtml(code) + ' (-' + formatRp(p.DiscountAmount) + ')</button>';
  }).join('');
}

function applyPromoChip(code) {
  var inputEl = document.getElementById('orderPromoInput');
  if (inputEl) inputEl.value = code;
  applyPromoCode();
}

function onPromoInputEdit() {
  var inputEl = document.getElementById('orderPromoInput');
  var fb = document.getElementById('promoFeedback');
  var val = inputEl ? inputEl.value.trim().toUpperCase() : '';
  if (!val || (state.appliedPromo && String(state.appliedPromo.Code).toUpperCase() !== val)) {
    state.appliedPromo = null;
    if (fb) fb.textContent = '';
    renderPromoChips();
    updateOrderSummary();
  }
}

function applyPromoCode() {
  var inputEl = document.getElementById('orderPromoInput');
  var fb = document.getElementById('promoFeedback');
  if (!inputEl || !fb) return;

  var code = inputEl.value.trim().toUpperCase();
  if (!code) {
    state.appliedPromo = null;
    fb.textContent = '';
    renderPromoChips();
    updateOrderSummary();
    return;
  }

  var found = (state.promos || []).find(function (p) {
    return String(p.Code).toUpperCase() === code && p.Status === 'Active';
  });
  if (!found) {
    state.appliedPromo = null;
    fb.style.color = 'var(--danger)';
    fb.textContent = 'Kode promo tidak ditemukan atau tidak aktif.';
    renderPromoChips();
    updateOrderSummary();
    return;
  }

  var fare = calculateSelectedFare();
  if (fare.subtotal < Number(found.MinOrder || 0)) {
    state.appliedPromo = null;
    fb.style.color = 'var(--danger)';
    fb.textContent = 'Minimal ongkir untuk promo ini ' + formatRp(found.MinOrder) + '.';
    renderPromoChips();
    updateOrderSummary();
    return;
  }

  state.appliedPromo = found;
  fb.style.color = 'var(--success)';
  fb.textContent = 'Promo ' + found.Code + ' aktif! Potongan ' + formatRp(found.DiscountAmount) + '.';
  renderPromoChips();
  updateOrderSummary();
}

function updateOrderSummary() {
  var fare = calculateSelectedFare();
  var discount = 0;

  if (state.appliedPromo) {
    if (fare.subtotal >= Number(state.appliedPromo.MinOrder || 0)) {
      discount = Number(state.appliedPromo.DiscountAmount || 0);
    } else {
      var fb = document.getElementById('promoFeedback');
      if (fb) {
        fb.style.color = 'var(--danger)';
        fb.textContent = 'Minimal ongkir untuk promo ' + state.appliedPromo.Code + ' adalah ' + formatRp(state.appliedPromo.MinOrder) + '.';
      }
      state.appliedPromo = null;
      renderPromoChips();
    }
  }

  var total = Math.max(0, fare.subtotal - discount);
  var sumBaseLabel = document.getElementById('sumBasePriceLabel');
  var sumBase = document.getElementById('sumBasePrice');
  var extraRow = document.getElementById('sumExtraDistRow');
  var extraLabel = document.getElementById('sumExtraDistLabel');
  var extraPrice = document.getElementById('sumExtraDistPrice');
  var discRow = document.getElementById('sumDiscountRow');
  var sumDisc = document.getElementById('sumDiscount');
  var sumTotLabel = document.getElementById('sumTotalLabel');
  var sumTot = document.getElementById('sumTotal');

  if (sumBaseLabel) sumBaseLabel.textContent = 'Tarif Minimal (s.d. ' + fare.minKm + ' km)';
  if (sumBase) sumBase.textContent = formatRp(fare.baseFare);
  if (extraRow && extraLabel && extraPrice) {
    if (fare.extraFare > 0) {
      extraRow.style.display = 'flex';
      extraLabel.textContent = 'Tambahan Jarak (' + fare.extraKm.toFixed(1) + ' km × ' + formatRp(fare.perKm) + ')';
      extraPrice.textContent = formatRp(fare.extraFare);
    } else {
      extraRow.style.display = 'none';
    }
  }
  if (discRow && sumDisc) {
    if (discount > 0) {
      discRow.style.display = 'flex';
      sumDisc.textContent = '-' + formatRp(discount);
    } else {
      discRow.style.display = 'none';
    }
  }
  if (sumTotLabel) sumTotLabel.textContent = 'Estimasi Ongkir (' + fare.distanceKm.toFixed(1) + ' km)';
  if (sumTot) sumTot.textContent = formatRp(total);
}

function saveOrderToLocalHistory(orderObj) {
  try {
    var list = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCAL_ORDERS) || '[]');
    list.unshift(orderObj);
    localStorage.setItem(STORAGE_KEYS.LOCAL_ORDERS, JSON.stringify(list.slice(0, 20)));
  } catch (e) {}
}

async function handleOrderSubmit(e) {
  e.preventDefault();
  if (!state.googleUser || !state.googleUser.email) {
    showToast('Silakan login dengan akun Google terlebih dahulu sebelum mengirim order.', 'error');
    scrollToOrderForm();
    return;
  }

  var btn = document.getElementById('submitOrderBtn');
  var serviceId = document.getElementById('orderServiceSelect').value;
  var driverSelect = document.getElementById('orderDriverSelect');
  var driverId = driverSelect ? driverSelect.value : '';
  var itemDetails = document.getElementById('orderDetails').value.trim();
  var customerName = document.getElementById('orderCustName').value.trim() || state.googleUser.displayName;
  var rawPhoneEl = document.getElementById('orderCustPhone');
  var rawCustPhone = rawPhoneEl ? rawPhoneEl.value.trim() : '';
  var customerPhone = formatWhatsAppNumber(rawCustPhone);
  var customerEmail = state.googleUser.email;
  var notes = document.getElementById('orderNotes').value.trim();
  var promoCode = state.appliedPromo ? state.appliedPromo.Code : '';

  if (!itemDetails || !customerName) {
    showToast('Mohon lengkapi nama dan detail pesanan Anda.', 'error');
    return;
  }

  if (!isValidWhatsAppNumber(customerPhone)) {
    showToast('Nomor WhatsApp aktif wajib diisi dengan format yang valid (contoh: 0812xxxxxxxx).', 'error');
    if (rawPhoneEl) rawPhoneEl.focus();
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Memproses Pesanan...';

  var srv = getSelectedTariff();
  var srvName = srv ? srv.Nama_Layanan : 'Layanan SuruhAja';
  var srvId = srv ? srv.ID_Layanan : serviceId;
  var drv = driverId ? (state.drivers || []).find(function (d) { return d.ID === driverId; }) : null;
  var driverCleanName = drv ? drv.FullName : 'Admin / Driver Cepu';
  var driverLabel = drv ? (drv.FullName + (drv.VehicleType ? ' (' + drv.VehicleType + ')' : '')) : 'Driver Tersedia (Acak)';
  var targetWa = formatWhatsAppNumber((drv && drv.PhoneWA) ? drv.PhoneWA : state.whatsappNumber);
  var fare = calculateSelectedFare();

  try {
    localStorage.setItem(STORAGE_KEYS.CUST_NAME, customerName);
    localStorage.setItem(STORAGE_KEYS.CUST_PHONE, rawCustPhone);
  } catch (errName) {}

  try {
    var token = getAuthToken();
    var res = await SuruhAjaAPI.createOrder({
      customerName: customerName,
      googleName: state.googleUser.displayName || customerName,
      customerEmail: customerEmail,
      customerPhone: customerPhone,
      serviceId: srvId,
      driverId: driverId,
      itemDetails: itemDetails,
      notes: notes,
      promoCode: promoCode,
      pickupLat: state.pickup.lat,
      pickupLng: state.pickup.lng,
      dropoffLat: state.dropoff.lat,
      dropoffLng: state.dropoff.lng,
      pickupAddress: state.pickup.address,
      dropoffAddress: state.dropoff.address,
      distanceKm: fare.distanceKm
    }, token);

    if (res && res.success && res.data) {
      var savedOrderObj = {
        ID: res.data.orderId,
        OrderCode: res.data.orderCode,
        CustomerName: customerName,
        CustomerPhone: customerPhone,
        CustomerEmail: customerEmail,
        ServiceID: srvId,
        ServiceName: (res.data.serviceName || srvName) + ' · ' + fare.distanceKm.toFixed(1) + ' km (' + (res.data.driverName || driverLabel) + ')',
        RouteID: res.data.driverId || driverId || 'AUTO',
        RouteName: res.data.driverName || driverLabel,
        DriverName: res.data.driverCleanName || driverCleanName,
        DriverPhoneWA: res.data.driverPhone || targetWa,
        DriverVehicle: res.data.driverVehicle || (drv ? drv.VehicleType : ''),
        DriverPlate: res.data.driverPlate || (drv ? drv.PlateNumber : ''),
        PickupAddress: res.data.pickupAddress || state.pickup.address,
        DropoffAddress: res.data.dropoffAddress || state.dropoff.address,
        ItemDetails: itemDetails,
        Notes: notes,
        EstimatedTotal: res.data.estimatedTotal,
        OrderStatus: 'Baru',
        CreatedAt: new Date().toISOString()
      };
      saveOrderToLocalHistory(savedOrderObj);
      showOrderSuccessModal(res.data.orderCode, res.data.estimatedTotal, res.data.whatsappUrl, res.data.driverName || driverLabel, savedOrderObj);
    } else {
      showToast(res ? res.message : 'Gagal membuat pesanan.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Pesan Sekarang';
  }
}

function showOrderSuccessModal(code, total, waUrl, driverName, orderObj) {
  state.lastWaUrl = waUrl || '';
  setElText('succOrderCode', code);
  setElText('succDriverName', driverName || 'Driver Tersedia');
  setElText('succOrderTotal', formatRp(total));
  var waLinkEl = document.getElementById('succWaLink');
  if (waLinkEl) waLinkEl.href = waUrl;

  var o = orderObj || {};
  var cleanDrv = o.DriverName || String(driverName || 'Driver SuruhAja').replace(/\s*\([^)]*\)\s*$/, '').trim();
  var vehInfo = [o.DriverVehicle, o.DriverPlate].filter(Boolean).join(' - ');
  setElText('succDriverCardName', cleanDrv || 'Driver SuruhAja');
  setElText('succDriverCardMeta', vehInfo || 'Siap menerima pesanan & menuju lokasi jemput');
  var chatDriverEl = document.getElementById('succChatDriverLink');
  if (chatDriverEl) chatDriverEl.href = buildCustomerToDriverWaUrl(Object.assign({}, o, { OrderCode: code, DriverName: cleanDrv }));

  openModal('orderSuccessModal');
  var orderFormEl = document.getElementById('orderForm');
  if (orderFormEl) orderFormEl.reset();
  restoreSavedCustomerName();
  state.selectedDriverId = '';
  state.appliedPromo = null;
  setElText('promoFeedback', '');
  renderServices();
  renderDriversSelect();
  renderPromoChips();
  updateOrderSummary();
}

function copyLastOrderMessage() {
  if (!state.lastWaUrl) return;
  var parts = state.lastWaUrl.split('?text=');
  var msg = parts.length > 1 ? decodeURIComponent(parts[1]) : state.lastWaUrl;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg).then(function () {
      showToast('Teks pesanan berhasil disalin!', 'success');
    }).catch(function () {
      showToast('Gagal menyalin otomatis. Silakan klik Lanjut Kirim ke WhatsApp.', 'error');
    });
  } else {
    showToast('Silakan klik tombol Lanjut Kirim ke WhatsApp.', 'info');
  }
}

/* ========================================================================
 * 6. RIWAYAT & STATUS PESANAN PELANGGAN (+ CHAT DRIVER VIA WHATSAPP)
 * ======================================================================== */
async function loadCustomerOrders() {
  renderCustomerOrders();
  if (state.googleUser && state.googleUser.email) {
    try {
      var res = await SuruhAjaAPI.getCustomerOrders(state.googleUser.email);
      if (res && res.success && Array.isArray(res.data)) {
        try {
          localStorage.setItem(STORAGE_KEYS.LOCAL_ORDERS, JSON.stringify(res.data.slice(0, 20)));
        } catch (eStore) {}
        renderCustomerOrders(res.data, true);
      }
    } catch (e) {}
  }
}

function renderCustomerOrders(serverOrders, isFromServer) {
  var container = document.getElementById('customerOrdersList');
  var clearBtn = document.getElementById('clearOrdersBtn');
  if (!container) return;
  var orders = Array.isArray(serverOrders) ? serverOrders.slice() : [];

  if (!isFromServer && !orders.length) {
    try {
      orders = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCAL_ORDERS) || '[]');
    } catch (e) {
      orders = [];
    }
  }

  if (clearBtn) clearBtn.style.display = orders.length ? 'inline-flex' : 'none';

  if (!orders.length) {
    container.innerHTML = '\n' +
      '          <div style="text-align:center; padding:28px 12px;">\n' +
      '            <div style="width:58px; height:58px; margin:0 auto 12px; border-radius:16px; background:#E8F8EE; display:grid; place-items:center;">\n' +
      '              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00AA13" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>\n' +
      '            </div>\n' +
      '            <p class="text-muted">Belum ada riwayat pesanan.</p>\n' +
      '            <button type="button" class="btn-pill btn-primary mt-12" onclick="scrollToOrderForm()">Pesan Sekarang</button>\n' +
      '          </div>';
    return;
  }

  container.innerHTML = orders.map(function (o, idx) {
    var st = String(o.OrderStatus || 'Baru');
    var badgeCls = st === 'Selesai' ? 'badge-done' : st === 'Dibatalkan' ? 'badge-cancel' : 'badge-process';
    var isRunning = st !== 'Selesai' && st !== 'Dibatalkan';
    var drvName = o.DriverName || String(o.RouteName || 'Driver SuruhAja').replace(/\s*\([^)]*\)\s*$/, '').trim();
    var drvVeh = [o.DriverVehicle, o.DriverPlate].filter(Boolean).join(' - ');
    var chatDriverUrl = buildCustomerToDriverWaUrl(o);
    return ('\n' +
      '          <div class="order-history-card">\n' +
      '            <div class="flex-between">\n' +
      '              <strong>' + (escHtml(o.OrderCode || 'SRH')) + '</strong>\n' +
      '              <span class="badge ' + (badgeCls) + '">' + (escHtml(st === 'Diproses' ? 'Diterima / Berjalan' : st)) + '</span>\n' +
      '            </div>\n' +
      '            <div style="font-size:13.5px; font-weight:700;">' + (escHtml(o.ServiceName || 'SuruhAja')) + '</div>\n' +
      '            <div class="text-muted">' + (escHtml(o.ItemDetails || '')) + '</div>\n' +
      '            ' + (o.PickupAddress || o.DropoffAddress ? ('\n' +
      '            <div class="text-muted" style="font-size:11.5px; margin-top:4px;">\n' +
      '              Jemput: ' + (escHtml(o.PickupAddress || '-')) + ' → Antar: ' + (escHtml(o.DropoffAddress || '-')) + '\n' +
      '            </div>') : '') + '\n' +
      '            ' + (isRunning ? ('\n' +
      '            <div class="order-driver-info-card">\n' +
      '              <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">\n' +
      '                <div style="display:flex; align-items:center; gap:9px; min-width:0;">\n' +
      '                  <div class="driver-avatar-circle" style="width:36px; height:36px; background:#FFFFFF;">' + (getDriverVectorSvg(20)) + '</div>\n' +
      '                  <div style="min-width:0;">\n' +
      '                    <div style="font-size:12.5px; font-weight:800; color:#064E3B;">' + (escHtml(drvName)) + '</div>\n' +
      '                    <div style="font-size:11px; color:#047857;">' + (escHtml(drvVeh || (st === 'Diproses' ? 'Driver sedang menuju lokasi' : 'Menunggu konfirmasi driver'))) + '</div>\n' +
      '                  </div>\n' +
      '                </div>\n' +
      '                <span class="badge ' + (st === 'Diproses' ? 'badge-done' : 'badge-process') + '" style="flex-shrink:0;">' + (st === 'Diproses' ? 'Berjalan' : 'Aktif') + '</span>\n' +
      '              </div>\n' +
      '              <a href="' + (escHtml(chatDriverUrl)) + '" target="_blank" rel="noopener" class="btn-wa-chat" style="width:100%;">\n' +
      '                ' + (getWhatsAppIconSvg(16)) + '\n' +
      '                <span>Chat Driver via WhatsApp</span>\n' +
      '              </a>\n' +
      '            </div>') : '') + '\n' +
      '            <div class="flex-between mt-12">\n' +
      '              <div>\n' +
      '                <strong style="color:var(--primary);">' + (formatRp(o.EstimatedTotal)) + '</strong>\n' +
      '                ' + (o.CreatedAt ? ('<div class="text-muted" style="font-size:11px;">' + (escHtml(formatDateSafe(o.CreatedAt))) + '</div>') : '') + '\n' +
      '              </div>\n' +
      '              <button type="button" class="btn-pill btn-soft" style="padding:6px 12px; font-size:12px;" onclick="repeatOrder(' + (idx) + ')">Pesan Lagi</button>\n' +
      '            </div>\n' +
      '          </div>\n' +
      '        ');
  }).join('');

  state._lastDisplayedOrders = orders;
}

function clearCustomerOrdersHistory() {
  if (!confirm('Hapus semua riwayat pesanan lokal di perangkat ini?')) return;
  try {
    localStorage.removeItem(STORAGE_KEYS.LOCAL_ORDERS);
  } catch (e) {}
  renderCustomerOrders([], true);
  showToast('Riwayat pesanan lokal dibersihkan.', 'info');
}

function repeatOrder(idx) {
  var o = (state._lastDisplayedOrders || [])[idx];
  if (!o) return;
  var list = getActiveTariffList();
  if (o.ServiceID && list.some(function (s) { return s.ID_Layanan === o.ServiceID; })) {
    selectService(o.ServiceID);
  }
  document.getElementById('orderDetails').value = o.ItemDetails || '';
  document.getElementById('orderCustName').value = o.CustomerName || '';
  var phoneEl = document.getElementById('orderCustPhone');
  if (phoneEl && o.CustomerPhone && o.CustomerPhone !== '-') {
    phoneEl.value = o.CustomerPhone;
  }
  var cleanNotes = String(o.Notes || '').replace(/^\[Driver:\s*[^\]]+\]\s*/i, '');
  document.getElementById('orderNotes').value = cleanNotes;
  scrollToOrderForm();
  showToast('Data pesanan sebelumnya sudah diisi kembali.', 'success');
}

/* ========================================================================
 * 7. AUTENTIKASI (LOGIN DRIVER & ADMIN, DAFTAR KHUSUS DRIVER, LOGOUT)
 * ======================================================================== */
function normalizePlateLocal(plate) {
  return String(plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeWaLocal(phone) {
  return formatWhatsAppNumber(phone);
}

function getAdminWaitlistWaUrl(msgText) {
  var wa = formatWhatsAppNumber(state.whatsappNumber || '6281234567890');
  var txt = encodeURIComponent(msgText || 'Halo Admin SuruhAja Cepu, saya ingin masuk daftar tunggu pendaftaran Mitra Driver.');
  return 'https://wa.me/' + wa + '?text=' + txt;
}

function getFallbackDriverQuota() {
  var maxQ = Math.max(1, parseInt(state.maxDriverQuota || 15, 10) || 15);
  var activeCount = 0;
  var pendingCount = 0;
  (state.drivers || []).forEach(function (d) {
    var st = String(d.Status || '').toUpperCase();
    var app = String(d.ApprovalStatus || '').toUpperCase();
    if (st === 'DELETED') return;
    if (st === 'PENDING' || app === 'PENDING' || app === 'MENUNGGU') {
      pendingCount++;
    } else if (st !== 'INACTIVE' && st !== 'NONAKTIF' && app !== 'DITOLAK') {
      activeCount++;
    }
  });
  var used = activeCount + pendingCount;
  return {
    maxQuota: maxQ,
    activeCount: activeCount,
    pendingCount: pendingCount,
    usedCount: used,
    remainingSlots: Math.max(0, maxQ - used),
    isFull: used >= maxQ
  };
}

async function ensureGooglePopupSignIn() {
  if (state.googleUser && state.googleUser.email) {
    return state.googleUser;
  }
  if (!state.firebaseReady || typeof firebase === 'undefined' || !firebase.auth) {
    showToast('SDK Firebase belum siap. Coba muat ulang halaman.', 'error');
    return null;
  }
  try {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    var result = await firebase.auth().signInWithPopup(provider);
    var u = result && result.user;
    if (u && u.email) {
      state.googleUser = {
        uid: u.uid,
        displayName: u.displayName || u.email.split('@')[0],
        email: u.email,
        photoURL: u.photoURL || ''
      };
      state.syncedFirebaseUid = u.uid;
      await SuruhAjaAPI.syncFirebaseUser(state.googleUser);
      renderGoogleAuthState();
      return state.googleUser;
    }
    return null;
  } catch (err) {
    var code = err && err.code ? String(err.code) : '';
    showToast('Login Google dibatalkan atau gagal: ' + (err.message || code), 'error');
    return null;
  }
}

function applyRegQuotaView(quota) {
  var loadingBox = document.getElementById('regQuotaLoadingBox');
  var fullBox = document.getElementById('regQuotaFullBox');
  var openWrap = document.getElementById('regOpenWrap');
  var fullText = document.getElementById('regQuotaFullText');
  var waBtn = document.getElementById('regWaitlistWaLink');
  var badge = document.getElementById('regQuotaCountBadge');

  if (loadingBox) loadingBox.style.display = 'none';
  if (quota && quota.isFull) {
    if (fullBox) fullBox.style.display = 'block';
    if (openWrap) openWrap.style.display = 'none';
    if (fullText) {
      fullText.textContent = 'Saat ini kuota mitra sudah penuh (' + quota.usedCount + '/' + quota.maxQuota + ' mitra) demi menjaga pemerataan pemasukan seluruh driver SuruhAja Cepu. Silakan hubungi WhatsApp Admin untuk masuk daftar tunggu.';
    }
    if (waBtn) waBtn.href = getAdminWaitlistWaUrl('Halo Admin SuruhAja Cepu, kuota mitra sedang penuh (' + quota.usedCount + '/' + quota.maxQuota + '). Saya ingin masuk daftar tunggu Mitra Driver.');
  } else {
    if (fullBox) fullBox.style.display = 'none';
    if (openWrap) openWrap.style.display = 'block';
    if (badge && quota) {
      badge.textContent = 'Sisa ' + quota.remainingSlots + ' dari ' + quota.maxQuota + ' slot';
    }
    renderDriverRegGoogleGate();
  }
}

function syncRegSubmitState() {
  var cb = document.getElementById('regRulesAgreeCheckbox');
  var btn = document.getElementById('regSubmitBtn');
  if (!btn) return;
  var agreed = Boolean(cb && cb.checked);
  btn.disabled = !agreed;
  btn.style.opacity = agreed ? '1' : '0.55';
  btn.style.cursor = agreed ? 'pointer' : 'not-allowed';
}

function renderDriverRegGoogleGate() {
  var boxOut = document.getElementById('regGoogleNotLoggedIn');
  var boxIn = document.getElementById('regGoogleLoggedIn');
  var fieldsWrap = document.getElementById('regFormFieldsWrap');
  var nameEl = document.getElementById('regGoogleDisplayName');
  var emailEl = document.getElementById('regGoogleDisplayEmail');
  var regNameInput = document.getElementById('regName');

  if (state.googleUser && state.googleUser.email) {
    if (boxOut) boxOut.style.display = 'none';
    if (boxIn) boxIn.style.display = 'block';
    if (fieldsWrap) fieldsWrap.style.display = 'block';
    if (nameEl) nameEl.textContent = state.googleUser.displayName || 'Mitra Driver';
    if (emailEl) emailEl.textContent = state.googleUser.email;
    if (regNameInput && !regNameInput.value.trim() && state.googleUser.displayName) {
      regNameInput.value = state.googleUser.displayName;
    }
    syncRegSubmitState();
  } else {
    if (boxOut) boxOut.style.display = 'block';
    if (boxIn) boxIn.style.display = 'none';
    if (fieldsWrap) fieldsWrap.style.display = 'none';
  }
}

async function refreshDriverRegModalState() {
  var loadingBox = document.getElementById('regQuotaLoadingBox');
  var fullBox = document.getElementById('regQuotaFullBox');
  var openWrap = document.getElementById('regOpenWrap');
  if (loadingBox) loadingBox.style.display = 'block';
  if (fullBox) fullBox.style.display = 'none';
  if (openWrap) openWrap.style.display = 'none';

  try {
    var res = await SuruhAjaAPI.getDriverRegistrationStatus();
    if (res && res.success && res.data && res.data.quota) {
      state.driverQuota = res.data.quota;
      if (res.data.whatsappNumber) state.whatsappNumber = res.data.whatsappNumber;
      applyRegQuotaView(res.data.quota);
    } else {
      applyRegQuotaView(state.driverQuota || getFallbackDriverQuota());
    }
  } catch (err) {
    applyRegQuotaView(state.driverQuota || getFallbackDriverQuota());
  }
}

async function loginGoogleForDriverRegistration() {
  var gUser = await ensureGooglePopupSignIn();
  if (gUser) {
    renderDriverRegGoogleGate();
    showToast('Akun Google terverifikasi: ' + gUser.email, 'success');
  }
}

async function loginDriverViaGoogle() {
  var btn = document.getElementById('driverGoogleLoginBtn');
  if (btn) btn.disabled = true;
  try {
    var gUser = await ensureGooglePopupSignIn();
    if (!gUser || !gUser.email) return;

    var res = await SuruhAjaAPI.loginDriverWithGoogle({
      email: gUser.email,
      displayName: gUser.displayName,
      uid: gUser.uid
    });
    if (res && res.success && res.data) {
      try { localStorage.setItem(STORAGE_KEYS.TOKEN, res.data.token); } catch (eSave) {}
      state.user = res.data.user;
      closeModal('authModal');
      renderAuthState();
      showToast(res.message || 'Login Mitra Driver berhasil!', 'success');
      switchView('driver');
    } else {
      showToast(res ? res.message : 'Gagal masuk sebagai Mitra Driver.', 'error');
    }
  } catch (err) {
    showToast('Gagal login driver: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function openAuthModal(mode) {
  mode = mode || 'login';
  var isLogin = mode === 'login';
  var titleEl = document.getElementById('authModalTitle');
  var loginForm = document.getElementById('loginForm');
  var regForm = document.getElementById('registerForm');
  if (titleEl) titleEl.textContent = isLogin ? 'Masuk Driver / Admin' : 'Daftar Mitra Driver SuruhAja';
  if (loginForm) loginForm.style.display = isLogin ? 'block' : 'none';
  if (regForm) regForm.style.display = isLogin ? 'none' : 'block';
  openModal('authModal');
  if (!isLogin) {
    refreshDriverRegModalState();
  }
}

function renderAuthState() {
  var authBtn = document.getElementById('authNavBtn');
  var adminBtn = document.getElementById('adminNavBtn');
  var driverBtn = document.getElementById('driverNavBtn');
  var profOut = document.getElementById('profileLoggedOut');
  var profIn = document.getElementById('profileLoggedIn');
  var profAdminBtn = document.getElementById('profileAdminBtn');
  var profDriverBtn = document.getElementById('profileDriverBtn');
  var profAvatar = document.getElementById('profileAvatar');
  var profName = document.getElementById('profileName');
  var profEmail = document.getElementById('profileEmail');
  var profRole = document.getElementById('profileRoleBadge');

  if (state.user) {
    if (authBtn) {
      authBtn.textContent = state.user.fullName ? state.user.fullName.split(' ')[0] : state.user.username;
    }
    var isAdmin = state.user.role === 'Admin';
    var isDriver = state.user.role === 'Driver';

    if (adminBtn) adminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    if (driverBtn) driverBtn.style.display = isDriver ? 'inline-flex' : 'none';
    if (profAdminBtn) profAdminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    if (profDriverBtn) profDriverBtn.style.display = isDriver ? 'inline-flex' : 'none';

    if (profOut) profOut.style.display = 'none';
    if (profIn) profIn.style.display = 'block';
    if (profAvatar) profAvatar.textContent = (state.user.fullName || state.user.username || 'U').charAt(0).toUpperCase();
    if (profName) profName.textContent = state.user.fullName || state.user.username;
    if (profEmail) profEmail.textContent = state.user.email || state.user.username;
    if (profRole) profRole.textContent = state.user.role || 'Driver';
  } else {
    if (authBtn) {
      authBtn.textContent = 'Driver / Admin';
    }
    if (adminBtn) adminBtn.style.display = 'none';
    if (driverBtn) driverBtn.style.display = 'none';
    if (profAdminBtn) profAdminBtn.style.display = 'none';
    if (profDriverBtn) profDriverBtn.style.display = 'none';
    if (profOut) profOut.style.display = 'block';
    if (profIn) profIn.style.display = 'none';
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  var identifier = document.getElementById('loginIdentifier').value.trim();
  var password = document.getElementById('loginPassword').value;
  var btn = document.getElementById('loginSubmitBtn');

  btn.disabled = true;
  btn.textContent = 'Memeriksa...';

  try {
    var res = await SuruhAjaAPI.loginUser({ identifier: identifier, password: password });
    if (res && res.success && res.data) {
      try { localStorage.setItem(STORAGE_KEYS.TOKEN, res.data.token); } catch (errSave) {}
      state.user = res.data.user;
      document.getElementById('loginForm').reset();
      closeModal('authModal');
      renderAuthState();
      showToast(res.message || 'Login berhasil!', 'success');
      if (state.user.role === 'Admin') {
        switchView('admin');
      } else if (state.user.role === 'Driver') {
        switchView('driver');
      }
    } else {
      showToast(res ? res.message : 'Login gagal.', 'error');
    }
  } catch (err) {
    showToast('Gagal login: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Masuk';
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  var btn = document.getElementById('regSubmitBtn');
  var rulesCb = document.getElementById('regRulesAgreeCheckbox');

  if (!state.googleUser || !state.googleUser.email) {
    showToast('Wajib Login dengan Google terlebih dahulu sebelum mendaftar.', 'error');
    return;
  }

  if (!rulesCb || !rulesCb.checked) {
    showToast('Silakan centang persetujuan Tata Tertib Mitra SuruhAja Cepu terlebih dahulu.', 'error');
    syncRegSubmitState();
    return;
  }

  var payload = {
    googleEmail: state.googleUser.email.trim().toLowerCase(),
    googlePhotoUrl: state.googleUser.photoURL || '',
    fullName: document.getElementById('regName').value.trim(),
    phoneWA: document.getElementById('regPhone').value.trim(),
    vehicleType: document.getElementById('regVehicle').value.trim(),
    plateNumber: document.getElementById('regPlate').value.trim().toUpperCase(),
    area: (document.getElementById('regArea') ? document.getElementById('regArea').value.trim() : '') || 'Area Cepu'
  };

  if (!payload.fullName || !payload.phoneWA || !payload.vehicleType || !normalizePlateLocal(payload.plateNumber)) {
    showToast('Lengkapi Nama Lengkap, Nomor WA Aktif, Jenis/Warna Motor, dan Pelat Nomor.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Mengirim Pendaftaran...';

  try {
    var res = await SuruhAjaAPI.registerDriverAccount(payload);
    if (res && res.success) {
      if (res.data && res.data.quota) state.driverQuota = res.data.quota;
      showToast(res.message || 'Pendaftaran berhasil! Akun berstatus PENDING menunggu persetujuan Admin.', 'success');
      document.getElementById('registerForm').reset();
      syncRegSubmitState();
      await bootstrapApp();
      openAuthModal('login');
    } else {
      if (res && res.code === 'QUOTA_FULL' && res.data && res.data.quota) {
        state.driverQuota = res.data.quota;
        applyRegQuotaView(res.data.quota);
      }
      showToast(res ? res.message : 'Gagal mendaftar driver.', 'error');
    }
  } catch (err) {
    showToast('Gagal mendaftar: ' + err.message, 'error');
  } finally {
    btn.textContent = 'Kirim Pendaftaran Driver';
    syncRegSubmitState();
  }
}

async function handleLogout() {
  var token = getAuthToken();
  try { await SuruhAjaAPI.logoutUser(token); } catch (e) {}
  try {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.SESSION_META);
  } catch (e) {}
  state.user = null;
  renderAuthState();
  switchView('home');
  showToast('Anda telah keluar dari akun.', 'info');
}

/* ========================================================================
 * 7B. DASHBOARD DRIVER (LOAD DATA, UBAH STATUS STANDBY/SIBUK, UPDATE ORDER)
 * ======================================================================== */
async function loadDriverData() {
  var listEl = document.getElementById('driverOrdersList');
  if (listEl) listEl.innerHTML = '<p class="text-muted">Memuat data driver...</p>';

  try {
    var token = getAuthToken();
    var res = await SuruhAjaAPI.getDriverDashboardData(token);
    if (res && res.success && res.data) {
      state.driverData = res.data;
      renderDriverDashboard();
    } else {
      showToast(res ? res.message : 'Gagal memuat Dashboard Driver.', 'error');
    }
  } catch (err) {
    showToast('Error Dashboard Driver: ' + err.message, 'error');
  }
}

function setDriverOrderFilter(status, btnEl) {
  state.driverOrderFilter = status || 'ALL';
  document.querySelectorAll('#driverOrderFilters .filter-pill').forEach(function (b) {
    b.classList.remove('active');
  });
  if (btnEl) btnEl.classList.add('active');
  renderDriverDashboard();
}

function renderDriverDashboard() {
  var d = state.driverData;
  if (!d) return;

  var drv = d.driver;
  var pendingBanner = document.getElementById('driverPendingBanner');
  var opBox = document.getElementById('driverOperationalBox');
  var pendingWa = document.getElementById('driverPendingWaLink');
  var isApproved = d.isApproved !== false && drv && String(drv.Status || '').toUpperCase() !== 'PENDING' && String(drv.ApprovalStatus || '').toUpperCase() !== 'PENDING' && String(drv.ApprovalStatus || '').toUpperCase() !== 'DITOLAK';

  if (pendingWa) {
    pendingWa.href = getAdminWaitlistWaUrl('Halo Admin SuruhAja Cepu, saya Mitra Driver (' + (drv ? drv.FullName : '-') + ') dengan status PENDING ingin menanyakan persetujuan akun.');
  }

  if (!isApproved) {
    if (pendingBanner) pendingBanner.style.display = 'block';
    if (opBox) opBox.style.display = 'none';
    return;
  }

  if (pendingBanner) pendingBanner.style.display = 'none';
  if (opBox) opBox.style.display = 'block';
  var stLabel = document.getElementById('driverMyStatusLabel');
  var infoLine = document.getElementById('driverMyInfoLine');
  var avatarEl = document.getElementById('driverDashAvatar');
  if (drv) {
    var st = drv.ApprovalStatus || 'Standby';
    if (stLabel) stLabel.textContent = 'Status Mitra: ' + st;
    if (infoLine) infoLine.textContent = drv.FullName + ' · ' + (drv.VehicleType || 'Motor') + (drv.PlateNumber ? ' (' + drv.PlateNumber + ')' : '') + ' · ' + (drv.Area || 'Area Cepu');
    if (avatarEl) avatarEl.innerHTML = renderDriverAvatarInner(drv.PhotoURL, drv.FullName);

    var btnSt = document.getElementById('drvStatusBtnStandby');
    var btnSb = document.getElementById('drvStatusBtnSibuk');
    var btnOff = document.getElementById('drvStatusBtnNonaktif');
    if (btnSt) btnSt.classList.toggle('btn-status-active', st === 'Standby');
    if (btnSb) btnSb.classList.toggle('btn-status-active', st === 'Sibuk');
    if (btnOff) btnOff.classList.toggle('btn-status-active', st === 'Nonaktif');
  }

  var listEl = document.getElementById('driverOrdersList');
  if (!listEl) return;
  var allOrders = d.orders || [];
  var filterVal = state.driverOrderFilter || 'ALL';
  var orders = filterVal === 'ALL'
    ? allOrders
    : allOrders.filter(function (o) { return o.OrderStatus === filterVal; });

  if (!orders.length) {
    listEl.innerHTML = '<p class="text-muted">Belum ada pesanan' + (filterVal === 'ALL' ? ' masuk saat ini.' : ' dengan status "' + escHtml(filterVal) + '".') + '</p>';
    return;
  }

  listEl.innerHTML = orders.map(function (o) {
    var badgeCls = o.OrderStatus === 'Selesai' ? 'badge-done' : o.OrderStatus === 'Dibatalkan' ? 'badge-cancel' : 'badge-process';
    var isAuto = String(o.RouteID) === 'AUTO';
    var isDoneOrCancelled = o.OrderStatus === 'Selesai' || o.OrderStatus === 'Dibatalkan';
    var custWaUrl = buildDriverToCustomerWaUrl(o, drv);
    return ('\n' +
      '          <div class="order-history-card">\n' +
      '            <div class="flex-between">\n' +
      '              <div>\n' +
      '                <strong>' + (escHtml(o.OrderCode)) + ' — ' + (escHtml(o.CustomerName)) + '</strong>\n' +
      '                <span class="badge ' + (isAuto ? 'badge-process' : 'badge-done') + '" style="margin-left:6px;">\n' +
      '                  ' + (isAuto ? 'Antrean Umum' : 'Khusus Kamu') + '\n' +
      '                </span>\n' +
      '              </div>\n' +
      '              <span class="badge ' + (badgeCls) + '">' + (escHtml(o.OrderStatus)) + '</span>\n' +
      '            </div>\n' +
      '            <div style="font-size:13.5px; font-weight:700;">' + (escHtml(o.ServiceName)) + ' · <span style="color:var(--primary);">' + (formatRp(o.EstimatedTotal)) + '</span></div>\n' +
      '            <div class="text-muted">' + (escHtml(o.ItemDetails)) + '</div>\n' +
      '            ' + ((o.PickupAddress || o.DropoffAddress) ? ('<div class="text-muted" style="font-size:11.5px;">Jemput: ' + (escHtml(o.PickupAddress || '-')) + ' → Antar: ' + (escHtml(o.DropoffAddress || '-')) + '</div>') : '') + '\n' +
      '            ' + (o.Notes ? ('<div class="text-muted" style="font-size:12px;">Catatan: ' + (escHtml(o.Notes)) + '</div>') : '') + '\n' +
      '            ' + (!isDoneOrCancelled ? ('\n' +
      '            <div style="margin-top:10px;">\n' +
      '              ' + (custWaUrl
        ? ('<a href="' + (escHtml(custWaUrl)) + '" target="_blank" rel="noopener" class="btn-wa-chat" style="width:100%;">' + (getWhatsAppIconSvg(15)) + '<span>Hubungi Pelanggan via WA</span></a>')
        : '<button type="button" class="btn-pill btn-soft" style="width:100%; font-size:12px;" onclick="showToast(\'Nomor WhatsApp pelanggan belum tercatat di pesanan ini.\', \'info\')">Nomor WA Pelanggan Tidak Tersedia</button>'
      ) + '\n' +
      '            </div>') : '') + '\n' +
      '            <div class="flex-between mt-12">\n' +
      '              <span class="text-muted" style="font-size:11.5px;">' + (escHtml(formatDateSafe(o.CreatedAt))) + '</span>\n' +
      '              ' + (isDoneOrCancelled ? '' : ('\n' +
      '              <div style="display:flex; gap:8px;">\n' +
      '                ' + (o.OrderStatus !== 'Diproses' ? ('<button type="button" class="btn-pill btn-soft" style="padding:6px 12px; font-size:12px;" onclick="driverSetOrderStatus(\'' + (escHtml(o.ID)) + '\', \'Diproses\')">Proses</button>') : '') + '\n' +
      '                <button type="button" class="btn-pill btn-primary" style="padding:6px 12px; font-size:12px;" onclick="driverSetOrderStatus(\'' + (escHtml(o.ID)) + '\', \'Selesai\')">Selesai</button>\n' +
      '              </div>')) + '\n' +
      '            </div>\n' +
      '          </div>\n' +
      '        ');
  }).join('');
}

async function changeMyDriverStatus(newStatus) {
  try {
    var res = await SuruhAjaAPI.driverUpdateAvailability(newStatus, getAuthToken());
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      await bootstrapApp();
      loadDriverData();
    }
  } catch (err) {
    showToast('Gagal mengubah status: ' + err.message, 'error');
  }
}

async function driverSetOrderStatus(orderId, newStatus) {
  try {
    var res = await SuruhAjaAPI.driverUpdateOrderStatus(orderId, newStatus, getAuthToken());
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) loadDriverData();
  } catch (err) {
    showToast('Gagal update pesanan: ' + err.message, 'error');
  }
}

function handleDriverUpdateOwnPhoto(e) {
  var file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('Ukuran foto maksimal 5 MB.', 'error');
    e.target.value = '';
    return;
  }
  var reader = new FileReader();
  reader.onload = async function () {
    var fileData = { base64: reader.result, mimeType: file.type, fileName: file.name, file: file };
    showToast('Mengupload foto profil...', 'info');
    try {
      var res = await SuruhAjaAPI.driverUpdateOwnPhoto(fileData, getAuthToken());
      showToast(res.message, res.success ? 'success' : 'error');
      if (res.success) {
        await bootstrapApp();
        loadDriverData();
      }
    } catch (err) {
      showToast('Gagal upload foto: ' + err.message, 'error');
    }
  };
  reader.readAsDataURL(file);
}

/* ========================================================================
 * 8. ADMIN PANEL (LOAD DATA, TABS, CRUD LAYANAN/PROMO/REKANAN/SETTINGS)
 * ======================================================================== */
function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(function (b) {
    b.classList.toggle('active', b.dataset.atab === tabName);
  });
  document.querySelectorAll('.admin-panel-tab').forEach(function (p) {
    p.style.display = p.id === 'atab-' + tabName ? 'block' : 'none';
  });
}

async function loadAdminData() {
  try {
    var res = await SuruhAjaAPI.getAdminDashboardData(getAuthToken());
    if (res && res.success && res.data) {
      state.adminData = res.data;
      renderAdminPanel();
    } else {
      showToast(res ? res.message : 'Gagal memuat Admin Panel.', 'error');
    }
  } catch (err) {
    showToast('Error Admin Panel: ' + err.message, 'error');
  }
}

function renderAdminPanel() {
  var d = state.adminData;
  if (!d) return;

  var isOpen = (d.settings && d.settings.storeStatus ? d.settings.storeStatus : state.storeStatus) !== 'CLOSED';
  var stNote = (d.settings && d.settings.storeStatusNote) || state.storeStatusNote || '';
  var lbl = document.getElementById('adminStatusLabel');
  var prev = document.getElementById('adminStatusNotePreview');
  var inp = document.getElementById('adminStatusNoteInput');
  var toggleBtn = document.getElementById('toggleStoreStatusBtn');
  if (lbl) lbl.textContent = isOpen ? 'Status Operasional: SEDANG BUKA' : 'Status Operasional: SEDANG TUTUP';
  if (prev) prev.textContent = stNote;
  if (inp) inp.value = stNote;
  if (toggleBtn) {
    toggleBtn.className = 'btn-pill ' + (isOpen ? 'btn-danger-soft' : 'btn-primary');
    toggleBtn.textContent = isOpen ? 'Ubah Jadi Tutup' : 'Ubah Jadi Buka';
  }

  document.getElementById('kpiTotalOrders').textContent = d.stats.totalOrders || 0;
  document.getElementById('kpiTodayOrders').textContent = d.stats.todayOrders || 0;
  var kpiDrv = document.getElementById('kpiTotalDrivers');
  if (kpiDrv) kpiDrv.textContent = d.stats.totalDrivers !== undefined ? d.stats.totalDrivers : (d.drivers ? d.drivers.length : 0);
  document.getElementById('kpiActiveServices').textContent = d.stats.activeServices || 0;

  var recentBody = document.getElementById('adminRecentOrdersBody');
  recentBody.innerHTML = (d.orders || []).slice(0, 5).map(function (o) {
    var bCls = o.OrderStatus === 'Selesai' ? 'badge-done' : o.OrderStatus === 'Dibatalkan' ? 'badge-cancel' : 'badge-process';
    return ('\n' +
      '          <tr>\n' +
      '            <td><strong>' + (escHtml(o.OrderCode)) + '</strong></td>\n' +
      '            <td>' + (escHtml(o.CustomerName)) + '</td>\n' +
      '            <td>' + (escHtml(o.ServiceName)) + '</td>\n' +
      '            <td>' + (formatRp(o.EstimatedTotal)) + '</td>\n' +
      '            <td><span class="badge ' + (bCls) + '">' + (escHtml(o.OrderStatus)) + '</span></td>\n' +
      '          </tr>\n' +
      '        ');
  }).join('') || '<tr><td colspan="5" class="text-muted">Belum ada pesanan.</td></tr>';

  renderAdminOrdersTable();

  var srvBody = document.getElementById('adminServicesBody');
  var tariffList = d.tariffs || [];
  srvBody.innerHTML = tariffList.map(function (s) {
    var isAktif = s.Status === 'Aktif' || s.Status === 'Active';
    var nextStatus = isAktif ? 'Nonaktif' : 'Aktif';
    var meta = getServiceVectorMeta(s);
    return ('\n' +
      '          <tr>\n' +
      '            <td>\n' +
      '              <div style="display:flex; align-items:center; gap:9px;">\n' +
      '                <div class="service-icon-box ' + (meta.boxClass) + '" style="width:36px; height:36px; margin-bottom:0; border-radius:10px; flex-shrink:0;">' + (meta.svg) + '</div>\n' +
      '                <div><strong>' + (escHtml(s.Nama_Layanan)) + '</strong><div class="text-muted" style="font-size:11px;">' + (escHtml(s.ID_Layanan)) + '</div></div>\n' +
      '              </div>\n' +
      '            </td>\n' +
      '            <td><strong style="color:var(--primary);">' + (formatRp(s.Tarif_Minimal)) + '</strong></td>\n' +
      '            <td>' + (Number(s.Jarak_Minimal_Km || 0)) + ' km</td>\n' +
      '            <td>' + (formatRp(s.Tarif_Per_Km)) + ' / km</td>\n' +
      '            <td>\n' +
      '              <button type="button" class="badge ' + (isAktif ? 'badge-done' : 'badge-cancel') + '" style="border:none; cursor:pointer;" onclick="toggleTariffStatusUI(\'' + (escHtml(s.ID_Layanan)) + '\', \'' + (nextStatus) + '\')" title="Klik untuk ubah status">\n' +
      '                ' + (isAktif ? 'Aktif' : 'Nonaktif') + '\n' +
      '              </button>\n' +
      '            </td>\n' +
      '            <td style="display:flex; gap:6px;">\n' +
      '              <button type="button" class="btn-pill btn-soft" style="padding:6px 10px; font-size:12px;" onclick="openServiceModal(\'' + (escHtml(s.ID_Layanan)) + '\')">Edit</button>\n' +
      '              <button type="button" class="btn-pill btn-danger-soft" style="padding:6px 10px; font-size:12px;" onclick="deleteServiceUI(\'' + (escHtml(s.ID_Layanan)) + '\')">Hapus</button>\n' +
      '            </td>\n' +
      '          </tr>\n' +
      '        ');
  }).join('') || '<tr><td colspan="6" class="text-muted">Belum ada layanan di pengaturan_tarif.</td></tr>';

  var quotaObj = d.driverQuota || getFallbackDriverQuota();
  var quotaSummaryEl = document.getElementById('adminQuotaSummary');
  var quotaInputEl = document.getElementById('adminMaxDriverQuota');
  if (quotaSummaryEl && quotaObj) {
    quotaSummaryEl.textContent = 'Terisi: ' + quotaObj.usedCount + ' / ' + quotaObj.maxQuota + ' (Aktif: ' + quotaObj.activeCount + ' · Pending: ' + quotaObj.pendingCount + (quotaObj.isFull ? ' · PENUH' : ' · Sisa ' + quotaObj.remainingSlots) + ')';
  }
  if (quotaInputEl && quotaObj) {
    quotaInputEl.value = quotaObj.maxQuota;
  }

  var drvBody = document.getElementById('adminDriversBody');
  if (drvBody) {
    drvBody.innerHTML = (d.drivers || []).map(function (drv) {
      var rowSt = String(drv.Status || 'AKTIF').toUpperCase();
      var cond = drv.ApprovalStatus || 'Standby';
      var isPend = rowSt === 'PENDING' || cond.toUpperCase() === 'PENDING' || cond === 'Menunggu';
      var isRejected = cond === 'Ditolak' || rowSt === 'INACTIVE' || rowSt === 'NONAKTIF';
      var statusLabel = isPend ? 'PENDING' : (isRejected ? (cond === 'Ditolak' ? 'Ditolak' : 'Nonaktif') : 'AKTIF');
      var statusCls = isPend ? 'badge-process' : (isRejected ? 'badge-cancel' : 'badge-done');
      var condCls = cond === 'Standby' ? 'badge-done' : (cond === 'Sibuk' || isPend) ? 'badge-process' : 'badge-cancel';
      return ('\n' +
        '            <tr>\n' +
        '              <td>\n' +
        '                <div style="display:flex; align-items:center; gap:9px;">\n' +
        '                  <div class="driver-avatar-circle" style="width:36px; height:36px; background:#ECFDF5;">' + (renderDriverAvatarInner(drv.PhotoURL, drv.FullName)) + '</div>\n' +
        '                  <div>\n' +
        '                    <strong>' + (escHtml(drv.FullName)) + '</strong>\n' +
        '                    ' + (drv.Email ? ('<div class="text-muted" style="font-size:11px;">' + (escHtml(drv.Email)) + '</div>') : '') + '\n' +
        '                  </div>\n' +
        '                </div>\n' +
        '              </td>\n' +
        '              <td>' + (escHtml(drv.PhoneWA || '-')) + '</td>\n' +
        '              <td class="text-muted">' + (escHtml(drv.VehicleType || 'Motor')) + ' ' + (drv.PlateNumber ? '<strong>(' + escHtml(drv.PlateNumber) + ')</strong>' : '') + '<div style="font-size:11.5px;">Area: ' + (escHtml(drv.Area || 'Area Cepu')) + '</div></td>\n' +
        '              <td>\n' +
        '                <span class="badge ' + (statusCls) + '">' + (escHtml(statusLabel)) + '</span>\n' +
        '                <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:6px;">\n' +
        '                  ' + (statusLabel !== 'AKTIF' ? ('<button type="button" class="btn-pill btn-primary" style="padding:4px 9px; font-size:11px;" onclick="updateDriverApprovalUI(\'' + (escHtml(drv.ID)) + '\', \'AKTIF\')">Setujui (AKTIF)</button>') : '') + '\n' +
        '                  ' + (isPend ? ('<button type="button" class="btn-pill btn-danger-soft" style="padding:4px 9px; font-size:11px;" onclick="updateDriverApprovalUI(\'' + (escHtml(drv.ID)) + '\', \'Ditolak\')">Tolak</button>') : '') + '\n' +
        '                </div>\n' +
        '              </td>\n' +
        '              <td><span class="badge ' + (condCls) + '">' + (escHtml(cond)) + '</span></td>\n' +
        '              <td style="display:flex; gap:6px;">\n' +
        '                <button type="button" class="btn-pill btn-soft" style="padding:6px 10px; font-size:12px;" onclick="openDriverModal(\'' + (escHtml(drv.ID)) + '\')">Edit</button>\n' +
        '                <button type="button" class="btn-pill btn-danger-soft" style="padding:6px 10px; font-size:12px;" onclick="deleteDriverUI(\'' + (escHtml(drv.ID)) + '\')">Hapus</button>\n' +
        '              </td>\n' +
        '            </tr>\n' +
        '          ');
    }).join('') || '<tr><td colspan="6" class="text-muted">Belum ada driver terdaftar. Klik + Tambah Driver.</td></tr>';
  }

  var prmBody = document.getElementById('adminPromosBody');
  prmBody.innerHTML = (d.promos || []).map(function (p) {
    return ('\n' +
      '          <tr>\n' +
      '            <td><strong>' + (escHtml(p.Code)) + '</strong></td>\n' +
      '            <td>' + (escHtml(p.Title)) + '</td>\n' +
      '            <td>' + (formatRp(p.DiscountAmount)) + '</td>\n' +
      '            <td>' + (formatRp(p.MinOrder)) + '</td>\n' +
      '            <td><span class="badge ' + (p.Status === 'Active' ? 'badge-done' : 'badge-cancel') + '">' + (escHtml(p.Status)) + '</span></td>\n' +
      '            <td style="display:flex; gap:6px;">\n' +
      '              <button type="button" class="btn-pill btn-soft" style="padding:6px 10px; font-size:12px;" onclick="openPromoModal(\'' + (escHtml(p.ID)) + '\')">Edit</button>\n' +
      '              <button type="button" class="btn-pill btn-danger-soft" style="padding:6px 10px; font-size:12px;" onclick="deletePromoUI(\'' + (escHtml(p.ID)) + '\')">Hapus</button>\n' +
      '            </td>\n' +
      '          </tr>\n' +
      '        ');
  }).join('') || '<tr><td colspan="6" class="text-muted">Belum ada promo.</td></tr>';

  var prtBody = document.getElementById('adminPartnersBody');
  if (prtBody) {
    prtBody.innerHTML = (d.partners || []).map(function (p) {
      return ('\n' +
        '            <tr>\n' +
        '              <td>\n' +
        '                <div style="display:flex; align-items:center; gap:9px;">\n' +
        '                  ' + (getPartnerVectorSvg(p)) + '\n' +
        '                  <div><strong>' + (escHtml(p.name)) + '</strong><div class="text-muted">' + (escHtml(p.category || 'Kuliner')) + '</div></div>\n' +
        '                </div>\n' +
        '              </td>\n' +
        '              <td class="text-muted">' + (escHtml(p.menuHint || '-')) + '</td>\n' +
        '              <td><span class="badge badge-process">' + (escHtml(p.badge || 'Rekanan')) + '</span></td>\n' +
        '              <td><span class="badge ' + (p.status !== 'Inactive' ? 'badge-done' : 'badge-cancel') + '">' + (escHtml(p.status || 'Active')) + '</span></td>\n' +
        '              <td style="display:flex; gap:6px;">\n' +
        '                <button type="button" class="btn-pill btn-soft" style="padding:6px 10px; font-size:12px;" onclick="openPartnerModal(\'' + (escHtml(p.id)) + '\')">Edit</button>\n' +
        '                <button type="button" class="btn-pill btn-danger-soft" style="padding:6px 10px; font-size:12px;" onclick="deletePartnerUI(\'' + (escHtml(p.id)) + '\')">Hapus</button>\n' +
        '              </td>\n' +
        '            </tr>\n' +
        '          ');
    }).join('') || '<tr><td colspan="5" class="text-muted">Belum ada warung rekanan.</td></tr>';
  }

  var tstBody = document.getElementById('adminTestimonialsBody');
  if (tstBody) {
    tstBody.innerHTML = (d.testimonials || []).map(function (t) {
      return ('\n' +
        '            <tr>\n' +
        '              <td><strong>' + (escHtml(t.name)) + '</strong></td>\n' +
        '              <td style="color:#F59E0B;">' + ('★'.repeat(Number(t.rating || 5))) + '</td>\n' +
        '              <td class="text-muted">' + (escHtml(t.comment)) + '</td>\n' +
        '              <td><span class="badge ' + (t.status !== 'Inactive' ? 'badge-done' : 'badge-cancel') + '">' + (escHtml(t.status || 'Active')) + '</span></td>\n' +
        '              <td style="display:flex; gap:6px;">\n' +
        '                <button type="button" class="btn-pill btn-soft" style="padding:6px 10px; font-size:12px;" onclick="openTestimonialModal(\'' + (escHtml(t.id)) + '\')">Edit</button>\n' +
        '                <button type="button" class="btn-pill btn-danger-soft" style="padding:6px 10px; font-size:12px;" onclick="deleteTestimonialUI(\'' + (escHtml(t.id)) + '\')">Hapus</button>\n' +
        '              </td>\n' +
        '            </tr>\n' +
        '          ');
    }).join('') || '<tr><td colspan="5" class="text-muted">Belum ada ulasan.</td></tr>';
  }

  var st = d.settings || {};
  var ft = st.footer || {};
  setElVal('setWaNumber', st.whatsappNumber || state.whatsappNumber);
  setElVal('setTagline', st.appTagline || state.appTagline);
  setElVal('setFooterBrand', ft.brandName || '');
  setElVal('setFooterDesc', ft.description || '');
  setElVal('setFooterAddr', ft.address || '');
  setElVal('setFooterEmail', ft.email || '');
  setElVal('setFooterIg', ft.instagram || '');
  setElVal('setFooterCopy', ft.copyright || '');
  setElVal('setMaxDriverQuota', st.maxDriverQuota || (d.driverQuota && d.driverQuota.maxQuota) || state.maxDriverQuota || 15);
  setElVal('setSaweriaUrl', st.saweriaUrl !== undefined ? st.saweriaUrl : (state.saweriaUrl || ''));
  setElVal('setSaweriaText', st.saweriaText || state.saweriaText || '');

  var logoPrev = document.getElementById('adminLogoPreview');
  if (logoPrev) {
    logoPrev.innerHTML = st.logoUrl
      ? ('<img src="' + (escHtml(st.logoUrl)) + '" alt="Logo" />')
      : 'Logo Default Kurir Motor Aktif';
  }
}

function setAdminOrderFilter(status, btnEl) {
  state.adminOrderFilter = status || 'ALL';
  document.querySelectorAll('#adminOrderFilters .filter-pill').forEach(function (b) {
    b.classList.remove('active');
  });
  if (btnEl) btnEl.classList.add('active');
  renderAdminOrdersTable();
}

function renderAdminOrdersTable() {
  var ordersBody = document.getElementById('adminOrdersBody');
  if (!ordersBody || !state.adminData) return;
  var list = state.adminData.orders || [];
  var stFilter = state.adminOrderFilter || 'ALL';
  var qEl = document.getElementById('adminOrderSearch');
  var q = qEl ? qEl.value.trim().toLowerCase() : '';

  var filtered = list.filter(function (o) {
    if (stFilter !== 'ALL' && o.OrderStatus !== stFilter) return false;
    if (q) {
      var hay = (
        String(o.OrderCode || '') + ' ' +
        String(o.CustomerName || '') + ' ' +
        String(o.CustomerEmail || '') + ' ' +
        String(o.ServiceName || '') + ' ' +
        String(o.RouteName || '') + ' ' +
        String(o.ItemDetails || '')
      ).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });

  ordersBody.innerHTML = filtered.map(function (o) {
    var opts = ['Baru', 'Diproses', 'Selesai', 'Dibatalkan'].map(function (st) {
      return ('<option value="' + (st) + '" ' + (o.OrderStatus === st ? 'selected' : '') + '>' + (st) + '</option>');
    }).join('');
    return ('\n' +
      '          <tr>\n' +
      '            <td><strong>' + (escHtml(o.OrderCode)) + '</strong><div class="text-muted">' + (escHtml(formatDateSafe(o.CreatedAt))) + '</div></td>\n' +
      '            <td>\n' +
      '              <strong>' + (escHtml(o.CustomerName)) + '</strong>\n' +
      '              ' + (o.CustomerEmail ? ('<div class="text-muted" style="font-size:11px;">' + (escHtml(o.CustomerEmail)) + '</div>') : '') + '\n' +
      '            </td>\n' +
      '            <td>\n' +
      '              <strong>' + (escHtml(o.ServiceName)) + '</strong>\n' +
      '              ' + (o.DistanceKm !== undefined && o.DistanceKm !== '' ? ('<span class="badge badge-done" style="margin-left:4px;">' + (escHtml(o.DistanceKm)) + ' km</span>') : '') + '\n' +
      '              ' + (o.RouteName ? ('<span class="badge badge-process" style="margin-left:4px;">' + (escHtml(o.RouteName)) + '</span>') : '') + '\n' +
      '              ' + (o.PromoCode ? ('<span class="badge badge-done" style="margin-left:4px;">' + (escHtml(o.PromoCode)) + '</span>') : '') + '\n' +
      '              <div class="text-muted">' + (escHtml(o.ItemDetails)) + '</div>\n' +
      '              ' + ((o.PickupCoords || o.DropoffCoords) ? ('<div class="text-muted" style="font-size:11px;">Jemput: ' + (escHtml(o.PickupAddress || o.PickupCoords)) + ' → Tujuan: ' + (escHtml(o.DropoffAddress || o.DropoffCoords)) + '</div>') : '') + '\n' +
      '              ' + (o.Notes ? ('<div class="text-muted" style="font-size:11.5px;">Catatan: ' + (escHtml(o.Notes)) + '</div>') : '') + '\n' +
      '            </td>\n' +
      '            <td><strong>' + (formatRp(o.EstimatedTotal)) + '</strong></td>\n' +
      '            <td>\n' +
      '              <select class="form-control" style="padding:6px 8px; font-size:12px;" onchange="adminUpdateOrderStatusUI(\'' + (escHtml(o.ID)) + '\', this.value)">\n' +
      '                ' + (opts) + '\n' +
      '              </select>\n' +
      '            </td>\n' +
      '          </tr>\n' +
      '        ');
  }).join('') || '<tr><td colspan="5" class="text-muted">Tidak ada pesanan yang cocok.</td></tr>';
}

async function adminUpdateOrderStatusUI(orderId, newStatus) {
  try {
    var res = await SuruhAjaAPI.adminUpdateOrderStatus(orderId, newStatus, getAuthToken());
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) loadAdminData();
  } catch (err) {
    showToast('Gagal ubah status: ' + err.message, 'error');
  }
}

/* --- Modal Edit/Tambah Pengaturan Layanan & Tarif --- */
function openServiceModal(id) {
  id = id || '';
  var list = (state.adminData && state.adminData.tariffs) || state.tariffs || [];
  var s = id ? list.find(function (x) { return x.ID_Layanan === id; }) : null;
  document.getElementById('adminEditorTitle').textContent = s ? 'Edit Layanan & Tarif' : 'Tambah Layanan Baru';
  document.getElementById('adminEditorBody').innerHTML = ('\n' +
    '        <form onsubmit="saveServiceForm(event, \'' + (escHtml(id)) + '\')">\n' +
    '          <div class="form-grid two-col">\n' +
    '            <div class="form-group">\n' +
    '              <label>Nama Layanan *</label>\n' +
    '              <input type="text" id="edSrvName" class="form-control" value="' + (escHtml(s ? s.Nama_Layanan : '')) + '" placeholder="Misal: Ojek / Kurir Makanan" required />\n' +
    '            </div>\n' +
    '            <div class="form-group">\n' +
    '              <label>Kategori Ikon (ojek / makan / paket)</label>\n' +
    '              <input type="text" id="edSrvIcon" class="form-control" value="' + (escHtml(s ? s.Ikon : 'ojek')) + '" placeholder="ojek / makan / paket" />\n' +
    '            </div>\n' +
    '          </div>\n' +
    '          <div class="form-grid two-col mt-12">\n' +
    '            <div class="form-group">\n' +
    '              <label>Tarif Minimal (Rp) *</label>\n' +
    '              <input type="number" id="edSrvMinFare" class="form-control" min="0" step="500" value="' + (s ? Number(s.Tarif_Minimal) : 6000) + '" required />\n' +
    '            </div>\n' +
    '            <div class="form-group">\n' +
    '              <label>Jarak Minimal (Km) *</label>\n' +
    '              <input type="number" id="edSrvMinKm" class="form-control" min="0" step="0.1" value="' + (s ? Number(s.Jarak_Minimal_Km) : 2) + '" required />\n' +
    '            </div>\n' +
    '          </div>\n' +
    '          <div class="form-grid two-col mt-12">\n' +
    '            <div class="form-group">\n' +
    '              <label>Tarif Per Km (Rp) *</label>\n' +
    '              <input type="number" id="edSrvPerKm" class="form-control" min="0" step="500" value="' + (s ? Number(s.Tarif_Per_Km) : 2500) + '" required />\n' +
    '            </div>\n' +
    '            <div class="form-group">\n' +
    '              <label>Status</label>\n' +
    '              <select id="edSrvStatus" class="form-control">\n' +
    '                <option value="Aktif" ' + (!s || s.Status === 'Aktif' || s.Status === 'Active' ? 'selected' : '') + '>Aktif</option>\n' +
    '                <option value="Nonaktif" ' + (s && (s.Status === 'Nonaktif' || s.Status === 'Inactive') ? 'selected' : '') + '>Nonaktif</option>\n' +
    '              </select>\n' +
    '            </div>\n' +
    '          </div>\n' +
    '          <button type="submit" class="btn-pill btn-primary mt-20" style="width:100%;">Simpan Layanan & Tarif</button>\n' +
    '        </form>');
  openModal('adminEditorModal');
}

async function saveServiceForm(e, id) {
  e.preventDefault();
  var payload = {
    idLayanan: id,
    namaLayanan: document.getElementById('edSrvName').value.trim(),
    ikon: document.getElementById('edSrvIcon').value.trim() || 'ojek',
    tarifMinimal: Number(document.getElementById('edSrvMinFare').value || 0),
    jarakMinimalKm: Number(document.getElementById('edSrvMinKm').value || 0),
    tarifPerKm: Number(document.getElementById('edSrvPerKm').value || 0),
    status: document.getElementById('edSrvStatus').value
  };

  try {
    var res = await SuruhAjaAPI.adminSaveTariffService(payload, getAuthToken());
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      closeModal('adminEditorModal');
      await bootstrapApp();
      loadAdminData();
    }
  } catch (err) {
    showToast('Gagal menyimpan layanan: ' + err.message, 'error');
  }
}

async function toggleTariffStatusUI(idLayanan, nextStatus) {
  try {
    var res = await SuruhAjaAPI.adminToggleTariffStatus(idLayanan, nextStatus, getAuthToken());
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      await bootstrapApp();
      loadAdminData();
    }
  } catch (err) {
    showToast('Gagal mengubah status layanan: ' + err.message, 'error');
  }
}

async function deleteServiceUI(id) {
  if (!confirm('Hapus layanan ini dari pengaturan_tarif?')) return;
  try {
    var res = await SuruhAjaAPI.adminDeleteTariffService(id, getAuthToken());
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      await bootstrapApp();
      loadAdminData();
    }
  } catch (err) {
    showToast('Gagal menghapus layanan: ' + err.message, 'error');
  }
}

/* --- Modal Edit/Tambah Promo --- */
function openPromoModal(id) {
  id = id || '';
  var p = id && state.adminData ? state.adminData.promos.find(function (x) { return x.ID === id; }) : null;
  document.getElementById('adminEditorTitle').textContent = p ? 'Edit Kode Promo' : 'Tambah Kode Promo';
  document.getElementById('adminEditorBody').innerHTML = ('\n' +
    '        <form onsubmit="savePromoForm(event, \'' + (escHtml(id)) + '\')">\n' +
    '          <div class="form-group">\n' +
    '            <label>Kode Promo</label>\n' +
    '            <input type="text" id="edPrmCode" class="form-control" value="' + (escHtml(p ? p.Code : '')) + '" placeholder="SURUHHARIINI" required />\n' +
    '          </div>\n' +
    '          <div class="form-group mt-12">\n' +
    '            <label>Judul Promo</label>\n' +
    '            <input type="text" id="edPrmTitle" class="form-control" value="' + (escHtml(p ? p.Title : '')) + '" required />\n' +
    '          </div>\n' +
    '          <div class="form-grid two-col mt-12">\n' +
    '            <div class="form-group">\n' +
    '              <label>Nominal Diskon (Rp)</label>\n' +
    '              <input type="number" id="edPrmDisc" class="form-control" min="0" value="' + (p ? Number(p.DiscountAmount) : 3000) + '" required />\n' +
    '            </div>\n' +
    '            <div class="form-group">\n' +
    '              <label>Min. Order (Rp)</label>\n' +
    '              <input type="number" id="edPrmMin" class="form-control" min="0" value="' + (p ? Number(p.MinOrder) : 10000) + '" required />\n' +
    '            </div>\n' +
    '          </div>\n' +
    '          <div class="form-group mt-12">\n' +
    '            <label>Status</label>\n' +
    '            <select id="edPrmStatus" class="form-control">\n' +
    '              <option value="Active" ' + (!p || p.Status === 'Active' ? 'selected' : '') + '>Active</option>\n' +
    '              <option value="Inactive" ' + (p && p.Status === 'Inactive' ? 'selected' : '') + '>Inactive</option>\n' +
    '            </select>\n' +
    '          </div>\n' +
    '          <button type="submit" class="btn-pill btn-primary mt-20" style="width:100%;">Simpan Promo</button>\n' +
    '        </form>');
  openModal('adminEditorModal');
}

async function savePromoForm(e, id) {
  e.preventDefault();
  var payload = {
    id: id,
    code: document.getElementById('edPrmCode').value.trim().toUpperCase(),
    title: document.getElementById('edPrmTitle').value.trim(),
    discountAmount: Number(document.getElementById('edPrmDisc').value || 0),
    minOrder: Number(document.getElementById('edPrmMin').value || 0),
    status: document.getElementById('edPrmStatus').value
  };

  try {
    var res = await SuruhAjaAPI.adminSavePromo(payload, getAuthToken());
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      closeModal('adminEditorModal');
      await bootstrapApp();
      loadAdminData();
    }
  } catch (err) {
    showToast('Gagal menyimpan promo: ' + err.message, 'error');
  }
}

async function deletePromoUI(id) {
  if (!confirm('Hapus kode promo ini?')) return;
  try {
    var res = await SuruhAjaAPI.adminDeletePromo(id, getAuthToken());
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      await bootstrapApp();
      loadAdminData();
    }
  } catch (err) {
    showToast('Gagal menghapus promo: ' + err.message, 'error');
  }
}

/* --- Upload Logo & Simpan Settings --- */
function previewLogoFile(e) {
  var file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('Ukuran logo maksimal 5 MB.', 'error');
    e.target.value = '';
    return;
  }
  var reader = new FileReader();
  reader.onload = function () {
    state.pendingLogoFile = { base64: reader.result, mimeType: file.type, fileName: file.name, file: file };
    document.getElementById('adminLogoPreview').innerHTML = ('<img src="' + (reader.result) + '" alt="Preview Logo" />');
  };
  reader.readAsDataURL(file);
}

async function handleUploadLogo() {
  if (!state.pendingLogoFile) {
    showToast('Pilih file gambar logo terlebih dahulu.', 'error');
    return;
  }
  var btn = document.getElementById('uploadLogoBtn');
  btn.disabled = true;
  btn.textContent = 'Mengupload...';

  try {
    var res = await SuruhAjaAPI.adminUploadLogo(state.pendingLogoFile, getAuthToken());
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success && res.data) {
      state.logoUrl = res.data.fileUrl;
      state.pendingLogoFile = null;
      renderLogoElements();
      loadAdminData();
    }
  } catch (err) {
    showToast('Gagal upload logo: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Upload & Simpan Logo';
  }
}

async function handleSaveSettings(e) {
  e.preventDefault();
  var btn = document.getElementById('saveSettingsBtn');
  var quotaInput = document.getElementById('setMaxDriverQuota');
  var maxQuotaVal = quotaInput ? parseInt(quotaInput.value, 10) : state.maxDriverQuota;
  var payload = {
    whatsappNumber: document.getElementById('setWaNumber').value.trim(),
    appName: state.appName,
    appTagline: document.getElementById('setTagline').value.trim(),
    maxDriverQuota: maxQuotaVal,
    saweriaUrl: document.getElementById('setSaweriaUrl').value.trim(),
    saweriaText: document.getElementById('setSaweriaText').value.trim(),
    footer: {
      brandName: document.getElementById('setFooterBrand').value.trim(),
      description: document.getElementById('setFooterDesc').value.trim(),
      address: document.getElementById('setFooterAddr').value.trim(),
      whatsapp: document.getElementById('setWaNumber').value.trim(),
      email: document.getElementById('setFooterEmail').value.trim(),
      instagram: document.getElementById('setFooterIg').value.trim(),
      copyright: document.getElementById('setFooterCopy').value.trim()
    }
  };

  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    var res = await SuruhAjaAPI.adminSaveSettings(payload, getAuthToken());
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      await bootstrapApp();
      loadAdminData();
    }
  } catch (err) {
    showToast('Gagal menyimpan pengaturan: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan Semua Pengaturan';
  }
}

async function handleChangeAdminPassword(e) {
  e.preventDefault();
  var oldPassword = document.getElementById('oldAdminPwd').value;
  var newPassword = document.getElementById('newAdminPwd').value;
  var confirmPassword = document.getElementById('confirmAdminPwd').value;
  var btn = document.getElementById('changePwdBtn');

  if (newPassword.length < 4) {
    showToast('Password baru minimal 4 karakter.', 'error');
    return;
  }
  if (newPassword !== confirmPassword) {
    showToast('Konfirmasi password baru tidak cocok.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    var res = await SuruhAjaAPI.adminChangePassword(
      { oldPassword: oldPassword, newPassword: newPassword, confirmPassword: confirmPassword },
      getAuthToken()
    );
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      document.getElementById('changeAdminPwdForm').reset();
    }
  } catch (err) {
    showToast('Gagal mengganti password: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan Password Baru';
  }
}

/* --- Admin: Toggle Status Buka / Tutup --- */
async function toggleStoreStatusUI() {
  var currentStatus = (state.adminData && state.adminData.settings && state.adminData.settings.storeStatus) || state.storeStatus;
  var nextStatus = currentStatus === 'CLOSED' ? 'OPEN' : 'CLOSED';
  var noteInput = document.getElementById('adminStatusNoteInput');
  var nextNote = (noteInput && noteInput.value.trim()) || (nextStatus === 'OPEN' ? 'Kurir Siap Jalan (07.00 - 21.00 WIB)' : 'Sedang Istirahat / Tutup');

  try {
    var res = await SuruhAjaAPI.adminSaveStoreStatus({ storeStatus: nextStatus, storeStatusNote: nextNote }, getAuthToken());
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      state.storeStatus = nextStatus;
      state.storeStatusNote = nextNote;
      renderStoreStatus();
      loadAdminData();
    }
  } catch (err) {
    showToast('Gagal mengubah status: ' + err.message, 'error');
  }
}

/* --- Admin: CRUD Warung Rekanan Cepu --- */
function openPartnerModal(id) {
  id = id || '';
  var list = (state.adminData && state.adminData.partners) || state.partners || [];
  var p = id ? list.find(function (x) { return x.id === id; }) : null;
  document.getElementById('adminEditorTitle').textContent = p ? 'Edit Warung Rekanan' : 'Tambah Warung Rekanan';
  document.getElementById('adminEditorBody').innerHTML = ('\n' +
    '        <form onsubmit="savePartnerForm(event, \'' + (escHtml(id)) + '\')">\n' +
    '          <div class="form-group">\n' +
    '            <label>Nama Warung / Toko</label>\n' +
    '            <input type="text" id="edPrtName" class="form-control" value="' + (escHtml(p ? p.name : '')) + '" placeholder="Misal: Ayam Geprek Mbak Yanti" required />\n' +
    '          </div>\n' +
    '          <div class="form-grid two-col mt-12">\n' +
    '            <div class="form-group">\n' +
    '              <label>Jenis Ikon (makan / minum / paket)</label>\n' +
    '              <input type="text" id="edPrtIcon" class="form-control" value="' + (escHtml(p ? p.icon : 'makan')) + '" placeholder="makan / minum / paket" />\n' +
    '            </div>\n' +
    '            <div class="form-group">\n' +
    '              <label>Label / Badge</label>\n' +
    '              <input type="text" id="edPrtBadge" class="form-control" value="' + (escHtml(p ? p.badge : 'Favorit')) + '" placeholder="Favorit / Laris" />\n' +
    '            </div>\n' +
    '          </div>\n' +
    '          <div class="form-group mt-12">\n' +
    '            <label>Saran Menu / Produk</label>\n' +
    '            <input type="text" id="edPrtHint" class="form-control" value="' + (escHtml(p ? p.menuHint : '')) + '" placeholder="Misal: Paket Geprek + Es Teh" />\n' +
    '          </div>\n' +
    '          <div class="form-grid two-col mt-12">\n' +
    '            <div class="form-group">\n' +
    '              <label>Kategori</label>\n' +
    '              <input type="text" id="edPrtCat" class="form-control" value="' + (escHtml(p ? p.category : 'Kuliner')) + '" />\n' +
    '            </div>\n' +
    '            <div class="form-group">\n' +
    '              <label>Status</label>\n' +
    '              <select id="edPrtStatus" class="form-control">\n' +
    '                <option value="Active" ' + (!p || p.status !== 'Inactive' ? 'selected' : '') + '>Active</option>\n' +
    '                <option value="Inactive" ' + (p && p.status === 'Inactive' ? 'selected' : '') + '>Inactive</option>\n' +
    '              </select>\n' +
    '            </div>\n' +
    '          </div>\n' +
    '          <button type="submit" class="btn-pill btn-primary mt-20" style="width:100%;">Simpan Warung Rekanan</button>\n' +
    '        </form>');
  openModal('adminEditorModal');
}

async function savePartnerForm(e, id) {
  e.preventDefault();
  var list = JSON.parse(JSON.stringify((state.adminData && state.adminData.partners) || state.partners || []));
  var item = {
    id: id || ('PRT-' + Date.now()),
    name: document.getElementById('edPrtName').value.trim(),
    icon: document.getElementById('edPrtIcon').value.trim() || 'makan',
    badge: document.getElementById('edPrtBadge').value.trim() || 'Rekanan',
    menuHint: document.getElementById('edPrtHint').value.trim(),
    category: document.getElementById('edPrtCat').value.trim() || 'Kuliner',
    status: document.getElementById('edPrtStatus').value
  };

  var idx = list.findIndex(function (x) { return x.id === item.id; });
  if (idx >= 0) list[idx] = item;
  else list.push(item);

  await persistPartnersList(list);
  closeModal('adminEditorModal');
}

async function deletePartnerUI(id) {
  if (!confirm('Hapus warung rekanan ini?')) return;
  var list = ((state.adminData && state.adminData.partners) || state.partners || []).filter(function (x) { return x.id !== id; });
  await persistPartnersList(list);
}

async function persistPartnersList(list) {
  try {
    var res = await SuruhAjaAPI.adminSavePartners(list, getAuthToken());
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      state.partners = res.data || list;
      renderPartners();
      loadAdminData();
    }
  } catch (err) {
    showToast('Gagal menyimpan rekanan: ' + err.message, 'error');
  }
}

/* --- Admin: CRUD Testimoni Warga Cepu --- */
function openTestimonialModal(id) {
  id = id || '';
  var list = (state.adminData && state.adminData.testimonials) || state.testimonials || [];
  var t = id ? list.find(function (x) { return x.id === id; }) : null;
  document.getElementById('adminEditorTitle').textContent = t ? 'Edit Testimoni' : 'Tambah Testimoni';
  var ratingOpts = [5, 4, 3, 2, 1].map(function (r) {
    return ('<option value="' + (r) + '" ' + ((t ? Number(t.rating) : 5) === r ? 'selected' : '') + '>' + (r) + ' Bintang</option>');
  }).join('');
  document.getElementById('adminEditorBody').innerHTML = ('\n' +
    '        <form onsubmit="saveTestimonialForm(event, \'' + (escHtml(id)) + '\')">\n' +
    '          <div class="form-group">\n' +
    '            <label>Nama Pelanggan & Area</label>\n' +
    '            <input type="text" id="edTstName" class="form-control" value="' + (escHtml(t ? t.name : '')) + '" placeholder="Misal: Mbak Rina — Balun, Cepu" required />\n' +
    '          </div>\n' +
    '          <div class="form-grid two-col mt-12">\n' +
    '            <div class="form-group">\n' +
    '              <label>Rating (1-5)</label>\n' +
    '              <select id="edTstRating" class="form-control">\n' +
    '                ' + (ratingOpts) + '\n' +
    '              </select>\n' +
    '            </div>\n' +
    '            <div class="form-group">\n' +
    '              <label>Status</label>\n' +
    '              <select id="edTstStatus" class="form-control">\n' +
    '                <option value="Active" ' + (!t || t.status !== 'Inactive' ? 'selected' : '') + '>Active</option>\n' +
    '                <option value="Inactive" ' + (t && t.status === 'Inactive' ? 'selected' : '') + '>Inactive</option>\n' +
    '              </select>\n' +
    '            </div>\n' +
    '          </div>\n' +
    '          <div class="form-group mt-12">\n' +
    '            <label>Isi Ulasan</label>\n' +
    '            <textarea id="edTstComment" class="form-control" required>' + (escHtml(t ? t.comment : '')) + '</textarea>\n' +
    '          </div>\n' +
    '          <button type="submit" class="btn-pill btn-primary mt-20" style="width:100%;">Simpan Testimoni</button>\n' +
    '        </form>');
  openModal('adminEditorModal');
}

async function saveTestimonialForm(e, id) {
  e.preventDefault();
  var list = JSON.parse(JSON.stringify((state.adminData && state.adminData.testimonials) || state.testimonials || []));
  var item = {
    id: id || ('TST-' + Date.now()),
    name: document.getElementById('edTstName').value.trim(),
    rating: Number(document.getElementById('edTstRating').value || 5),
    comment: document.getElementById('edTstComment').value.trim(),
    status: document.getElementById('edTstStatus').value
  };

  var idx = list.findIndex(function (x) { return x.id === item.id; });
  if (idx >= 0) list[idx] = item;
  else list.push(item);

  await persistTestimonialsList(list);
  closeModal('adminEditorModal');
}

async function deleteTestimonialUI(id) {
  if (!confirm('Hapus ulasan ini?')) return;
  var list = ((state.adminData && state.adminData.testimonials) || state.testimonials || []).filter(function (x) { return x.id !== id; });
  await persistTestimonialsList(list);
}

async function persistTestimonialsList(list) {
  try {
    var res = await SuruhAjaAPI.adminSaveTestimonials(list, getAuthToken());
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      state.testimonials = res.data || list;
      renderTestimonials();
      loadAdminData();
    }
  } catch (err) {
    showToast('Gagal menyimpan testimoni: ' + err.message, 'error');
  }
}

/* --- Admin: Kuota, Persetujuan, & CRUD Driver --- */
async function saveAdminDriverQuotaUI() {
  var inp = document.getElementById('adminMaxDriverQuota');
  var btn = document.getElementById('saveQuotaBtn');
  var val = inp ? parseInt(inp.value, 10) : 15;
  if (isNaN(val) || val < 1 || val > 1000) {
    showToast('Masukkan angka kuota antara 1 sampai 1000.', 'error');
    return;
  }

  if (btn) btn.disabled = true;
  try {
    var res = await SuruhAjaAPI.adminSaveDriverQuota(val, getAuthToken());
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      await bootstrapApp();
      loadAdminData();
    }
  } catch (err) {
    showToast('Gagal menyimpan kuota: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function updateDriverApprovalUI(driverId, nextStatus) {
  try {
    var res = await SuruhAjaAPI.adminUpdateDriverStatus(driverId, nextStatus, getAuthToken());
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      await bootstrapApp();
      loadAdminData();
    }
  } catch (err) {
    showToast('Gagal mengubah status driver: ' + err.message, 'error');
  }
}

function openDriverModal(id) {
  id = id || '';
  state.pendingAdminDriverPhoto = null;
  var list = (state.adminData && state.adminData.drivers) || state.drivers || [];
  var drv = id ? list.find(function (x) { return x.ID === id; }) : null;
  var curRowSt = drv ? String(drv.Status || 'AKTIF').toUpperCase() : 'AKTIF';
  var curStatusVal = curRowSt === 'PENDING' ? 'PENDING' : ((curRowSt === 'INACTIVE' || curRowSt === 'NONAKTIF') ? 'Inactive' : 'AKTIF');
  document.getElementById('adminEditorTitle').textContent = drv ? 'Edit Data Driver' : 'Tambah Driver Baru';
  document.getElementById('adminEditorBody').innerHTML = ('\n' +
    '        <form onsubmit="saveDriverForm(event, \'' + (escHtml(id)) + '\')">\n' +
    '          <div class="form-group">\n' +
    '            <label>Foto Profil Driver (Opsional)</label>\n' +
    '            <div style="display:flex; align-items:center; gap:12px; background:var(--bg-input); padding:10px 12px; border-radius:12px;">\n' +
    '              <div class="driver-avatar-circle" id="edDrvPhotoPreview" style="width:52px; height:52px; background:#ECFDF5;">\n' +
    '                ' + (drv ? renderDriverAvatarInner(drv.PhotoURL, drv.FullName) : getDriverVectorSvg(26)) + '\n' +
    '              </div>\n' +
    '              <input type="file" id="edDrvPhotoInput" accept="image/jpeg,image/png,image/webp" class="form-control" style="background:var(--bg-surface); padding:8px 10px; font-size:12px;" onchange="previewAdminDriverPhoto(event)" />\n' +
    '            </div>\n' +
    '          </div>\n' +
    '          <div class="form-group mt-12">\n' +
    '            <label>Nama Driver *</label>\n' +
    '            <input type="text" id="edDrvName" class="form-control" value="' + (escHtml(drv ? drv.FullName : '')) + '" placeholder="Contoh: Mas Andi" required />\n' +
    '          </div>\n' +
    '          <div class="form-grid two-col mt-12">\n' +
    '            <div class="form-group">\n' +
    '              <label>Email Google</label>\n' +
    '              <input type="email" id="edDrvEmail" class="form-control" value="' + (escHtml(drv && drv.Email ? drv.Email : '')) + '" placeholder="driver@gmail.com" />\n' +
    '            </div>\n' +
    '            <div class="form-group">\n' +
    '              <label>Nomor WhatsApp *</label>\n' +
    '              <input type="text" id="edDrvWa" class="form-control" value="' + (escHtml(drv ? drv.PhoneWA : '')) + '" placeholder="081234567890" required />\n' +
    '            </div>\n' +
    '          </div>\n' +
    '          <div class="form-grid two-col mt-12">\n' +
    '            <div class="form-group">\n' +
    '              <label>Jenis &amp; Warna Motor *</label>\n' +
    '              <input type="text" id="edDrvVeh" class="form-control" value="' + (escHtml(drv ? drv.VehicleType : 'Honda Beat Hitam')) + '" placeholder="Honda Beat Hitam" required />\n' +
    '            </div>\n' +
    '            <div class="form-group">\n' +
    '              <label>Pelat Nomor *</label>\n' +
    '              <input type="text" id="edDrvPlate" class="form-control" value="' + (escHtml(drv ? drv.PlateNumber : '')) + '" placeholder="K 1234 XX" required />\n' +
    '            </div>\n' +
    '          </div>\n' +
    '          <div class="form-group mt-12">\n' +
    '            <label>Area Mangkal / Jangkauan</label>\n' +
    '            <input type="text" id="edDrvArea" class="form-control" value="' + (escHtml(drv ? drv.Area : 'Area Cepu')) + '" placeholder="Cepu Kota / Balun / Ngelo" />\n' +
    '          </div>\n' +
    '          <div class="form-grid two-col mt-12">\n' +
    '            <div class="form-group">\n' +
    '              <label>Status Persetujuan Akun</label>\n' +
    '              <select id="edDrvStatus" class="form-control">\n' +
    '                <option value="AKTIF" ' + (curStatusVal === 'AKTIF' ? 'selected' : '') + '>AKTIF (Disetujui &amp; Bisa Order)</option>\n' +
    '                <option value="PENDING" ' + (curStatusVal === 'PENDING' ? 'selected' : '') + '>PENDING (Menunggu Persetujuan)</option>\n' +
    '                <option value="Inactive" ' + (curStatusVal === 'Inactive' ? 'selected' : '') + '>Nonaktif / Diblokir</option>\n' +
    '              </select>\n' +
    '            </div>\n' +
    '            <div class="form-group">\n' +
    '              <label>Kondisi Saat Ini</label>\n' +
    '              <select id="edDrvCond" class="form-control">\n' +
    '                <option value="Standby" ' + (!drv || drv.ApprovalStatus === 'Standby' || drv.ApprovalStatus === 'AKTIF' || drv.ApprovalStatus === 'Diterima' ? 'selected' : '') + '>Standby (Siap Jalan)</option>\n' +
    '                <option value="Sibuk" ' + (drv && drv.ApprovalStatus === 'Sibuk' ? 'selected' : '') + '>Sibuk / Sedang Antar</option>\n' +
    '                <option value="PENDING" ' + (drv && drv.ApprovalStatus === 'PENDING' ? 'selected' : '') + '>PENDING</option>\n' +
    '                <option value="Nonaktif" ' + (drv && drv.ApprovalStatus === 'Nonaktif' ? 'selected' : '') + '>Libur / Off</option>\n' +
    '              </select>\n' +
    '            </div>\n' +
    '          </div>\n' +
    '          <button type="submit" class="btn-pill btn-primary mt-20" style="width:100%;">Simpan Driver</button>\n' +
    '        </form>');
  openModal('adminEditorModal');
}

function previewAdminDriverPhoto(e) {
  var file = e.target.files[0];
  var prevEl = document.getElementById('edDrvPhotoPreview');
  if (!file) {
    state.pendingAdminDriverPhoto = null;
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('Ukuran foto maksimal 5 MB.', 'error');
    e.target.value = '';
    state.pendingAdminDriverPhoto = null;
    return;
  }
  var reader = new FileReader();
  reader.onload = function () {
    state.pendingAdminDriverPhoto = { base64: reader.result, mimeType: file.type, fileName: file.name, file: file };
    if (prevEl) prevEl.innerHTML = '<img src="' + reader.result + '" alt="Preview" />';
  };
  reader.readAsDataURL(file);
}

async function saveDriverForm(e, id) {
  e.preventDefault();
  var payload = {
    id: id,
    fullName: document.getElementById('edDrvName').value.trim(),
    email: document.getElementById('edDrvEmail').value.trim().toLowerCase(),
    phoneWA: document.getElementById('edDrvWa').value.trim(),
    vehicleType: document.getElementById('edDrvVeh').value.trim() || 'Motor',
    plateNumber: document.getElementById('edDrvPlate').value.trim().toUpperCase(),
    area: document.getElementById('edDrvArea').value.trim() || 'Area Cepu',
    availability: document.getElementById('edDrvCond').value,
    status: document.getElementById('edDrvStatus').value,
    photoFile: state.pendingAdminDriverPhoto
  };
  if (payload.status === 'AKTIF' && payload.availability === 'PENDING') {
    payload.availability = 'Standby';
  }

  try {
    var res = await SuruhAjaAPI.adminSaveDriver(payload, getAuthToken());
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      state.pendingAdminDriverPhoto = null;
      closeModal('adminEditorModal');
      await bootstrapApp();
      loadAdminData();
    }
  } catch (err) {
    showToast('Gagal menyimpan driver: ' + err.message, 'error');
  }
}

async function deleteDriverUI(id) {
  if (!confirm('Hapus data driver ini?')) return;
  try {
    var res = await SuruhAjaAPI.adminDeleteDriver(id, getAuthToken());
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      await bootstrapApp();
      loadAdminData();
    }
  } catch (err) {
    showToast('Gagal menghapus driver: ' + err.message, 'error');
  }
}

/* ========================================================================
 * 9. EKSPOS GLOBAL & STARTUP
 * ======================================================================== */
window.switchView = switchView;
window.scrollToOrderForm = scrollToOrderForm;
window.handleOrderNowAction = handleOrderNowAction;
window.scrollToServices = scrollToServices;
window.toggleTheme = toggleTheme;
window.showToast = showToast;
window.getWhatsAppIconSvg = getWhatsAppIconSvg;
window.getDriverVectorSvg = getDriverVectorSvg;
window.openModal = openModal;
window.closeModal = closeModal;
window.togglePasswordVisibility = togglePasswordVisibility;
window.openAuthModal = openAuthModal;
window.loginWithGoogleCustomer = loginWithGoogleCustomer;
window.logoutGoogleCustomer = logoutGoogleCustomer;
window.handleLoginSubmit = handleLoginSubmit;
window.handleRegisterSubmit = handleRegisterSubmit;
window.handleLogout = handleLogout;
window.selectService = selectService;
window.chooseServiceAndOrder = chooseServiceAndOrder;
window.onServiceChange = onServiceChange;
window.setMapPinMode = setMapPinMode;
window.locateUserGPS = locateUserGPS;
window.searchCepuAddress = searchCepuAddress;
window.selectNominatimResult = selectNominatimResult;
window.selectDriverCard = selectDriverCard;
window.onDriverChange = onDriverChange;
window.loginDriverViaGoogle = loginDriverViaGoogle;
window.loginGoogleForDriverRegistration = loginGoogleForDriverRegistration;
window.syncRegSubmitState = syncRegSubmitState;
window.saveAdminDriverQuotaUI = saveAdminDriverQuotaUI;
window.updateDriverApprovalUI = updateDriverApprovalUI;
window.handleDriverUpdateOwnPhoto = handleDriverUpdateOwnPhoto;
window.previewAdminDriverPhoto = previewAdminDriverPhoto;
window.applyQuickTask = applyQuickTask;
window.applyPromoCode = applyPromoCode;
window.applyPromoChip = applyPromoChip;
window.onPromoInputEdit = onPromoInputEdit;
window.handleOrderSubmit = handleOrderSubmit;
window.copyLastOrderMessage = copyLastOrderMessage;
window.loadCustomerOrders = loadCustomerOrders;
window.formatWhatsAppNumber = formatWhatsAppNumber;
window.repeatOrder = repeatOrder;
window.clearCustomerOrdersHistory = clearCustomerOrdersHistory;
window.orderFromPartnerByIdx = orderFromPartnerByIdx;
window.handleLogoImgError = handleLogoImgError;
window.loadDriverData = loadDriverData;
window.setDriverOrderFilter = setDriverOrderFilter;
window.changeMyDriverStatus = changeMyDriverStatus;
window.driverSetOrderStatus = driverSetOrderStatus;
window.switchAdminTab = switchAdminTab;
window.loadAdminData = loadAdminData;
window.setAdminOrderFilter = setAdminOrderFilter;
window.renderAdminOrdersTable = renderAdminOrdersTable;
window.adminUpdateOrderStatusUI = adminUpdateOrderStatusUI;
window.openServiceModal = openServiceModal;
window.saveServiceForm = saveServiceForm;
window.toggleTariffStatusUI = toggleTariffStatusUI;
window.deleteServiceUI = deleteServiceUI;
window.openPromoModal = openPromoModal;
window.savePromoForm = savePromoForm;
window.deletePromoUI = deletePromoUI;
window.previewLogoFile = previewLogoFile;
window.handleUploadLogo = handleUploadLogo;
window.handleSaveSettings = handleSaveSettings;
window.handleChangeAdminPassword = handleChangeAdminPassword;
window.toggleStoreStatusUI = toggleStoreStatusUI;
window.openPartnerModal = openPartnerModal;
window.savePartnerForm = savePartnerForm;
window.deletePartnerUI = deletePartnerUI;
window.openTestimonialModal = openTestimonialModal;
window.saveTestimonialForm = saveTestimonialForm;
window.deleteTestimonialUI = deleteTestimonialUI;
window.openDriverModal = openDriverModal;
window.saveDriverForm = saveDriverForm;
window.deleteDriverUI = deleteDriverUI;

function bindSafeEventListeners() {
  bindEventSafe('brandHomeLink', 'click', function () { switchView('home'); });
  bindEventSafe('themeToggleBtn', 'click', function () { toggleTheme(); });
  bindEventSafe('googleNavBtn', 'click', function () { loginWithGoogleCustomer(); });
  bindEventSafe('driverNavBtn', 'click', function () { switchView('driver'); });
  bindEventSafe('adminNavBtn', 'click', function () { switchView('admin'); });
  bindEventSafe('authNavBtn', 'click', function () {
    if (state.user) switchView('profile');
    else openAuthModal('login');
  });

  bindEventSafe('googleTopLoginBtn', 'click', function () { loginWithGoogleCustomer(); });
  bindEventSafe('googleLoginGateBtn', 'click', function () { loginWithGoogleCustomer(); });
  bindEventSafe('googleLogoutTopBtn', 'click', function () { logoutGoogleCustomer(); });

  bindEventSafe('heroOrderNowBtn', 'click', function () { handleOrderNowAction(); });
  bindEventSafe('heroOrdersBtn', 'click', function () { switchView('orders'); });
  bindEventSafe('footerOrderLink', 'click', function () { handleOrderNowAction(); });
  bindEventSafe('footerOrdersLink', 'click', function () { switchView('orders'); });
  bindEventSafe('footerRegDriverLink', 'click', function () { openAuthModal('register'); });
  bindEventSafe('footerLoginLink', 'click', function () { openAuthModal('login'); });

  document.querySelectorAll('.bnav-item').forEach(function (btn) {
    bindEventSafe(btn, 'click', function () {
      var v = btn.dataset ? btn.dataset.view : '';
      if (v === 'services') scrollToServices();
      else if (v) switchView(v);
    });
  });

  bindEventSafe('orderForm', 'submit', handleOrderSubmit);
  bindEventSafe('orderServiceSelect', 'change', onServiceChange);
  bindEventSafe('pinModePickupBtn', 'click', function () { setMapPinMode('pickup'); });
  bindEventSafe('pinModeDropoffBtn', 'click', function () { setMapPinMode('dropoff'); });
  bindEventSafe('pickupCoordCard', 'click', function () { setMapPinMode('pickup'); });
  bindEventSafe('dropoffCoordCard', 'click', function () { setMapPinMode('dropoff'); });
  bindEventSafe('gpsLocateBtn', 'click', locateUserGPS);
  bindEventSafe('mapSearchBtn', 'click', searchCepuAddress);
  bindEventSafe('mapSearchInput', 'keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchCepuAddress();
    }
  });
  bindEventSafe('orderPromoInput', 'input', onPromoInputEdit);
  bindEventSafe('applyPromoBtn', 'click', applyPromoCode);

  bindEventSafe('refreshCustOrdersBtn', 'click', function () { loadCustomerOrders(); });
  bindEventSafe('clearOrdersBtn', 'click', clearCustomerOrdersHistory);
  bindEventSafe('newOrderFromOrdersBtn', 'click', handleOrderNowAction);

  bindEventSafe('driverRefreshBtn', 'click', loadDriverData);
  bindEventSafe('driverHomeBtn', 'click', function () { switchView('home'); });

  bindEventSafe('profileLoginBtn', 'click', function () { openAuthModal('login'); });
  bindEventSafe('profileRegisterBtn', 'click', function () { openAuthModal('register'); });
  bindEventSafe('profileDriverBtn', 'click', function () { switchView('driver'); });
  bindEventSafe('profileAdminBtn', 'click', function () { switchView('admin'); });
  bindEventSafe('profileOrdersBtn', 'click', function () { switchView('orders'); });
  bindEventSafe('profileLogoutBtn', 'click', handleLogout);

  bindEventSafe('adminRefreshBtn', 'click', loadAdminData);
  bindEventSafe('adminHomeBtn', 'click', function () { switchView('home'); });
  document.querySelectorAll('.admin-tab').forEach(function (tabBtn) {
    bindEventSafe(tabBtn, 'click', function () {
      var t = tabBtn.dataset ? tabBtn.dataset.atab : '';
      if (t) switchAdminTab(t);
    });
  });
  bindEventSafe('adminSettingsForm', 'submit', handleSaveSettings);
  bindEventSafe('changeAdminPwdForm', 'submit', handleChangeAdminPassword);

  bindEventSafe('closeAuthModalBtn', 'click', function () { closeModal('authModal'); });
  bindEventSafe('driverGoogleLoginBtn', 'click', loginDriverViaGoogle);
  bindEventSafe('loginForm', 'submit', handleLoginSubmit);
  bindEventSafe('gotoRegisterLink', 'click', function () { openAuthModal('register'); });
  bindEventSafe('regWaitlistLoginLink', 'click', function () { openAuthModal('login'); });
  bindEventSafe('gotoLoginLink', 'click', function () { openAuthModal('login'); });
  bindEventSafe('regGoogleLoginBtn', 'click', loginGoogleForDriverRegistration);
  bindEventSafe('regRulesAgreeCheckbox', 'change', syncRegSubmitState);
  bindEventSafe('registerForm', 'submit', handleRegisterSubmit);
  bindEventSafe('copyLastOrderBtn', 'click', copyLastOrderMessage);
  bindEventSafe('closeSuccessModalBtn', 'click', function () { closeModal('orderSuccessModal'); });
  bindEventSafe('closeAdminEditorModalBtn', 'click', function () { closeModal('adminEditorModal'); });

  document.querySelectorAll('.modal-backdrop').forEach(function (backdrop) {
    bindEventSafe(backdrop, 'click', function (e) {
      if (e.target === backdrop) backdrop.classList.remove('open');
    });
  });
  if (!window.__suruhAjaEscBound) {
    window.__suruhAjaEscBound = true;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.open').forEach(function (m) {
          m.classList.remove('open');
        });
      }
    });
  }
}

function bootAppSafe() {
  if (window.__suruhAjaBooted) return;
  window.__suruhAjaBooted = true;
  try { bindSafeEventListeners(); } catch (errBind) { console.error('bindSafeEventListeners err:', errBind); }
  try { bootstrapApp(); } catch (errBoot) { console.error('bootstrapApp err:', errBoot); }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootAppSafe);
} else {
  bootAppSafe();
}
