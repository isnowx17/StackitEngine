/* Stackit — blok modellerini DOM'a çizer */
(function () {
  var BV = (window.BV = window.BlockView = {});
  var B = SE.blocks;
  var FONT = '700 12px Nunito, "Segoe UI", system-ui, sans-serif';

  /* renk yardımcıları */
  function hexToRgb(h) {
    h = h.replace('#', '');
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }
  function shade(hex, f) {
    var c = hexToRgb(hex).map(function (v) {
      v = f < 0 ? v * (1 + f) : v + (255 - v) * f;
      return Math.round(Math.max(0, Math.min(255, v)));
    });
    return 'rgb(' + c.join(',') + ')';
  }
  var catColors = {};
  B.cats.forEach(function (c) {
    catColors[c.id] = { c: c.color, d: shade(c.color, -0.22), l: shade(c.color, 0.25) };
  });
  BV.catColors = catColors;

  var parseCache = {};
  function parseText(t) {
    if (parseCache[t]) return parseCache[t];
    var parts = [], re = /\{([A-Z0-9_]+)\}/g, last = 0, m;
    while ((m = re.exec(t))) {
      if (m.index > last) parts.push({ label: t.slice(last, m.index) });
      parts.push({ arg: m[1] });
      last = re.lastIndex;
    }
    if (last < t.length) parts.push({ label: t.slice(last) });
    parseCache[t] = parts;
    return parts;
  }

  function label(text) {
    var s = document.createElement('span');
    s.className = 'lbl';
    s.textContent = text.trim();
    return s;
  }

  function menuLabel(ad, value, env) {
    var opts = B.menuOptions(ad.menu, env);
    for (var i = 0; i < opts.length; i++) if (opts[i][1] === value) return opts[i][0];
    if (value === '' || value == null) return '—';
    if (ad.menu === 'vars' || ad.menu === 'lists' || ad.menu === 'sprites' || ad.menu === 'touch' || ad.menu === 'goto' || ad.menu === 'towards' || ad.menu === 'clone' || ad.menu === 'follow' || ad.menu === 'collide') {
      return '?';
    }
    return String(value);
  }
  BV.menuLabel = menuLabel;

  function varName(id, env, isList) {
    var key = isList ? 'lists' : 'variables';
    var all = (env.project.stage[key] || []).slice();
    env.project.sprites.forEach(function (s) { all = all.concat(s[key] || []); });
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i].name;
    return '?';
  }
  BV.varName = varName;

  function autosize(inp) {
    var w = UI.textWidth(inp.value || ' ', FONT);
    inp.style.width = Math.ceil(Math.max(w, 10) + 14) + 'px';
  }
  BV.autosize = autosize;

  function slotFor(b, key, ad, env) {
    var inp = b.inputs[key];
    if (!inp) inp = b.inputs[key] = { value: ad.v == null ? '' : B.resolveDefault(ad.v, env) };
    var slot = document.createElement('span');
    slot.className = 'slot slot-' + ad.t;
    var accept = null;
    if (ad.t === 'num' || ad.t === 'text') accept = 'any';
    else if (ad.t === 'bool') accept = 'bool';
    else if (ad.t === 'menu' && ad.drop) accept = 'any';
    slot._slot = { owner: b, key: key, accept: accept };

    if (inp.block) {
      slot.classList.add('filled');
      slot.appendChild(BV.render(inp.block, env));
      return slot;
    }
    var ro = !!env.palette;
    switch (ad.t) {
      case 'num':
      case 'text': {
        var e = document.createElement('input');
        e.className = 'in in-' + ad.t;
        e.value = inp.value == null ? '' : inp.value;
        e.spellcheck = false;
        e.autocomplete = 'off';
        if (ad.t === 'num') e.inputMode = 'decimal';
        if (ro) { e.readOnly = true; e.tabIndex = -1; }
        autosize(e);
        e.addEventListener('input', function () {
          if (ad.t === 'num') {
            var clean = e.value.replace(/[^0-9.,\-eE+]/g, '');
            if (clean !== e.value) e.value = clean;
          }
          inp.value = e.value;
          autosize(e);
          if (env.onChange) env.onChange('input');
        });
        e.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') e.blur();
          ev.stopPropagation();
        });
        slot.appendChild(e);
        break;
      }
      case 'bool':
        slot.appendChild(Object.assign(document.createElement('span'), { className: 'in in-bool' }));
        break;
      case 'color': {
        var c = document.createElement('input');
        c.type = 'color';
        c.className = 'in in-color';
        c.value = /^#[0-9a-f]{6}$/i.test(inp.value) ? inp.value : '#ff0000';
        if (ro) { c.disabled = true; c.tabIndex = -1; }
        c.addEventListener('input', function () {
          inp.value = c.value;
          if (env.onChange) env.onChange('input');
        });
        slot.appendChild(c);
        break;
      }
      case 'varname': {
        var isList = b.op === 'list';
        slot.appendChild(label(varName(inp.value, env, isList)));
        break;
      }
      case 'menu': {
        var m = document.createElement('span');
        m.className = 'in in-menu';
        m.textContent = menuLabel(ad, inp.value, env);
        if (!ro) {
          m.addEventListener('click', function (ev) {
            ev.stopPropagation();
            var opts = B.menuOptions(ad.menu, env);
            var r = m.getBoundingClientRect();
            var items = opts.map(function (o) { return { label: o[0], value: o[1], check: o[1] === inp.value }; });
            if (!items.length) items = [{ label: SE.t('(seçenek yok)'), value: '__none__' }];
            UI.menu(r.left, r.bottom + 4, items, function (v) {
              if (v === '__none__') return;
              if (v === '__new__') {
                UI.prompt(SE.t('Yeni mesaj'), SE.t('Mesaj adı'), SE.t('mesaj') + ((env.project.messages || []).length + 1)).then(function (name) {
                  if (!name) return;
                  env.project.messages = env.project.messages || [];
                  if (env.project.messages.indexOf(name) < 0) env.project.messages.push(name);
                  inp.value = name;
                  m.textContent = name;
                  if (env.onChange) env.onChange('input');
                });
                return;
              }
              inp.value = v;
              m.textContent = menuLabel(ad, v, env);
              if (env.onChange) env.onChange('input');
            }, { cls: 'blockmenu', color: catColors[B.defs[b.op].cat].c });
          });
        }
        slot.appendChild(m);
        break;
      }
    }
    return slot;
  }

  function fill(container, text, b, def, env) {
    parseText(SE.t(text)).forEach(function (p) {
      if (p.label != null) {
        if (p.label.trim()) container.appendChild(label(p.label));
      } else {
        var ad = def.args[p.arg];
        if (ad) container.appendChild(slotFor(b, p.arg, ad, env));
      }
    });
  }

  function mouth(b, key, env) {
    var m = document.createElement('div');
    m.className = 'mouth';
    m.dataset.key = key;
    var sub = b.substacks && b.substacks[key];
    if (sub) BV.renderChain(sub, env, m);
    return m;
  }

  BV.render = function (b, env) {
    var def = B.defs[b.op];
    var el = document.createElement('div');
    el._blk = b;
    if (!def) {
      el.className = 'blk shape-stack unknown';
      el.appendChild(label('? ' + b.op));
      return el;
    }
    var col = catColors[def.cat];
    el.className = 'blk shape-' + def.shape + ' cat-' + def.cat;
    el.style.setProperty('--c', col.c);
    el.style.setProperty('--cd', col.d);
    el.style.setProperty('--cl', col.l);

    if (b.op === 'proc_def') {
      el.appendChild(label(SE.t('tanımla')));
      var nm = label(b.proc || '?');
      nm.classList.add('proc-name');
      el.appendChild(nm);
      (b.params || []).forEach(function (p) {
        var t = BV.render({ op: 'proc_arg', arg: p, inputs: {}, next: null }, env);
        t.classList.add('template');
        el.appendChild(t);
      });
      if (b.warp) el.appendChild(label('⚡'));
      return el;
    }
    if (b.op === 'proc_call') {
      el.appendChild(label(b.proc || '?'));
      (b.params || []).forEach(function (p, i) {
        el.appendChild(label(p + ':'));
        el.appendChild(slotFor(b, 'P' + i, { t: 'text', v: '' }, env));
      });
      return el;
    }
    if (b.op === 'proc_arg') {
      el.appendChild(label(b.arg || '?'));
      return el;
    }

    if (def.shape === 'c' || def.shape === 'c2' || def.shape === 'ccap') {
      var head = document.createElement('div');
      head.className = 'c-head';
      fill(head, def.text, b, def, env);
      el.appendChild(head);
      el.appendChild(mouth(b, 'SUBSTACK', env));
      if (def.shape === 'c2') {
        var mid = document.createElement('div');
        mid.className = 'c-mid';
        fill(mid, def.text2, b, def, env);
        el.appendChild(mid);
        el.appendChild(mouth(b, 'SUBSTACK2', env));
      }
      var foot = document.createElement('div');
      foot.className = 'c-foot';
      el.appendChild(foot);
      return el;
    }
    fill(el, def.text, b, def, env);
    return el;
  };

  BV.renderChain = function (b, env, container) {
    while (b) {
      container.appendChild(BV.render(b, env));
      if (B.isReporter(b)) break;
      b = b.next;
    }
  };
})();
