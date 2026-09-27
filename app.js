(function () {
  'use strict';

  var baseCans = window.CAN_COLLECTION || [];
  var userCans = [];
  var STORAGE_KEY = 'can-catalog:ratings:v1';
  var DB_NAME = 'can-catalog';
  var DB_STORE = 'cans';
  var HIDDEN_KEY = 'can-catalog:hidden:v1';
  var PHOTO_MAX_SIDE = 1600;
  var PHOTO_KEEP_SIZE = 1.5 * 1024 * 1024;

  var els = {
    sub: document.getElementById('collectionSub'),
    form: document.getElementById('filters'),
    search: document.getElementById('searchInput'),
    brand: document.getElementById('filterBrand'),
    country: document.getElementById('filterCountry'),
    flavor: document.getElementById('filterFlavor'),
    sort: document.getElementById('sortBy'),
    grid: document.getElementById('grid'),
    empty: document.getElementById('emptyState'),
    reset: document.getElementById('resetFilters'),
    overlay: document.getElementById('overlay'),
    panel: document.getElementById('panel'),
    panelClose: document.getElementById('panelClose'),
    panelMedia: document.getElementById('panelMedia'),
    panelNumber: document.getElementById('panelNumber'),
    panelBrand: document.getElementById('panelBrand'),
    panelTitle: document.getElementById('panelTitle'),
    metaCountry: document.getElementById('metaCountry'),
    metaDate: document.getElementById('metaDate'),
    metaVolume: document.getElementById('metaVolume'),
    stars: document.getElementById('panelStars'),
    clearRating: document.getElementById('clearRating'),
    panelNotes: document.getElementById('panelNotes'),
    deleteCan: document.getElementById('deleteCan'),
    addCanBtn: document.getElementById('addCanBtn'),
    formPanel: document.getElementById('formPanel'),
    formClose: document.getElementById('formClose'),
    addForm: document.getElementById('addForm'),
    dropzone: document.getElementById('dropzone'),
    photoInput: document.getElementById('photoInput'),
    photoPreview: document.getElementById('photoPreview'),
    dzEmpty: document.getElementById('dzEmpty'),
    photoRemove: document.getElementById('photoRemove'),
    colorField: document.getElementById('colorField'),
    colorInput: document.getElementById('colorInput'),
    fNumber: document.getElementById('fNumber'),
    fBrand: document.getElementById('fBrand'),
    fFlavor: document.getElementById('fFlavor'),
    fCountry: document.getElementById('fCountry'),
    fVolume: document.getElementById('fVolume'),
    fDate: document.getElementById('fDate'),
    fNotes: document.getElementById('fNotes'),
    brandList: document.getElementById('brandList'),
    countryList: document.getElementById('countryList'),
    formError: document.getElementById('formError')
  };

  var state = {
    search: '',
    brand: '',
    country: '',
    flavor: '',
    sort: 'number-asc',
    ratings: loadRatings(),
    hiddenIds: loadHidden()
  };

  var db = null;
  var pendingPhoto = null;
  var currentCan = null;
  var lastFocused = null;
  var openPanelEl = null;

  var STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>';
  var X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function loadRatings() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      var out = {};
      Object.keys(raw).forEach(function (k) {
        var v = Number(raw[k]);
        if (v >= 1 && v <= 5) out[k] = Math.round(v);
      });
      return out;
    } catch (e) {
      return {};
    }
  }

  function saveRatings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.ratings));
    } catch (e) {}
  }

  function loadHidden() {
    try {
      var raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter(function (v) { return typeof v === 'string'; }) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHidden() {
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(state.hiddenIds));
    } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pad(n) {
    return '№ ' + String(n).padStart(3, '0');
  }

  function plural(n, forms) {
    var a = n % 10;
    var b = n % 100;
    if (a === 1 && b !== 11) return forms[0];
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return forms[1];
    return forms[2];
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    if (isNaN(n)) return hex;
    var t = f < 0 ? 0 : 255;
    var p = Math.abs(f);
    var r = (n >> 16) & 255;
    var g = (n >> 8) & 255;
    var b = n & 255;
    r = Math.round((t - r) * p + r);
    g = Math.round((t - g) * p + g);
    b = Math.round((t - b) * p + b);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function initials(brand) {
    return String(brand).trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w.charAt(0); })
      .join('')
      .toUpperCase();
  }

  function placeholderSvg(can) {
    var c = can.color || '#7C8B99';
    return '<svg viewBox="0 0 200 264" role="img" aria-label="' + esc(can.brand) + '">' +
      '<ellipse cx="100" cy="248" rx="54" ry="8" fill="rgba(22,25,30,.07)"/>' +
      '<rect x="58" y="34" width="84" height="208" rx="13" fill="' + c + '"/>' +
      '<rect x="62" y="24" width="76" height="18" rx="8" fill="' + shade(c, -0.38) + '"/>' +
      '<rect x="72" y="29" width="26" height="5" rx="2.5" fill="rgba(255,255,255,.4)"/>' +
      '<rect x="58" y="106" width="84" height="54" fill="rgba(22,25,30,.16)"/>' +
      '<text x="100" y="134" text-anchor="middle" dominant-baseline="middle" font-family="Inter, system-ui, sans-serif" font-size="21" font-weight="600" letter-spacing="3" fill="#fff">' + esc(initials(can.brand)) + '</text>' +
      '<rect x="66" y="44" width="7" height="188" rx="3.5" fill="rgba(255,255,255,.2)"/>' +
      '</svg>';
  }

  function mediaHtml(can) {
    if (can.imageUrl) {
      return '<img src="' + can.imageUrl + '" alt="' + esc(can.brand + ' ' + can.flavor) + '">';
    }
    if (can.image) {
      return '<img src="' + esc(can.image) + '" alt="' + esc(can.brand + ' ' + can.flavor) + '" loading="lazy"' +
        ' onerror="this.onerror=null;this.parentElement.innerHTML=window.__canFallback(\'' + esc(can.id) + '\')">';
    }
    return placeholderSvg(can);
  }

  window.__canFallback = function (id) {
    var can = byId(id);
    return can ? placeholderSvg(can) : '';
  };

  function allCans() {
    return baseCans
      .filter(function (c) { return state.hiddenIds.indexOf(c.id) === -1; })
      .concat(userCans);
  }

  function byId(id) {
    return allCans().find(function (c) { return c.id === id; });
  }

  function uniqueSorted(arr) {
    return Array.from(new Set(arr.filter(Boolean)))
      .sort(function (a, b) { return a.localeCompare(b, 'ru'); });
  }

  function fillSelect(sel, values, allLabel) {
    var current = sel.value;
    sel.innerHTML = '<option value="">' + allLabel + '</option>' +
      values.map(function (v) {
        return '<option value="' + esc(v) + '">' + esc(v) + '</option>';
      }).join('');
    if (values.indexOf(current) !== -1) sel.value = current;
  }

  function fillDatalist(sel, values) {
    sel.innerHTML = values.map(function (v) {
      return '<option value="' + esc(v) + '"></option>';
    }).join('');
  }

  function populateFilters() {
    var brands = uniqueSorted(allCans().map(function (c) { return c.brand; }));
    var countries = uniqueSorted(allCans().map(function (c) { return c.country; }));
    var flavors = uniqueSorted(allCans().map(function (c) { return c.flavor; }));
    fillSelect(els.brand, brands, 'Все бренды');
    fillSelect(els.country, countries, 'Все страны');
    fillSelect(els.flavor, flavors, 'Все вкусы');
    fillDatalist(els.brandList, brands);
    fillDatalist(els.countryList, countries);
  }

  var SORTERS = {
    'number-asc': function (a, b) { return a.number - b.number; },
    'number-desc': function (a, b) { return b.number - a.number; },
    'rating-desc': function (a, b) {
      return (state.ratings[b.id] || 0) - (state.ratings[a.id] || 0) || a.number - b.number;
    },
    'brand-asc': function (a, b) {
      return a.brand.localeCompare(b.brand, 'ru') || a.number - b.number;
    }
  };

  function getFiltered() {
    var q = state.search.trim().toLowerCase();
    var list = allCans().filter(function (c) {
      if (state.brand && c.brand !== state.brand) return false;
      if (state.country && c.country !== state.country) return false;
      if (state.flavor && c.flavor !== state.flavor) return false;
      if (!q) return true;
      var hay = [c.brand, c.flavor, c.country, c.notes, c.number].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    list.sort(SORTERS[state.sort] || SORTERS['number-asc']);
    return list;
  }

  function miniStars(rating) {
    if (!rating) return '';
    var out = '<span class="mini-stars" aria-label="Оценка: ' + rating + ' из 5">';
    for (var i = 1; i <= 5; i++) {
      out += '<span class="' + (i <= rating ? 'on' : 'off') + '">' + STAR_SVG + '</span>';
    }
    return out + '</span>';
  }

  function cardHtml(can, i, withAppear) {
    return '<article class="card' + (withAppear ? ' appear' : '') + '"' +
      (withAppear ? ' style="--i:' + i + '"' : '') +
      ' data-id="' + esc(can.id) + '" tabindex="0" role="button"' +
      ' aria-label="' + esc(can.brand + ' ' + can.flavor + '. Открыть карточку') + '">' +
      '<button class="card-remove" type="button" aria-label="Удалить банку ' + esc(can.brand + ' ' + can.flavor) + '">' + X_SVG + '</button>' +
      '<div class="card-media">' + mediaHtml(can) + '</div>' +
      '<div class="card-body">' +
      '<div class="card-row"><span class="card-number">' + pad(can.number) + '</span>' + miniStars(state.ratings[can.id]) + '</div>' +
      '<h3 class="card-brand">' + esc(can.brand) + '</h3>' +
      '<p class="card-flavor">' + esc(can.flavor) + '</p>' +
      '<p class="card-country">' + esc(can.country) + '</p>' +
      '</div></article>';
  }

  function updateSub(shown) {
    var total = allCans().length;
    if (shown === total) {
      els.sub.textContent = total + ' ' + plural(total, ['банка', 'банки', 'банок']) + ' в коллекции';
    } else {
      els.sub.textContent = 'Показано ' + shown + ' из ' + total;
    }
  }

  function renderGrid(withAppear) {
    var list = getFiltered();
    els.grid.innerHTML = list.map(function (c, i) {
      return cardHtml(c, i, withAppear);
    }).join('');
    els.grid.hidden = list.length === 0;
    els.empty.hidden = list.length > 0;
    updateSub(list.length);
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB is not available'));
        return;
      }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore(DB_STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function dbGetAll(database) {
    return new Promise(function (resolve, reject) {
      var req = database.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).getAll();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function dbPut(database, record) {
    return new Promise(function (resolve, reject) {
      var req = database.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(record);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function dbDelete(database, id) {
    return new Promise(function (resolve, reject) {
      var req = database.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).delete(id);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function loadUserCans() {
    return openDb().then(function (database) {
      db = database;
      return dbGetAll(database);
    }).then(function (records) {
      userCans = (records || []).map(function (rec) {
        var can = Object.assign({}, rec);
        can.isUser = true;
        if (can.photo) {
          try { can.imageUrl = URL.createObjectURL(can.photo); } catch (e) {}
        }
        return can;
      });
    });
  }

  function paintStars(container, value, cls) {
    Array.prototype.forEach.call(container.children, function (btn) {
      btn.classList.toggle(cls, Number(btn.dataset.value) <= value);
    });
  }

  function renderStars(current) {
    els.stars.innerHTML = '';
    for (var v = 1; v <= 5; v++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'star';
      b.dataset.value = String(v);
      b.setAttribute('aria-label', v + ' из 5');
      b.innerHTML = STAR_SVG;
      els.stars.appendChild(b);
    }
    paintStars(els.stars, current, 'on');
  }

  function openDetail(can) {
    if (openPanelEl && openPanelEl !== els.panel) closePanelEl(openPanelEl, false);
    currentCan = can;
    if (openPanelEl !== els.panel) {
      lastFocused = document.activeElement;
      openPanelEl = els.panel;
    }

    els.panelMedia.innerHTML = mediaHtml(can);
    els.panelNumber.textContent = pad(can.number);
    els.panelBrand.textContent = can.brand;
    els.panelTitle.textContent = can.flavor;
    els.metaCountry.textContent = can.country || '—';
    els.metaDate.textContent = formatDate(can.date) || '—';
    els.metaVolume.textContent = can.volume || '—';

    var rating = state.ratings[can.id] || 0;
    renderStars(rating);
    els.clearRating.hidden = !rating;
    els.deleteCan.hidden = false;

    if (can.notes) {
      els.panelNotes.textContent = can.notes;
      els.panelNotes.classList.remove('is-empty');
    } else {
      els.panelNotes.textContent = 'Заметок пока нет.';
      els.panelNotes.classList.add('is-empty');
    }

    els.overlay.classList.add('show');
    els.panel.classList.add('open');
    document.body.classList.add('no-scroll');
    els.panel.scrollTop = 0;
    els.panelClose.focus();
  }

  function closePanelEl(panel, restoreFocus) {
    panel.classList.remove('open');
    if (panel === els.panel) currentCan = null;
    if (openPanelEl === panel) openPanelEl = null;
    if (!els.panel.classList.contains('open') && !els.formPanel.classList.contains('open')) {
      els.overlay.classList.remove('show');
      document.body.classList.remove('no-scroll');
    }
    if (restoreFocus && lastFocused && document.contains(lastFocused)) lastFocused.focus();
    if (restoreFocus) lastFocused = null;
  }

  function closeAllPanels() {
    if (openPanelEl) closePanelEl(openPanelEl, true);
    else {
      els.panel.classList.remove('open');
      els.formPanel.classList.remove('open');
      els.overlay.classList.remove('show');
      document.body.classList.remove('no-scroll');
    }
  }

  function nextNumber() {
    return allCans().reduce(function (m, c) {
      return Math.max(m, Number(c.number) || 0);
    }, 0) + 1;
  }

  function showFormError(msg) {
    els.formError.textContent = msg;
    els.formError.hidden = false;
  }

  function hideFormError() {
    els.formError.hidden = true;
  }

  function clearPendingPhoto() {
    if (pendingPhoto) {
      URL.revokeObjectURL(pendingPhoto.url);
      pendingPhoto = null;
    }
  }

  function resetPhotoUi() {
    els.photoPreview.hidden = true;
    els.photoPreview.removeAttribute('src');
    els.dzEmpty.hidden = false;
    els.photoRemove.hidden = true;
    els.colorField.hidden = false;
  }

  function resetForm() {
    clearPendingPhoto();
    els.addForm.reset();
    els.colorInput.value = '#0E6B5B';
    resetPhotoUi();
    hideFormError();
    [els.fBrand, els.fFlavor, els.fCountry].forEach(function (inp) {
      inp.classList.remove('invalid');
    });
  }

  function processPhoto(file) {
    return new Promise(function (resolve) {
      if (!file || !/^image\//.test(file.type)) {
        resolve(null);
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (w <= PHOTO_MAX_SIDE && h <= PHOTO_MAX_SIDE && file.size <= PHOTO_KEEP_SIZE) {
          resolve(file);
          return;
        }
        var scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(w, h));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          resolve(blob || file);
        }, 'image/jpeg', 0.85);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  function setPhoto(file) {
    if (!file) return;
    hideFormError();
    processPhoto(file).then(function (blob) {
      if (!blob) {
        showFormError('Не удалось прочитать изображение. Попробуй другой файл.');
        return;
      }
      clearPendingPhoto();
      pendingPhoto = { blob: blob, url: URL.createObjectURL(blob) };
      els.photoPreview.src = pendingPhoto.url;
      els.photoPreview.hidden = false;
      els.dzEmpty.hidden = true;
      els.photoRemove.hidden = false;
      els.colorField.hidden = true;
    });
  }

  function openForm() {
    if (openPanelEl && openPanelEl !== els.formPanel) closePanelEl(openPanelEl, false);
    if (openPanelEl !== els.formPanel) {
      lastFocused = document.activeElement;
      openPanelEl = els.formPanel;
    }
    els.fNumber.value = String(nextNumber());
    els.overlay.classList.add('show');
    els.formPanel.classList.add('open');
    document.body.classList.add('no-scroll');
    els.formPanel.scrollTop = 0;
    els.fBrand.focus();
  }

  function setRating(can, value) {
    if (state.ratings[can.id] === value) return;
    state.ratings[can.id] = value;
    saveRatings();
    paintStars(els.stars, value, 'on');
    els.clearRating.hidden = false;
    renderGrid(false);
  }

  function removeCan(can) {
    var label = can.brand + ' ' + can.flavor;
    if (!window.confirm('Удалить банку «' + label + '» из коллекции?')) return;

    var finish = function () {
      if (can.imageUrl) URL.revokeObjectURL(can.imageUrl);
      if (state.ratings[can.id]) {
        delete state.ratings[can.id];
        saveRatings();
      }
      if (can.isUser) {
        userCans = userCans.filter(function (c) { return c.id !== can.id; });
      } else {
        state.hiddenIds.push(can.id);
        saveHidden();
      }
      closeAllPanels();
      populateFilters();
      renderGrid(false);
    };

    if (can.isUser && db) {
      dbDelete(db, can.id).then(finish, finish);
    } else {
      finish();
    }
  }

  els.form.addEventListener('submit', function (e) { e.preventDefault(); });

  els.search.addEventListener('input', function () {
    state.search = els.search.value;
    renderGrid(false);
  });

  els.brand.addEventListener('change', function () {
    state.brand = els.brand.value;
    renderGrid(false);
  });

  els.country.addEventListener('change', function () {
    state.country = els.country.value;
    renderGrid(false);
  });

  els.flavor.addEventListener('change', function () {
    state.flavor = els.flavor.value;
    renderGrid(false);
  });

  els.sort.addEventListener('change', function () {
    state.sort = els.sort.value;
    renderGrid(false);
  });

  els.reset.addEventListener('click', function () {
    state.search = '';
    state.brand = '';
    state.country = '';
    state.flavor = '';
    state.sort = 'number-asc';
    els.form.reset();
    renderGrid(false);
  });

  els.grid.addEventListener('click', function (e) {
    var removeBtn = e.target.closest('.card-remove');
    if (removeBtn) {
      var card = removeBtn.closest('.card');
      var target = card && byId(card.dataset.id);
      if (target) removeCan(target);
      return;
    }
    var cardEl = e.target.closest('.card');
    if (!cardEl) return;
    var can = byId(cardEl.dataset.id);
    if (can) openDetail(can);
  });

  els.grid.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest('.card-remove')) return;
    var card = e.target.closest('.card');
    if (!card) return;
    e.preventDefault();
    var can = byId(card.dataset.id);
    if (can) openDetail(can);
  });

  els.stars.addEventListener('click', function (e) {
    var btn = e.target.closest('.star');
    if (!btn || !currentCan) return;
    setRating(currentCan, Number(btn.dataset.value));
  });

  els.stars.addEventListener('mouseover', function (e) {
    var btn = e.target.closest('.star');
    if (!btn) return;
    els.stars.classList.add('hover');
    paintStars(els.stars, Number(btn.dataset.value), 'pre');
  });

  els.stars.addEventListener('mouseleave', function () {
    els.stars.classList.remove('hover');
    Array.prototype.forEach.call(els.stars.querySelectorAll('.pre'), function (b) {
      b.classList.remove('pre');
    });
  });

  els.clearRating.addEventListener('click', function () {
    if (!currentCan) return;
    delete state.ratings[currentCan.id];
    saveRatings();
    paintStars(els.stars, 0, 'on');
    els.clearRating.hidden = true;
    renderGrid(false);
  });

  els.panelClose.addEventListener('click', function () { closeAllPanels(); });
  els.formClose.addEventListener('click', function () { closeAllPanels(); });
  els.overlay.addEventListener('click', function () { closeAllPanels(); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openPanelEl) closeAllPanels();
  });

  Array.prototype.forEach.call(document.querySelectorAll('.panel'), function (p) {
    p.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var focusables = Array.prototype.filter.call(
        p.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        function (el) { return el.offsetParent !== null; }
      );
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  });

  els.addCanBtn.addEventListener('click', openForm);

  els.dropzone.addEventListener('click', function () {
    els.photoInput.click();
  });

  els.dropzone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      els.photoInput.click();
    }
  });

  els.photoInput.addEventListener('change', function () {
    var file = els.photoInput.files && els.photoInput.files[0];
    setPhoto(file);
    els.photoInput.value = '';
  });

  ['dragenter', 'dragover'].forEach(function (type) {
    els.dropzone.addEventListener(type, function (e) {
      e.preventDefault();
      els.dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(function (type) {
    els.dropzone.addEventListener(type, function (e) {
      e.preventDefault();
      els.dropzone.classList.remove('dragover');
    });
  });

  els.dropzone.addEventListener('drop', function (e) {
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    setPhoto(file);
  });

  els.photoRemove.addEventListener('click', function (e) {
    e.stopPropagation();
    clearPendingPhoto();
    resetPhotoUi();
  });

  [els.fBrand, els.fFlavor, els.fCountry].forEach(function (inp) {
    inp.addEventListener('input', function () {
      inp.classList.remove('invalid');
      hideFormError();
    });
  });

  els.addForm.addEventListener('submit', function (e) {
    e.preventDefault();
    hideFormError();

    var missing = [els.fBrand, els.fFlavor, els.fCountry].filter(function (inp) {
      var ok = inp.value.trim().length > 0;
      inp.classList.toggle('invalid', !ok);
      return !ok;
    });

    if (missing.length) {
      showFormError('Заполните обязательные поля: бренд, вкус и страна.');
      missing[0].focus();
      return;
    }

    var number = parseInt(els.fNumber.value, 10);
    if (!number || number < 1) number = nextNumber();

    var record = {
      id: 'user-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
      number: number,
      brand: els.fBrand.value.trim(),
      flavor: els.fFlavor.value.trim(),
      country: els.fCountry.value.trim(),
      volume: els.fVolume.value.trim() || null,
      date: els.fDate.value || null,
      notes: els.fNotes.value.trim() || null,
      color: els.colorInput.value || '#7C8B99',
      photo: pendingPhoto ? pendingPhoto.blob : null,
      createdAt: Date.now(),
      isUser: true
    };

    var apply = function () {
      var can = Object.assign({}, record);
      if (record.photo) {
        try { can.imageUrl = URL.createObjectURL(record.photo); } catch (e) {}
      }
      userCans.push(can);
      resetForm();
      closeAllPanels();
      populateFilters();
      renderGrid(false);
    };

    if (db) {
      dbPut(db, record).then(apply, function () {
        showFormError('Не удалось сохранить банку: хранилище браузера недоступно.');
      });
    } else {
      showFormError('Не удалось сохранить банку: хранилище браузера недоступно.');
    }
  });

  els.deleteCan.addEventListener('click', function () {
    if (!currentCan) return;
    removeCan(currentCan);
  });

  function init() {
    populateFilters();
    renderGrid(true);
  }

  loadUserCans().then(init, init);
})();
