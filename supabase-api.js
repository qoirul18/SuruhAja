/**
 * ============================================================================
 * SURUHAJA CEPU — SUPABASE CLIENT & BACKEND LOGIC (supabase-api.js)
 * ============================================================================
 * Menggantikan seluruh logika server Google Apps Script (code.gs & Setup.gs)
 * menjadi query langsung ke Supabase JS v2 & Supabase Storage (bucket: uploads).
 * ============================================================================
 */
(function (global) {
  'use strict';

  var SUPABASE_URL = 'https://rrrcqutdsyhrzjsgzpgs.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_tfJizPKNCJ5sZM32V4mVjg_jKpniXs0';

  var TABLES = {
    USERS: 'users',
    SERVICES: 'services',
    TARIFF_SETTINGS: 'pengaturan_tarif',
    PRICING: 'pricing',
    PROMOS: 'promos',
    ORDERS: 'orders',
    DRIVERS: 'drivers',
    HERO_CAROUSEL: 'herocarousel',
    FILES: 'files',
    SETTINGS: 'settings'
  };

  var STORAGE_BUCKET = 'uploads';
  var SESSION_DURATION_HOURS = 72;
  var SESSION_TOKEN_KEY = 'suruhaja_session_token';
  var SESSION_META_KEY = 'suruhaja_session_meta';
  var MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
  var ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  var _supabaseClient = null;

  function getClient() {
    if (_supabaseClient) return _supabaseClient;
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      throw new Error('Library @supabase/supabase-js v2 belum termuat.');
    }
    _supabaseClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return _supabaseClient;
  }

  /* --------------------------------------------------------------------------
   * Response & Utility Helpers
   * -------------------------------------------------------------------------- */
  function resOk(data, message) {
    return {
      success: true,
      message: message || 'Berhasil',
      data: data !== undefined ? data : null
    };
  }

  function resErr(message, code, data) {
    var obj = {
      success: false,
      message: message || 'Terjadi kesalahan pada server. Silakan coba lagi.',
      data: data !== undefined ? data : null
    };
    if (code) obj.code = code;
    return obj;
  }

  function cleanStr(val, maxLen) {
    var s = val === null || val === undefined ? '' : String(val).trim();
    if (maxLen && s.length > maxLen) {
      s = s.substring(0, maxLen);
    }
    return s;
  }

  function randomHex(len) {
    var bytes = new Uint8Array(Math.ceil(len / 2));
    if (global.crypto && typeof global.crypto.getRandomValues === 'function') {
      global.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(bytes, function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('').substring(0, len);
  }

  function generateUuid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return randomHex(8) + '-' + randomHex(4) + '-4' + randomHex(3) + '-' + randomHex(4) + '-' + randomHex(12);
  }

  function generateId(prefix) {
    return (prefix || 'ID') + '-' + randomHex(8).toUpperCase();
  }

  function formatRp(num) {
    var n = Math.round(Number(num || 0));
    return 'Rp ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function getJakartaDateStr(dateInput) {
    var d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d);
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  }

  function normalizePhoneWA(phone) {
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

  function normalizePlateNumber(plate) {
    return String(plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  /* --------------------------------------------------------------------------
   * SHA-256 Hashing (Compatible with Setup.gs: SHA-256 of `${salt}:${password}`)
   * -------------------------------------------------------------------------- */
  function sha256Fallback(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var lengthProperty = 'length';
    var i, j;
    var result = '';
    var words = [];
    var asciiBitLength = ascii[lengthProperty] * 8;
    var hash = [];
    var k = [];
    var primeCounter = 0;
    var isComposite = {};

    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }

    ascii += '\x80';
    while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return '';
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
    words[words[lengthProperty]] = asciiBitLength;

    for (j = 0; j < words[lengthProperty];) {
      var w = words.slice(j, (j += 16));
      var oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7] +
          (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
          ((e & hash[5]) ^ ((~e) & hash[6])) +
          k[i] +
          (w[i] = i < 16 ? w[i] : (
            w[i - 16] +
            (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
            w[i - 7] +
            (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
          ) | 0);
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
          ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }

    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? '0' : '') + b.toString(16);
      }
    }
    return result;
  }

  async function hashPassword(password, salt) {
    var input = String(salt || '') + ':' + String(password || '');
    if (global.crypto && global.crypto.subtle && typeof TextEncoder !== 'undefined') {
      try {
        var data = new TextEncoder().encode(input);
        var digest = await global.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest), function (b) {
          return b.toString(16).padStart(2, '0');
        }).join('');
      } catch (e) {
        // Fallback below
      }
    }
    var utf8 = unescape(encodeURIComponent(input));
    return sha256Fallback(utf8);
  }

  /* --------------------------------------------------------------------------
   * Local Session Management (Validated against Supabase `users` table)
   * -------------------------------------------------------------------------- */
  function saveLocalSession(userRow) {
    var token = generateUuid() + '-' + randomHex(8);
    var now = new Date();
    var expires = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
    var meta = {
      token: token,
      userId: userRow.ID,
      username: userRow.Username,
      role: userRow.Role,
      expiresAt: expires.toISOString()
    };
    try {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
      localStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
    } catch (e) {}
    return token;
  }

  function readLocalSessionMeta(token) {
    try {
      var raw = localStorage.getItem(SESSION_META_KEY);
      if (!raw) return null;
      var meta = JSON.parse(raw);
      if (!meta || !meta.token || !meta.userId) return null;
      if (token && String(meta.token) !== String(token)) return null;
      if (new Date(meta.expiresAt).getTime() <= Date.now()) return null;
      return meta;
    } catch (e) {
      return null;
    }
  }

  function clearLocalSession() {
    try {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      localStorage.removeItem(SESSION_META_KEY);
    } catch (e) {}
  }

  /* --------------------------------------------------------------------------
   * Supabase Table Helpers
   * -------------------------------------------------------------------------- */
  async function fetchAllRows(tableName) {
    var sb = getClient();
    var res = await sb.from(tableName).select('*');
    if (res.error) {
      throw new Error('Supabase [' + tableName + ']: ' + res.error.message);
    }
    return Array.isArray(res.data) ? res.data : [];
  }

  async function getSettingsMap() {
    var rows = await fetchAllRows(TABLES.SETTINGS);
    var map = {};
    rows.forEach(function (r) {
      if (r && r.Key !== undefined && r.Key !== null) {
        map[String(r.Key)] = r.Value;
      }
    });
    return map;
  }

  async function upsertSetting(key, value, actor) {
    var sb = getClient();
    var now = new Date().toISOString();
    var existing = await sb.from(TABLES.SETTINGS).select('Key').eq('Key', String(key)).limit(1);
    if (existing.error) {
      throw new Error('Gagal membaca settings: ' + existing.error.message);
    }
    if (existing.data && existing.data.length > 0) {
      var upd = await sb.from(TABLES.SETTINGS).update({
        Value: String(value === undefined || value === null ? '' : value),
        UpdatedAt: now,
        UpdatedBy: actor || 'Admin'
      }).eq('Key', String(key));
      if (upd.error) throw new Error('Gagal memperbarui settings: ' + upd.error.message);
    } else {
      var ins = await sb.from(TABLES.SETTINGS).insert({
        Key: String(key),
        Value: String(value === undefined || value === null ? '' : value),
        UpdatedAt: now,
        UpdatedBy: actor || 'Admin'
      });
      if (ins.error) throw new Error('Gagal menambah settings: ' + ins.error.message);
    }
  }

  function getDriverPhotosMap(settingsMap) {
    try {
      return JSON.parse((settingsMap && settingsMap.DriverPhotosJSON) || '{}');
    } catch (e) {
      return {};
    }
  }

  async function saveDriverPhotoUrl(driverId, photoUrl, actor) {
    if (!driverId || !photoUrl) return;
    var settings = await getSettingsMap();
    var map = getDriverPhotosMap(settings);
    map[String(driverId)] = String(photoUrl);
    await upsertSetting('DriverPhotosJSON', JSON.stringify(map), actor || 'System');
  }

  function extractDriverEmail(driverObj) {
    if (!driverObj) return '';
    if (driverObj.Email) return String(driverObj.Email).trim().toLowerCase();
    var m = String(driverObj.Notes || '').match(/\[Google:\s*([^\]]+)\]/i);
    return m ? String(m[1]).trim().toLowerCase() : '';
  }

  function isDriverPending(driverObj) {
    if (!driverObj || driverObj.Status === 'Deleted') return false;
    var st = String(driverObj.Status || '').trim().toUpperCase();
    var app = String(driverObj.ApprovalStatus || '').trim().toUpperCase();
    return st === 'PENDING' || app === 'PENDING' || app === 'MENUNGGU';
  }

  function isDriverApprovedActive(driverObj) {
    if (!driverObj || driverObj.Status === 'Deleted') return false;
    var st = String(driverObj.Status || '').trim().toUpperCase();
    var app = String(driverObj.ApprovalStatus || '').trim().toUpperCase();
    if (isDriverPending(driverObj)) return false;
    if (st === 'INACTIVE' || st === 'NONAKTIF' || app === 'DITOLAK') return false;
    return st === 'AKTIF' || st === 'ACTIVE';
  }

  function computeDriverQuota(driversList, settingsMap) {
    var parsedMax = parseInt(settingsMap && settingsMap.MaxDriverQuota, 10);
    var maxQuota = (!isNaN(parsedMax) && parsedMax >= 1) ? parsedMax : 15;
    var activeCount = 0;
    var pendingCount = 0;

    (driversList || []).forEach(function (d) {
      if (!d || d.Status === 'Deleted') return;
      if (isDriverPending(d)) pendingCount++;
      else if (isDriverApprovedActive(d)) activeCount++;
    });

    var usedCount = activeCount + pendingCount;
    return {
      maxQuota: maxQuota,
      activeCount: activeCount,
      pendingCount: pendingCount,
      usedCount: usedCount,
      remainingSlots: Math.max(0, maxQuota - usedCount),
      isFull: usedCount >= maxQuota
    };
  }

  function findDriverForUser(drivers, user) {
    if (!Array.isArray(drivers) || !user) return null;
    var userPhone = normalizePhoneWA(user.phone);
    var usernameLower = String(user.username || '').toLowerCase();
    var userEmailLower = String(user.email || '').trim().toLowerCase();
    var profileDriverId = user.driverProfile ? String(user.driverProfile.driverId) : '';

    return drivers.filter(function (d) {
      if (!d || d.Status === 'Deleted') return false;
      var matchId = profileDriverId && String(d.ID) === profileDriverId;
      var matchEmail = userEmailLower && extractDriverEmail(d) === userEmailLower;
      var matchCreator = usernameLower && String(d.CreatedBy || '').toLowerCase() === usernameLower;
      var matchPhone = userPhone && normalizePhoneWA(d.PhoneWA) === userPhone;
      return matchId || matchEmail || matchCreator || matchPhone;
    })[0] || null;
  }

  async function syncLinkedDriverUserStatus(driverObj, newUserStatus, actor) {
    if (!driverObj) return;
    var sb = getClient();
    var drvEmail = extractDriverEmail(driverObj);
    var drvPhone = normalizePhoneWA(driverObj.PhoneWA);
    var drvCreator = String(driverObj.CreatedBy || '').toLowerCase();
    var users = await fetchAllRows(TABLES.USERS);
    var now = new Date().toISOString();

    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      if (u.Role !== 'Driver' || u.Status === 'Deleted') continue;
      var uEmail = String(u.Email || '').trim().toLowerCase();
      var uUser = String(u.Username || '').trim().toLowerCase();
      var uPhone = normalizePhoneWA(u.Phone);
      if ((drvEmail && uEmail === drvEmail) || (drvCreator && uUser === drvCreator) || (drvPhone && uPhone === drvPhone)) {
        await sb.from(TABLES.USERS).update({
          Status: newUserStatus,
          UpdatedAt: now,
          UpdatedBy: actor || 'Admin'
        }).eq('ID', u.ID);
      }
    }
  }

  function normalizeTariffRow(r) {
    var statusRaw = cleanStr(r.Status !== undefined ? r.Status : r['Status (Aktif/Nonaktif)'], 20) || 'Aktif';
    var statusNorm = (statusRaw === 'Inactive' || statusRaw === 'Nonaktif') ? 'Nonaktif' : (statusRaw === 'Deleted' ? 'Deleted' : 'Aktif');
    var minFareRaw = r.Tarif_Minimal !== undefined ? r.Tarif_Minimal : r['Tarif_Minimal (Rp)'];
    var perKmRaw = r.Tarif_Per_Km !== undefined ? r.Tarif_Per_Km : r['Tarif_Per_Km (Rp)'];
    return {
      ID_Layanan: cleanStr(r.ID_Layanan, 50),
      Nama_Layanan: cleanStr(r.Nama_Layanan, 80),
      Ikon: cleanStr(r.Ikon, 16) || 'ojek',
      Tarif_Minimal: Math.max(0, Number(minFareRaw || 0)),
      Jarak_Minimal_Km: Math.max(0, Number(r.Jarak_Minimal_Km || 0)),
      Tarif_Per_Km: Math.max(0, Number(perKmRaw || 0)),
      Status: statusNorm
    };
  }

  function calculateDistanceFare(tariffRow, distanceKm) {
    var minFare = Math.max(0, Number((tariffRow && tariffRow.Tarif_Minimal) || 0));
    var minKm = Math.max(0, Number((tariffRow && tariffRow.Jarak_Minimal_Km) || 0));
    var perKm = Math.max(0, Number((tariffRow && tariffRow.Tarif_Per_Km) || 0));
    var dist = Math.max(0, Math.round(Number(distanceKm || 0) * 10) / 10);
    var extraKm = Math.max(0, Math.round((dist - minKm) * 10) / 10);
    var extraFare = Math.round(extraKm * perKm);
    return {
      distanceKm: dist,
      baseFare: minFare,
      extraKm: extraKm,
      extraFare: extraFare,
      subtotal: minFare + extraFare
    };
  }

  async function softDeleteById(tableName, id, actor, notFoundMsg, successMsg) {
    var sb = getClient();
    var existing = await sb.from(tableName).select('ID, Status').eq('ID', String(id)).limit(1);
    if (existing.error) throw new Error(existing.error.message);
    if (!existing.data || !existing.data.length || existing.data[0].Status === 'Deleted') {
      return resErr(notFoundMsg);
    }
    var now = new Date().toISOString();
    var upd = await sb.from(tableName).update({
      Status: 'Deleted',
      UpdatedAt: now,
      UpdatedBy: actor || 'Admin'
    }).eq('ID', String(id));
    if (upd.error) throw new Error(upd.error.message);
    return resOk(null, successMsg);
  }

  /* --------------------------------------------------------------------------
   * Session Validation & Role Guards
   * -------------------------------------------------------------------------- */
  async function validateSessionInternal(token) {
    var meta = readLocalSessionMeta(token);
    if (!meta) return null;

    var sb = getClient();
    var userRes = await sb.from(TABLES.USERS).select('*').eq('ID', String(meta.userId)).limit(1);
    if (userRes.error || !userRes.data || !userRes.data.length) return null;

    var u = userRes.data[0];
    var isAllowedStatus = u.Status === 'Active' || (u.Role === 'Driver' && String(u.Status || '').toUpperCase() === 'PENDING');
    if (!isAllowedStatus || u.Status === 'Deleted') return null;

    var addresses = [];
    try { addresses = JSON.parse(u.SavedAddressesJSON || '[]'); } catch (e) { addresses = []; }

    var driverProfile = null;
    if (u.Role === 'Driver') {
      var results = await Promise.all([getSettingsMap(), fetchAllRows(TABLES.DRIVERS)]);
      var settingsMap = results[0];
      var drivers = results[1];
      var driverPhotos = getDriverPhotosMap(settingsMap);
      var drv = findDriverForUser(drivers, {
        username: u.Username,
        email: u.Email,
        phone: u.Phone
      });
      if (drv) {
        driverProfile = {
          driverId: drv.ID,
          fullName: drv.FullName,
          email: extractDriverEmail(drv) || u.Email,
          phoneWA: drv.PhoneWA,
          area: drv.Area,
          vehicleType: drv.VehicleType,
          plateNumber: drv.PlateNumber,
          approvalStatus: drv.ApprovalStatus || 'PENDING',
          status: drv.Status || 'PENDING',
          isApproved: isDriverApprovedActive(drv),
          photoUrl: driverPhotos[String(drv.ID)] || ''
        };
      }
    }

    return {
      id: u.ID,
      username: u.Username,
      email: u.Email,
      fullName: u.FullName,
      phone: u.Phone,
      role: u.Role,
      driverProfile: driverProfile,
      savedAddresses: addresses
    };
  }

  async function requireAdmin(sessionToken) {
    var user = await validateSessionInternal(sessionToken);
    if (!user || user.role !== 'Admin') {
      throw new Error('Akses ditolak. Hanya Admin yang diizinkan melakukan tindakan ini.');
    }
    return user;
  }

  async function requireDriver(sessionToken) {
    var user = await validateSessionInternal(sessionToken);
    if (!user || user.role !== 'Driver') {
      throw new Error('Akses ditolak. Hanya Driver terdaftar yang diizinkan.');
    }
    return user;
  }

  /* --------------------------------------------------------------------------
   * Supabase Storage Upload Helper (Bucket: `uploads` + Table: `files`)
   * -------------------------------------------------------------------------- */
  function base64ToBlob(base64Data, mimeType) {
    var cleanBase64 = String(base64Data).replace(/^data:[^;]+;base64,/, '');
    var byteChars = atob(cleanBase64);
    var byteNumbers = new Array(byteChars.length);
    for (var i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  }

  async function uploadImageToStorage(fileData, category, refId, uploadedBy) {
    if (!fileData) {
      throw new Error('Data file tidak lengkap.');
    }

    var blob = null;
    var mime = '';
    var rawName = 'image.png';

    if (typeof File !== 'undefined' && fileData instanceof File) {
      blob = fileData;
      mime = String(fileData.type || '').toLowerCase();
      rawName = fileData.name || 'image.png';
    } else if (typeof Blob !== 'undefined' && fileData instanceof Blob) {
      blob = fileData;
      mime = String(fileData.type || '').toLowerCase();
      rawName = 'image.png';
    } else if (fileData.file instanceof Blob) {
      blob = fileData.file;
      mime = String(fileData.mimeType || fileData.file.type || '').toLowerCase();
      rawName = fileData.fileName || fileData.file.name || 'image.png';
    } else if (fileData.base64 && fileData.mimeType) {
      mime = String(fileData.mimeType).toLowerCase();
      rawName = fileData.fileName || 'image.png';
      blob = base64ToBlob(fileData.base64, mime);
    } else {
      throw new Error('Data file tidak lengkap.');
    }

    if (ALLOWED_MIMES.indexOf(mime) === -1) {
      throw new Error('Format gambar tidak didukung. Gunakan JPG, JPEG, PNG, atau WEBP.');
    }
    if (blob.size > MAX_UPLOAD_BYTES) {
      throw new Error('Ukuran gambar melebihi batas maksimal 5 MB.');
    }

    var origName = cleanStr(rawName, 100).replace(/[^a-zA-Z0-9._-]/g, '_');
    var uniqueName = 'SuruhAja_' + (category || 'IMG') + '_' + Date.now() + '_' + origName;
    var folderPath = String(category || 'general').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    var storagePath = folderPath + '/' + uniqueName;

    var sb = getClient();
    var uploadRes = await sb.storage.from(STORAGE_BUCKET).upload(storagePath, blob, {
      contentType: mime,
      cacheControl: '3600',
      upsert: true
    });

    if (uploadRes.error) {
      throw new Error('Gagal mengunggah ke Supabase Storage (bucket "' + STORAGE_BUCKET + '"): ' + uploadRes.error.message);
    }

    var pubRes = sb.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    var fileUrl = (pubRes && pubRes.data && pubRes.data.publicUrl) ? pubRes.data.publicUrl : '';
    var fileId = generateId('FIL');
    var now = new Date().toISOString();

    var fileRecord = {
      FileID: fileId,
      FileName: uniqueName,
      FileURL: fileUrl,
      MimeType: mime,
      FileSize: blob.size,
      FolderID: STORAGE_BUCKET,
      FileCategory: category || 'General',
      ReferenceID: refId || '',
      UploadedBy: uploadedBy || 'Admin',
      UploadedAt: now,
      Status: 'Active'
    };

    var dbRes = await sb.from(TABLES.FILES).insert(fileRecord);
    if (dbRes.error) {
      throw new Error('File terunggah ke Storage, tetapi gagal mencatat ke tabel files: ' + dbRes.error.message);
    }

    return { fileId: fileId, fileUrl: fileUrl, storagePath: storagePath };
  }

  /* --------------------------------------------------------------------------
   * 1. BOOTSTRAP APLIKASI
   * -------------------------------------------------------------------------- */
  async function getAppBootstrap(sessionToken) {
    try {
      var results = await Promise.all([
        getSettingsMap(),
        fetchAllRows(TABLES.SERVICES),
        fetchAllRows(TABLES.TARIFF_SETTINGS),
        fetchAllRows(TABLES.PRICING),
        fetchAllRows(TABLES.PROMOS),
        fetchAllRows(TABLES.HERO_CAROUSEL),
        fetchAllRows(TABLES.DRIVERS)
      ]);

      var settings = results[0];
      var servicesRaw = results[1];
      var tariffsRaw = results[2];
      var pricingRaw = results[3];
      var promosRaw = results[4];
      var carouselRaw = results[5];
      var driversRaw = results[6];

      var footer = {};
      try {
        footer = JSON.parse(settings.FooterJSON || '{}');
      } catch (e) {
        footer = {
          brandName: 'SuruhAja',
          description: 'Jasa suruh lokal simpel & cepat langsung ke WhatsApp.',
          address: 'Area Lokal',
          whatsapp: settings.WhatsAppNumber || '6281234567890',
          email: 'halo@suruhaja.id',
          instagram: '@suruhaja.id',
          copyright: '© ' + new Date().getFullYear() + ' SuruhAja.'
        };
      }

      var services = servicesRaw
        .filter(function (s) { return s.Status === 'Active'; })
        .sort(function (a, b) { return Number(a.OrderIndex || 0) - Number(b.OrderIndex || 0); });

      var tariffs = tariffsRaw
        .map(normalizeTariffRow)
        .filter(function (t) { return t.ID_Layanan && t.Status === 'Aktif'; });

      var pricing = pricingRaw
        .filter(function (p) { return p.Status === 'Active'; })
        .sort(function (a, b) { return Number(a.OrderIndex || 0) - Number(b.OrderIndex || 0); });

      var promos = promosRaw.filter(function (p) { return p.Status === 'Active'; });

      var carousel = carouselRaw
        .filter(function (c) { return c.Status === 'Active'; })
        .sort(function (a, b) { return Number(a.OrderIndex || 0) - Number(b.OrderIndex || 0); });

      var partners = [];
      try {
        partners = JSON.parse(settings.PartnersJSON || '[]').filter(function (p) { return p.status !== 'Inactive'; });
      } catch (e) { partners = []; }

      var testimonials = [];
      try {
        testimonials = JSON.parse(settings.TestimonialsJSON || '[]').filter(function (t) { return t.status !== 'Inactive'; });
      } catch (e) { testimonials = []; }

      var driverPhotos = getDriverPhotosMap(settings);
      var driverQuota = computeDriverQuota(driversRaw, settings);
      var drivers = driversRaw
        .filter(function (d) { return isDriverApprovedActive(d) && d.ApprovalStatus !== 'Nonaktif'; })
        .map(function (d) {
          return {
            ID: d.ID,
            FullName: d.FullName,
            PhoneWA: normalizePhoneWA(d.PhoneWA),
            Area: d.Area || 'Area Cepu',
            VehicleType: d.VehicleType || 'Motor',
            PlateNumber: d.PlateNumber || '',
            ApprovalStatus: d.ApprovalStatus || 'AKTIF',
            Status: d.Status || 'AKTIF',
            PhotoURL: driverPhotos[String(d.ID)] || ''
          };
        });

      var currentUser = null;
      if (sessionToken) {
        currentUser = await validateSessionInternal(sessionToken);
      }

      return resOk({
        appName: settings.AppName || 'SuruhAja',
        appTagline: settings.AppTagline || 'Titip Beli & Antar Barang Area Cepu',
        whatsappNumber: settings.WhatsAppNumber || '6281234567890',
        logoUrl: settings.LogoURL || '',
        storeStatus: settings.StoreStatus || 'OPEN',
        storeStatusNote: settings.StoreStatusNote || 'Kurir Siap Jalan (07.00 - 21.00 WIB)',
        maxDriverQuota: driverQuota.maxQuota,
        driverQuota: driverQuota,
        saweriaUrl: settings.SaweriaURL || '',
        saweriaText: settings.SaweriaText || 'Suka dengan layanan SuruhAja? Traktir kopi pengembang agar aplikasi tetap gratis & makin cepat!',
        drivers: drivers,
        partners: partners,
        testimonials: testimonials,
        footer: footer,
        services: services,
        tariffs: tariffs,
        pricing: pricing,
        promos: promos,
        carousel: carousel,
        user: currentUser
      });
    } catch (err) {
      return resErr('Gagal memuat data aplikasi dari Supabase: ' + err.message);
    }
  }

  /* --------------------------------------------------------------------------
   * 2. FIREBASE USER SYNC & AUTHENTICATION
   * -------------------------------------------------------------------------- */
  async function syncFirebaseUser(googleUser) {
    try {
      var email = cleanStr(googleUser && googleUser.email, 160).toLowerCase();
      if (!email || email.indexOf('@') === -1) return null;

      var displayName = cleanStr(googleUser && googleUser.displayName, 100) || email.split('@')[0];
      var sb = getClient();
      var users = await fetchAllRows(TABLES.USERS);
      var now = new Date().toISOString();

      var existing = users.find(function (u) {
        return u.Status !== 'Deleted' && String(u.Email || '').trim().toLowerCase() === email;
      });

      if (existing) {
        var patch = {
          UpdatedAt: now,
          UpdatedBy: 'FirebaseAuth'
        };
        if (!existing.FullName && displayName) {
          patch.FullName = displayName;
        }
        await sb.from(TABLES.USERS).update(patch).eq('ID', existing.ID);
        return Object.assign({}, existing, patch);
      }

      var baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'pelanggan';
      var taken = {};
      users.forEach(function (u) {
        if (u.Status !== 'Deleted') taken[String(u.Username || '').toLowerCase()] = true;
      });
      var username = taken[baseUsername] ? (baseUsername + '_' + randomHex(4)) : baseUsername;

      var savedPhone = '';
      try {
        savedPhone = normalizePhoneWA(localStorage.getItem('suruhaja_customer_phone') || '');
      } catch (e) {}

      var newRow = {
        ID: generateId('USR'),
        Username: username,
        Email: email,
        PasswordHash: '',
        Salt: '',
        FullName: displayName,
        Phone: savedPhone,
        Role: 'Customer',
        SavedAddressesJSON: '[]',
        Status: 'Active',
        CreatedAt: now,
        UpdatedAt: now,
        CreatedBy: 'FirebaseAuth',
        UpdatedBy: 'FirebaseAuth'
      };

      var ins = await sb.from(TABLES.USERS).insert(newRow);
      if (ins.error) {
        console.warn('Gagal sinkron user Firebase ke Supabase:', ins.error.message);
        return null;
      }
      return newRow;
    } catch (err) {
      console.warn('syncFirebaseUser err:', err.message);
      return null;
    }
  }

  async function loginUser(payload) {
    try {
      var identifier = cleanStr(payload && payload.identifier, 120).toLowerCase();
      var password = String((payload && payload.password) || '');

      if (!identifier || !password) {
        return resErr('Username/Email dan Password wajib diisi.');
      }

      var users = await fetchAllRows(TABLES.USERS);
      var found = null;
      for (var i = 0; i < users.length; i++) {
        var u = users[i];
        if (u.Status === 'Deleted') continue;
        if (
          String(u.Username || '').trim().toLowerCase() === identifier ||
          String(u.Email || '').trim().toLowerCase() === identifier
        ) {
          found = u;
          break;
        }
      }

      var foundActive = found && (found.Status === 'Active' || (found.Role === 'Driver' && String(found.Status || '').toUpperCase() === 'PENDING'));
      if (!foundActive) {
        return resErr('Akun tidak ditemukan atau sedang nonaktif.');
      }

      var computedHash = await hashPassword(password, found.Salt);
      if (computedHash !== String(found.PasswordHash)) {
        return resErr('Password yang Anda masukkan salah.');
      }

      var sessionToken = saveLocalSession(found);
      var validatedUser = await validateSessionInternal(sessionToken);

      return resOk({
        token: sessionToken,
        user: validatedUser
      }, 'Login berhasil! Selamat datang, ' + found.FullName + '.');
    } catch (err) {
      return resErr('Gagal memproses login: ' + err.message);
    }
  }

  async function getDriverRegistrationStatus() {
    try {
      var results = await Promise.all([getSettingsMap(), fetchAllRows(TABLES.DRIVERS)]);
      var settings = results[0];
      var drivers = results[1];
      var quota = computeDriverQuota(drivers, settings);
      return resOk({
        quota: quota,
        whatsappNumber: settings.WhatsAppNumber || '6281234567890'
      });
    } catch (err) {
      return resErr('Gagal mengecek kuota driver: ' + err.message);
    }
  }

  async function loginDriverWithGoogle(payload) {
    try {
      var email = cleanStr(payload && payload.email, 120).toLowerCase();
      if (!email || email.indexOf('@') === -1) {
        return resErr('Email Google tidak valid.');
      }

      var results = await Promise.all([fetchAllRows(TABLES.DRIVERS), fetchAllRows(TABLES.USERS)]);
      var drivers = results[0];
      var users = results[1];

      var matchedDrv = null;
      for (var i = 0; i < drivers.length; i++) {
        if (drivers[i].Status === 'Deleted') continue;
        if (extractDriverEmail(drivers[i]) === email) {
          matchedDrv = drivers[i];
          break;
        }
      }

      var matchedUser = null;
      var matchedCustomer = null;
      for (var j = 0; j < users.length; j++) {
        if (users[j].Status === 'Deleted') continue;
        if (String(users[j].Email || '').trim().toLowerCase() === email) {
          if (users[j].Role === 'Driver') {
            matchedUser = users[j];
            break;
          } else if (users[j].Role === 'Customer') {
            matchedCustomer = users[j];
          }
        }
      }

      if (!matchedDrv && !matchedUser) {
        return resErr('Email Google (' + email + ') belum terdaftar sebagai Mitra Driver. Silakan daftar terlebih dahulu.');
      }

      if (matchedDrv && (String(matchedDrv.ApprovalStatus || '').toUpperCase() === 'DITOLAK' || matchedDrv.Status === 'Inactive' || String(matchedDrv.Status || '').toUpperCase() === 'NONAKTIF')) {
        return resErr('Akun Mitra Driver Anda sedang nonaktif atau belum disetujui. Hubungi Admin SuruhAja.');
      }

      var sb = getClient();
      var isoNow = new Date().toISOString();

      if (!matchedUser && matchedDrv) {
        var uStatus = isDriverApprovedActive(matchedDrv) ? 'Active' : 'PENDING';
        if (matchedCustomer) {
          await sb.from(TABLES.USERS).update({
            FullName: matchedDrv.FullName || matchedCustomer.FullName,
            Phone: normalizePhoneWA(matchedDrv.PhoneWA) || matchedCustomer.Phone,
            Role: 'Driver',
            Status: uStatus,
            UpdatedAt: isoNow,
            UpdatedBy: matchedCustomer.Username
          }).eq('ID', matchedCustomer.ID);
          matchedUser = Object.assign({}, matchedCustomer, {
            Role: 'Driver',
            Status: uStatus,
            FullName: matchedDrv.FullName || matchedCustomer.FullName
          });
        } else {
          var newUserId = generateId('USR');
          var baseUsername = email.split('@')[0].replace(/[^a-z0-9._-]/g, '') || 'driver';
          var username = baseUsername + '_' + newUserId.slice(-4).toLowerCase();
          var salt = randomHex(16);
          var hash = await hashPassword(generateUuid(), salt);
          var newUserRow = {
            ID: newUserId,
            Username: username,
            Email: email,
            PasswordHash: hash,
            Salt: salt,
            FullName: matchedDrv.FullName,
            Phone: normalizePhoneWA(matchedDrv.PhoneWA),
            Role: 'Driver',
            SavedAddressesJSON: '[]',
            Status: uStatus,
            CreatedAt: isoNow,
            UpdatedAt: isoNow,
            CreatedBy: username,
            UpdatedBy: username
          };
          var ins = await sb.from(TABLES.USERS).insert(newUserRow);
          if (ins.error) throw new Error(ins.error.message);
          matchedUser = newUserRow;
        }
      }

      var sessionToken = saveLocalSession(matchedUser);
      var validatedUser = await validateSessionInternal(sessionToken);
      var isPending = validatedUser && validatedUser.driverProfile && !validatedUser.driverProfile.isApproved;
      var msg = isPending
        ? 'Login berhasil! Akun Mitra Anda saat ini masih berstatus PENDING menunggu persetujuan Admin.'
        : 'Selamat datang kembali, ' + (validatedUser ? validatedUser.fullName : matchedUser.FullName) + '!';

      return resOk({
        token: sessionToken,
        user: validatedUser
      }, msg);
    } catch (err) {
      return resErr('Gagal login driver dengan Google: ' + err.message);
    }
  }

  async function registerDriverAccount(payload) {
    try {
      var fullName = cleanStr(payload && payload.fullName, 100);
      var email = cleanStr(payload && (payload.googleEmail || payload.email), 120).toLowerCase();
      var phoneWA = normalizePhoneWA(payload && (payload.phoneWA || payload.phone));
      var area = cleanStr(payload && payload.area, 120) || 'Area Cepu';
      var vehicleType = cleanStr(payload && payload.vehicleType, 100);
      var plateNumber = cleanStr(payload && payload.plateNumber, 30).toUpperCase();
      var normalizedPlate = normalizePlateNumber(plateNumber);
      var photoFile = payload && payload.photoFile;

      if (!email || email.indexOf('@') === -1) {
        return resErr('Wajib Login dengan akun Google terlebih dahulu sebelum mendaftar sebagai Driver.');
      }
      if (!fullName || !phoneWA || !vehicleType || !normalizedPlate) {
        return resErr('Nama Lengkap, Nomor WhatsApp Aktif, Jenis/Warna Motor, dan Pelat Nomor wajib diisi.');
      }
      if (phoneWA.length < 10) {
        return resErr('Nomor WhatsApp tidak valid. Masukkan nomor aktif yang benar.');
      }

      var results = await Promise.all([
        getSettingsMap(),
        fetchAllRows(TABLES.DRIVERS),
        fetchAllRows(TABLES.USERS)
      ]);
      var settings = results[0];
      var existingDrivers = results[1];
      var users = results[2];

      var quota = computeDriverQuota(existingDrivers, settings);
      if (quota.isFull) {
        return resErr(
          'Maaf, kuota mitra driver saat ini sedang penuh (' + quota.usedCount + '/' + quota.maxQuota + ') demi menjaga pemerataan pemasukan mitra. Hubungi WhatsApp Admin untuk masuk daftar tunggu.',
          'QUOTA_FULL',
          { quota: quota, whatsappNumber: settings.WhatsAppNumber || '6281234567890' }
        );
      }

      for (var dIdx = 0; dIdx < existingDrivers.length; dIdx++) {
        var dRow = existingDrivers[dIdx];
        if (dRow.Status === 'Deleted') continue;
        var dEmail = extractDriverEmail(dRow);
        var dPhone = normalizePhoneWA(dRow.PhoneWA);
        var dPlate = normalizePlateNumber(dRow.PlateNumber);

        if (dEmail && dEmail === email) {
          return resErr('Email Google (' + email + ') sudah terdaftar sebelumnya.');
        }
        if (dPhone && dPhone === phoneWA) {
          return resErr('Nomor WhatsApp ini sudah terdaftar sebelumnya.');
        }
        if (dPlate && dPlate === normalizedPlate) {
          return resErr('Pelat nomor ' + plateNumber + ' sudah terdaftar sebelumnya.');
        }
      }

      var baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'driver';
      var username = baseUsername;
      var takenUsernames = {};
      var existingCustomerUser = null;

      for (var i = 0; i < users.length; i++) {
        if (users[i].Status === 'Deleted') continue;
        takenUsernames[String(users[i].Username || '').toLowerCase()] = true;
        if (String(users[i].Email || '').trim().toLowerCase() === email) {
          if (users[i].Role === 'Customer') {
            existingCustomerUser = users[i];
          } else {
            return resErr('Email Google (' + email + ') sudah terdaftar sebelumnya.');
          }
        }
        if (users[i].Role === 'Driver' && normalizePhoneWA(users[i].Phone) === phoneWA) {
          return resErr('Nomor WhatsApp ini sudah terdaftar sebelumnya.');
        }
      }
      if (takenUsernames[username] && (!existingCustomerUser || String(existingCustomerUser.Username).toLowerCase() !== username)) {
        username = baseUsername + '_' + randomHex(4);
      }

      var now = new Date().toISOString();
      var newUserId = existingCustomerUser ? existingCustomerUser.ID : generateId('USR');
      var newDriverId = generateId('DRV');
      var actorUsername = existingCustomerUser ? existingCustomerUser.Username : username;

      var photoUrl = cleanStr(payload && payload.googlePhotoUrl, 300);
      if (photoFile && (photoFile.base64 || photoFile instanceof Blob)) {
        var uploadedPhoto = await uploadImageToStorage(photoFile, 'DRIVER_PHOTO', newDriverId, actorUsername);
        photoUrl = uploadedPhoto.fileUrl;
      }

      var sb = getClient();
      if (existingCustomerUser) {
        var updUser = await sb.from(TABLES.USERS).update({
          FullName: fullName,
          Phone: phoneWA,
          Role: 'Driver',
          Status: 'PENDING',
          UpdatedAt: now,
          UpdatedBy: actorUsername
        }).eq('ID', existingCustomerUser.ID);
        if (updUser.error) throw new Error(updUser.error.message);
      } else {
        var salt = randomHex(16);
        var rawPwd = String((payload && payload.password) || generateUuid());
        var hash = await hashPassword(rawPwd, salt);
        var insUser = await sb.from(TABLES.USERS).insert({
          ID: newUserId,
          Username: username,
          Email: email,
          PasswordHash: hash,
          Salt: salt,
          FullName: fullName,
          Phone: phoneWA,
          Role: 'Driver',
          SavedAddressesJSON: '[]',
          Status: 'PENDING',
          CreatedAt: now,
          UpdatedAt: now,
          CreatedBy: username,
          UpdatedBy: username
        });
        if (insUser.error) throw new Error(insUser.error.message);
      }

      var insDriver = await sb.from(TABLES.DRIVERS).insert({
        ID: newDriverId,
        FullName: fullName,
        PhoneWA: phoneWA,
        Area: area,
        VehicleType: vehicleType,
        PlateNumber: plateNumber,
        Notes: '[Google: ' + email + '] Daftar ringan tanpa KTP',
        ApprovalStatus: 'PENDING',
        Status: 'PENDING',
        CreatedAt: now,
        UpdatedAt: now,
        CreatedBy: actorUsername,
        UpdatedBy: actorUsername,
        Email: email
      });
      if (insDriver.error) throw new Error(insDriver.error.message);

      if (photoUrl) {
        await saveDriverPhotoUrl(newDriverId, photoUrl, actorUsername);
      }

      var refreshedDrivers = await fetchAllRows(TABLES.DRIVERS);
      var updatedQuota = computeDriverQuota(refreshedDrivers, settings);

      return resOk({
        userId: newUserId,
        driverId: newDriverId,
        username: actorUsername,
        email: email,
        approvalStatus: 'PENDING',
        status: 'PENDING',
        quota: updatedQuota
      }, 'Pendaftaran Mitra Driver berhasil dikirim! Status akun Anda saat ini PENDING menunggu persetujuan Admin.');
    } catch (err) {
      return resErr('Gagal mendaftar sebagai driver: ' + err.message);
    }
  }

  async function logoutUser() {
    clearLocalSession();
    return resOk(null, 'Anda telah keluar dari akun.');
  }

  /* --------------------------------------------------------------------------
   * 3. PEMESANAN PELANGGAN (ORDER -> SUPABASE + WHATSAPP)
   * -------------------------------------------------------------------------- */
  async function createOrder(payload, sessionToken) {
    try {
      var customerName = cleanStr(payload && (payload.customerName || payload.googleName), 100);
      var customerEmail = cleanStr(payload && payload.customerEmail, 160).toLowerCase();
      var customerPhone = normalizePhoneWA(payload && payload.customerPhone);
      var serviceId = cleanStr(payload && payload.serviceId, 50);
      var driverId = cleanStr(payload && payload.driverId, 50);
      var itemDetails = cleanStr(payload && payload.itemDetails, 500);
      var notes = cleanStr(payload && payload.notes, 300);
      var promoCode = cleanStr(payload && payload.promoCode, 40).toUpperCase();

      var pickupLat = Number(payload && payload.pickupLat);
      var pickupLng = Number(payload && payload.pickupLng);
      var dropoffLat = Number(payload && payload.dropoffLat);
      var dropoffLng = Number(payload && payload.dropoffLng);
      var hasPickupCoords = isFinite(pickupLat) && isFinite(pickupLng);
      var hasDropoffCoords = isFinite(dropoffLat) && isFinite(dropoffLng);
      var pickupCoords = hasPickupCoords ? (pickupLat.toFixed(6) + ', ' + pickupLng.toFixed(6)) : '';
      var dropoffCoords = hasDropoffCoords ? (dropoffLat.toFixed(6) + ', ' + dropoffLng.toFixed(6)) : '';
      var pickupAddress = cleanStr(payload && payload.pickupAddress, 250) || (pickupCoords ? ('Titik Peta (' + pickupCoords + ')') : 'Dikirim di WhatsApp');
      var dropoffAddress = cleanStr(payload && payload.dropoffAddress, 250) || (dropoffCoords ? ('Titik Peta (' + dropoffCoords + ')') : 'Dikirim di WhatsApp');
      var rawDistanceKm = Number((payload && payload.distanceKm) || 0);

      if (!customerEmail || customerEmail.indexOf('@') === -1) {
        return resErr('Silakan login dengan akun Google terlebih dahulu sebelum mengirim pesanan.');
      }
      if (!customerName) return resErr('Nama Anda wajib diisi.');
      if (!customerPhone || customerPhone.length < 10 || customerPhone.indexOf('62') !== 0) {
        return resErr('Nomor WhatsApp aktif wajib diisi dengan format yang valid (contoh: 0812xxxxxxxx).');
      }
      if (!serviceId) return resErr('Silakan pilih layanan terlebih dahulu.');
      if (!itemDetails) return resErr('Detail pesanan atau barang wajib diisi.');

      var results = await Promise.all([
        fetchAllRows(TABLES.TARIFF_SETTINGS),
        fetchAllRows(TABLES.SERVICES),
        fetchAllRows(TABLES.PROMOS),
        getSettingsMap(),
        fetchAllRows(TABLES.DRIVERS),
        fetchAllRows(TABLES.USERS)
      ]);

      var activeTariffs = results[0].map(normalizeTariffRow).filter(function (t) { return t.ID_Layanan && t.Status === 'Aktif'; });
      var services = results[1];
      var promos = results[2];
      var settings = results[3];
      var allDrivers = results[4];
      var allUsers = results[5];

      var selectedTariff = activeTariffs.filter(function (t) { return t.ID_Layanan === serviceId; })[0];
      var selectedService = null;
      if (!selectedTariff) {
        selectedService = services.filter(function (s) { return s.ID === serviceId && s.Status === 'Active'; })[0];
        if (!selectedService) return resErr('Layanan yang dipilih tidak tersedia atau sedang nonaktif.');
      }

      var serviceName = selectedTariff ? selectedTariff.Nama_Layanan : selectedService.Name;
      var resolvedServiceId = selectedTariff ? selectedTariff.ID_Layanan : selectedService.ID;

      var targetWa = normalizePhoneWA(settings.WhatsAppNumber || '6281234567890');
      var driverLabel = 'Driver Tersedia (Acak)';
      var driverCleanName = 'Admin / Driver Cepu';
      var driverVehicle = '';
      var driverPlate = '';

      if (driverId) {
        var foundDrv = allDrivers.filter(function (d) { return String(d.ID) === driverId && isDriverApprovedActive(d); })[0];
        if (!foundDrv || foundDrv.ApprovalStatus === 'Nonaktif' || foundDrv.ApprovalStatus === 'Ditolak') {
          return resErr('Driver yang dipilih sedang tidak aktif atau libur. Silakan pilih driver lain atau Driver Tersedia.');
        }
        if (normalizePhoneWA(foundDrv.PhoneWA)) {
          targetWa = normalizePhoneWA(foundDrv.PhoneWA);
          driverCleanName = foundDrv.FullName;
          driverVehicle = foundDrv.VehicleType || 'Motor';
          driverPlate = foundDrv.PlateNumber || '';
          driverLabel = foundDrv.FullName + (foundDrv.VehicleType ? ' (' + foundDrv.VehicleType + ')' : '');
        }
      }

      var fare = selectedTariff
        ? calculateDistanceFare(selectedTariff, rawDistanceKm)
        : {
          distanceKm: Math.max(0, Math.round(rawDistanceKm * 10) / 10),
          baseFare: Number(selectedService.BasePrice || 0),
          extraKm: 0,
          extraFare: 0,
          subtotal: Number(selectedService.BasePrice || 0)
        };

      var basePrice = fare.baseFare;
      var routePrice = fare.extraFare;
      var subtotal = fare.subtotal;
      var discountAmount = 0;
      var validPromoCode = '';

      if (promoCode) {
        var foundPromo = promos.filter(function (pr) {
          return String(pr.Code).toUpperCase() === promoCode && pr.Status === 'Active';
        })[0];
        if (foundPromo && subtotal >= Number(foundPromo.MinOrder || 0)) {
          discountAmount = Number(foundPromo.DiscountAmount || 0);
          validPromoCode = foundPromo.Code;
        }
      }

      var estimatedTotal = Math.max(0, subtotal - discountAmount);
      var sessionUser = sessionToken ? await validateSessionInternal(sessionToken) : null;
      var customerUser = allUsers.find(function (u) {
        return u.Status !== 'Deleted' && String(u.Email || '').trim().toLowerCase() === customerEmail;
      });

      var sb = getClient();
      var now = new Date();
      var isoNow = now.toISOString();

      if (customerUser && !customerUser.Phone && customerPhone) {
        await sb.from(TABLES.USERS).update({
          Phone: customerPhone,
          UpdatedAt: isoNow,
          UpdatedBy: 'OrderCheckout'
        }).eq('ID', customerUser.ID);
      }

      var dateTag = getJakartaDateStr(now).replace(/-/g, '');
      var orderId = generateId('ORD');
      var orderCode = 'SRH-' + dateTag + '-' + orderId.slice(-4);
      var savedNotes = '[Driver: ' + driverLabel + ']' + (notes ? ' ' + notes : '');
      var resolvedUserId = sessionUser ? sessionUser.id : (customerUser ? customerUser.ID : '');
      var orderActor = sessionUser ? sessionUser.username : (customerUser ? customerUser.Username : (customerEmail || customerName));

      var orderRow = {
        ID: orderId,
        OrderCode: orderCode,
        CustomerName: customerName,
        CustomerPhone: customerPhone || '-',
        ServiceID: resolvedServiceId,
        ServiceName: serviceName,
        RouteID: driverId || 'AUTO',
        RouteName: driverLabel,
        PickupAddress: pickupAddress,
        DropoffAddress: dropoffAddress,
        ItemDetails: itemDetails,
        Notes: savedNotes,
        PromoCode: validPromoCode,
        BasePrice: basePrice,
        RoutePrice: routePrice,
        DiscountAmount: discountAmount,
        EstimatedTotal: estimatedTotal,
        OrderStatus: 'Baru',
        UserID: resolvedUserId,
        Status: 'Active',
        CreatedAt: isoNow,
        UpdatedAt: isoNow,
        CreatedBy: orderActor,
        UpdatedBy: orderActor,
        PickupCoords: pickupCoords,
        DropoffCoords: dropoffCoords,
        DistanceKm: fare.distanceKm,
        CustomerEmail: customerEmail
      };

      var ins = await sb.from(TABLES.ORDERS).insert(orderRow);
      if (ins.error) {
        throw new Error(ins.error.message);
      }

      var msgLines = [
        '*PESANAN BARU — SURUHAJA CEPU*',
        '--------------------------------',
        'Kode Order: *' + orderCode + '*',
        'Driver: *' + driverLabel + '*',
        'Layanan: *' + serviceName + '*',
        'Jarak Rute: *' + fare.distanceKm + ' km*',
        '--------------------------------',
        'Nama: ' + customerName,
        'No. WhatsApp: ' + customerPhone,
        'Email Google: ' + customerEmail,
        'Detail Pesanan: ' + itemDetails,
        'Catatan: ' + (notes || '-'),
        '--------------------------------',
        '📍 Jemput: ' + pickupAddress + (hasPickupCoords ? ('\n   Maps: https://maps.google.com/?q=' + pickupLat.toFixed(6) + ',' + pickupLng.toFixed(6)) : ''),
        '🏁 Tujuan: ' + dropoffAddress + (hasDropoffCoords ? ('\n   Maps: https://maps.google.com/?q=' + dropoffLat.toFixed(6) + ',' + dropoffLng.toFixed(6)) : ''),
        '--------------------------------',
        'Tarif Minimal: ' + formatRp(basePrice)
      ];
      if (routePrice > 0) msgLines.push('Tambahan Jarak: ' + formatRp(routePrice));
      if (discountAmount > 0) msgLines.push('Promo (' + validPromoCode + '): -' + formatRp(discountAmount));
      msgLines.push('*Estimasi Ongkir: ' + formatRp(estimatedTotal) + '*');
      msgLines.push('--------------------------------');
      msgLines.push('Halo Kak, saya mau order ini ya. Mohon konfirmasinya!');

      var waUrl = 'https://wa.me/' + targetWa + '?text=' + encodeURIComponent(msgLines.join('\n'));

      return resOk({
        orderId: orderId,
        orderCode: orderCode,
        driverId: driverId || 'AUTO',
        driverName: driverLabel,
        driverCleanName: driverCleanName,
        driverPhone: targetWa,
        driverVehicle: driverVehicle,
        driverPlate: driverPlate,
        serviceName: serviceName,
        customerPhone: customerPhone,
        customerEmail: customerEmail,
        pickupAddress: pickupAddress,
        dropoffAddress: dropoffAddress,
        distanceKm: fare.distanceKm,
        pickupCoords: pickupCoords,
        dropoffCoords: dropoffCoords,
        estimatedTotal: estimatedTotal,
        whatsappUrl: waUrl
      }, 'Pesanan siap dikirim ke WhatsApp ' + driverLabel + '!');
    } catch (err) {
      return resErr('Gagal membuat pesanan: ' + err.message);
    }
  }

  async function getCustomerOrders(customerEmail) {
    try {
      var email = cleanStr(customerEmail, 160).toLowerCase();
      if (!email || email.indexOf('@') === -1) {
        return resErr('Email pelanggan tidak valid.');
      }

      var results = await Promise.all([
        getSettingsMap(),
        fetchAllRows(TABLES.DRIVERS),
        fetchAllRows(TABLES.ORDERS)
      ]);
      var settings = results[0];
      var drivers = results[1].filter(function (d) { return d.Status !== 'Deleted'; });
      var allOrders = results[2];

      var adminWa = normalizePhoneWA(settings.WhatsAppNumber || '6281234567890');
      var drvById = {};
      drivers.forEach(function (d) { drvById[String(d.ID)] = d; });

      var orders = allOrders
        .filter(function (o) {
          return o.Status !== 'Deleted' && String(o.CustomerEmail || '').trim().toLowerCase() === email;
        })
        .sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); })
        .slice(0, 30)
        .map(function (o) {
          var drv = o.RouteID && o.RouteID !== 'AUTO' ? drvById[String(o.RouteID)] : null;
          var cleanDrvName = drv
            ? drv.FullName
            : String(o.RouteName || 'Driver SuruhAja').replace(/\s*\([^)]*\)\s*$/, '').trim();
          return {
            ID: o.ID,
            OrderCode: o.OrderCode,
            CustomerName: o.CustomerName,
            CustomerPhone: normalizePhoneWA(o.CustomerPhone),
            CustomerEmail: o.CustomerEmail,
            ServiceID: o.ServiceID,
            ServiceName: o.ServiceName,
            RouteID: o.RouteID || 'AUTO',
            RouteName: o.RouteName || 'Driver Tersedia',
            DriverName: cleanDrvName,
            DriverPhoneWA: drv ? normalizePhoneWA(drv.PhoneWA) : adminWa,
            DriverVehicle: drv ? (drv.VehicleType || 'Motor') : '',
            DriverPlate: drv ? (drv.PlateNumber || '') : '',
            PickupAddress: o.PickupAddress || o.PickupCoords || 'Titik Jemput',
            DropoffAddress: o.DropoffAddress || o.DropoffCoords || 'Titik Tujuan',
            DistanceKm: o.DistanceKm,
            ItemDetails: o.ItemDetails,
            Notes: o.Notes,
            EstimatedTotal: o.EstimatedTotal,
            OrderStatus: o.OrderStatus || 'Baru',
            CreatedAt: o.CreatedAt
          };
        });

      return resOk(orders);
    } catch (err) {
      return resErr('Gagal memuat pesanan pelanggan: ' + err.message);
    }
  }

  /* --------------------------------------------------------------------------
   * 4. DASHBOARD & AKSI DRIVER
   * -------------------------------------------------------------------------- */
  async function getDriverDashboardData(sessionToken) {
    try {
      var user = await requireDriver(sessionToken);
      var results = await Promise.all([
        getSettingsMap(),
        fetchAllRows(TABLES.DRIVERS),
        fetchAllRows(TABLES.ORDERS)
      ]);
      var settings = results[0];
      var drivers = results[1];
      var ordersRaw = results[2];

      var driverPhotos = getDriverPhotosMap(settings);
      var myDriver = findDriverForUser(drivers, user);
      if (myDriver) {
        myDriver = Object.assign({}, myDriver, {
          PhotoURL: driverPhotos[String(myDriver.ID)] || '',
          Email: extractDriverEmail(myDriver) || user.email
        });
      }

      var isApproved = Boolean(myDriver && isDriverApprovedActive(myDriver));
      if (!isApproved) {
        return resOk({ driver: myDriver, isApproved: false, orders: [] });
      }

      var myOrders = ordersRaw
        .filter(function (o) {
          return o.Status !== 'Deleted' && (String(o.RouteID) === String(myDriver.ID) || String(o.RouteID) === 'AUTO');
        })
        .sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); });

      return resOk({ driver: myDriver, isApproved: true, orders: myOrders });
    } catch (err) {
      return resErr(err.message);
    }
  }

  async function driverUpdateAvailability(availability, sessionToken) {
    try {
      var user = await requireDriver(sessionToken);
      var allowed = ['Standby', 'Sibuk', 'Nonaktif'];
      if (allowed.indexOf(availability) === -1) {
        return resErr('Status kondisi driver tidak valid.');
      }

      var drivers = await fetchAllRows(TABLES.DRIVERS);
      var myDriver = findDriverForUser(drivers, user);
      if (!myDriver || !isDriverApprovedActive(myDriver)) {
        return resErr('Akun Mitra Driver Anda masih berstatus PENDING / belum diaktifkan oleh Admin.');
      }

      var sb = getClient();
      var upd = await sb.from(TABLES.DRIVERS).update({
        ApprovalStatus: availability,
        UpdatedAt: new Date().toISOString(),
        UpdatedBy: user.username
      }).eq('ID', String(myDriver.ID));

      if (upd.error) throw new Error(upd.error.message);
      return resOk({ availability: availability }, 'Status Anda diperbarui menjadi ' + availability + '.');
    } catch (err) {
      return resErr(err.message);
    }
  }

  async function driverUpdateOwnPhoto(fileData, sessionToken) {
    try {
      var user = await requireDriver(sessionToken);
      var drivers = await fetchAllRows(TABLES.DRIVERS);
      var myDriver = findDriverForUser(drivers, user);
      if (!myDriver) return resErr('Profil driver tidak ditemukan.');

      var uploaded = await uploadImageToStorage(fileData, 'DRIVER_PHOTO', myDriver.ID, user.username);
      await saveDriverPhotoUrl(myDriver.ID, uploaded.fileUrl, user.username);
      return resOk({ photoUrl: uploaded.fileUrl }, 'Foto profil driver berhasil diperbarui!');
    } catch (err) {
      return resErr('Gagal mengupload foto driver: ' + err.message);
    }
  }

  async function driverUpdateOrderStatus(orderId, newStatus, sessionToken) {
    try {
      var user = await requireDriver(sessionToken);
      var allowed = ['Diproses', 'Selesai'];
      if (allowed.indexOf(newStatus) === -1) {
        return resErr('Driver hanya dapat mengubah status menjadi Diproses atau Selesai.');
      }

      var drivers = await fetchAllRows(TABLES.DRIVERS);
      var myDriver = findDriverForUser(drivers, user);
      if (!myDriver || !isDriverApprovedActive(myDriver)) {
        return resErr('Akun Anda masih berstatus PENDING. Anda baru dapat melihat dan mengambil order setelah disetujui (AKTIF) oleh Admin.');
      }

      var sb = getClient();
      var orderRes = await sb.from(TABLES.ORDERS).select('*').eq('ID', String(orderId)).limit(1);
      if (orderRes.error) throw new Error(orderRes.error.message);
      var order = orderRes.data && orderRes.data[0];
      if (!order || order.Status === 'Deleted') return resErr('Pesanan tidak ditemukan.');
      if (order.OrderStatus === 'Dibatalkan') return resErr('Pesanan ini sudah dibatalkan.');

      var assignedRouteId = String(order.RouteID || '');
      if (assignedRouteId !== 'AUTO' && assignedRouteId !== String(myDriver.ID)) {
        return resErr('Pesanan ini sudah ditangani oleh driver lain.');
      }

      var patch = {
        OrderStatus: newStatus,
        UpdatedAt: new Date().toISOString(),
        UpdatedBy: user.username
      };
      if (assignedRouteId === 'AUTO') {
        patch.RouteID = myDriver.ID;
        patch.RouteName = myDriver.FullName + (myDriver.VehicleType ? ' (' + myDriver.VehicleType + ')' : '');
      }

      var upd = await sb.from(TABLES.ORDERS).update(patch).eq('ID', String(orderId));
      if (upd.error) throw new Error(upd.error.message);
      return resOk(null, 'Status pesanan berhasil diubah menjadi ' + newStatus + '.');
    } catch (err) {
      return resErr(err.message);
    }
  }

  /* --------------------------------------------------------------------------
   * 5. ADMIN PANEL — DASHBOARD & CRUD
   * -------------------------------------------------------------------------- */
  async function getAdminDashboardData(sessionToken) {
    try {
      await requireAdmin(sessionToken);

      var results = await Promise.all([
        fetchAllRows(TABLES.ORDERS),
        fetchAllRows(TABLES.SERVICES),
        fetchAllRows(TABLES.TARIFF_SETTINGS),
        fetchAllRows(TABLES.PRICING),
        fetchAllRows(TABLES.PROMOS),
        getSettingsMap(),
        fetchAllRows(TABLES.DRIVERS),
        fetchAllRows(TABLES.HERO_CAROUSEL)
      ]);

      var orders = results[0]
        .filter(function (o) { return o.Status !== 'Deleted'; })
        .sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); });

      var services = results[1]
        .filter(function (s) { return s.Status !== 'Deleted'; })
        .sort(function (a, b) { return Number(a.OrderIndex || 0) - Number(b.OrderIndex || 0); });

      var tariffs = results[2]
        .map(normalizeTariffRow)
        .filter(function (t) { return t.ID_Layanan && t.Status !== 'Deleted'; });

      var pricing = results[3]
        .filter(function (p) { return p.Status !== 'Deleted'; })
        .sort(function (a, b) { return Number(a.OrderIndex || 0) - Number(b.OrderIndex || 0); });

      var promos = results[4].filter(function (p) { return p.Status !== 'Deleted'; });
      var settings = results[5];
      var driversRaw = results[6];
      var carouselRaw = results[7];

      var driverPhotos = getDriverPhotosMap(settings);
      var driverQuota = computeDriverQuota(driversRaw, settings);

      var drivers = driversRaw
        .filter(function (d) { return d.Status !== 'Deleted'; })
        .sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); })
        .map(function (d) {
          return Object.assign({}, d, {
            PhotoURL: driverPhotos[String(d.ID)] || '',
            Email: extractDriverEmail(d)
          });
        });

      var carousel = carouselRaw
        .filter(function (c) { return c.Status === 'Active'; })
        .sort(function (a, b) { return Number(a.OrderIndex || 0) - Number(b.OrderIndex || 0); });

      var footer = {};
      try { footer = JSON.parse(settings.FooterJSON || '{}'); } catch (e) { footer = {}; }
      var partners = [];
      try { partners = JSON.parse(settings.PartnersJSON || '[]'); } catch (e) { partners = []; }
      var testimonials = [];
      try { testimonials = JSON.parse(settings.TestimonialsJSON || '[]'); } catch (e) { testimonials = []; }

      var todayStr = getJakartaDateStr(new Date());
      var todayOrders = orders.filter(function (o) {
        if (!o.CreatedAt) return false;
        return getJakartaDateStr(o.CreatedAt) === todayStr || String(o.CreatedAt).indexOf(todayStr) === 0;
      }).length;

      return resOk({
        stats: {
          totalOrders: orders.length,
          todayOrders: todayOrders,
          totalDrivers: drivers.length,
          activeServices: tariffs.filter(function (t) { return t.Status === 'Aktif'; }).length
        },
        orders: orders,
        services: services,
        tariffs: tariffs,
        pricing: pricing,
        promos: promos,
        drivers: drivers,
        driverQuota: driverQuota,
        carousel: carousel,
        partners: partners,
        testimonials: testimonials,
        settings: {
          whatsappNumber: settings.WhatsAppNumber || '',
          appName: settings.AppName || 'SuruhAja',
          appTagline: settings.AppTagline || '',
          logoUrl: settings.LogoURL || '',
          logoFileId: settings.LogoFileID || '',
          storeStatus: settings.StoreStatus || 'OPEN',
          storeStatusNote: settings.StoreStatusNote || 'Kurir Siap Jalan (07.00 - 21.00 WIB)',
          maxDriverQuota: driverQuota.maxQuota,
          saweriaUrl: settings.SaweriaURL || '',
          saweriaText: settings.SaweriaText || 'Suka dengan layanan SuruhAja? Traktir kopi pengembang agar aplikasi tetap gratis & makin cepat!',
          footer: footer
        }
      });
    } catch (err) {
      return resErr(err.message);
    }
  }

  async function adminUpdateOrderStatus(orderId, newStatus, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      var allowed = ['Baru', 'Diproses', 'Selesai', 'Dibatalkan'];
      if (allowed.indexOf(newStatus) === -1) return resErr('Status pesanan tidak valid.');

      var sb = getClient();
      var existing = await sb.from(TABLES.ORDERS).select('ID, Status').eq('ID', String(orderId)).limit(1);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data || !existing.data.length || existing.data[0].Status === 'Deleted') {
        return resErr('Pesanan tidak ditemukan.');
      }

      var upd = await sb.from(TABLES.ORDERS).update({
        OrderStatus: newStatus,
        UpdatedAt: new Date().toISOString(),
        UpdatedBy: admin.username
      }).eq('ID', String(orderId));
      if (upd.error) throw new Error(upd.error.message);

      return resOk(null, 'Status pesanan berhasil diubah menjadi ' + newStatus + '.');
    } catch (err) {
      return resErr(err.message);
    }
  }

  async function adminSaveService(payload, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      var id = cleanStr(payload && payload.id, 50);
      var name = cleanStr(payload && payload.name, 80);
      var hasCategory = payload && payload.category !== undefined;
      var category = cleanStr(payload && payload.category, 50) || 'Umum';
      var description = cleanStr(payload && payload.description, 250);
      var basePrice = Math.max(0, Number((payload && payload.basePrice) || 0));
      var icon = cleanStr(payload && payload.icon, 16) || '🛵';
      var hasImageUrl = payload && payload.imageUrl !== undefined;
      var imageUrl = cleanStr(payload && payload.imageUrl, 500);
      var orderIndex = Number((payload && payload.orderIndex) || 1);
      var status = (payload && payload.status) === 'Inactive' ? 'Inactive' : 'Active';

      if (!name) return resErr('Nama layanan wajib diisi.');

      var sb = getClient();
      var now = new Date().toISOString();

      if (id) {
        var existing = await sb.from(TABLES.SERVICES).select('*').eq('ID', id).limit(1);
        if (existing.data && existing.data.length) {
          var row = existing.data[0];
          var upd = await sb.from(TABLES.SERVICES).update({
            Name: name,
            Category: hasCategory ? category : (row.Category || 'Umum'),
            Description: description,
            BasePrice: basePrice,
            Icon: icon,
            ImageURL: hasImageUrl ? imageUrl : (row.ImageURL || ''),
            OrderIndex: orderIndex,
            Status: status,
            UpdatedAt: now,
            UpdatedBy: admin.username
          }).eq('ID', id);
          if (upd.error) throw new Error(upd.error.message);
          return resOk({ id: id }, 'Layanan berhasil diperbarui.');
        }
      }

      var newId = generateId('SRV');
      var ins = await sb.from(TABLES.SERVICES).insert({
        ID: newId,
        Name: name,
        Category: category,
        Description: description,
        BasePrice: basePrice,
        Icon: icon,
        ImageURL: imageUrl,
        OrderIndex: orderIndex,
        Status: status,
        CreatedAt: now,
        UpdatedAt: now,
        CreatedBy: admin.username,
        UpdatedBy: admin.username
      });
      if (ins.error) throw new Error(ins.error.message);
      return resOk({ id: newId }, 'Layanan baru berhasil ditambahkan.');
    } catch (err) {
      return resErr(err.message);
    }
  }

  async function adminDeleteService(id, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      return await softDeleteById(TABLES.SERVICES, id, admin.username, 'Layanan tidak ditemukan.', 'Layanan berhasil dihapus.');
    } catch (err) {
      return resErr(err.message);
    }
  }

  async function adminSaveTariffService(payload, sessionToken) {
    try {
      await requireAdmin(sessionToken);
      var id = cleanStr(payload && (payload.idLayanan || payload.id), 50);
      var nama = cleanStr(payload && (payload.namaLayanan || payload.name), 80);
      var ikon = cleanStr(payload && (payload.ikon || payload.icon), 16) || '🛵';
      var tarifMin = Math.max(0, Number(payload && (payload.tarifMinimal !== undefined ? payload.tarifMinimal : payload.Tarif_Minimal) || 0));
      var jarakMin = Math.max(0, Number(payload && (payload.jarakMinimalKm !== undefined ? payload.jarakMinimalKm : payload.Jarak_Minimal_Km) || 0));
      var tarifPerKm = Math.max(0, Number(payload && (payload.tarifPerKm !== undefined ? payload.tarifPerKm : payload.Tarif_Per_Km) || 0));
      var statusRaw = cleanStr(payload && (payload.status || payload.Status), 20);
      var status = (statusRaw === 'Nonaktif' || statusRaw === 'Inactive') ? 'Nonaktif' : 'Aktif';

      if (!nama) return resErr('Nama layanan wajib diisi.');

      var sb = getClient();
      if (id) {
        var existing = await sb.from(TABLES.TARIFF_SETTINGS).select('ID_Layanan').eq('ID_Layanan', id).limit(1);
        if (existing.data && existing.data.length) {
          var upd = await sb.from(TABLES.TARIFF_SETTINGS).update({
            Nama_Layanan: nama,
            Ikon: ikon,
            Tarif_Minimal: tarifMin,
            Jarak_Minimal_Km: jarakMin,
            Tarif_Per_Km: tarifPerKm,
            Status: status
          }).eq('ID_Layanan', id);
          if (upd.error) throw new Error(upd.error.message);
          return resOk({ id: id }, 'Tarif layanan "' + nama + '" berhasil diperbarui.');
        }
      }

      var newId = generateId('SRV');
      var ins = await sb.from(TABLES.TARIFF_SETTINGS).insert({
        ID_Layanan: newId,
        Nama_Layanan: nama,
        Ikon: ikon,
        Tarif_Minimal: tarifMin,
        Jarak_Minimal_Km: jarakMin,
        Tarif_Per_Km: tarifPerKm,
        Status: status
      });
      if (ins.error) throw new Error(ins.error.message);
      return resOk({ id: newId }, 'Layanan baru "' + nama + '" berhasil ditambahkan.');
    } catch (err) {
      return resErr('Gagal menyimpan tarif layanan: ' + err.message);
    }
  }

  async function adminToggleTariffStatus(idLayanan, nextStatus, sessionToken) {
    try {
      await requireAdmin(sessionToken);
      var status = (nextStatus === 'Nonaktif' || nextStatus === 'Inactive') ? 'Nonaktif' : 'Aktif';
      var sb = getClient();
      var existing = await sb.from(TABLES.TARIFF_SETTINGS).select('ID_Layanan').eq('ID_Layanan', String(idLayanan)).limit(1);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data || !existing.data.length) return resErr('Layanan tidak ditemukan.');

      var upd = await sb.from(TABLES.TARIFF_SETTINGS).update({ Status: status }).eq('ID_Layanan', String(idLayanan));
      if (upd.error) throw new Error(upd.error.message);
      return resOk({ id: idLayanan, status: status }, 'Status layanan diubah menjadi ' + status + '.');
    } catch (err) {
      return resErr('Gagal mengubah status layanan: ' + err.message);
    }
  }

  async function adminDeleteTariffService(idLayanan, sessionToken) {
    try {
      await requireAdmin(sessionToken);
      var sb = getClient();
      var existing = await sb.from(TABLES.TARIFF_SETTINGS).select('ID_Layanan').eq('ID_Layanan', String(idLayanan)).limit(1);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data || !existing.data.length) return resErr('Layanan tidak ditemukan.');

      var del = await sb.from(TABLES.TARIFF_SETTINGS).delete().eq('ID_Layanan', String(idLayanan));
      if (del.error) throw new Error(del.error.message);
      return resOk(null, 'Layanan berhasil dihapus dari pengaturan_tarif.');
    } catch (err) {
      return resErr('Gagal menghapus layanan: ' + err.message);
    }
  }

  async function adminSavePricing(payload, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      var id = cleanStr(payload && payload.id, 50);
      var routeName = cleanStr(payload && payload.routeName, 100);
      var distanceLabel = cleanStr(payload && payload.distanceLabel, 80);
      var price = Math.max(0, Number((payload && payload.price) || 0));
      var description = cleanStr(payload && payload.description, 250);
      var orderIndex = Number((payload && payload.orderIndex) || 1);
      var status = (payload && payload.status) === 'Inactive' ? 'Inactive' : 'Active';

      if (!routeName) return resErr('Nama rute / area wajib diisi.');

      var sb = getClient();
      var now = new Date().toISOString();

      if (id) {
        var existing = await sb.from(TABLES.PRICING).select('ID').eq('ID', id).limit(1);
        if (existing.data && existing.data.length) {
          var upd = await sb.from(TABLES.PRICING).update({
            RouteName: routeName,
            DistanceLabel: distanceLabel,
            Price: price,
            Description: description,
            OrderIndex: orderIndex,
            Status: status,
            UpdatedAt: now,
            UpdatedBy: admin.username
          }).eq('ID', id);
          if (upd.error) throw new Error(upd.error.message);
          return resOk({ id: id }, 'Tarif rute berhasil diperbarui.');
        }
      }

      var newId = generateId('PRC');
      var ins = await sb.from(TABLES.PRICING).insert({
        ID: newId,
        RouteName: routeName,
        DistanceLabel: distanceLabel,
        Price: price,
        Description: description,
        OrderIndex: orderIndex,
        Status: status,
        CreatedAt: now,
        UpdatedAt: now,
        CreatedBy: admin.username,
        UpdatedBy: admin.username
      });
      if (ins.error) throw new Error(ins.error.message);
      return resOk({ id: newId }, 'Tarif rute baru berhasil ditambahkan.');
    } catch (err) {
      return resErr(err.message);
    }
  }

  async function adminDeletePricing(id, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      return await softDeleteById(TABLES.PRICING, id, admin.username, 'Tarif rute tidak ditemukan.', 'Tarif rute dihapus.');
    } catch (err) {
      return resErr(err.message);
    }
  }

  async function adminSavePromo(payload, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      var id = cleanStr(payload && payload.id, 50);
      var code = cleanStr(payload && payload.code, 40).toUpperCase().replace(/\s+/g, '');
      var title = cleanStr(payload && payload.title, 100);
      var discountAmount = Math.max(0, Number((payload && payload.discountAmount) || 0));
      var minOrder = Math.max(0, Number((payload && payload.minOrder) || 0));
      var status = (payload && payload.status) === 'Inactive' ? 'Inactive' : 'Active';

      if (!code || !title) return resErr('Kode promo dan judul wajib diisi.');

      var sb = getClient();
      var now = new Date().toISOString();

      if (id) {
        var existing = await sb.from(TABLES.PROMOS).select('ID').eq('ID', id).limit(1);
        if (existing.data && existing.data.length) {
          var upd = await sb.from(TABLES.PROMOS).update({
            Code: code,
            Title: title,
            DiscountAmount: discountAmount,
            MinOrder: minOrder,
            Status: status,
            UpdatedAt: now,
            UpdatedBy: admin.username
          }).eq('ID', id);
          if (upd.error) throw new Error(upd.error.message);
          return resOk({ id: id }, 'Kode promo berhasil diperbarui.');
        }
      }

      var newId = generateId('PRM');
      var ins = await sb.from(TABLES.PROMOS).insert({
        ID: newId,
        Code: code,
        Title: title,
        DiscountAmount: discountAmount,
        MinOrder: minOrder,
        Status: status,
        CreatedAt: now,
        UpdatedAt: now,
        CreatedBy: admin.username,
        UpdatedBy: admin.username
      });
      if (ins.error) throw new Error(ins.error.message);
      return resOk({ id: newId }, 'Kode promo berhasil ditambahkan.');
    } catch (err) {
      return resErr(err.message);
    }
  }

  async function adminDeletePromo(id, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      return await softDeleteById(TABLES.PROMOS, id, admin.username, 'Kode promo tidak ditemukan.', 'Kode promo berhasil dihapus.');
    } catch (err) {
      return resErr(err.message);
    }
  }

  async function adminSaveDriver(payload, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      var id = cleanStr(payload && payload.id, 50);
      var fullName = cleanStr(payload && payload.fullName, 100);
      var phoneWA = normalizePhoneWA(payload && payload.phoneWA);
      var email = cleanStr(payload && payload.email, 120).toLowerCase();
      var area = cleanStr(payload && payload.area, 120) || 'Area Cepu';
      var vehicleType = cleanStr(payload && payload.vehicleType, 100) || 'Motor';
      var plateNumber = cleanStr(payload && payload.plateNumber, 30).toUpperCase();
      var normalizedPlate = normalizePlateNumber(plateNumber);
      var hasNotes = payload && payload.notes !== undefined;
      var notes = cleanStr(payload && payload.notes, 250);
      var availability = cleanStr(payload && payload.availability, 30) || 'Standby';
      var rawStatus = cleanStr(payload && payload.status, 30) || 'AKTIF';
      var status = (rawStatus === 'Inactive' || rawStatus.toUpperCase() === 'NONAKTIF')
        ? 'Inactive'
        : (rawStatus.toUpperCase() === 'PENDING' ? 'PENDING' : 'AKTIF');

      if (!fullName || !phoneWA) {
        return resErr('Nama driver dan nomor WhatsApp wajib diisi.');
      }

      var allDrivers = await fetchAllRows(TABLES.DRIVERS);
      for (var chk = 0; chk < allDrivers.length; chk++) {
        var ex = allDrivers[chk];
        if (ex.Status === 'Deleted' || String(ex.ID) === String(id)) continue;
        if (email && extractDriverEmail(ex) === email) {
          return resErr('Email ' + email + ' sudah digunakan oleh driver lain.');
        }
        if (normalizePhoneWA(ex.PhoneWA) === phoneWA) {
          return resErr('Nomor WhatsApp ' + phoneWA + ' sudah terdaftar pada driver lain.');
        }
        if (normalizedPlate && normalizePlateNumber(ex.PlateNumber) === normalizedPlate) {
          return resErr('Pelat nomor ' + plateNumber + ' sudah terdaftar pada driver lain.');
        }
      }

      var sb = getClient();
      var now = new Date().toISOString();

      if (id) {
        var existing = allDrivers.find(function (d) { return String(d.ID) === id; });
        if (existing) {
          var finalNotes = hasNotes ? notes : (existing.Notes || '');
          var finalEmail = email || extractDriverEmail({ Email: existing.Email, Notes: finalNotes });
          var upd = await sb.from(TABLES.DRIVERS).update({
            FullName: fullName,
            PhoneWA: phoneWA,
            Area: area,
            VehicleType: vehicleType,
            PlateNumber: plateNumber,
            Notes: finalNotes,
            ApprovalStatus: availability,
            Status: status,
            UpdatedAt: now,
            UpdatedBy: admin.username,
            Email: finalEmail
          }).eq('ID', id);
          if (upd.error) throw new Error(upd.error.message);

          var linkedStatus = status === 'PENDING' ? 'PENDING' : (status === 'Inactive' ? 'Inactive' : 'Active');
          await syncLinkedDriverUserStatus({
            PhoneWA: phoneWA,
            Email: finalEmail,
            Notes: finalNotes,
            CreatedBy: existing.CreatedBy
          }, linkedStatus, admin.username);

          if (payload && payload.photoFile && (payload.photoFile.base64 || payload.photoFile instanceof Blob)) {
            var upEdit = await uploadImageToStorage(payload.photoFile, 'DRIVER_PHOTO', id, admin.username);
            await saveDriverPhotoUrl(id, upEdit.fileUrl, admin.username);
          }
          return resOk({ id: id }, 'Data driver berhasil diperbarui.');
        }
      }

      var newId = generateId('DRV');
      var ins = await sb.from(TABLES.DRIVERS).insert({
        ID: newId,
        FullName: fullName,
        PhoneWA: phoneWA,
        Area: area,
        VehicleType: vehicleType,
        PlateNumber: plateNumber,
        Notes: notes,
        ApprovalStatus: availability,
        Status: status,
        CreatedAt: now,
        UpdatedAt: now,
        CreatedBy: admin.username,
        UpdatedBy: admin.username,
        Email: email
      });
      if (ins.error) throw new Error(ins.error.message);

      if (payload && payload.photoFile && (payload.photoFile.base64 || payload.photoFile instanceof Blob)) {
        var upNew = await uploadImageToStorage(payload.photoFile, 'DRIVER_PHOTO', newId, admin.username);
        await saveDriverPhotoUrl(newId, upNew.fileUrl, admin.username);
      }

      return resOk({ id: newId }, 'Driver baru berhasil ditambahkan.');
    } catch (err) {
      return resErr('Gagal menyimpan driver: ' + err.message);
    }
  }

  async function adminDeleteDriver(id, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      return await softDeleteById(TABLES.DRIVERS, id, admin.username, 'Data driver tidak ditemukan.', 'Driver berhasil dihapus.');
    } catch (err) {
      return resErr(err.message);
    }
  }

  async function adminSaveDriverQuota(maxQuota, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      var parsed = parseInt(maxQuota, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 1000) {
        return resErr('Kuota maksimal driver harus berupa angka antara 1 sampai 1000.');
      }
      await upsertSetting('MaxDriverQuota', String(parsed), admin.username);
      var drivers = await fetchAllRows(TABLES.DRIVERS);
      var quota = computeDriverQuota(drivers, { MaxDriverQuota: parsed });
      return resOk(quota, 'Kuota maksimal driver diperbarui menjadi ' + parsed + '.');
    } catch (err) {
      return resErr('Gagal menyimpan kuota driver: ' + err.message);
    }
  }

  async function adminUpdateDriverStatus(driverId, nextStatus, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      var allowed = ['PENDING', 'AKTIF', 'Nonaktif', 'Ditolak', 'Standby', 'Sibuk', 'Menunggu', 'Diterima'];
      if (allowed.indexOf(nextStatus) === -1) return resErr('Status mitra tidak valid.');

      var sb = getClient();
      var resDrv = await sb.from(TABLES.DRIVERS).select('*').eq('ID', String(driverId)).limit(1);
      if (resDrv.error) throw new Error(resDrv.error.message);
      var drv = resDrv.data && resDrv.data[0];
      if (!drv || drv.Status === 'Deleted') return resErr('Data driver tidak ditemukan.');

      var rowStatus = 'AKTIF';
      var appStatus = nextStatus;
      var userStatus = 'Active';

      if (nextStatus === 'PENDING' || nextStatus === 'Menunggu') {
        appStatus = 'PENDING';
        rowStatus = 'PENDING';
        userStatus = 'PENDING';
      } else if (nextStatus === 'AKTIF' || nextStatus === 'Diterima') {
        appStatus = 'Standby';
        rowStatus = 'AKTIF';
        userStatus = 'Active';
      } else if (nextStatus === 'Ditolak' || nextStatus === 'Nonaktif') {
        appStatus = nextStatus;
        rowStatus = nextStatus === 'Ditolak' ? 'Inactive' : 'Nonaktif';
        userStatus = 'Inactive';
      }

      var now = new Date().toISOString();
      var upd = await sb.from(TABLES.DRIVERS).update({
        ApprovalStatus: appStatus,
        Status: rowStatus,
        UpdatedAt: now,
        UpdatedBy: admin.username
      }).eq('ID', String(driverId));
      if (upd.error) throw new Error(upd.error.message);

      await syncLinkedDriverUserStatus({
        PhoneWA: drv.PhoneWA,
        Email: drv.Email,
        Notes: drv.Notes,
        CreatedBy: drv.CreatedBy
      }, userStatus, admin.username);

      var settingsAndDrivers = await Promise.all([getSettingsMap(), fetchAllRows(TABLES.DRIVERS)]);
      var quota = computeDriverQuota(settingsAndDrivers[1], settingsAndDrivers[0]);
      return resOk({ driverId: driverId, approvalStatus: appStatus, status: rowStatus, quota: quota }, 'Status driver diperbarui menjadi ' + nextStatus + '.');
    } catch (err) {
      return resErr(err.message);
    }
  }

  /* --------------------------------------------------------------------------
   * 6. HERO CAROUSEL & UPLOAD LOGO / SETTINGS
   * -------------------------------------------------------------------------- */
  async function adminSaveCarouselSlide(payload, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      var id = cleanStr(payload && payload.id, 50);
      var imageSource = (payload && payload.imageSource) === 'upload' ? 'upload' : 'url';
      var imageUrl = cleanStr(payload && payload.imageUrl, 600);
      var fileId = cleanStr(payload && payload.fileId, 120);
      var title = cleanStr(payload && payload.title, 120);
      var description = cleanStr(payload && payload.description, 250);
      var linkUrl = cleanStr(payload && payload.linkUrl, 300);
      var orderIndex = Number((payload && payload.orderIndex) || 1);
      var status = (payload && payload.status) === 'Inactive' ? 'Inactive' : 'Active';

      if (imageSource === 'upload' && payload && payload.fileData && (payload.fileData.base64 || payload.fileData instanceof Blob)) {
        var uploaded = await uploadImageToStorage(payload.fileData, 'CAROUSEL', id || 'NEW', admin.username);
        fileId = uploaded.fileId;
        imageUrl = uploaded.fileUrl;
      } else if (imageSource === 'url' && imageUrl) {
        if (!/^https?:\/\/.+/i.test(imageUrl)) {
          return resErr('URL gambar harus diawali http:// atau https://');
        }
        fileId = '';
      }

      var sb = getClient();
      var now = new Date().toISOString();

      if (id) {
        var existing = await sb.from(TABLES.HERO_CAROUSEL).select('*').eq('ID', id).limit(1);
        if (existing.data && existing.data.length) {
          var row = existing.data[0];
          var finalUrl = imageUrl || row.ImageURL;
          var finalFileId = imageSource === 'upload' ? (fileId || row.FileID) : '';
          var upd = await sb.from(TABLES.HERO_CAROUSEL).update({
            ImageSource: imageSource,
            ImageURL: finalUrl,
            FileID: finalFileId,
            Title: title,
            Description: description,
            LinkURL: linkUrl,
            OrderIndex: orderIndex,
            Status: status,
            UpdatedAt: now,
            UpdatedBy: admin.username
          }).eq('ID', id);
          if (upd.error) throw new Error(upd.error.message);
          return resOk({ id: id, imageUrl: finalUrl }, 'Slide Hero Carousel berhasil diperbarui.');
        }
      }

      var newId = generateId('SLD');
      var ins = await sb.from(TABLES.HERO_CAROUSEL).insert({
        ID: newId,
        ImageSource: imageSource,
        ImageURL: imageUrl,
        FileID: fileId,
        Title: title,
        Description: description,
        LinkURL: linkUrl,
        OrderIndex: orderIndex,
        Status: status,
        CreatedAt: now,
        UpdatedAt: now,
        CreatedBy: admin.username,
        UpdatedBy: admin.username
      });
      if (ins.error) throw new Error(ins.error.message);
      return resOk({ id: newId, imageUrl: imageUrl }, 'Slide Hero Carousel berhasil ditambahkan.');
    } catch (err) {
      return resErr('Gagal menyimpan slide carousel: ' + err.message);
    }
  }

  async function adminDeleteCarouselSlide(id, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      return await softDeleteById(TABLES.HERO_CAROUSEL, id, admin.username, 'Slide tidak ditemukan.', 'Slide berhasil dihapus.');
    } catch (err) {
      return resErr(err.message);
    }
  }

  async function adminUploadLogo(fileData, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      var uploaded = await uploadImageToStorage(fileData, 'LOGO', 'APP_LOGO', admin.username);
      await upsertSetting('LogoFileID', uploaded.fileId, admin.username);
      await upsertSetting('LogoURL', uploaded.fileUrl, admin.username);
      return resOk(uploaded, 'Logo SuruhAja berhasil diperbarui.');
    } catch (err) {
      return resErr('Gagal mengupload logo: ' + err.message);
    }
  }

  async function adminSaveSettings(payload, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      var wa = normalizePhoneWA(payload && payload.whatsappNumber);
      if (!wa) return resErr('Nomor WhatsApp tujuan order wajib diisi.');

      var appName = cleanStr(payload && payload.appName, 60) || 'SuruhAja';
      var appTagline = cleanStr(payload && payload.appTagline, 160);
      var saweriaUrl = cleanStr(payload && payload.saweriaUrl, 300);
      var saweriaText = cleanStr(payload && payload.saweriaText, 220) || 'Suka dengan layanan SuruhAja? Traktir kopi pengembang agar aplikasi tetap gratis & makin cepat!';
      var hasQuota = payload && payload.maxDriverQuota !== undefined && payload.maxDriverQuota !== '';
      var maxDriverQuota = hasQuota ? parseInt(payload.maxDriverQuota, 10) : null;

      if (hasQuota && (isNaN(maxDriverQuota) || maxDriverQuota < 1 || maxDriverQuota > 1000)) {
        return resErr('Kuota maksimal driver harus antara 1 sampai 1000.');
      }
      if (saweriaUrl && !/^https?:\/\/.+/i.test(saweriaUrl)) {
        return resErr('Link Saweria harus diawali dengan https:// (contoh: https://saweria.co/username).');
      }

      var footer = {
        brandName: cleanStr(payload && payload.footer && payload.footer.brandName, 60) || appName,
        description: cleanStr(payload && payload.footer && payload.footer.description, 250),
        address: cleanStr(payload && payload.footer && payload.footer.address, 180),
        whatsapp: normalizePhoneWA(payload && payload.footer && payload.footer.whatsapp) || wa,
        email: cleanStr(payload && payload.footer && payload.footer.email, 100),
        instagram: cleanStr(payload && payload.footer && payload.footer.instagram, 80),
        copyright: cleanStr(payload && payload.footer && payload.footer.copyright, 120)
      };

      await upsertSetting('WhatsAppNumber', wa, admin.username);
      await upsertSetting('AppName', appName, admin.username);
      await upsertSetting('AppTagline', appTagline, admin.username);
      await upsertSetting('SaweriaURL', saweriaUrl, admin.username);
      await upsertSetting('SaweriaText', saweriaText, admin.username);
      await upsertSetting('FooterJSON', JSON.stringify(footer), admin.username);
      if (hasQuota) {
        await upsertSetting('MaxDriverQuota', String(maxDriverQuota), admin.username);
      }

      return resOk({
        whatsappNumber: wa,
        maxDriverQuota: maxDriverQuota,
        saweriaUrl: saweriaUrl,
        saweriaText: saweriaText,
        footer: footer
      }, 'Pengaturan berhasil disimpan.');
    } catch (err) {
      return resErr('Gagal menyimpan pengaturan: ' + err.message);
    }
  }

  async function adminChangePassword(payload, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      var oldPassword = String((payload && payload.oldPassword) || '');
      var newPassword = String((payload && payload.newPassword) || '');
      var confirmPassword = String((payload && payload.confirmPassword) || '');

      if (!oldPassword || !newPassword || !confirmPassword) {
        return resErr('Password lama, password baru, dan konfirmasi wajib diisi.');
      }
      if (newPassword.length < 4) return resErr('Password baru minimal 4 karakter.');
      if (newPassword !== confirmPassword) return resErr('Konfirmasi password baru tidak cocok.');

      var sb = getClient();
      var resUser = await sb.from(TABLES.USERS).select('*').eq('ID', String(admin.id)).limit(1);
      if (resUser.error) throw new Error(resUser.error.message);
      var userRow = resUser.data && resUser.data[0];
      if (!userRow) return resErr('Akun Admin tidak ditemukan.');

      var oldHash = await hashPassword(oldPassword, userRow.Salt);
      if (oldHash !== String(userRow.PasswordHash)) {
        return resErr('Password lama yang Anda masukkan salah.');
      }

      var newSalt = randomHex(16);
      var newHash = await hashPassword(newPassword, newSalt);
      var upd = await sb.from(TABLES.USERS).update({
        PasswordHash: newHash,
        Salt: newSalt,
        UpdatedAt: new Date().toISOString(),
        UpdatedBy: admin.username
      }).eq('ID', String(admin.id));
      if (upd.error) throw new Error(upd.error.message);

      return resOk(null, 'Password Admin berhasil diubah! Gunakan password baru saat login berikutnya.');
    } catch (err) {
      return resErr('Gagal mengganti password: ' + err.message);
    }
  }

  async function adminSaveStoreStatus(payload, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      var status = (payload && payload.storeStatus) === 'CLOSED' ? 'CLOSED' : 'OPEN';
      var note = cleanStr(payload && payload.storeStatusNote, 120) || (status === 'OPEN' ? 'Kurir Siap Jalan' : 'Sedang Istirahat / Tutup');

      await upsertSetting('StoreStatus', status, admin.username);
      await upsertSetting('StoreStatusNote', note, admin.username);
      return resOk({ storeStatus: status, storeStatusNote: note }, 'Status operasional berhasil diperbarui.');
    } catch (err) {
      return resErr('Gagal mengubah status buka/tutup: ' + err.message);
    }
  }

  async function adminSavePartners(partnersList, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      var cleanList = [];
      if (Array.isArray(partnersList)) {
        partnersList.slice(0, 30).forEach(function (p) {
          if (!p) return;
          var name = cleanStr(p.name, 100);
          if (name) {
            cleanList.push({
              id: cleanStr(p.id, 40) || generateId('PRT'),
              name: name,
              category: cleanStr(p.category, 40) || 'Kuliner',
              menuHint: cleanStr(p.menuHint, 120) || '',
              badge: cleanStr(p.badge, 30) || 'Rekanan',
              icon: cleanStr(p.icon, 16) || '🍜',
              status: p.status === 'Inactive' ? 'Inactive' : 'Active'
            });
          }
        });
      }
      await upsertSetting('PartnersJSON', JSON.stringify(cleanList), admin.username);
      return resOk(cleanList, 'Daftar Warung Rekanan berhasil disimpan.');
    } catch (err) {
      return resErr('Gagal menyimpan warung rekanan: ' + err.message);
    }
  }

  async function adminSaveTestimonials(testimonialsList, sessionToken) {
    try {
      var admin = await requireAdmin(sessionToken);
      var cleanList = [];
      if (Array.isArray(testimonialsList)) {
        testimonialsList.slice(0, 20).forEach(function (t) {
          if (!t) return;
          var name = cleanStr(t.name, 80);
          var comment = cleanStr(t.comment, 260);
          if (name && comment) {
            cleanList.push({
              id: cleanStr(t.id, 40) || generateId('TST'),
              name: name,
              rating: Math.min(5, Math.max(1, Number(t.rating || 5))),
              comment: comment,
              status: t.status === 'Inactive' ? 'Inactive' : 'Active'
            });
          }
        });
      }
      await upsertSetting('TestimonialsJSON', JSON.stringify(cleanList), admin.username);
      return resOk(cleanList, 'Daftar testimoni berhasil disimpan.');
    } catch (err) {
      return resErr('Gagal menyimpan testimoni: ' + err.message);
    }
  }

  /* --------------------------------------------------------------------------
   * Expose Global API
   * -------------------------------------------------------------------------- */
  global.SuruhAjaAPI = {
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
    TABLES: TABLES,
    STORAGE_BUCKET: STORAGE_BUCKET,
    getClient: getClient,
    uploadImageToStorage: uploadImageToStorage,
    syncFirebaseUser: syncFirebaseUser,
    getAppBootstrap: getAppBootstrap,
    loginUser: loginUser,
    getDriverRegistrationStatus: getDriverRegistrationStatus,
    loginDriverWithGoogle: loginDriverWithGoogle,
    registerDriverAccount: registerDriverAccount,
    logoutUser: logoutUser,
    createOrder: createOrder,
    getCustomerOrders: getCustomerOrders,
    getDriverDashboardData: getDriverDashboardData,
    driverUpdateAvailability: driverUpdateAvailability,
    driverUpdateOwnPhoto: driverUpdateOwnPhoto,
    driverUpdateOrderStatus: driverUpdateOrderStatus,
    getAdminDashboardData: getAdminDashboardData,
    adminUpdateOrderStatus: adminUpdateOrderStatus,
    adminSaveService: adminSaveService,
    adminDeleteService: adminDeleteService,
    adminSaveTariffService: adminSaveTariffService,
    adminToggleTariffStatus: adminToggleTariffStatus,
    adminDeleteTariffService: adminDeleteTariffService,
    adminSavePricing: adminSavePricing,
    adminDeletePricing: adminDeletePricing,
    adminSavePromo: adminSavePromo,
    adminDeletePromo: adminDeletePromo,
    adminSaveDriver: adminSaveDriver,
    adminDeleteDriver: adminDeleteDriver,
    adminSaveDriverQuota: adminSaveDriverQuota,
    adminUpdateDriverStatus: adminUpdateDriverStatus,
    adminSaveCarouselSlide: adminSaveCarouselSlide,
    adminDeleteCarouselSlide: adminDeleteCarouselSlide,
    adminUploadLogo: adminUploadLogo,
    adminSaveSettings: adminSaveSettings,
    adminChangePassword: adminChangePassword,
    adminSaveStoreStatus: adminSaveStoreStatus,
    adminSavePartners: adminSavePartners,
    adminSaveTestimonials: adminSaveTestimonials
  };
})(window);
