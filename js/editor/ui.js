/* Stackit — küçük arayüz yardımcıları: açılır menü, modal, bildirim, baloncuk */
(function () {
  var UI = (window.UI = {});

  UI.el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  /* ---------- açılır menü ---------- */
  var openMenu = null;
  UI.closeMenu = function () {
    if (openMenu) {
      openMenu.remove();
      openMenu = null;
    }
  };
  /* items: [{label, value?, danger?, sep?, check?, color?}] */
  UI.menu = function (x, y, items, onPick, opts) {
    UI.closeMenu();
    opts = opts || {};
    var m = UI.el('div', 'popmenu' + (opts.cls ? ' ' + opts.cls : ''));
    if (opts.color) m.style.setProperty('--mc', opts.color);
    items.forEach(function (it) {
      if (it.sep) {
        m.appendChild(UI.el('div', 'pm-sep'));
        return;
      }
      var b = UI.el('button', 'pm-item' + (it.danger ? ' danger' : '') + (it.check ? ' checked' : ''));
      b.type = 'button';
      b.textContent = it.label;
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        UI.closeMenu();
        onPick(it.value !== undefined ? it.value : it.label, it);
      });
      m.appendChild(b);
    });
    document.body.appendChild(m);
    var r = m.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;
    if (x + r.width > vw - 6) x = vw - r.width - 6;
    if (y + r.height > vh - 6) y = Math.max(6, vh - r.height - 6);
    m.style.left = Math.max(6, x) + 'px';
    m.style.top = Math.max(6, y) + 'px';
    var chk = m.querySelector('.checked');
    if (chk) chk.scrollIntoView({ block: 'nearest' });
    openMenu = m;
    return m;
  };
  document.addEventListener('pointerdown', function (e) {
    if (openMenu && !openMenu.contains(e.target)) UI.closeMenu();
  }, true);
  window.addEventListener('blur', UI.closeMenu);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') UI.closeMenu();
  });

  /* ---------- bildirim ---------- */
  UI.toast = function (msg, kind) {
    var host = document.getElementById('toasts');
    if (!host) return;
    var t = UI.el('div', 'toast' + (kind ? ' ' + kind : ''), msg);
    host.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 2600);
    setTimeout(function () { t.remove(); }, 3000);
  };

  /* ---------- değer baloncuğu ---------- */
  var bubble = null;
  UI.bubble = function (target, text) {
    if (bubble) bubble.remove();
    var r = target.getBoundingClientRect();
    bubble = UI.el('div', 'value-bubble', text === '' ? SE.t('(boş)') : text);
    document.body.appendChild(bubble);
    var br = bubble.getBoundingClientRect();
    bubble.style.left = Math.max(6, Math.min(window.innerWidth - br.width - 6, r.left + r.width / 2 - br.width / 2)) + 'px';
    bubble.style.top = Math.max(6, r.top - br.height - 8) + 'px';
    var b = bubble;
    setTimeout(function () {
      b.classList.add('out');
      setTimeout(function () { b.remove(); if (bubble === b) bubble = null; }, 250);
    }, 2200);
  };

  /* ---------- modal ----------
   * fields: [{key, label, type: 'text'|'number'|'radio'|'check'|'select', value, options:[[label,value]]}] */
  UI.form = function (title, fields, okLabel) {
    return new Promise(function (resolve) {
      var back = UI.el('div', 'modal-back');
      var box = UI.el('form', 'modal');
      box.appendChild(UI.el('h3', null, title));
      var getters = {};
      fields.forEach(function (f, i) {
        var row = UI.el('label', 'mrow mrow-' + (f.type || 'text'));
        if (f.type === 'radio') {
          row = UI.el('div', 'mrow mrow-radio');
          if (f.label) row.appendChild(UI.el('span', 'mlabel', f.label));
          var wrap = UI.el('div', 'mradios');
          f.options.forEach(function (o, j) {
            var l = UI.el('label', 'mradio');
            var r = document.createElement('input');
            r.type = 'radio';
            r.name = 'f' + i;
            r.value = o[1];
            if (o[1] === f.value || (f.value == null && j === 0)) r.checked = true;
            l.appendChild(r);
            l.appendChild(document.createTextNode(' ' + o[0]));
            wrap.appendChild(l);
          });
          row.appendChild(wrap);
          getters[f.key] = function () {
            var c = box.querySelector('input[name="f' + i + '"]:checked');
            return c ? c.value : null;
          };
        } else if (f.type === 'check') {
          var cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = !!f.value;
          row.appendChild(cb);
          row.appendChild(UI.el('span', null, ' ' + f.label));
          getters[f.key] = function () { return cb.checked; };
        } else if (f.type === 'select') {
          row.appendChild(UI.el('span', 'mlabel', f.label));
          var sel = document.createElement('select');
          f.options.forEach(function (o) {
            var op = document.createElement('option');
            op.value = o[1];
            op.textContent = o[0];
            sel.appendChild(op);
          });
          if (f.value != null) sel.value = f.value;
          row.appendChild(sel);
          getters[f.key] = function () { return sel.value; };
        } else {
          row.appendChild(UI.el('span', 'mlabel', f.label));
          var inp = document.createElement('input');
          inp.type = f.type === 'number' ? 'number' : 'text';
          inp.value = f.value == null ? '' : f.value;
          if (f.placeholder) inp.placeholder = f.placeholder;
          inp.spellcheck = false;
          row.appendChild(inp);
          getters[f.key] = function () { return inp.value; };
        }
        box.appendChild(row);
      });
      var btns = UI.el('div', 'mbtns');
      var cancel = UI.el('button', 'btn ghost', SE.t('Vazgeç'));
      cancel.type = 'button';
      var ok = UI.el('button', 'btn primary', okLabel || SE.t('Tamam'));
      ok.type = 'submit';
      btns.appendChild(cancel);
      btns.appendChild(ok);
      box.appendChild(btns);
      back.appendChild(box);
      document.body.appendChild(back);
      var first = box.querySelector('input[type=text],input[type=number],select');
      if (first) setTimeout(function () { first.focus(); if (first.select) first.select(); }, 20);
      function close(v) {
        back.remove();
        resolve(v);
      }
      cancel.addEventListener('click', function () { close(null); });
      back.addEventListener('pointerdown', function (e) { if (e.target === back) close(null); });
      box.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(null); });
      box.addEventListener('submit', function (e) {
        e.preventDefault();
        var out = {};
        Object.keys(getters).forEach(function (k) { out[k] = getters[k](); });
        close(out);
      });
    });
  };

  UI.prompt = function (title, label, value) {
    return UI.form(title, [{ key: 'v', label: label, value: value }]).then(function (r) {
      return r ? String(r.v).trim() : null;
    });
  };

  UI.confirm = function (title, okLabel) {
    return UI.form(title, [], okLabel || SE.t('Evet')).then(function (r) { return !!r; });
  };

  /* metin genişliği ölçümü (girdi kutularını otomatik boyutlandırmak için) */
  var mctx = null;
  UI.textWidth = function (text, font) {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    mctx.font = font;
    return mctx.measureText(text).width;
  };

  UI.download = function (filename, content, type) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: type || 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  };

  UI.pickFile = function (accept) {
    return new Promise(function (resolve) {
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = accept || '';
      inp.addEventListener('change', function () { resolve(inp.files && inp.files[0] ? inp.files[0] : null); });
      inp.click();
    });
  };
})();
