/* Stackit — kostüm / dekor editörü (piksel çizim aracı) */
(function () {
  var COLORS = [
    '#1e2235', '#3a4058', '#6b7392', '#a7afc8', '#e3e7f2', '#ffffff',
    '#7a1f2b', '#d33a4a', '#ff6b6b', '#ffb4a8', '#8a4b1f', '#c98a4b',
    '#ff8a3d', '#ffb347', '#ffd23f', '#fff3a0', '#1f6e3a', '#2fae4f',
    '#7ee081', '#c8f7a8', '#0e5e6f', '#17a9a1', '#5ef2d0', '#b5fff0',
    '#1d3f8f', '#3b7ddd', '#6cc0ff', '#bfe3ff', '#4b2a8a', '#7c5cff',
    '#b49bff', '#ff7ad9'
  ];
  var TOOLS = [
    ['pen', 'M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3', SE.t('Kalem (B)')],
    ['eraser', 'M3 15l8-8 7 7-5 5H7zM11 20h10M7 11l7 7', SE.t('Silgi (E)')],
    ['fill', 'M4 12l7-7 7 7-7 7zM4 12h14M20 15.5c.8 1.2 1.3 2 1.3 2.7a1.3 1.3 0 0 1-2.6 0c0-.7.5-1.5 1.3-2.7', SE.t('Boya kovası (G)')],
    ['picker', 'M14 4l6 6M17.5 6.5L8 16l-4 1 1-4 9.5-9.5', SE.t('Renk seçici (I)')],
    ['line', 'M5 19L19 5', SE.t('Çizgi (L)')],
    ['rect', 'M4 6h16v12H4z', SE.t('Dikdörtgen (R)')]
  ];
  function icon(path) {
    return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
  }

  function CostumeEditor(app, root) {
    this.app = app;
    this.root = root;
    this.tool = 'pen';
    this.color = '#7c5cff';
    this.brush = 1;
    this.mirror = false;
    this.undoStacks = new WeakMap();
    this.build();
  }
  var P = CostumeEditor.prototype;

  P.build = function () {
    var self = this, r = this.root;
    r.innerHTML = '';
    this.listWrap = UI.el('div', 'cos-side');
    var addRow = UI.el('div', 'cos-add');
    [[SE.t('+ Yeni'), 'new'], [SE.t('Yükle'), 'upload'], [SE.t('Hazır'), 'lib']].forEach(function (b) {
      var btn = UI.el('button', 'btn small', b[0]);
      btn.type = 'button';
      btn.addEventListener('click', function (e) { self.addAction(b[1], e); });
      addRow.appendChild(btn);
    });
    this.backBtn = UI.el('button', 'btn small back-btn', SE.t('← Haritaya dön'));
    this.backBtn.type = 'button';
    this.backBtn.addEventListener('click', function () { self.app.setTab('map'); });
    this.listWrap.appendChild(this.backBtn);
    this.listWrap.appendChild(addRow);
    this.list = UI.el('div', 'cos-list');
    this.listWrap.appendChild(this.list);
    r.appendChild(this.listWrap);

    var main = UI.el('div', 'cos-main');
    var props = UI.el('div', 'cos-props');
    this.nameInp = document.createElement('input');
    this.nameInp.className = 'field';
    this.nameInp.spellcheck = false;
    this.nameInp.addEventListener('change', function () { self.rename(self.nameInp.value.trim()); });
    props.appendChild(UI.el('span', 'flabel', SE.t('Ad')));
    props.appendChild(this.nameInp);
    this.scaleSel = document.createElement('select');
    this.scaleSel.className = 'field';
    [0.25, 0.5, 1, 2, 3, 4, 5, 6, 8, 10].forEach(function (s) {
      var o = document.createElement('option');
      o.value = s;
      o.textContent = '×' + s;
      self.scaleSel.appendChild(o);
    });
    this.scaleSel.addEventListener('change', function () {
      var c = self.costume();
      if (!c) return;
      c.scale = +self.scaleSel.value;
      self.app.costumeChanged();
    });
    this.scaleLabel = UI.el('span', 'flabel', SE.t('Ölçek'));
    props.appendChild(this.scaleLabel);
    props.appendChild(this.scaleSel);
    var sm = UI.el('label', 'fcheck');
    this.smoothCb = document.createElement('input');
    this.smoothCb.type = 'checkbox';
    this.smoothCb.addEventListener('change', function () {
      var c = self.costume();
      if (!c) return;
      c.smooth = self.smoothCb.checked;
      self.app.costumeChanged();
    });
    sm.appendChild(this.smoothCb);
    sm.appendChild(document.createTextNode(' ' + SE.t('yumuşat')));
    props.appendChild(sm);
    this.kindLabel = UI.el('span', 'flabel', SE.t('Tür'));
    this.kindSel = document.createElement('select');
    this.kindSel.className = 'field';
    [[SE.t('katı'), 'solid'], [SE.t('tek yönlü'), 'oneway'], [SE.t('geçilebilir'), 'none']].forEach(function (k) {
      var o = document.createElement('option');
      o.value = k[1];
      o.textContent = k[0];
      self.kindSel.appendChild(o);
    });
    this.kindSel.addEventListener('change', function () {
      var c = self.costume();
      if (!c) return;
      c.solid = self.kindSel.value;
      self.app.costumeChanged(true);
    });
    props.appendChild(this.kindLabel);
    props.appendChild(this.kindSel);
    this.sizeInfo = UI.el('span', 'cos-size');
    props.appendChild(this.sizeInfo);
    main.appendChild(props);

    var tb = UI.el('div', 'cos-tools');
    this.toolBtns = {};
    TOOLS.forEach(function (t) {
      var b = UI.el('button', 'tool');
      b.innerHTML = icon(t[1]);
      b.type = 'button';
      b.title = t[2];
      b.addEventListener('click', function () { self.setTool(t[0]); });
      tb.appendChild(b);
      self.toolBtns[t[0]] = b;
    });
    tb.appendChild(UI.el('span', 'tsep'));
    this.brushBtns = [];
    [1, 2, 3].forEach(function (n) {
      var b = UI.el('button', 'tool brush', '●');
      b.style.fontSize = 6 + n * 4 + 'px';
      b.title = SE.t('Fırça {n}px', { n: n });
      b.type = 'button';
      b.addEventListener('click', function () {
        self.brush = n;
        self.syncTools();
      });
      tb.appendChild(b);
      self.brushBtns.push(b);
    });
    tb.appendChild(UI.el('span', 'tsep'));
    this.mirrorBtn = UI.el('button', 'tool');
    this.mirrorBtn.innerHTML = icon('M12 3v18M4 8l4 4-4 4M20 8l-4 4 4 4');
    this.mirrorBtn.type = 'button';
    this.mirrorBtn.title = SE.t('Ayna çizim (simetrik)');
    this.mirrorBtn.addEventListener('click', function () {
      self.mirror = !self.mirror;
      self.syncTools();
    });
    tb.appendChild(this.mirrorBtn);
    [['M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3', SE.t('Geri al (Ctrl+Z)'), function () { self.undo(); }],
      ['M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4', SE.t('Yatay çevir'), function () { self.transform('h'); }],
      ['M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4', SE.t('Dikey çevir'), function () { self.transform('v'); }],
      ['M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', SE.t('Temizle'), function () { self.transform('clear'); }]].forEach(function (a) {
      var b = UI.el('button', 'tool');
      b.innerHTML = icon(a[0]);
      b.type = 'button';
      b.title = a[1];
      b.addEventListener('click', a[2]);
      tb.appendChild(b);
    });
    main.appendChild(tb);

    this.wrap = UI.el('div', 'cos-canvas-wrap');
    this.cv = document.createElement('canvas');
    this.cv.className = 'cos-canvas';
    this.wrap.appendChild(this.cv);
    this.notice = UI.el('div', 'cos-notice');
    this.wrap.appendChild(this.notice);
    main.appendChild(this.wrap);

    var pal = UI.el('div', 'cos-colors');
    this.swatches = [];
    COLORS.forEach(function (c) {
      var s = UI.el('button', 'sw');
      s.type = 'button';
      s.style.background = c;
      s.title = c;
      s.addEventListener('click', function () { self.setColor(c); });
      pal.appendChild(s);
      self.swatches.push(s);
    });
    this.customColor = document.createElement('input');
    this.customColor.type = 'color';
    this.customColor.className = 'sw-custom';
    this.customColor.title = SE.t('Özel renk');
    this.customColor.addEventListener('input', function () { self.setColor(self.customColor.value); });
    pal.appendChild(this.customColor);
    this.curSw = UI.el('span', 'sw-current');
    pal.insertBefore(this.curSw, pal.firstChild);
    main.appendChild(pal);
    r.appendChild(main);

    this.bindCanvas();
    new ResizeObserver(function () { if (self.target) self.draw(); }).observe(this.wrap);
    this.syncTools();
  };

  P.setTool = function (t) {
    this.tool = t;
    this.syncTools();
  };
  P.setColor = function (c) {
    this.color = c;
    if (this.tool === 'eraser' || this.tool === 'picker') this.tool = 'pen';
    this.syncTools();
  };
  P.syncTools = function () {
    var self = this;
    Object.keys(this.toolBtns).forEach(function (k) { self.toolBtns[k].classList.toggle('on', self.tool === k); });
    this.brushBtns.forEach(function (b, i) { b.classList.toggle('on', self.brush === i + 1); });
    this.mirrorBtn.classList.toggle('on', this.mirror);
    this.curSw.style.background = this.color;
    this.swatches.forEach(function (s) { s.classList.toggle('on', s.title.toLowerCase() === self.color.toLowerCase()); });
  };

  /* mode: 'sprite' | 'stage' | 'tile' (karo setini düzenlerken) */
  P.setTarget = function (t, mode) {
    this.target = t;
    this.mode = mode || (t === this.app.project.stage ? 'stage' : 'sprite');
    this.render();
  };
  P.costume = function () {
    var cs = this.target && this.target.costumes;
    if (!cs || !cs.length) return null;
    var i = Math.min(this.target.currentCostume | 0, cs.length - 1);
    return cs[i];
  };

  P.render = function () {
    var self = this, t = this.target;
    var isStage = this.mode === 'stage', isTile = this.mode === 'tile';
    this.backBtn.style.display = isTile ? '' : 'none';
    this.kindSel.style.display = isTile ? '' : 'none';
    this.kindLabel.style.display = isTile ? '' : 'none';
    this.list.innerHTML = '';
    (t.costumes || []).forEach(function (c, i) {
      var item = UI.el('div', 'cos-item' + (i === (t.currentCostume | 0) ? ' on' : ''));
      item.appendChild(UI.el('span', 'cos-num', String(i + 1)));
      var img = document.createElement('img');
      img.src = c.src;
      img.alt = '';
      if (!c.smooth) img.style.imageRendering = 'pixelated';
      item.appendChild(img);
      item.appendChild(UI.el('span', 'cos-name', c.name));
      item.appendChild(UI.el('span', 'cos-dim', c.w + '×' + c.h));
      item.addEventListener('click', function () {
        t.currentCostume = i;
        self.app.costumeChanged(true);
        self.render();
      });
      item.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        var items = [{ label: SE.t('Çoğalt'), value: 'dup' }];
        if (i > 0) items.push({ label: SE.t('Yukarı taşı'), value: 'up' });
        if (t.costumes.length > 1) items.push({ label: SE.t('Sil'), value: 'del', danger: true });
        UI.menu(e.clientX, e.clientY, items, function (v) {
          if (v === 'dup') {
            var cp = SE.util.clone(c);
            cp.name = self.uniqueName(c.name);
            if (isTile) cp.id = t.nextId++;
            t.costumes.splice(i + 1, 0, cp);
            t.currentCostume = i + 1;
          } else if (v === 'up') {
            t.costumes.splice(i - 1, 0, t.costumes.splice(i, 1)[0]);
            t.currentCostume = i - 1;
          } else if (v === 'del') {
            t.costumes.splice(i, 1);
            t.currentCostume = Math.min(t.currentCostume | 0, t.costumes.length - 1);
            if (self.app.costumeRemoved) self.app.costumeRemoved(c, self.mode);
          }
          self.app.costumeChanged(true);
          self.render();
        });
      });
      self.list.appendChild(item);
    });
    var c = this.costume();
    this.scaleSel.style.display = isStage || isTile ? 'none' : '';
    this.scaleLabel.style.display = isStage || isTile ? 'none' : '';
    if (!c) {
      this.nameInp.value = '';
      this.pix = null;
      this.notice.textContent = isStage ? SE.t('Dekor yok — arka plan rengi görünür. "+ Yeni" ile piksel dekor çiz ya da "Hazır"dan seç.') : SE.t('Kostüm yok.');
      this.notice.style.display = '';
      this.draw();
      return;
    }
    this.nameInp.value = c.name;
    if ([].some.call(this.scaleSel.options, function (o) { return +o.value === (c.scale || 1); })) this.scaleSel.value = c.scale || 1;
    this.smoothCb.checked = !!c.smooth;
    if (isTile) this.kindSel.value = c.solid || 'solid';
    this.sizeInfo.textContent = c.w + '×' + c.h + ' px';
    this.loadPix(c);
  };

  P.loadPix = function (c) {
    var self = this;
    this.editable = c.w * c.h <= 256 * 256;
    this.notice.style.display = this.editable ? 'none' : '';
    this.notice.textContent = this.editable ? '' : SE.t('Bu görsel piksel düzenleme için çok büyük (en fazla 256×256). Ad, ölçek ve yumuşatma yine de ayarlanabilir.');
    var pix = document.createElement('canvas');
    pix.width = c.w;
    pix.height = c.h;
    this.pix = pix;
    this.pixFor = c;
    var img = new Image();
    img.onload = function () {
      if (self.pix !== pix) return;
      pix.getContext('2d').drawImage(img, 0, 0, c.w, c.h);
      self.draw();
    };
    img.src = c.src;
    this.draw();
  };

  P.uniqueName = function (base) {
    var names = (this.target.costumes || []).map(function (c) { return c.name; });
    var root = base.replace(/\d+$/, '') || SE.t('kostüm'), n = 2, name = base;
    while (names.indexOf(name) >= 0) name = root + n++;
    return name;
  };

  P.rename = function (name) {
    var c = this.costume();
    if (!c || !name || name === c.name) return;
    var old = c.name;
    name = this.uniqueName(name);
    c.name = name;
    (this.target.scripts || []).forEach(function (s) {
      SE.blocks.walk(s.block, function (b) {
        if ((b.op === 'switch_costume' && b.inputs.COSTUME && b.inputs.COSTUME.value === old) || (b.op === 'switch_backdrop' && b.inputs.BD && b.inputs.BD.value === old)) {
          (b.inputs.COSTUME || b.inputs.BD).value = name;
        }
      });
    });
    this.app.costumeChanged(true);
    this.render();
  };

  P.addCostumes = function (list) {
    var t = this.target, self = this;
    t.costumes = t.costumes || [];
    list.forEach(function (c) {
      c.name = self.uniqueName(c.name);
      if (self.mode === 'tile') {
        c.id = t.nextId++;
        c.solid = c.solid || 'solid';
        c.smooth = false;
      }
      t.costumes.push(c);
    });
    t.currentCostume = t.costumes.length - list.length;
    this.app.costumeChanged(true);
    this.render();
  };

  P.addAction = function (kind, ev) {
    var self = this, isStage = this.mode === 'stage', isTile = this.mode === 'tile';
    if (kind === 'new') {
      var sizes = isStage
        ? [[SE.t('120×90 (önerilen)'), '120x90'], [SE.t('60×45 (iri piksel)'), '60x45'], [SE.t('240×180 (ince)'), '240x180']]
        : isTile ? [[SE.t('16×16 (önerilen)'), '16x16'], ['8×8', '8x8'], ['32×32', '32x32']]
          : [['16×16', '16x16'], ['24×24', '24x24'], ['32×32', '32x32'], ['48×48', '48x48'], ['64×64', '64x64']];
      UI.form(isStage ? SE.t('Yeni dekor') : isTile ? SE.t('Yeni karo') : SE.t('Yeni kostüm'), [
        { key: 'name', label: SE.t('Ad'), value: isStage ? SE.t('dekor') : isTile ? SE.t('karo') : SE.t('kostüm') },
        { key: 'size', label: SE.t('Boyut (piksel)'), type: 'select', options: sizes, value: sizes[0][1] }
      ], SE.t('Oluştur')).then(function (r) {
        if (!r) return;
        var wh = r.size.split('x');
        var c = StackitLib.blank(+wh[0], +wh[1], r.name || SE.t('kostüm'));
        if (!isStage) c.scale = +wh[0] <= 16 ? 3 : +wh[0] <= 32 ? 2 : 1;
        self.addCostumes([c]);
      });
    } else if (kind === 'upload') {
      UI.pickFile('image/*').then(function (file) {
        if (!file) return;
        self.importImage(file);
      });
    } else if (kind === 'lib') {
      var items = StackitLib.items.map(function (it) { return { label: it.name, value: it.id }; });
      if (isStage) items = [{ label: SE.t('Gökyüzü'), value: '_sky' }, { label: SE.t('Uzay'), value: '_space' }];
      if (isTile) items = StackitLib.tileItems.map(function (it) { return { label: it.name, value: 't:' + it.id }; });
      var r = ev.target.getBoundingClientRect();
      UI.menu(r.left, r.bottom + 4, items, function (id) {
        if (id === '_sky') self.addCostumes([StackitLib.skyBackdrop()]);
        else if (id === '_space') self.addCostumes([StackitLib.spaceBackdrop()]);
        else if (id.indexOf('t:') === 0) self.addCostumes([StackitLib.makeTile(id.slice(2))]);
        else self.addCostumes(StackitLib.make(id));
      });
    }
  };

  P.importImage = function (file) {
    var self = this, isStage = this.mode === 'stage', isTile = this.mode === 'tile';
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, max = isTile ? 64 : 1024;
        if (w > max || h > max) {
          var f = Math.min(max / w, max / h);
          w = Math.round(w * f);
          h = Math.round(h * f);
        }
        var cv = document.createElement('canvas');
        cv.width = w;
        cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        var small = w <= 64 && h <= 64;
        var scale = small ? 3 : isStage ? 1 : Math.min(1, 200 / Math.max(w, h));
        scale = Math.round(scale * 100) / 100;
        self.addCostumes([{
          name: file.name.replace(/\.[^.]+$/, '').slice(0, 30) || SE.t('resim'),
          src: cv.toDataURL('image/png'), w: w, h: h, scale: scale || 1, smooth: !small
        }]);
      };
      img.onerror = function () { UI.toast(SE.t('Görsel okunamadı'), 'err'); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  /* ---------- çizim ---------- */
  P.layout = function () {
    var c = this.pixFor;
    if (!c) return 1;
    var r = this.wrap.getBoundingClientRect();
    var cell = Math.floor(Math.min((r.width - 24) / c.w, (r.height - 24) / c.h));
    if (!this.editable) cell = Math.min((r.width - 24) / c.w, (r.height - 24) / c.h);
    return Math.max(this.editable ? 2 : 0.05, Math.min(cell, 40));
  };

  P.draw = function () {
    var cv = this.cv, c = this.pixFor;
    if (!this.pix || !c || !this.costume()) {
      cv.width = 0;
      cv.height = 0;
      return;
    }
    var cell = (this.cell = this.layout());
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = Math.max(1, Math.round(c.w * cell)), H = Math.max(1, Math.round(c.h * cell));
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var ck = Math.max(4, cell >= 8 ? cell : 8);
    for (var y = 0; y < H; y += ck) {
      for (var x = 0; x < W; x += ck) {
        g.fillStyle = ((x / ck + y / ck) & 1) ? '#d9dce6' : '#eef0f5';
        g.fillRect(x, y, ck, ck);
      }
    }
    g.imageSmoothingEnabled = !this.editable && !!c.smooth;
    g.drawImage(this.preview || this.pix, 0, 0, W, H);
    if (this.editable && cell >= 6) {
      g.strokeStyle = 'rgba(30,34,53,.10)';
      g.lineWidth = 1;
      g.beginPath();
      for (var i = 1; i < c.w; i++) { g.moveTo(i * cell + 0.5, 0); g.lineTo(i * cell + 0.5, H); }
      for (var j = 1; j < c.h; j++) { g.moveTo(0, j * cell + 0.5); g.lineTo(W, j * cell + 0.5); }
      g.stroke();
      if (this.mirror) {
        g.strokeStyle = 'rgba(124,92,255,.6)';
        g.beginPath();
        g.moveTo(W / 2, 0);
        g.lineTo(W / 2, H);
        g.stroke();
      }
    }
    if (this.hover && this.editable) {
      g.strokeStyle = 'rgba(124,92,255,.9)';
      g.lineWidth = 2;
      var b = this.brush, o = Math.floor((b - 1) / 2);
      g.strokeRect((this.hover.x - o) * cell + 1, (this.hover.y - o) * cell + 1, b * cell - 2, b * cell - 2);
    }
  };

  P.cellAt = function (e) {
    var r = this.cv.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / this.cell), y: Math.floor((e.clientY - r.top) / this.cell) };
  };

  P.bindCanvas = function () {
    var self = this, cv = this.cv;
    cv.addEventListener('pointerdown', function (e) {
      if (!self.editable || !self.pix || e.button !== 0) return;
      cv.setPointerCapture(e.pointerId);
      var p = self.cellAt(e);
      self.pushUndo();
      var g = self.pix.getContext('2d');
      if (self.tool === 'picker') {
        var d = g.getImageData(U(p.x, self.pix.width), U(p.y, self.pix.height), 1, 1).data;
        if (d[3] > 0) self.setColor('#' + [d[0], d[1], d[2]].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''));
        self.undoStack().pop();
        return;
      }
      if (self.tool === 'fill') {
        self.flood(p.x, p.y);
        if (self.mirror) self.flood(self.pix.width - 1 - p.x, p.y);
        self.commit();
        return;
      }
      self.stroke = { start: p, last: p };
      if (self.tool === 'pen' || self.tool === 'eraser') {
        self.plot(p.x, p.y);
        self.draw();
      }
    });
    cv.addEventListener('pointermove', function (e) {
      if (!self.pix) return;
      var p = self.cellAt(e);
      self.hover = p;
      var s = self.stroke;
      if (s) {
        if (self.tool === 'pen' || self.tool === 'eraser') {
          self.line(s.last.x, s.last.y, p.x, p.y, function (x, y) { self.plot(x, y); });
          s.last = p;
        } else if (self.tool === 'line' || self.tool === 'rect') {
          s.last = p;
          self.makePreview();
        }
      }
      self.draw();
    });
    cv.addEventListener('pointerleave', function () {
      self.hover = null;
      self.draw();
    });
    var up = function () {
      var s = self.stroke;
      if (!s) return;
      self.stroke = null;
      if (self.tool === 'line' || self.tool === 'rect') {
        self.preview = null;
        self.shapeTo(s.start, s.last, function (x, y) { self.plot(x, y); });
      }
      self.commit();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  };
  function U(v, max) { return Math.max(0, Math.min(max - 1, v)); }

  P.plotRaw = function (g, x, y) {
    var b = this.brush, o = Math.floor((b - 1) / 2);
    if (this.tool === 'eraser') g.clearRect(x - o, y - o, b, b);
    else {
      g.fillStyle = this.color;
      g.fillRect(x - o, y - o, b, b);
    }
  };
  P.plot = function (x, y, g) {
    g = g || this.pix.getContext('2d');
    this.plotRaw(g, x, y);
    if (this.mirror) {
      var b = this.brush, o = Math.floor((b - 1) / 2);
      this.plotRaw(g, this.pix.width - 1 - x - (b - 1) + 2 * o, y);
    }
  };
  P.line = function (x0, y0, x1, y1, fn) {
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (var n = 0; n < 4000; n++) {
      fn(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  P.shapeTo = function (a, b, fn) {
    if (this.tool === 'line') this.line(a.x, a.y, b.x, b.y, fn);
    else {
      this.line(a.x, a.y, b.x, a.y, fn);
      this.line(b.x, a.y, b.x, b.y, fn);
      this.line(b.x, b.y, a.x, b.y, fn);
      this.line(a.x, b.y, a.x, a.y, fn);
    }
  };
  P.makePreview = function () {
    var s = this.stroke, self = this;
    var pv = document.createElement('canvas');
    pv.width = this.pix.width;
    pv.height = this.pix.height;
    var g = pv.getContext('2d');
    g.drawImage(this.pix, 0, 0);
    this.shapeTo(s.start, s.last, function (x, y) { self.plot(x, y, g); });
    this.preview = pv;
  };
  P.flood = function (x, y) {
    var w = this.pix.width, h = this.pix.height;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    var g = this.pix.getContext('2d');
    var img = g.getImageData(0, 0, w, h), d = img.data;
    var i0 = (y * w + x) * 4;
    var tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2], ta = d[i0 + 3];
    var hex = this.color.replace('#', '');
    var nr = parseInt(hex.substr(0, 2), 16), ng = parseInt(hex.substr(2, 2), 16), nb = parseInt(hex.substr(4, 2), 16);
    if (tr === nr && tg === ng && tb === nb && ta === 255) return;
    var same = function (i) {
      if (ta === 0) return d[i + 3] === 0;
      return d[i] === tr && d[i + 1] === tg && d[i + 2] === tb && d[i + 3] === ta;
    };
    var stack = [[x, y]], seen = new Uint8Array(w * h);
    while (stack.length) {
      var p = stack.pop(), px = p[0], py = p[1];
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      var k = py * w + px;
      if (seen[k]) continue;
      seen[k] = 1;
      var i = k * 4;
      if (!same(i)) continue;
      d[i] = nr; d[i + 1] = ng; d[i + 2] = nb; d[i + 3] = 255;
      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
    g.putImageData(img, 0, 0);
  };
  P.transform = function (kind) {
    if (!this.editable || !this.pix) return;
    this.pushUndo();
    var w = this.pix.width, h = this.pix.height;
    var tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    tmp.getContext('2d').drawImage(this.pix, 0, 0);
    var g = this.pix.getContext('2d');
    g.save();
    g.clearRect(0, 0, w, h);
    if (kind === 'h') { g.translate(w, 0); g.scale(-1, 1); g.drawImage(tmp, 0, 0); }
    else if (kind === 'v') { g.translate(0, h); g.scale(1, -1); g.drawImage(tmp, 0, 0); }
    g.restore();
    this.commit();
  };

  P.undoStack = function () {
    var c = this.pixFor;
    if (!this.undoStacks.has(c)) this.undoStacks.set(c, []);
    return this.undoStacks.get(c);
  };
  P.pushUndo = function () {
    if (!this.pix) return;
    var st = this.undoStack();
    st.push(this.pix.getContext('2d').getImageData(0, 0, this.pix.width, this.pix.height));
    if (st.length > 40) st.shift();
  };
  P.undo = function () {
    var st = this.undoStack();
    if (!st.length || !this.pix) return;
    this.pix.getContext('2d').putImageData(st.pop(), 0, 0);
    this.commit();
  };
  P.commit = function () {
    var c = this.pixFor;
    if (!c || !this.pix) return;
    c.src = this.pix.toDataURL('image/png');
    this.draw();
    var imgs = this.list.querySelectorAll('.cos-item');
    var i = (this.target.costumes || []).indexOf(c);
    if (imgs[i]) imgs[i].querySelector('img').src = c.src;
    this.app.costumeChanged();
  };

  P.onKey = function (e) {
    var k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); this.undo(); return true; }
    var map = { b: 'pen', e: 'eraser', g: 'fill', i: 'picker', l: 'line', r: 'rect' };
    if (!e.ctrlKey && !e.metaKey && map[k]) { this.setTool(map[k]); return true; }
    return false;
  };

  window.CostumeEditor = CostumeEditor;
})();
