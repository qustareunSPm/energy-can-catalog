(function () {
  'use strict';

  var els = {
    sub: document.getElementById('collectionSub'),
    form: document.getElementById('filters'),
    search: document.getElementById('searchInput'),
    brand: document.getElementById('filterBrand'),
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
    formError: document.getElementById('formError'),
    saveBtn: document.getElementById('saveBtn'),
    authScreen: document.getElementById('authScreen'),
    authForm: document.getElementById('authForm'),
    authTitle: document.getElementById('authTitle'),
    authSub: document.getElementById('authSub'),
    aUser: document.getElementById('aUser'),
    aPass: document.getElementById('aPass'),
    authError: document.getElementById('authError'),
    authSubmit: document.getElementById('authSubmit'),
    authToggle: document.getElementById('authToggle'),
    appShell: document.getElementById('appShell'),
    userChip: document.getElementById('userChip'),
    logoutBtn: document.getElementById('logoutBtn'),
    themeBtn: document.getElementById('themeBtn')
  };

  var state = {
    search: '',
    brand: '',
    flavor: '',
    sort: 'number-asc'
  };

  var cans = [];
  var pendingPhoto = null;
  var currentCan = null;
  var lastFocused = null;
  var openPanelEl = null;
  var authMode = 'login';

  var STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>';
  var X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var THEME_KEY = 'can-catalog:theme';
  var SUN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/></svg>';
  var MOON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
    els.themeBtn.innerHTML = theme === 'dark' ? SUN_SVG : MOON_SVG;
    els.themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Светлая тема' : 'Тёмная тема');
  }

  async function api(method, url, body) {
    var opts = { method: method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    var res;
    try {
      res = await fetch(url, opts);
    } catch (e) {
      var netErr = new Error('Нет связи с сервером');
      netErr.status = 0;
      throw netErr;
    }
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      var err = new Error(data && data.error ? data.error : 'Ошибка ' + res.status);
      err.status = res.status;
      throw err;
    }
    return data;
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
    if (can.photoUrl) {
      return '<img src="' + esc(can.photoUrl) + '" alt="' + esc(can.brand + ' ' + can.flavor) + '" loading="lazy">';
    }
    return placeholderSvg(can);
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
    var brands = uniqueSorted(cans.map(function (c) { return c.brand; }));
    var flavors = uniqueSorted(cans.map(function (c) { return c.flavor; }));
    var countries = uniqueSorted(cans.map(function (c) { return c.country; }));
    fillSelect(els.brand, brands, 'Все бренды');
    fillSelect(els.flavor, flavors, 'Все вкусы');
    fillDatalist(els.brandList, brands);
    fillDatalist(els.countryList, countries);
  }

  var SORTERS = {
    'number-asc': function (a, b) { return a.number - b.number; },
    'number-desc': function (a, b) { return b.number - a.number; },
    'rating-desc': function (a, b) {
      return (b.rating || 0) - (a.rating || 0) || a.number - b.number;
    },
    'brand-asc': function (a, b) {
      return a.brand.localeCompare(b.brand, 'ru') || a.number - b.number;
    }
  };

  function getFiltered() {
    var q = state.search.trim().toLowerCase();
    var list = cans.filter(function (c) {
      if (state.brand && c.brand !== state.brand) return false;
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
      '<div class="card-row"><span class="card-number">' + pad(can.number) + '</span>' + miniStars(can.rating) + '</div>' +
      '<h3 class="card-brand">' + esc(can.brand) + '</h3>' +
      '<p class="card-flavor">' + esc(can.flavor) + '</p>' +
      '<p class="card-country">' + esc(can.country) + '</p>' +
      '</div></article>';
  }

  function updateSub(shown) {
    var total = cans.length;
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

  function nextNumber() {
    return cans.reduce(function (m, c) {
      return Math.max(m, Number(c.number) || 0);
    }, 0) + 1;
  }

  async function loadCans(withAppear) {
    var data = await api('GET', '/api/cans');
    cans = data.cans || [];
    populateFilters();
    renderGrid(withAppear);
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

    renderStars(can.rating || 0);
    els.clearRating.hidden = !can.rating;
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

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(blob);
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
      img.onload = async function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        var keepSize = 1.5 * 1024 * 1024;
        var blob;
        if (w <= 1600 && h <= 1600 && file.size <= keepSize) {
          blob = file;
        } else {
          var scale = Math.min(1, 1600 / Math.max(w, h));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          blob = await new Promise(function (res2) {
            canvas.toBlob(res2, 'image/jpeg', 0.85);
          }) || file;
        }
        try {
          var dataUrl = await blobToDataUrl(blob);
          resolve({ blob: blob, url: URL.createObjectURL(blob), dataUrl: dataUrl });
        } catch (e) {
          resolve(null);
        }
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
    processPhoto(file).then(function (photo) {
      if (!photo) {
        showFormError('Не удалось прочитать изображение. Попробуй другой файл.');
        return;
      }
      clearPendingPhoto();
      pendingPhoto = photo;
      els.photoPreview.src = photo.url;
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

  function setAuthMode(mode) {
    authMode = mode;
    els.authError.hidden = true;
    if (mode === 'login') {
      els.authTitle.textContent = 'Вход';
      els.authSub.textContent = 'Войдите, чтобы открыть свою коллекцию';
      els.authSubmit.textContent = 'Войти';
      els.authToggle.textContent = 'Создать аккаунт';
      els.aPass.setAttribute('autocomplete', 'current-password');
    } else {
      els.authTitle.textContent = 'Регистрация';
      els.authSub.textContent = 'Новый аккаунт получит стартовую коллекцию из 10 банок';
      els.authSubmit.textContent = 'Создать аккаунт';
      els.authToggle.textContent = 'У меня есть аккаунт';
      els.aPass.setAttribute('autocomplete', 'new-password');
    }
  }

  function showAuth(message) {
    closeAllPanels();
    cans = [];
    els.appShell.hidden = true;
    els.userChip.hidden = true;
    els.logoutBtn.hidden = true;
    els.authScreen.hidden = false;
    if (message) {
      els.authError.textContent = message;
      els.authError.hidden = false;
    } else {
      els.authError.hidden = true;
    }
    els.aUser.focus();
  }

  function enterApp(username) {
    els.authScreen.hidden = true;
    els.appShell.hidden = false;
    els.userChip.textContent = '@' + username;
    els.userChip.hidden = false;
    els.logoutBtn.hidden = false;
  }

  async function setRating(can, value) {
    try {
      var updated = await api('PATCH', '/api/cans/' + encodeURIComponent(can.id) + '/rating', { rating: value });
      can.rating = updated.rating;
      paintStars(els.stars, value, 'on');
      els.clearRating.hidden = !value;
      renderGrid(false);
    } catch (e) {}
  }

  async function removeCan(can) {
    var label = can.brand + ' ' + can.flavor;
    if (!window.confirm('Удалить банку «' + label + '» из коллекции?')) return;
    try {
      await api('DELETE', '/api/cans/' + encodeURIComponent(can.id));
    } catch (e) {
      return;
    }
    cans = cans.filter(function (c) { return c.id !== can.id; });
    closeAllPanels();
    populateFilters();
    renderGrid(false);
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
    state.flavor = '';
    state.sort = 'number-asc';
    els.form.reset();
    renderGrid(false);
  });

  els.grid.addEventListener('click', function (e) {
    var removeBtn = e.target.closest('.card-remove');
    if (removeBtn) {
      var card = removeBtn.closest('.card');
      var target = card && cans.find(function (c) { return c.id === card.dataset.id; });
      if (target) removeCan(target);
      return;
    }
    var cardEl = e.target.closest('.card');
    if (!cardEl) return;
    var can = cans.find(function (c) { return c.id === cardEl.dataset.id; });
    if (can) openDetail(can);
  });

  els.grid.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest('.card-remove')) return;
    var card = e.target.closest('.card');
    if (!card) return;
    e.preventDefault();
    var can = cans.find(function (c) { return c.id === card.dataset.id; });
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
    setRating(currentCan, 0);
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

  els.addForm.addEventListener('submit', async function (e) {
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
    var payload = {
      number: number >= 1 ? number : null,
      brand: els.fBrand.value.trim(),
      flavor: els.fFlavor.value.trim(),
      country: els.fCountry.value.trim(),
      volume: els.fVolume.value.trim() || null,
      date: els.fDate.value || null,
      notes: els.fNotes.value.trim() || null,
      color: els.colorInput.value || '#7C8B99',
      photo: pendingPhoto ? pendingPhoto.dataUrl : null
    };

    els.saveBtn.disabled = true;
    try {
      var created = await api('POST', '/api/cans', payload);
      cans.push(created);
      resetForm();
      closeAllPanels();
      populateFilters();
      renderGrid(false);
    } catch (err) {
      showFormError(err.message);
    } finally {
      els.saveBtn.disabled = false;
    }
  });

  els.deleteCan.addEventListener('click', function () {
    if (!currentCan) return;
    removeCan(currentCan);
  });

  els.authToggle.addEventListener('click', function () {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
  });

  els.authForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    els.authError.hidden = true;
    els.authSubmit.disabled = true;
    try {
      var me = await api('POST', authMode === 'login' ? '/api/login' : '/api/register', {
        username: els.aUser.value.trim(),
        password: els.aPass.value
      });
      enterApp(me.username);
      els.authForm.reset();
      await loadCans(true);
    } catch (err) {
      els.authError.textContent = err.message;
      els.authError.hidden = false;
    } finally {
      els.authSubmit.disabled = false;
    }
  });

  els.logoutBtn.addEventListener('click', async function () {
    try {
      await api('POST', '/api/logout');
    } catch (e) {}
    setAuthMode('login');
    showAuth();
  });

  els.themeBtn.addEventListener('click', function () {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });

  async function init() {
    try {
      var me = await api('GET', '/api/me');
      enterApp(me.username);
      await loadCans(true);
    } catch (e) {
      if (e.status === 401) {
        showAuth();
      } else {
        showAuth('Не удалось связаться с сервером. Попробуй обновить страницу позже.');
      }
    }
  }

  applyTheme(currentTheme());

  init();
})();
