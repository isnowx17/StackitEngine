/* Stackit — betik çalışma alanı: sürükle-bırak, yapışma, kaydırma, yakınlaştırma */
(function () {
  var B = SE.blocks;
  var U = SE.util;

  function Workspace(app, root, paletteEl) {
    this.app = app;
    this.root = root;
    this.palette = paletteEl;
    this.content = UI.el('div', 'ws-content');
    root.appendChild(this.content);
    this.indicator = UI.el('div', 'ws-indicator');
    this.hint = UI.el('div', 'ws-hint');
    this.hint.innerHTML = SE.t('<b>Boş bir sahne!</b><span>Soldaki bloklardan birini sürükleyip buraya bırak.<br>Örn. <i>Olaylar → ▶ oyun başlayınca</i></span>');
    root.appendChild(this.hint);
    this.layer = document.getElementById('drag-layer');
    this.views = {};
    this.pending = null;
    this.drag = null;
    this.pan = null;
    this.hl = null;

    var zoom = UI.el('div', 'ws-zoom');
    var self = this;
    [['+', SE.t('Yakınlaştır'), 1.2], ['−', SE.t('Uzaklaştır'), 1 / 1.2], ['=', SE.t('Sıfırla'), 0]].forEach(function (z) {
      var b = UI.el('button', null, z[0]);
      b.type = 'button';
      b.title = z[1];
      b.addEventListener('click', function () {
        var r = root.getBoundingClientRect();
        if (z[2]) self.zoomAt(r.left + r.width / 2, r.top + r.height / 2, z[2]);
        else {
          var v = self.view();
          v.zoom = 1;
          v.x = 30;
          v.y = 30;
          self.applyView();
        }
      });
      zoom.appendChild(b);
    });
    root.appendChild(zoom);

    root.addEventListener('pointerdown', function (e) { self.onDown(e, 'ws'); });
    paletteEl.addEventListener('pointerdown', function (e) { self.onDown(e, 'palette'); });
    window.addEventListener('pointermove', function (e) { self.onMove(e); });
    window.addEventListener('pointerup', function (e) { self.onUp(e); });
    window.addEventListener('pointercancel', function (e) {
      // dokunmatikte tarayıcı kaydırmayı devraldı: bekleyen tıklamayı iptal et
      self.pending = null;
      self.onUp(e);
    });
    root.addEventListener('wheel', function (e) { self.onWheel(e); }, { passive: false });
    root.addEventListener('contextmenu', function (e) { self.onContext(e); });
  }

  var P = Workspace.prototype;

  P.target = function () { return this.app.currentTarget(); };
  P.view = function () {
    var id = this.target().id;
    if (!this.views[id]) this.views[id] = { x: 30, y: 30, zoom: 1 };
    return this.views[id];
  };
  P.applyView = function () {
    var v = this.view();
    this.content.style.transform = 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.zoom + ')';
    this.root.style.backgroundPosition = v.x + 'px ' + v.y + 'px';
    this.root.style.backgroundSize = 22 * v.zoom + 'px ' + 22 * v.zoom + 'px';
  };
  P.clientToContent = function (cx, cy) {
    var r = this.root.getBoundingClientRect(), v = this.view();
    return { x: (cx - r.left - v.x) / v.zoom, y: (cy - r.top - v.y) / v.zoom };
  };

  P.render = function () {
    var t = this.target(), self = this;
    t.scripts = t.scripts.filter(function (s) { return s && s.block; });
    this.content.innerHTML = '';
    var env = this.app.blockEnv();
    t.scripts.forEach(function (s) {
      var se = UI.el('div', 'script');
      se._script = s;
      se.style.left = s.x + 'px';
      se.style.top = s.y + 'px';
      BV.renderChain(s.block, env, se);
      self.content.appendChild(se);
    });
    this.content.appendChild(this.indicator);
    this.indicator.style.display = 'none';
    this.hint.style.display = t.scripts.length ? 'none' : '';
    this.applyView();
  };

  P.updateRunning = function (engine) {
    var els = this.content.children;
    for (var i = 0; i < els.length; i++) {
      var s = els[i]._script;
      if (s) els[i].classList.toggle('running', engine.running && engine.isScriptRunning(s.block));
    }
  };

  /* görünür alana yeni betik ekle */
  P.addScriptVisible = function (block) {
    var r = this.root.getBoundingClientRect();
    var p = this.clientToContent(r.left + 40, r.top + 40);
    var t = this.target();
    var y = p.y;
    t.scripts.forEach(function (s) { if (Math.abs(s.x - p.x) < 60 && Math.abs(s.y - y) < 30) y += 50; });
    t.scripts.push({ x: Math.round(p.x), y: Math.round(y), block: block });
    this.render();
  };

  /* ---------- model işlemleri ---------- */
  function searchIn(b, target) {
    while (b) {
      if (b.next === target) return { kind: 'next', owner: b };
      if (b.inputs) {
        for (var k in b.inputs) {
          var ib = b.inputs[k] && b.inputs[k].block;
          if (ib) {
            if (ib === target) return { kind: 'input', owner: b, key: k };
            var r = searchIn(ib, target);
            if (r) return r;
          }
        }
      }
      if (b.substacks) {
        for (var s in b.substacks) {
          var sb = b.substacks[s];
          if (sb) {
            if (sb === target) return { kind: 'sub', owner: b, key: s };
            var r2 = searchIn(sb, target);
            if (r2) return r2;
          }
        }
      }
      b = b.next;
    }
    return null;
  }
  P.findParent = function (target) {
    var scripts = this.target().scripts;
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].block === target) return { kind: 'top', script: scripts[i] };
      var r = searchIn(scripts[i].block, target);
      if (r) return r;
    }
    return null;
  };
  /* bloğu (ve altındakileri) bulunduğu yerden kopar */
  P.detach = function (b) {
    var loc = this.findParent(b);
    if (!loc) return null;
    if (loc.kind === 'top') {
      var arr = this.target().scripts;
      arr.splice(arr.indexOf(loc.script), 1);
    } else if (loc.kind === 'next') loc.owner.next = null;
    else if (loc.kind === 'sub') loc.owner.substacks[loc.key] = null;
    else if (loc.kind === 'input') loc.owner.inputs[loc.key].block = null;
    return b;
  };
  /* yalnızca bu bloğu sil, altındakileri yukarı bağla */
  P.deleteBlock = function (b) {
    var loc = this.findParent(b);
    if (!loc) return;
    this.app.snapshot();
    var rest = B.isReporter(b) ? null : b.next;
    b.next = null;
    if (loc.kind === 'top') {
      if (rest) loc.script.block = rest;
      else {
        var arr = this.target().scripts;
        arr.splice(arr.indexOf(loc.script), 1);
      }
    } else if (loc.kind === 'next') loc.owner.next = rest;
    else if (loc.kind === 'sub') loc.owner.substacks[loc.key] = rest;
    else if (loc.kind === 'input') loc.owner.inputs[loc.key].block = null;
    this.render();
    this.app.changed('structure');
  };

  /* ---------- işaretçi olayları ---------- */
  P.onDown = function (e, source) {
    if (e.button !== 0 || this.drag) return;
    var t = e.target;
    var bel = t.closest('.blk');
    if (source === 'ws') {
      if (t.closest('.ws-zoom')) return;
      if (bel && t.closest('input, .in-menu')) return;
      if (!bel) {
        var v = this.view();
        this.pan = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y };
        this.root.classList.add('panning');
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        e.preventDefault();
        return;
      }
    } else {
      if (!bel || t.closest('input[type=checkbox], button')) return;
    }
    e.preventDefault();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    UI.closeMenu();
    this.pending = {
      x: e.clientX, y: e.clientY, bel: bel, block: bel._blk,
      copy: source === 'palette' || bel.classList.contains('template'),
      fromPalette: source === 'palette'
    };
  };

  P.onMove = function (e) {
    if (this.pan) {
      var v = this.view();
      v.x = this.pan.vx + (e.clientX - this.pan.x);
      v.y = this.pan.vy + (e.clientY - this.pan.y);
      this.applyView();
      return;
    }
    if (this.pending && !this.drag) {
      if (Math.hypot(e.clientX - this.pending.x, e.clientY - this.pending.y) < 5) return;
      this.beginDrag(e);
    }
    if (this.drag) this.moveDrag(e);
  };

  P.onUp = function (e) {
    if (this.pan) {
      this.pan = null;
      this.root.classList.remove('panning');
      return;
    }
    if (this.drag) {
      this.endDrag(e);
      return;
    }
    if (this.pending) {
      var p = this.pending;
      this.pending = null;
      this.click(p);
    }
  };

  P.onWheel = function (e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      this.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.004));
      return;
    }
    var v = this.view();
    var dx = e.shiftKey ? e.deltaY : e.deltaX, dy = e.shiftKey ? 0 : e.deltaY;
    v.x -= dx;
    v.y -= dy;
    this.applyView();
  };

  P.zoomAt = function (cx, cy, f) {
    var r = this.root.getBoundingClientRect(), v = this.view();
    var px = cx - r.left, py = cy - r.top;
    var nz = U.clamp(v.zoom * f, 0.35, 2.5);
    v.x = px - ((px - v.x) * nz) / v.zoom;
    v.y = py - ((py - v.y) * nz) / v.zoom;
    v.zoom = nz;
    this.applyView();
  };

  /* ---------- sürükleme ---------- */
  P.beginDrag = function (e) {
    var p = this.pending;
    this.pending = null;
    var zoom = this.view().zoom;
    var r = p.bel.getBoundingClientRect();
    var srcScale = p.fromPalette ? 1 : zoom;
    var offX = (p.x - r.left) / srcScale, offY = (p.y - r.top) / srcScale;
    var block;
    if (p.copy) block = B.cloneBlock(p.block);
    else {
      this.app.snapshot();
      block = this.detach(p.block);
      if (!block) return;
      this.render();
    }
    var de = UI.el('div', 'drag-script');
    BV.renderChain(block, this.app.blockEnv(), de);
    de.style.transform = 'scale(' + zoom + ')';
    this.layer.appendChild(de);
    this.drag = { block: block, offX: offX, offY: offY, el: de, isNew: p.copy, rep: B.isReporter(block), zoom: zoom, best: null };
    document.body.classList.add('is-dragging');
    this.collectTargets();
    this.moveDrag(e);
  };

  P.collectTargets = function () {
    var d = this.drag, targets = (d.targets = []);
    var shapeTop = B.shapeOf(d.block);
    if (d.rep) {
      var isBool = shapeTop === 'bool';
      this.content.querySelectorAll('.slot').forEach(function (s) {
        var info = s._slot;
        if (!info || !info.accept) return;
        if (info.accept === 'bool' && !isBool) return;
        targets.push({ kind: 'input', owner: info.owner, key: info.key, el: s });
      });
    } else {
      var last = d.block;
      while (last.next) last = last.next;
      var ls = B.shapeOf(last);
      var canNext = ls !== 'cap' && ls !== 'ccap';
      if (shapeTop !== 'hat') {
        this.content.querySelectorAll('.blk').forEach(function (be) {
          var b = be._blk, bs = B.shapeOf(b);
          if (!b || bs === 'rep' || bs === 'bool' || be.classList.contains('template')) return;
          if (bs !== 'cap' && bs !== 'ccap' && (canNext || !b.next)) targets.push({ kind: 'after', owner: b, el: be });
          if (bs === 'c' || bs === 'c2' || bs === 'ccap') {
            for (var i = 0; i < be.children.length; i++) {
              var m = be.children[i];
              if (!m.classList.contains('mouth')) continue;
              if (canNext || !b.substacks[m.dataset.key]) targets.push({ kind: 'sub', owner: b, key: m.dataset.key, el: m });
            }
          }
        });
      }
      if (canNext) {
        for (var k = 0; k < this.content.children.length; k++) {
          var se = this.content.children[k], s = se._script;
          if (!s || !s.block) continue;
          var fs = B.shapeOf(s.block);
          if (fs !== 'hat' && fs !== 'rep' && fs !== 'bool') targets.push({ kind: 'above', script: s, el: se });
        }
      }
    }
    targets.forEach(function (t) {
      var r = t.el.getBoundingClientRect();
      t.rect = r;
      t.x = r.left;
      if (t.kind === 'after') t.y = r.bottom;
      else t.y = r.top;
      if (t.kind === 'sub') t.x = r.left;
    });
  };

  P.moveDrag = function (e) {
    var d = this.drag;
    d.el.style.left = e.clientX - d.offX * d.zoom + 'px';
    d.el.style.top = e.clientY - d.offY * d.zoom + 'px';
    var pr = this.palette.getBoundingClientRect();
    d.overPalette = e.clientX >= pr.left && e.clientX <= pr.right && e.clientY >= pr.top && e.clientY <= pr.bottom;
    this.palette.classList.toggle('drop-delete', d.overPalette);
    var best = null;
    if (!d.overPalette && d.el.firstChild) {
      var fr = d.el.firstChild.getBoundingClientRect();
      if (d.rep) {
        var px = fr.left + 6, py = fr.top + fr.height / 2, bestArea = Infinity;
        d.targets.forEach(function (t) {
          var r = t.rect;
          if (px >= r.left - 16 && px <= r.right + 4 && py >= r.top - 12 && py <= r.bottom + 12) {
            var area = r.width * r.height;
            if (area < bestArea) { bestArea = area; best = t; }
          }
        });
      } else {
        var dr = d.el.getBoundingClientRect(), bestD = 40;
        d.targets.forEach(function (t) {
          var dx = fr.left - t.x, dy = t.kind === 'above' ? dr.bottom - t.y : fr.top - t.y;
          var dist = Math.hypot(dx, dy * 1.2);
          if (dist < bestD) { bestD = dist; best = t; }
        });
      }
    }
    d.best = best;
    this.showIndicator(best);
  };

  P.showIndicator = function (t) {
    if (this.hl) {
      this.hl.classList.remove('drop-hl');
      this.hl = null;
    }
    var ind = this.indicator;
    if (!t) {
      ind.style.display = 'none';
      return;
    }
    if (t.kind === 'input') {
      t.el.classList.add('drop-hl');
      this.hl = t.el;
      ind.style.display = 'none';
      return;
    }
    var c = this.clientToContent(t.x, t.y);
    var w = Math.min(220, this.drag.el.getBoundingClientRect().width / this.view().zoom);
    ind.style.display = 'block';
    ind.style.left = c.x + 'px';
    ind.style.top = c.y - 3 + (t.kind === 'above' ? -4 : 0) + 'px';
    ind.style.width = Math.max(60, w) + 'px';
  };

  P.endDrag = function (e) {
    var d = this.drag;
    this.drag = null;
    document.body.classList.remove('is-dragging');
    this.palette.classList.remove('drop-delete');
    this.showIndicator(null);
    var dr = d.el.getBoundingClientRect();
    var pos = this.clientToContent(dr.left, dr.top);
    d.el.remove();
    if (d.overPalette) {
      if (!d.isNew) this.app.changed('structure');
      return;
    }
    var rr = this.root.getBoundingClientRect();
    var inside = e.clientX >= rr.left && e.clientX <= rr.right && e.clientY >= rr.top && e.clientY <= rr.bottom;
    if (!inside && !d.best) {
      if (d.isNew) return;
      var v = this.view();
      pos.x = U.clamp(pos.x, (-v.x + 10) / v.zoom, (rr.width - v.x - 120) / v.zoom);
      pos.y = U.clamp(pos.y, (-v.y + 10) / v.zoom, (rr.height - v.y - 40) / v.zoom);
    }
    if (d.isNew) this.app.snapshot();
    var b = d.block, last = b;
    if (!d.rep) while (last.next) last = last.next;
    var t = d.best, scripts = this.target().scripts;
    if (t) {
      if (t.kind === 'after') {
        last.next = t.owner.next;
        t.owner.next = b;
      } else if (t.kind === 'sub') {
        last.next = t.owner.substacks[t.key] || null;
        t.owner.substacks[t.key] = b;
      } else if (t.kind === 'above') {
        last.next = t.script.block;
        t.script.block = b;
        t.script.x = Math.round(pos.x);
        t.script.y = Math.round(pos.y);
      } else if (t.kind === 'input') {
        var inp = t.owner.inputs[t.key];
        if (inp.block) scripts.push({ x: Math.round(pos.x + 24), y: Math.round(pos.y + 36), block: inp.block });
        inp.block = b;
      }
    } else scripts.push({ x: Math.round(pos.x), y: Math.round(pos.y), block: b });
    this.render();
    this.app.changed('structure');
    if (B.isHat(b) && d.isNew && b.op === 'when_msg') this.app.ensureMessage(b.inputs.MSG.value);
  };

  P.click = function (p) {
    var b = p.block;
    if (!b) return;
    if (B.isReporter(b)) {
      var v = this.app.evalReporter(b);
      UI.bubble(p.bel, U.toStr(v));
      return;
    }
    if (p.bel.classList.contains('template')) return;
    if (p.fromPalette) {
      this.app.runScript(b);
      return;
    }
    var se = p.bel.closest('.script');
    if (se && se._script) this.app.runScript(se._script.block);
  };

  /* ---------- sağ tık menüsü ---------- */
  P.onContext = function (e) {
    e.preventDefault();
    var self = this;
    var bel = e.target.closest('.blk');
    if (bel && !bel.classList.contains('template') && bel._blk) {
      var b = bel._blk;
      var items = [];
      if (b.op === 'proc_def') items.push({ label: SE.t('Fonksiyonu düzenle'), value: 'editproc' });
      items.push({ label: SE.t('Çoğalt'), value: 'dup' });
      items.push({ label: B.isHat(b) ? SE.t('Başlığı sil') : SE.t('Bloğu sil'), value: 'del', danger: true });
      UI.menu(e.clientX, e.clientY, items, function (v) {
        if (v === 'del') self.deleteBlock(b);
        else if (v === 'editproc') self.app.editProc(b);
        else if (v === 'dup') {
          self.app.snapshot();
          var copy = B.cloneBlock(b);
          var r = bel.getBoundingClientRect();
          var pos = self.clientToContent(r.left + 24, r.top + 24);
          self.target().scripts.push({ x: Math.round(pos.x), y: Math.round(pos.y), block: copy });
          self.render();
          self.app.changed('structure');
        }
      });
      return;
    }
    UI.menu(e.clientX, e.clientY, [
      { label: SE.t('Blokları düzenle'), value: 'tidy' },
      { label: SE.t('Görünümü sıfırla'), value: 'reset' },
      { sep: true },
      { label: SE.t('Tüm betikleri sil'), value: 'clear', danger: true }
    ], function (v) {
      if (v === 'tidy') self.tidy();
      else if (v === 'reset') {
        var vw = self.view();
        vw.x = 30; vw.y = 30; vw.zoom = 1;
        self.applyView();
      } else if (v === 'clear') {
        UI.confirm(SE.t('Bu karakterin tüm betikleri silinsin mi?'), SE.t('Sil')).then(function (ok) {
          if (!ok) return;
          self.app.snapshot();
          self.target().scripts = [];
          self.render();
          self.app.changed('structure');
        });
      }
    });
  };

  P.tidy = function () {
    this.app.snapshot();
    var z = this.view().zoom, y = 20, self = this;
    var els = Array.prototype.slice.call(this.content.children).filter(function (el) { return el._script; });
    els.sort(function (a, b) { return a._script.y - b._script.y || a._script.x - b._script.x; });
    els.forEach(function (el) {
      el._script.x = 20;
      el._script.y = y;
      y += el.getBoundingClientRect().height / z + 28;
    });
    var v = this.view();
    v.x = 30; v.y = 30;
    self.render();
    self.app.changed('structure');
  };

  window.Workspace = Workspace;
})();
