/* Stackit — karo haritası ve seviye editörü */
(function () {
  var U = SE.util;
  var TOOLS = [
    ['paint', 'M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3', 'Boya (B)'],
    ['erase', 'M3 15l8-8 7 7-5 5H7zM11 20h10M7 11l7 7', 'Sil (E) — sağ tık da siler'],
    ['rect', 'M4 6h16v12H4zM4 6l16 12', 'Dikdörtgen doldur (R)'],
    ['fill', 'M4 12l7-7 7 7-7 7zM4 12h14M20 15.5c.8 1.2 1.3 2 1.3 2.7a1.3 1.3 0 0 1-2.6 0c0-.7.5-1.5 1.3-2.7', 'Boşluğu doldur (G)'],
    ['picker', 'M14 4l6 6M17.5 6.5L8 16l-4 1 1-4 9.5-9.5', 'Karo seç (I)'],
    ['pan', 'M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5V4a1.5 1.5 0 0 1 3 0v8M14 11.5V5.5a1.5 1.5 0 0 1 3 0V13M17 9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L4.5 15a1.6 1.6 0 0 1 2.4-2.1L8 14', 'Kaydır (H) — orta tık / boşluk tuşu da kaydırır']
  ];
  var KINDS = [['katı', 'solid'], ['tek yönlü (üstüne basılır)', 'oneway'], ['geçilebilir (dekor / toplanır)', 'none']];
  function icon(path) {
    return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
  }

  function MapEditor(app, root) {
    this.app = app;
    this.root = root;
    this.tool = 'paint';
    this.sel = null;
    this.view = { x: 140, y: -40, zoom: 0.8 };
    this.grid = true;
    this.undoStack = [];
    this.build();
  }
  var P = MapEditor.prototype;

  P.tileset = function () { return this.app.project.tileset; };
  P.level = function () { return this.app.project.levels[this.app.editLevel] || this.app.project.levels[0]; };
  P.tileById = function (id) {
    var l = this.tileset().costumes;
    for (var i = 0; i < l.length; i++) if (String(l[i].id) === String(id)) return l[i];
    return null;
  };

  P.build = function () {
    var self = this, r = this.root;
    r.innerHTML = '';
    var side = UI.el('div', 'map-side');
    side.appendChild(UI.el('div', 'map-side-head', 'Karolar'));
    this.tileGrid = UI.el('div', 'tile-grid');
    side.appendChild(this.tileGrid);
    var btns = UI.el('div', 'cos-add');
    [['+ Yeni', 'new'], ['Hazır', 'lib'], ['Yükle', 'upload']].forEach(function (b) {
      var x = UI.el('button', 'btn small', b[0]);
      x.type = 'button';
      x.addEventListener('click', function (e) { self.addTile(b[1], e); });
      btns.appendChild(x);
    });
    side.appendChild(btns);
    this.props = UI.el('div', 'tile-props');
    side.appendChild(this.props);
    r.appendChild(side);

    var main = UI.el('div', 'map-main');
    this.levelBar = UI.el('div', 'map-levels');
    main.appendChild(this.levelBar);
    var tb = UI.el('div', 'map-toolbar');
    this.toolBtns = {};
    TOOLS.forEach(function (t) {
      var b = UI.el('button', 'tool');
      b.type = 'button';
      b.innerHTML = icon(t[1]);
      b.title = t[2];
      b.addEventListener('click', function () { self.setTool(t[0]); });
      tb.appendChild(b);
      self.toolBtns[t[0]] = b;
    });
    tb.appendChild(UI.el('span', 'tsep'));
    var undo = UI.el('button', 'tool');
    undo.type = 'button';
    undo.title = 'Geri al (Ctrl+Z)';
    undo.innerHTML = icon('M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3');
    undo.addEventListener('click', function () { self.undo(); });
    tb.appendChild(undo);
    this.gridBtn = UI.el('button', 'tool on');
    this.gridBtn.type = 'button';
    this.gridBtn.title = 'Izgara';
    this.gridBtn.innerHTML = icon('M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16');
    this.gridBtn.addEventListener('click', function () {
      self.grid = !self.grid;
      self.gridBtn.classList.toggle('on', self.grid);
      self.draw();
    });
    tb.appendChild(this.gridBtn);
    var center = UI.el('button', 'tool');
    center.type = 'button';
    center.title = 'Başlangıç kamerasına git';
    center.innerHTML = icon('M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8');
    center.addEventListener('click', function () { self.resetView(); });
    tb.appendChild(center);
    tb.appendChild(UI.el('span', 'tsep'));
    tb.appendChild(UI.el('span', 'flabel', 'Karo'));
    this.sizeSel = document.createElement('select');
    this.sizeSel.className = 'field';
    this.sizeSel.title = 'Bir karonun dünyadaki boyutu (piksel)';
    [16, 24, 32, 40, 48, 64].forEach(function (n) {
      var o = document.createElement('option');
      o.value = n;
      o.textContent = n + ' px';
      self.sizeSel.appendChild(o);
    });
    this.sizeSel.addEventListener('change', function () {
      self.tileset().tileSize = +self.sizeSel.value;
      self.app.mapChanged(true);
      self.draw();
    });
    tb.appendChild(this.sizeSel);
    tb.appendChild(UI.el('span', 'tsep'));
    tb.appendChild(UI.el('span', 'flabel', 'Arka plan'));
    this.bgInp = document.createElement('input');
    this.bgInp.type = 'color';
    this.bgInp.className = 'field color';
    this.bgInp.title = 'Bu seviyenin arka plan rengi';
    this.bgInp.addEventListener('input', function () {
      self.level().bgColor = self.bgInp.value;
      self.app.mapChanged(true);
      self.draw();
    });
    tb.appendChild(this.bgInp);
    this.bdSel = document.createElement('select');
    this.bdSel.className = 'field';
    this.bdSel.title = 'Bu seviyenin dekoru';
    this.bdSel.addEventListener('change', function () {
      self.level().backdrop = self.bdSel.value;
      self.app.mapChanged(true);
    });
    tb.appendChild(this.bdSel);
    this.coord = UI.el('span', 'map-coord');
    tb.appendChild(this.coord);
    main.appendChild(tb);

    this.wrap = UI.el('div', 'map-canvas-wrap');
    this.cv = document.createElement('canvas');
    this.cv.className = 'map-canvas';
    this.wrap.appendChild(this.cv);
    main.appendChild(this.wrap);
    main.appendChild(UI.el('div', 'map-hint', 'Sol tık: boya · Sağ tık: sil · Tekerlek: yakınlaştır · Orta tık ya da boşluk + sürükle: kaydır · Kesikli çerçeve: oyunun başladığı kamera'));
    r.appendChild(main);

    this.bindCanvas();
    new ResizeObserver(function () { if (!self.root.hidden) self.draw(); }).observe(this.wrap);
    this.syncTools();
  };

  P.reset = function () {
    this.undoStack = [];
    this.sel = null;
    this.resetView();
  };
  P.resetView = function () {
    var r = this.wrap.getBoundingClientRect(), st = this.app.project.stage;
    var z = r.width ? Math.min(r.width / (st.width * 1.25), r.height / (st.height * 1.25)) : 0.8;
    this.view = { x: 0, y: 0, zoom: U.clamp(Math.round(z * 100) / 100, 0.2, 3) };
    this.draw();
  };
  P.show = function () {
    if (this.sel == null || !this.tileById(this.sel)) {
      var t = this.tileset().costumes[0];
      this.sel = t ? t.id : null;
    }
    this.render();
    var self = this;
    requestAnimationFrame(function () {
      if (!self._shown) {
        self._shown = true;
        self.resetView();
      } else self.draw();
    });
  };
  P.render = function () {
    this.renderTiles();
    this.renderLevels();
    this.sizeSel.value = this.tileset().tileSize;
    var lv = this.level(), st = this.app.project.stage;
    this.bgInp.value = /^#[0-9a-f]{6}$/i.test(lv.bgColor || '') ? lv.bgColor : (/^#[0-9a-f]{6}$/i.test(st.bgColor) ? st.bgColor : '#ffffff');
    this.bdSel.innerHTML = '';
    var o0 = document.createElement('option');
    o0.value = '';
    o0.textContent = 'Dekor: sahnedeki';
    this.bdSel.appendChild(o0);
    (st.costumes || []).forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.name;
      o.textContent = 'Dekor: ' + c.name;
      this.bdSel.appendChild(o);
    }, this);
    this.bdSel.value = lv.backdrop || '';
    this.draw();
  };

  P.renderTiles = function () {
    var self = this, ts = this.tileset();
    this.tileGrid.innerHTML = '';
    ts.costumes.forEach(function (t, i) {
      var b = UI.el('button', 'tile-btn' + (String(t.id) === String(self.sel) ? ' on' : ''));
      b.type = 'button';
      var kd = KINDS.filter(function (k) { return k[1] === (t.solid || 'solid'); })[0] || KINDS[0];
      b.title = t.name + ' (' + kd[0] + ') — çift tıkla: çiz';
      var img = document.createElement('img');
      img.src = t.src;
      img.alt = t.name;
      b.appendChild(img);
      if ((t.solid || 'solid') !== 'solid') b.appendChild(UI.el('span', 'tile-kind', t.solid === 'oneway' ? '↥' : '○'));
      b.addEventListener('click', function () {
        self.sel = t.id;
        if (self.tool === 'erase' || self.tool === 'picker' || self.tool === 'pan') self.setTool('paint');
        self.renderTiles();
      });
      b.addEventListener('dblclick', function () { self.app.editTiles(i); });
      self.tileGrid.appendChild(b);
    });
    this.renderProps();
  };

  P.renderProps = function () {
    var self = this, t = this.tileById(this.sel), p = this.props;
    p.innerHTML = '';
    if (!t) {
      p.appendChild(UI.el('div', 'pal-note', 'Karo yok. "+ Yeni" ya da "Hazır" ile ekle.'));
      return;
    }
    var name = document.createElement('input');
    name.className = 'field';
    name.value = t.name;
    name.spellcheck = false;
    name.addEventListener('change', function () {
      var v = name.value.trim();
      if (!v) { name.value = t.name; return; }
      t.name = v;
      self.renderTiles();
      self.app.changed('vars');
    });
    var lab = UI.el('label', 'insp-f');
    lab.appendChild(UI.el('span', 'flabel', 'Ad'));
    lab.appendChild(name);
    p.appendChild(lab);
    var kind = document.createElement('select');
    kind.className = 'field';
    KINDS.forEach(function (k) {
      var o = document.createElement('option');
      o.value = k[1];
      o.textContent = k[0];
      kind.appendChild(o);
    });
    kind.value = t.solid || 'solid';
    kind.addEventListener('change', function () {
      t.solid = kind.value;
      self.renderTiles();
      self.app.mapChanged(true);
    });
    var lab2 = UI.el('label', 'insp-f');
    lab2.appendChild(UI.el('span', 'flabel', 'Tür'));
    lab2.appendChild(kind);
    p.appendChild(lab2);
    var row = UI.el('div', 'cos-add');
    var ed = UI.el('button', 'btn small', 'Çiz / düzenle');
    ed.type = 'button';
    ed.addEventListener('click', function () { self.app.editTiles(self.tileset().costumes.indexOf(t)); });
    var del = UI.el('button', 'btn small', 'Sil');
    del.type = 'button';
    del.addEventListener('click', function () { self.app.deleteTile(t.id); });
    row.appendChild(ed);
    row.appendChild(del);
    p.appendChild(row);
  };

  P.renderLevels = function () {
    var self = this, app = this.app, lvs = app.project.levels;
    this.levelBar.innerHTML = '';
    this.levelBar.appendChild(UI.el('span', 'flabel', 'Seviyeler'));
    lvs.forEach(function (lv, i) {
      var b = UI.el('button', 'lvl-chip' + (i === app.editLevel ? ' on' : ''));
      b.type = 'button';
      b.appendChild(UI.el('span', 'lvl-num', String(i + 1)));
      b.appendChild(document.createTextNode(lv.name));
      b.addEventListener('click', function () { app.setEditLevel(i); });
      b.addEventListener('dblclick', function () { app.renameLevel(i); });
      b.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        var items = [{ label: 'Yeniden adlandır', value: 'ren' }, { label: 'Çoğalt', value: 'dup' }];
        if (i > 0) items.push({ label: 'Sola taşı', value: 'left' });
        if (lvs.length > 1) items.push({ label: 'Sil', value: 'del', danger: true });
        UI.menu(e.clientX, e.clientY, items, function (v) {
          if (v === 'ren') app.renameLevel(i);
          else if (v === 'dup') app.addLevel(i);
          else if (v === 'left') app.moveLevel(i, i - 1);
          else if (v === 'del') app.deleteLevel(i);
        });
      });
      self.levelBar.appendChild(b);
    });
    var add = UI.el('button', 'lvl-chip add', '+ Seviye');
    add.type = 'button';
    add.addEventListener('click', function () { app.addLevel(); });
    this.levelBar.appendChild(add);
  };

  P.setTool = function (t) {
    this.tool = t;
    this.syncTools();
  };
  P.syncTools = function () {
    var self = this;
    Object.keys(this.toolBtns).forEach(function (k) { self.toolBtns[k].classList.toggle('on', self.tool === k); });
    this.cv.style.cursor = this.tool === 'pan' ? 'grab' : 'crosshair';
  };

  /* ---------- karo ekleme / silme ---------- */
  P.addTile = function (kind, ev) {
    var self = this, ts = this.tileset();
    var push = function (c) {
      c.id = ts.nextId++;
      c.solid = c.solid || 'solid';
      c.smooth = false;
      var names = ts.costumes.map(function (x) { return x.name; }), base = c.name, n = 2;
      while (names.indexOf(c.name) >= 0) c.name = base + n++;
      ts.costumes.push(c);
      self.sel = c.id;
      self.app.mapChanged(true);
      self.app.changed('vars');
      self.renderTiles();
      return c;
    };
    if (kind === 'new') {
      push(StackitLib.blank(16, 16, 'karo'));
      this.app.editTiles(ts.costumes.length - 1);
    } else if (kind === 'lib') {
      var r = ev.target.getBoundingClientRect();
      UI.menu(r.left, r.bottom + 4, StackitLib.tileItems.map(function (t) { return { label: t.name, value: t.id }; }), function (id) {
        push(StackitLib.makeTile(id));
      });
    } else if (kind === 'upload') {
      UI.pickFile('image/*').then(function (file) {
        if (!file) return;
        var rd = new FileReader();
        rd.onload = function () {
          var img = new Image();
          img.onload = function () {
            var n = Math.min(64, Math.max(8, Math.min(img.naturalWidth, img.naturalHeight)));
            var cv = document.createElement('canvas');
            cv.width = n;
            cv.height = n;
            var g = cv.getContext('2d');
            var s = Math.min(img.naturalWidth, img.naturalHeight);
            g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, n, n);
            push({ name: file.name.replace(/\.[^.]+$/, '').slice(0, 20) || 'karo', src: cv.toDataURL('image/png'), w: n, h: n, scale: 1 });
          };
          img.src = rd.result;
        };
        rd.readAsDataURL(file);
      });
    }
  };

  /* ---------- çizim ---------- */
  P.size = function () {
    var r = this.wrap.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  };
  P.toWorld = function (e) {
    var r = this.cv.getBoundingClientRect(), v = this.view;
    var sx = e.clientX - r.left, sy = e.clientY - r.top;
    return { x: v.x + (sx - r.width / 2) / v.zoom, y: v.y - (sy - r.height / 2) / v.zoom };
  };
  P.cellOf = function (w) {
    var ts = this.tileset().tileSize;
    return { x: Math.floor(w.x / ts), y: Math.floor(w.y / ts) };
  };

  P.draw = function () {
    if (this.root.hidden) return;
    var cv = this.cv, sz = this.size(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = sz.w, H = sz.h;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px';
      cv.style.height = H + 'px';
    }
    var g = cv.getContext('2d'), app = this.app, p = app.project, lv = this.level(), v = this.view;
    var ts = this.tileset().tileSize;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = lv.bgColor || p.stage.bgColor || '#ffffff';
    g.fillRect(0, 0, W, H);
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(v.zoom, v.zoom);
    g.translate(-v.x, v.y);
    var hw = W / 2 / v.zoom, hh = H / 2 / v.zoom;
    var cx0 = Math.floor((v.x - hw) / ts), cx1 = Math.floor((v.x + hw) / ts);
    var cy0 = Math.floor((v.y - hh) / ts), cy1 = Math.floor((v.y + hh) / ts);
    var defs = {};
    this.tileset().costumes.forEach(function (t) { defs[t.id] = t; });
    g.imageSmoothingEnabled = false;
    var cells = lv.cells || {}, ov = 0.6 / v.zoom;
    var drawCell = function (cx, cy, id) {
      var t = defs[id];
      if (!t) return;
      var e = SE.getImage(t.src);
      if (e && e.ready) g.drawImage(e.img, cx * ts, -(cy + 1) * ts, ts + ov, ts + ov);
    };
    if ((cx1 - cx0 + 1) * (cy1 - cy0 + 1) > 8000) {
      Object.keys(cells).forEach(function (k) {
        var c = k.split(',');
        drawCell(+c[0], +c[1], cells[k]);
      });
    } else {
      for (var cy = cy0; cy <= cy1; cy++) for (var cx = cx0; cx <= cx1; cx++) {
        var id = cells[cx + ',' + cy];
        if (id != null) drawCell(cx, cy, id);
      }
    }
    // karakterler (bu seviyedeki başlangıç konumlarıyla, yarı saydam)
    var eng = app.engine;
    if (!eng.running) {
      g.globalAlpha = 0.6;
      eng.actors.forEach(function (a) { if (a.visible) eng.drawActor(g, a); });
      g.globalAlpha = 1;
    }
    // ızgara
    if (this.grid && ts * v.zoom >= 6) {
      g.strokeStyle = 'rgba(0,0,0,.10)';
      g.lineWidth = 1 / v.zoom;
      g.beginPath();
      for (var gx = cx0; gx <= cx1 + 1; gx++) { g.moveTo(gx * ts, -(cy1 + 1) * ts); g.lineTo(gx * ts, -cy0 * ts); }
      for (var gy = cy0; gy <= cy1 + 1; gy++) { g.moveTo(cx0 * ts, -gy * ts); g.lineTo((cx1 + 1) * ts, -gy * ts); }
      g.stroke();
    }
    // eksenler + başlangıç kamerası
    g.strokeStyle = 'rgba(0,0,0,.22)';
    g.lineWidth = 1.5 / v.zoom;
    g.beginPath();
    g.moveTo((cx0 - 1) * ts, 0);
    g.lineTo((cx1 + 2) * ts, 0);
    g.moveTo(0, -(cy1 + 2) * ts);
    g.lineTo(0, -(cy0 - 1) * ts);
    g.stroke();
    g.setLineDash([8 / v.zoom, 5 / v.zoom]);
    g.strokeStyle = 'rgba(124,92,255,.95)';
    g.lineWidth = 2 / v.zoom;
    g.strokeRect(-p.stage.width / 2, -p.stage.height / 2, p.stage.width, p.stage.height);
    g.setLineDash([]);
    // imleç / dikdörtgen önizleme
    var hv = this.hover;
    if (hv && this.tool !== 'pan') {
      var x0 = hv.x, x1 = hv.x, y0 = hv.y, y1 = hv.y;
      if (this.rect) {
        x0 = Math.min(this.rect.a.x, hv.x); x1 = Math.max(this.rect.a.x, hv.x);
        y0 = Math.min(this.rect.a.y, hv.y); y1 = Math.max(this.rect.a.y, hv.y);
      }
      var sel = defs[this.sel];
      if (sel && !this.rect && this.tool === 'paint') {
        var se = SE.getImage(sel.src);
        if (se && se.ready) {
          g.globalAlpha = 0.55;
          g.drawImage(se.img, hv.x * ts, -(hv.y + 1) * ts, ts, ts);
          g.globalAlpha = 1;
        }
      }
      g.fillStyle = this.rect && this.rect.erase || this.tool === 'erase' ? 'rgba(239,68,68,.25)' : 'rgba(124,92,255,.22)';
      g.fillRect(x0 * ts, -(y1 + 1) * ts, (x1 - x0 + 1) * ts, (y1 - y0 + 1) * ts);
      g.strokeStyle = 'rgba(124,92,255,1)';
      g.lineWidth = 2 / v.zoom;
      g.strokeRect(x0 * ts, -(y1 + 1) * ts, (x1 - x0 + 1) * ts, (y1 - y0 + 1) * ts);
    }
    g.restore();
  };

  /* ---------- düzenleme ---------- */
  P.snapshot = function () {
    var lv = this.level();
    this.undoStack.push({ level: lv, cells: JSON.stringify(lv.cells || {}) });
    if (this.undoStack.length > 50) this.undoStack.shift();
  };
  P.undo = function () {
    var s = this.undoStack.pop();
    if (!s) return;
    s.level.cells = JSON.parse(s.cells);
    this.app.mapChanged(true);
    this.draw();
  };
  P.setCell = function (cx, cy, id) {
    var cells = this.level().cells;
    var k = cx + ',' + cy;
    if (id == null) delete cells[k];
    else cells[k] = +id;
  };
  P.line = function (a, b, fn) {
    var x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (var n = 0; n < 2000; n++) {
      fn(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  P.flood = function (c, id) {
    var cells = this.level().cells, start = cells[c.x + ',' + c.y];
    if (start != null && String(start) === String(id)) return;
    var sz = this.size(), v = this.view, ts = this.tileset().tileSize;
    // sınırsız boşluğu doldurmamak için görünür alanla sınırla
    var hw = sz.w / 2 / v.zoom, hh = sz.h / 2 / v.zoom;
    var bx0 = Math.floor((v.x - hw) / ts), bx1 = Math.floor((v.x + hw) / ts), by0 = Math.floor((v.y - hh) / ts), by1 = Math.floor((v.y + hh) / ts);
    var stack = [[c.x, c.y]], seen = {}, n = 0;
    while (stack.length && n < 6000) {
      var p = stack.pop(), k = p[0] + ',' + p[1];
      if (seen[k] || p[0] < bx0 || p[0] > bx1 || p[1] < by0 || p[1] > by1) continue;
      seen[k] = 1;
      var cur = cells[k];
      if (start == null ? cur != null : String(cur) !== String(start)) continue;
      if (id == null) delete cells[k];
      else cells[k] = +id;
      n++;
      stack.push([p[0] + 1, p[1]], [p[0] - 1, p[1]], [p[0], p[1] + 1], [p[0], p[1] - 1]);
    }
  };

  P.bindCanvas = function () {
    var self = this, cv = this.cv;
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('pointerdown', function (e) {
      cv.setPointerCapture(e.pointerId);
      var w = self.toWorld(e), c = self.cellOf(w);
      self.hover = c;
      if (e.button === 1 || self.tool === 'pan' || self.spaceDown) {
        self.pan = { x: e.clientX, y: e.clientY, vx: self.view.x, vy: self.view.y };
        cv.style.cursor = 'grabbing';
        e.preventDefault();
        return;
      }
      var erase = e.button === 2 || self.tool === 'erase';
      if (self.tool === 'picker' && e.button === 0) {
        var id = self.level().cells[c.x + ',' + c.y];
        if (id != null) {
          self.sel = id;
          self.setTool('paint');
          self.renderTiles();
        }
        return;
      }
      if (!erase && !self.tileById(self.sel)) {
        UI.toast('Önce soldan bir karo seç', 'err');
        return;
      }
      self.snapshot();
      if (self.tool === 'rect') {
        self.rect = { a: c, erase: erase };
      } else if (self.tool === 'fill' && !erase) {
        self.flood(c, self.sel);
        self.app.mapChanged(false);
      } else {
        self.stroke = { last: c, erase: erase };
        self.setCell(c.x, c.y, erase ? null : self.sel);
      }
      self.draw();
    });
    cv.addEventListener('pointermove', function (e) {
      if (self.pan) {
        self.view.x = self.pan.vx - (e.clientX - self.pan.x) / self.view.zoom;
        self.view.y = self.pan.vy + (e.clientY - self.pan.y) / self.view.zoom;
        self.draw();
        return;
      }
      var w = self.toWorld(e), c = self.cellOf(w);
      self.coord.textContent = 'x: ' + Math.round(w.x) + '  y: ' + Math.round(w.y) + '  (karo ' + c.x + ', ' + c.y + ')';
      var moved = !self.hover || self.hover.x !== c.x || self.hover.y !== c.y;
      self.hover = c;
      if (self.stroke && moved) {
        var st = self.stroke;
        self.line(st.last, c, function (x, y) { self.setCell(x, y, st.erase ? null : self.sel); });
        st.last = c;
      }
      if (moved) self.draw();
    });
    var up = function () {
      if (self.pan) {
        self.pan = null;
        self.syncTools();
        return;
      }
      if (self.rect) {
        var a = self.rect.a, b = self.hover || a, er = self.rect.erase;
        for (var y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
          for (var x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) self.setCell(x, y, er ? null : self.sel);
        }
        self.rect = null;
        self.app.mapChanged(false);
        self.draw();
      }
      if (self.stroke) {
        self.stroke = null;
        self.app.mapChanged(false);
      }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', function () {
      if (!self.stroke && !self.rect) {
        self.hover = null;
        self.draw();
      }
    });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = cv.getBoundingClientRect(), v = self.view;
      var before = self.toWorld(e);
      v.zoom = U.clamp(v.zoom * Math.exp(-e.deltaY * 0.0015), 0.1, 4);
      var sx = e.clientX - r.left, sy = e.clientY - r.top;
      v.x = before.x - (sx - r.width / 2) / v.zoom;
      v.y = before.y + (sy - r.height / 2) / v.zoom;
      self.draw();
    }, { passive: false });
  };

  P.onKey = function (e) {
    var k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); this.undo(); return true; }
    if (e.key === ' ') {
      e.preventDefault();
      this.spaceDown = e.type === 'keydown';
      return true;
    }
    var map = { b: 'paint', e: 'erase', r: 'rect', g: 'fill', i: 'picker', h: 'pan' };
    if (!e.ctrlKey && !e.metaKey && map[k]) { this.setTool(map[k]); return true; }
    return false;
  };

  window.MapEditor = MapEditor;
})();
