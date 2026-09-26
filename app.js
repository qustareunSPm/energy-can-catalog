(function () {
  'use strict';

  var CANS = window.CAN_COLLECTION || [];
  var STORAGE_KEY = 'can-catalog:ratings:v1';

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
    panelNotes: document.getElementById('panelNotes')
  };

  var state = {
    search: '',
    brand: '',
    country: '',
    flavor: '',
    sort: 'number-asc',
    ratings: loadRatings()
  };

  var currentCan = null;
  var lastFocused = null;

  var STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>';

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

  function byId(id) {
    return CANS.find(function (c) { return c.id === id; });
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

  function populateFilters() {
    fillSelect(els.brand, uniqueSorted(CANS.map(function (c) { return c.brand; })), 'Все бренды');
    fillSelect(els.country, uniqueSorted(CANS.map(function (c) { return c.country; })), 'Все страны');
    fillSelect(els.flavor, uniqueSorted(CANS.map(function (c) { return c.flavor; })), 'Все вкусы');
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
    var list = CANS.filter(function (c) {
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
      '<div class="card-media">' + mediaHtml(can) + '</div>' +
      '<div class="card-body">' +
      '<div class="card-row"><span class="card-number">' + pad(can.number) + '</span>' + miniStars(state.ratings[can.id]) + '</div>' +
      '<h3 class="card-brand">' + esc(can.brand) + '</h3>' +
      '<p class="card-flavor">' + esc(can.flavor) + '</p>' +
      '<p class="card-country">' + esc(can.country) + '</p>' +
      '</div></article>';
  }

  function updateSub(shown) {
    var total = CANS.length;
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

  function openPanel(can) {
    currentCan = can;
    lastFocused = document.activeElement;

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

  function closePanel() {
    currentCan = null;
    els.overlay.classList.remove('show');
    els.panel.classList.remove('open');
    document.body.classList.remove('no-scroll');
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
    lastFocused = null;
  }

  function setRating(can, value) {
    if (state.ratings[can.id] === value) return;
    state.ratings[can.id] = value;
    saveRatings();
    paintStars(els.stars, value, 'on');
    els.clearRating.hidden = false;
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
    var card = e.target.closest('.card');
    if (!card) return;
    var can = byId(card.dataset.id);
    if (can) openPanel(can);
  });

  els.grid.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var card = e.target.closest('.card');
    if (!card) return;
    e.preventDefault();
    var can = byId(card.dataset.id);
    if (can) openPanel(can);
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

  els.panelClose.addEventListener('click', closePanel);
  els.overlay.addEventListener('click', closePanel);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && els.panel.classList.contains('open')) closePanel();
  });

  els.panel.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var focusables = els.panel.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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

  populateFilters();
  renderGrid(true);
})();
