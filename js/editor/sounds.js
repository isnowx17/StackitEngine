/* Stackit — ses editörü: ses dosyaları + adım tabanlı müzik/ritim yapıcı */
(function () {
  var U = SE.util;
  var NOTES = [84, 83, 81, 79, 77, 76, 74, 72, 71, 69, 67, 65, 64, 62, 60];
  var SOLFEGE = { 0: 'Do', 2: 'Re', 4: 'Mi', 5: 'Fa', 7: 'Sol', 9: 'La', 11: 'Si' };
  var LETTERS = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };
  var DRUMS = [['hat', SE.t('Zil')], ['snare', SE.t('Trampet')], ['kick', SE.t('Davul')]];
  var ROW_H = 22, LABEL_W = 64;
  var peaksCache = new Map();

  function noteName(m) { return (SE.lang === 'tr' ? SOLFEGE : LETTERS)[m % 12] + Math.floor(m / 12 - 1); }
  function icon(path) {
    return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
  }
  var IC_MUSIC = 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0a3 3 0 1 1 6 0zM20 16a3 3 0 1 1-6 0a3 3 0 1 1 6 0z';
  var IC_WAVE = 'M3 12h2M7 8v8M11 4v16M15 7v10M19 10v4M21 12h0';
  var IC_PLAY = 'M7 4.5l12.5 7.5L7 19.5z';
  var IC_STOP = 'M6 6h12v12H6z';

  function SoundEditor(app, root) {
    this.app = app;
    this.root = root;
    this.sel = 0;
    this.build();
  }
  var P = SoundEditor.prototype;

  P.build = function () {
    var self = this, r = this.root;
    r.innerHTML = '';
    var side = UI.el('div', 'cos-side');
    var add = UI.el('div', 'cos-add');
    [[SE.t('+ Müzik'), 'new'], [SE.t('Hazır'), 'lib'], [SE.t('Yükle'), 'upload']].forEach(function (b) {
      var x = UI.el('button', 'btn small', b[0]);
      x.type = 'button';
      x.addEventListener('click', function (e) { self.add(b[1], e); });
      add.appendChild(x);
    });
    side.appendChild(add);
    this.list = UI.el('div', 'cos-list');
    side.appendChild(this.list);
    r.appendChild(side);
    this.main = UI.el('div', 'snd-main');
    r.appendChild(this.main);
  };

  P.setTarget = function (t) {
    if (t !== this.target) this.stop();
    this.target = t;
    t.sounds = t.sounds || [];
    if (this.sel >= t.sounds.length) this.sel = Math.max(0, t.sounds.length - 1);
    this.render();
  };
  P.sound = function () { return this.target && this.target.sounds[this.sel]; };

  P.uniqueName = function (base) {
    var names = this.target.sounds.map(function (s) { return s.name; }), name = base, n = 2;
    var root = base.replace(/\d+$/, '') || SE.t('ses');
    while (names.indexOf(name) >= 0) name = root + n++;
    return name;
  };
  P.push = function (s) {
    s.id = U.uid('snd');
    s.name = this.uniqueName(s.name || SE.t('ses'));
    this.target.sounds.push(s);
    this.sel = this.target.sounds.length - 1;
    this.changed(true);
    this.render();
  };
  P.changed = function (structural) {
    this.app.changed(structural ? 'vars' : 'input');
  };

  P.add = function (kind, ev) {
    var self = this;
    if (kind === 'new') {
      this.push({ type: 'music', name: SE.t('müzik'), bpm: 120, steps: 16, wave: 'square', notes: [], drums: [] });
    } else if (kind === 'lib') {
      var r = ev.target.getBoundingClientRect();
      UI.menu(r.left, r.bottom + 4, StackitLib.melodies.map(function (m) { return { label: '♪ ' + m.name, value: m.id }; }), function (id) {
        var m = StackitLib.melodies.filter(function (x) { return x.id === id; })[0];
        if (m) self.push(m.make());
      });
    } else if (kind === 'upload') {
      UI.pickFile('audio/*').then(function (file) {
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) {
          UI.toast(SE.t('Ses dosyası çok büyük (en fazla 4 MB). Kısa bir efekt dene.'), 'err');
          return;
        }
        var rd = new FileReader();
        rd.onload = function () {
          var snd = { type: 'audio', name: file.name.replace(/\.[^.]+$/, '').slice(0, 24) || SE.t('ses'), src: rd.result, dur: 0 };
          SE.audio.decode(snd.src).then(function (buf) {
            snd.dur = Math.round(buf.duration * 100) / 100;
            self.push(snd);
            if (file.size > 1024 * 1024) UI.toast(SE.t('Büyük ses dosyası: tarayıcı deposu dolabilir, projeyi "İndir" ile de kaydet.'));
          }, function () {
            UI.toast(SE.t('Bu ses dosyası çözülemedi (mp3, wav veya ogg dene)'), 'err');
          });
        };
        rd.readAsDataURL(file);
      });
    }
  };

  P.render = function () {
    var self = this, t = this.target;
    this.list.innerHTML = '';
    t.sounds.forEach(function (s, i) {
      var it = UI.el('div', 'cos-item snd-item' + (i === self.sel ? ' on' : ''));
      it.appendChild(UI.el('span', 'cos-num', String(i + 1)));
      var ic = UI.el('span', 'snd-icon' + (s.type === 'music' ? ' music' : ''));
      ic.innerHTML = icon(s.type === 'music' ? IC_MUSIC : IC_WAVE);
      it.appendChild(ic);
      it.appendChild(UI.el('span', 'cos-name', s.name));
      it.appendChild(UI.el('span', 'cos-dim', s.type === 'music' ? SE.t('{bpm} bpm · {steps} adım', { bpm: s.bpm, steps: s.steps }) : (s.dur ? SE.t('{n} sn', { n: s.dur }) : SE.t('ses'))));
      it.addEventListener('click', function () {
        if (self.sel !== i) self.stop();
        self.sel = i;
        self.render();
      });
      it.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        UI.menu(e.clientX, e.clientY, [
          { label: SE.t('Yeniden adlandır'), value: 'ren' },
          { label: SE.t('Çoğalt'), value: 'dup' },
          { label: SE.t('Sil'), value: 'del', danger: true }
        ], function (v) {
          if (v === 'ren') {
            UI.prompt(SE.t('Sesi yeniden adlandır'), SE.t('Ad'), s.name).then(function (n) {
              if (!n || n === s.name) return;
              var old = s.name;
              s.name = self.uniqueName(n);
              self.renameRefs(old, s.name);
              self.changed(true);
              self.render();
            });
          } else if (v === 'dup') {
            var c = U.clone(s);
            self.push(c);
          } else {
            self.stop();
            t.sounds.splice(i, 1);
            self.sel = Math.max(0, Math.min(self.sel, t.sounds.length - 1));
            self.changed(true);
            self.render();
          }
        });
      });
      self.list.appendChild(it);
    });
    this.renderMain();
  };

  P.renameRefs = function (old, name) {
    (this.target.scripts || []).forEach(function (sc) {
      SE.blocks.walk(sc.block, function (b) {
        if (b.inputs && b.inputs.SOUND && b.inputs.SOUND.value === old) b.inputs.SOUND.value = name;
      });
    });
    this.app.ws.render();
  };

  P.renderMain = function () {
    var self = this, s = this.sound(), m = this.main;
    m.innerHTML = '';
    this.grid = null;
    if (!s) {
      var hint = UI.el('div', 'ws-hint');
      hint.style.position = 'static';
      hint.style.height = '100%';
      hint.innerHTML = SE.t('<b>Henüz ses yok</b><span>"+ Müzik" ile notalar ve davullarla kendi müziğini yap,<br>"Hazır" ile örnek bir melodi ekle ya da bir ses dosyası yükle.</span>');
      m.appendChild(hint);
      return;
    }
    var bar = UI.el('div', 'cos-props');
    var name = document.createElement('input');
    name.className = 'field';
    name.value = s.name;
    name.spellcheck = false;
    name.addEventListener('change', function () {
      var v = name.value.trim();
      if (!v || v === s.name) { name.value = s.name; return; }
      var old = s.name;
      s.name = self.uniqueName(v);
      name.value = s.name;
      self.renameRefs(old, s.name);
      self.changed(true);
      self.render();
    });
    bar.appendChild(UI.el('span', 'flabel', SE.t('Ad')));
    bar.appendChild(name);
    this.playBtn = UI.el('button', 'btn small play-btn');
    this.playBtn.type = 'button';
    this.playBtn.addEventListener('click', function () { self.toggle(); });
    bar.appendChild(this.playBtn);
    m.appendChild(bar);

    if (s.type === 'music') {
      var tb = UI.el('div', 'cos-tools');
      var bpm = document.createElement('input');
      bpm.type = 'number';
      bpm.className = 'field';
      bpm.style.width = '70px';
      bpm.min = 40;
      bpm.max = 260;
      bpm.value = s.bpm;
      bpm.addEventListener('change', function () {
        s.bpm = U.clamp(Math.round(U.toNum(bpm.value)) || 120, 40, 260);
        bpm.value = s.bpm;
        self.restartIfPlaying();
        self.changed();
      });
      tb.appendChild(UI.el('span', 'flabel', SE.t('Tempo')));
      tb.appendChild(bpm);
      var steps = document.createElement('select');
      steps.className = 'field';
      [16, 32].forEach(function (n) {
        var o = document.createElement('option');
        o.value = n;
        o.textContent = SE.t('{n} adım', { n: n });
        steps.appendChild(o);
      });
      steps.value = s.steps;
      steps.addEventListener('change', function () {
        s.steps = +steps.value;
        self.restartIfPlaying();
        self.changed();
        self.renderMain();
      });
      tb.appendChild(steps);
      var wave = document.createElement('select');
      wave.className = 'field';
      SE.blocks.menuOptions('waves').forEach(function (w) {
        var o = document.createElement('option');
        o.value = w[1];
        o.textContent = SE.t('Ses: {w}', { w: w[0] });
        wave.appendChild(o);
      });
      wave.value = s.wave || 'square';
      wave.addEventListener('change', function () {
        s.wave = wave.value;
        self.restartIfPlaying();
        self.changed();
      });
      tb.appendChild(wave);
      var clr = UI.el('button', 'btn small', SE.t('Temizle'));
      clr.type = 'button';
      clr.addEventListener('click', function () {
        s.notes = [];
        s.drums = [];
        self.changed();
        self.drawGrid();
      });
      tb.appendChild(clr);
      tb.appendChild(UI.el('span', 'cos-size', SE.t('Hücreye tıkla: nota/davul ekle · Sürükle: boya')));
      m.appendChild(tb);
      var wrap = UI.el('div', 'seq-wrap');
      var cv = document.createElement('canvas');
      cv.className = 'seq-canvas';
      wrap.appendChild(cv);
      m.appendChild(wrap);
      this.grid = { cv: cv, wrap: wrap };
      this.bindGrid();
      this.drawGrid();
      if (!this._ro) {
        this._ro = new ResizeObserver(function () { if (self.grid) self.drawGrid(); });
        this._ro.observe(this.main);
      }
    } else {
      var box = UI.el('div', 'wave-wrap');
      var wc = document.createElement('canvas');
      wc.className = 'wave-canvas';
      box.appendChild(wc);
      box.appendChild(UI.el('div', 'cos-size', (s.dur ? SE.t('{n} saniye · ', { n: s.dur }) : '') + Math.round((s.src.length * 0.75) / 1024) + ' KB'));
      m.appendChild(box);
      this.drawWave(wc, s);
    }
    this.syncPlay();
  };

  P.drawWave = function (cv, s) {
    var self = this;
    var paint = function (peaks) {
      var r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      var W = Math.max(200, r.width), H = 160;
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.height = H + 'px';
      var g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#151927';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#d9549a';
      var n = peaks.length;
      for (var i = 0; i < W; i++) {
        var p = peaks[Math.floor((i / W) * n)] || 0;
        var h = Math.max(1, p * (H - 16));
        g.fillRect(i, H / 2 - h / 2, 1, h);
      }
    };
    var cached = peaksCache.get(s.src);
    if (cached) { requestAnimationFrame(function () { paint(cached); }); return; }
    SE.audio.decode(s.src).then(function (buf) {
      var d = buf.getChannelData(0), N = 600, step = Math.max(1, Math.floor(d.length / N)), peaks = [];
      for (var i = 0; i < N; i++) {
        var mx = 0;
        for (var j = i * step; j < Math.min(d.length, (i + 1) * step); j++) mx = Math.max(mx, Math.abs(d[j]));
        peaks.push(mx);
      }
      peaksCache.set(s.src, peaks);
      if (self.sound() === s) paint(peaks);
    }, function () {});
  };

  /* ---------- adım ızgarası ---------- */
  P.layout = function () {
    var s = this.sound(), w = this.grid.wrap.getBoundingClientRect().width || 600;
    var cw = Math.max(18, Math.floor((w - LABEL_W - 12) / s.steps));
    return { cw: Math.min(cw, 44), rows: NOTES.length + DRUMS.length };
  };
  P.cellAt = function (e) {
    var r = this.grid.cv.getBoundingClientRect(), L = this.layout();
    var x = e.clientX - r.left - LABEL_W, y = e.clientY - r.top;
    if (x < 0) return null;
    var step = Math.floor(x / L.cw), row = Math.floor(y / ROW_H);
    if (step < 0 || step >= this.sound().steps || row < 0 || row >= L.rows) return null;
    return { step: step, row: row };
  };
  P.isOn = function (s, c) {
    if (c.row < NOTES.length) {
      var m = NOTES[c.row];
      return s.notes.some(function (n) { return n[0] === c.step && n[1] === m; });
    }
    var k = DRUMS[c.row - NOTES.length][0];
    return s.drums.some(function (d) { return d[0] === c.step && d[1] === k; });
  };
  P.setCell = function (s, c, on) {
    if (c.row < NOTES.length) {
      var m = NOTES[c.row];
      s.notes = s.notes.filter(function (n) { return !(n[0] === c.step && n[1] === m); });
      if (on) s.notes.push([c.step, m]);
    } else {
      var k = DRUMS[c.row - NOTES.length][0];
      s.drums = s.drums.filter(function (d) { return !(d[0] === c.step && d[1] === k); });
      if (on) s.drums.push([c.step, k]);
    }
  };
  P.preview = function (s, c) {
    if (c.row < NOTES.length) SE.audio.note(NOTES[c.row], 0.18, s.wave);
    else SE.audio.drum(DRUMS[c.row - NOTES.length][0]);
  };
  P.bindGrid = function () {
    var self = this, cv = this.grid.cv;
    cv.addEventListener('pointerdown', function (e) {
      var s = self.sound(), c = self.cellAt(e);
      if (!s || !c) return;
      cv.setPointerCapture(e.pointerId);
      self.paint = !self.isOn(s, c);
      self.last = c.step + ':' + c.row;
      self.setCell(s, c, self.paint);
      if (self.paint) self.preview(s, c);
      self.drawGrid();
    });
    cv.addEventListener('pointermove', function (e) {
      if (self.paint == null) return;
      var s = self.sound(), c = self.cellAt(e);
      if (!s || !c || self.last === c.step + ':' + c.row) return;
      self.last = c.step + ':' + c.row;
      if (self.isOn(s, c) !== self.paint) {
        self.setCell(s, c, self.paint);
        if (self.paint) self.preview(s, c);
        self.drawGrid();
      }
    });
    var up = function () {
      if (self.paint == null) return;
      self.paint = null;
      self.changed();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  };
  P.drawGrid = function () {
    if (!this.grid) return;
    var s = this.sound(), cv = this.grid.cv, L = this.layout();
    var W = LABEL_W + L.cw * s.steps + 2, H = ROW_H * L.rows + 2, dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    var play = this.playStep;
    g.font = '800 11px Nunito, system-ui, sans-serif';
    g.textBaseline = 'middle';
    for (var row = 0; row < L.rows; row++) {
      var y = row * ROW_H, isDrum = row >= NOTES.length;
      var label = isDrum ? DRUMS[row - NOTES.length][1] : noteName(NOTES[row]);
      g.fillStyle = isDrum ? '#2a2333' : row % 2 ? '#1e2232' : '#232839';
      g.fillRect(0, y, W, ROW_H);
      g.fillStyle = isDrum ? '#f5b971' : NOTES[row] % 12 === 0 ? '#ffffff' : '#9aa1bd';
      g.fillText(label, 8, y + ROW_H / 2 + 1);
    }
    for (var st = 0; st < s.steps; st++) {
      var x = LABEL_W + st * L.cw;
      if (st % 4 === 0) {
        g.fillStyle = 'rgba(255,255,255,.035)';
        if ((st / 4) % 2 === 0) g.fillRect(x, 0, L.cw * 4, H);
      }
      if (play === st) {
        g.fillStyle = 'rgba(94,242,208,.16)';
        g.fillRect(x, 0, L.cw, H);
      }
      g.fillStyle = st % 4 === 0 ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.06)';
      g.fillRect(x, 0, 1, H);
    }
    g.fillStyle = 'rgba(255,255,255,.2)';
    g.fillRect(0, NOTES.length * ROW_H, W, 1);
    var cell = function (st, row, col) {
      var x = LABEL_W + st * L.cw + 2, y = row * ROW_H + 3;
      g.fillStyle = col;
      if (g.roundRect) { g.beginPath(); g.roundRect(x, y, L.cw - 4, ROW_H - 6, 4); g.fill(); }
      else g.fillRect(x, y, L.cw - 4, ROW_H - 6);
    };
    s.notes.forEach(function (n) {
      var row = NOTES.indexOf(n[1]);
      if (row < 0 || n[0] >= s.steps) return;
      cell(n[0], row, 'hsl(' + (300 - row * 17) + ',80%,' + (play === n[0] ? 78 : 64) + '%)');
    });
    s.drums.forEach(function (d) {
      var row = NOTES.length + DRUMS.map(function (x) { return x[0]; }).indexOf(d[1]);
      if (row < NOTES.length || d[0] >= s.steps) return;
      cell(d[0], row, play === d[0] ? '#ffd8a0' : '#f59e0b');
    });
  };

  /* ---------- çalma ---------- */
  P.toggle = function () {
    if (this.handle && !this.handle.done) {
      this.stop();
      return;
    }
    var s = this.sound();
    if (!s) return;
    SE.audio.unlock();
    this.handle = SE.audio.playAsset(s, s.type === 'music');
    this.syncPlay();
    if (s.type === 'music') this.tickPlayhead();
    else {
      var self = this, h = this.handle;
      var poll = function () {
        if (h !== self.handle) return;
        if (h.done) { self.syncPlay(); return; }
        requestAnimationFrame(poll);
      };
      poll();
    }
  };
  P.restartIfPlaying = function () {
    if (this.handle && !this.handle.done && this.sound() && this.sound().type === 'music') {
      this.stop();
      this.toggle();
    }
  };
  P.tickPlayhead = function () {
    var self = this, h = this.handle;
    var loop = function () {
      if (h !== self.handle || h.done) {
        self.playStep = null;
        self.drawGrid();
        return;
      }
      var t = SE.audio.now() - h.start;
      var st = t < 0 ? null : Math.floor(t / h.stepDur) % h.steps;
      if (st !== self.playStep) {
        self.playStep = st;
        self.drawGrid();
      }
      requestAnimationFrame(loop);
    };
    loop();
  };
  P.stop = function () {
    if (this.handle) this.handle.stop();
    this.handle = null;
    this.playStep = null;
    this.syncPlay();
    if (this.grid) this.drawGrid();
  };
  P.syncPlay = function () {
    if (!this.playBtn) return;
    var on = this.handle && !this.handle.done;
    this.playBtn.innerHTML = icon(on ? IC_STOP : IC_PLAY) + (on ? SE.t('Durdur') : SE.t('Çal'));
    this.playBtn.classList.toggle('on', !!on);
  };

  window.SoundEditor = SoundEditor;
})();
