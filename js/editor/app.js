/* Stackit — editör uygulaması */
(function () {
  var U = SE.util, B = SE.blocks;
  var STORE_KEY = 'stackit.project.v1';
  var $ = function (s) { return document.querySelector(s); };

  var App = (window.App = {
    project: null,
    targetId: null,
    tab: 'code',
    history: {},
    errorShown: false
  });

  /* ---------------- başlatma ---------------- */
  App.init = function () {
    var self = this;
    // dil: sabit HTML metinlerini çevir
    document.documentElement.lang = SE.lang;
    SE.i18n.translateDOM(document.body);
    this.engine = new SE.Engine($('#stage'), { editable: true });
    this.palette = new Palette(this, $('#cats'), $('#blocks'));
    this.ws = new Workspace(this, $('#ws'), $('#palette'));
    this.costumes = new CostumeEditor(this, $('#costume-pane'));
    this.sounds = new SoundEditor(this, $('#sound-pane'));
    this.mapEditor = new MapEditor(this, $('#map-pane'));
    this.touch = SE.touchControls($('#stage-wrap'), this.engine);
    this.touch.show(false);
    this.editLevel = 0;
    this.engine.placeHook = function (data, x, y) { self.setPlacement(data, { x: x, y: y }); };
    this.engine.on('level', function () { self.syncLevelUI(); });

    this.engine.on('select', function (id) { self.selectTarget(id); });
    this.engine.on('spriteDragging', function (d) { if (d.id === self.targetId) self.fillInspectorPos(d); });
    this.engine.on('spriteMoved', function () {
      self.dirty();
      if (self.tab === 'map') self.mapEditor.draw();
    });
    this.engine.on('state', function () { self.syncRunState(); });
    this.engine.on('error', function (err) {
      if (self.errorShown) return;
      self.errorShown = true;
      UI.toast(SE.t('Betik hatası: {err}', { err: err && err.message ? err.message : err }), 'err');
    });

    this.bindTopbar();
    this.bindStageBar();
    this.bindKeys();

    $('#tab-code').addEventListener('click', function () { self.setTab('code'); });
    $('#tab-costumes').addEventListener('click', function () { self.setTab('costumes'); });
    $('#tab-sounds').addEventListener('click', function () { self.setTab('sounds'); });
    $('#tab-map').addEventListener('click', function () { self.setTab('map'); });
    $('#level-select').addEventListener('change', function () { self.setEditLevel(+this.value); });

    Home.init(this);
    this.showView('loading');
    StackitStore.init()
      .then(function () { return self.migrateOld(); })
      .then(function () { self.route(); }, function (err) {
        console.error(err);
        self.route();
      });
    window.addEventListener('hashchange', function () { self.route(); });

    setInterval(function () { self.tick(); }, 120);
    // sayfa kapanırken / arka plana geçerken bekleyen kaydı hemen yaz
    window.addEventListener('beforeunload', function () { if (self._saveT) self.save(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden' && self._saveT) self.save();
    });
  };

  /* ---------------- görünümler ve proje sistemi ---------------- */
  App.showView = function (v) {
    this.view = v;
    document.body.classList.toggle('view-home', v === 'home');
    document.body.classList.toggle('view-editor', v === 'editor');
    document.body.classList.toggle('view-loading', v === 'loading');
    $('#home').hidden = v !== 'home';
    this.engine.suspended = v !== 'editor';
    if (v !== 'editor') UI.closeMenu();
  };
  /* adres: #/ = Projelerim, #/p/<id> = editör */
  App.route = function () {
    var m = /^#\/p\/([\w-]+)/.exec(location.hash);
    if (m) {
      if (m[1] !== this.projectId) this.openProject(m[1]);
      else this.showView('editor');
    } else this.showHome();
  };
  App.goProject = function (id) {
    location.hash = '#/p/' + id;
  };
  App.goHome = function () {
    if (location.hash && location.hash !== '#/') location.hash = '#/';
    else this.showHome();
  };
  App.showHome = function () {
    var self = this;
    var flush = this.projectId ? this.save({ thumb: true }) : Promise.resolve();
    return flush.then(function () {
      if (self.engine.running) self.engine.stop();
      self.sounds.stop();
      self.projectId = null;
      self.showView('home');
      document.title = 'Stackit Engine';
      return Home.render();
    });
  };
  App.openProject = function (id) {
    var self = this;
    var flush = this.projectId ? this.save({ thumb: true }) : Promise.resolve();
    return flush.then(function () {
      return Promise.all([StackitStore.get(id), StackitStore.getMeta(id)]);
    }).then(function (r) {
      if (!r[0]) {
        UI.toast(SE.t('Proje bulunamadı'), 'err');
        self.projectId = null;
        location.hash = '#/';
        return;
      }
      self.projectId = id;
      self.projectMeta = r[1] || { id: id, created: Date.now() };
      self.setTab('code');
      self.setProject(r[0]);
      self.showView('editor');
      StackitStore.setLast(id);
      document.title = self.project.name + ' — Stackit Engine';
      self.setSaveState('saved');
    }, function (err) {
      UI.toast(SE.t('Proje açılamadı: {err}', { err: err && err.message ? err.message : err }), 'err');
      location.hash = '#/';
    });
  };
  /* projeyi depoya yeni kayıt olarak ekle (açmadan) */
  App.storeNew = function (data, thumb) {
    var self = this, id = StackitStore.newId(), p = normalize(data), now = Date.now();
    var meta = { id: id, name: p.name, created: now, modified: now, sprites: p.sprites.length, levels: p.levels.length, thumb: thumb || '' };
    var t = thumb ? Promise.resolve(thumb) : this.makeThumb(p).catch(function () { return ''; });
    return t.then(function (src) {
      meta.thumb = src;
      return StackitStore.put(id, p, meta);
    }).then(function () { return id; });
  };
  App.createProject = function (data) {
    var self = this;
    return this.storeNew(data).then(function (id) {
      self.goProject(id);
      return id;
    });
  };
  App.importFile = function () {
    var self = this;
    UI.pickFile('.stackit,.json,application/json').then(function (file) {
      if (!file) return;
      var rd = new FileReader();
      rd.onload = function () {
        var p;
        try {
          p = JSON.parse(rd.result);
          if (!p || !p.stage || !Array.isArray(p.sprites)) throw new Error('format');
        } catch (err) {
          UI.toast(SE.t('Bu dosya bir Stackit projesi değil'), 'err');
          return;
        }
        p.name = p.name || file.name.replace(/\.[^.]+$/, '');
        self.createProject(p).then(function () { UI.toast(SE.t('Proje içe aktarıldı: {name}', { name: p.name })); });
      };
      rd.readAsText(file);
    });
  };
  /* eski sürümün tek projelik kaydını "Projelerim"e taşı */
  App.migrateOld = function () {
    var raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) { raw = null; }
    if (!raw) return Promise.resolve();
    var p;
    try { p = JSON.parse(raw); } catch (e) { return Promise.resolve(); }
    return this.storeNew(p).then(function (id) {
      StackitStore.setLast(id);
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* yoksay */ }
    }, function () {});
  };
  /* proje önizlemesi: görünmez bir motorla başlangıç karesini çiz */
  App.makeThumb = function (p) {
    var self = this;
    if (!this.thumbEngine) this.thumbEngine = new SE.Engine(document.createElement('canvas'), { headless: true });
    var job = function () {
      var e = self.thumbEngine;
      e.editLevel = 0;
      e.levelIndex = 0;
      e.load(p);
      var srcs = [];
      var add = function (c) { if (c && c.src) srcs.push(c.src); };
      add(e.stage.costumeData());
      e.actors.forEach(function (a) { add(a.costumeData()); });
      e.tileDefs.forEach(function (t) { add(t); });
      var t0 = Date.now();
      return new Promise(function (res) {
        (function wait() {
          var ok = srcs.every(function (s) { var im = SE.getImage(s); return !im || im.ready || im.failed; });
          if (ok || Date.now() - t0 > 2000) res();
          else setTimeout(wait, 30);
        })();
      }).then(function () {
        e.render();
        var W = 256, H = Math.round((W * e.H) / e.W);
        var c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        var g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(e.canvas, 0, 0, W, H);
        return c.toDataURL('image/jpeg', 0.82);
      });
    };
    this._thumbQ = (this._thumbQ || Promise.resolve()).then(job, job);
    return this._thumbQ;
  };

  /* ---------------- proje ---------------- */
  function normalize(p) {
    p = p || {};
    p.format = 'stackit-1';
    p.name = p.name || SE.t('Oyunum');
    p.messages = Array.isArray(p.messages) ? p.messages : [];
    var st = (p.stage = p.stage || {});
    st.id = 'stage';
    st.name = SE.t('Sahne');
    st.width = +st.width || 480;
    st.height = +st.height || 360;
    st.bgColor = st.bgColor || '#f4f6fb';
    if (st.gravity == null) st.gravity = 0.8;
    ['costumes', 'scripts', 'variables', 'lists', 'sounds'].forEach(function (k) { if (!Array.isArray(st[k])) st[k] = []; });
    st.touch = st.touch || 'auto';
    var ts = p.tileset;
    if (!ts || !Array.isArray(ts.costumes)) ts = p.tileset = StackitLib.tileset(32);
    ts.tileSize = +ts.tileSize || 32;
    ts.currentCostume = ts.currentCostume | 0;
    var maxId = 0;
    ts.costumes.forEach(function (t) { if (t.id != null) maxId = Math.max(maxId, +t.id || 0); });
    ts.costumes.forEach(function (t) {
      if (t.id == null) t.id = ++maxId;
      t.solid = t.solid || 'solid';
    });
    ts.nextId = Math.max(+ts.nextId || 0, maxId + 1);
    if (!Array.isArray(p.levels) || !p.levels.length) p.levels = [{ name: SE.t('Seviye 1') }];
    p.levels.forEach(function (lv, i) {
      lv.id = lv.id || U.uid('lvl');
      lv.name = lv.name || SE.t('Seviye {n}', { n: i + 1 });
      lv.cells = lv.cells && typeof lv.cells === 'object' ? lv.cells : {};
      lv.place = lv.place && typeof lv.place === 'object' ? lv.place : {};
      lv.bgColor = lv.bgColor || '';
      lv.backdrop = lv.backdrop || '';
    });
    p.sprites = Array.isArray(p.sprites) ? p.sprites : [];
    p.sprites.forEach(function (s) {
      s.id = s.id || U.uid('spr');
      s.name = s.name || SE.t('Karakter');
      ['costumes', 'scripts', 'variables', 'lists', 'sounds'].forEach(function (k) { if (!Array.isArray(s[k])) s[k] = []; });
      s.physics = s.physics || { body: 'none', gravityScale: 1, bounce: 0, friction: 0.2 };
      s.physics.solidDyn = !!s.physics.solidDyn;
      if (s.direction == null) s.direction = 90;
      if (s.size == null) s.size = 100;
      if (s.visible == null) s.visible = true;
      s.rotationStyle = s.rotationStyle || 'all';
    });
    return p;
  }
  App.normalize = normalize;

  App.setProject = function (p) {
    if (this.engine.running) this.engine.stop();
    this.project = normalize(p);
    this.history = {};
    this.ws.views = {};
    this.editLevel = 0;
    this.engine.editLevel = 0;
    this.engine.levelIndex = 0;
    this.engine.resetEditView();
    this.engine.load(this.project);
    this.mapEditor.reset();
    this.syncTouch();
    $('#project-name').value = this.project.name;
    this.applyStageSize();
    var first = this.project.sprites[this.project.sprites.length - 1];
    this.targetId = null;
    this.selectTarget(first ? first.id : 'stage');
    this.renderSprites();
    this.syncLevelUI();
    this.syncRunState();
    if (this.tab === 'map') this.mapEditor.show();
    if (this.tab === 'tiles') this.setTab('map');
  };

  App.currentTarget = function () {
    var p = this.project;
    if (this.targetId === 'stage') return p.stage;
    for (var i = 0; i < p.sprites.length; i++) if (p.sprites[i].id === this.targetId) return p.sprites[i];
    if (p.sprites[0]) {
      this.targetId = p.sprites[0].id;
      return p.sprites[0];
    }
    this.targetId = 'stage';
    return p.stage;
  };
  App.isStageTarget = function () { return this.currentTarget() === this.project.stage; };

  App.blockEnv = function (opts) {
    var self = this, t = this.currentTarget();
    return {
      project: this.project,
      target: t,
      isStage: t === this.project.stage,
      palette: !!(opts && opts.palette),
      onChange: function (kind) { self.changed(kind); }
    };
  };

  App.selectTarget = function (id) {
    var changed = id !== this.targetId;
    this.targetId = id;
    var t = this.currentTarget();
    this.engine.selectedId = t === this.project.stage ? null : t.id;
    if (changed) {
      this.palette.render();
      this.ws.render();
      if (this.tab === 'costumes') this.costumes.setTarget(t);
      if (this.tab === 'sounds') this.sounds.setTarget(t);
    }
    $('#tab-costumes').textContent = t === this.project.stage ? SE.t('Dekorlar') : SE.t('Kostümler');
    $('#target-name').textContent = t === this.project.stage ? SE.t('Sahne') : t.name;
    this.renderSprites();
    this.renderInspector();
  };

  App.setTab = function (tab) {
    if (this.tab === 'sounds' && tab !== 'sounds') this.sounds.stop();
    this.tab = tab;
    ['code', 'costumes', 'sounds', 'map'].forEach(function (k) {
      $('#tab-' + k).classList.toggle('on', k === tab || (k === 'map' && tab === 'tiles'));
    });
    $('#code-pane').hidden = tab !== 'code';
    $('#costume-pane').hidden = tab !== 'costumes' && tab !== 'tiles';
    $('#sound-pane').hidden = tab !== 'sounds';
    $('#map-pane').hidden = tab !== 'map';
    document.querySelector('.target-label').style.visibility = tab === 'map' || tab === 'tiles' ? 'hidden' : '';
    if (tab === 'costumes') this.costumes.setTarget(this.currentTarget());
    if (tab === 'tiles') this.costumes.setTarget(this.project.tileset, 'tile');
    if (tab === 'sounds') this.sounds.setTarget(this.currentTarget());
    if (tab === 'map') this.mapEditor.show();
  };

  /* ---------------- değişiklik / kayıt / geri al ---------------- */
  App.changed = function (kind) {
    if (kind === 'structure' || kind === 'vars') {
      if (this.engine.procCache) this.engine.procCache.clear();
      this.palette.render();
    }
    if (kind === 'vars' && !this.engine.running) this.engine.rebuild();
    this.dirty();
  };
  App.dirty = function () {
    var self = this;
    if (!this.projectId) return;
    this.setSaveState('dirty');
    clearTimeout(this._saveT);
    this._saveT = setTimeout(function () { self.save(); }, 700);
  };
  App.setSaveState = function (st) {
    var el = $('#save-state');
    var map = {
      dirty: ['•', SE.t('Kaydedilmemiş değişiklikler')],
      saving: ['…', SE.t('Kaydediliyor')],
      saved: ['✓', SE.t('Projelerim\'e kaydedildi')],
      error: ['!', SE.t('Kaydedilemedi — projeyi "İndir" ile dosyaya kaydet')]
    };
    el.textContent = map[st][0];
    el.title = map[st][1];
    el.dataset.state = st;
  };
  /* projeyi depoya yaz; önizleme resmi en fazla birkaç saniyede bir yenilenir */
  App.save = function (opts) {
    clearTimeout(this._saveT);
    this._saveT = null;
    if (!this.projectId || !this.project) return Promise.resolve(false);
    var self = this, id = this.projectId, p = this.project, old = this.projectMeta || {};
    var meta = {
      id: id, name: p.name, created: old.created || Date.now(), modified: Date.now(),
      sprites: p.sprites.length, levels: (p.levels || []).length, thumb: old.thumb || ''
    };
    this.projectMeta = meta;
    this.setSaveState('saving');
    var wantThumb = (opts && opts.thumb) || !meta.thumb || Date.now() - (this._thumbAt || 0) > 5000;
    var thumb = wantThumb ? this.makeThumb(p).catch(function () { return meta.thumb; }) : Promise.resolve(meta.thumb);
    return thumb.then(function (src) {
      if (wantThumb) self._thumbAt = Date.now();
      meta.thumb = src || meta.thumb;
      return StackitStore.put(id, p, meta);
    }).then(function () {
      if (self.projectId === id && !self._saveT) self.setSaveState('saved');
      return true;
    }, function (err) {
      self.setSaveState('error');
      UI.toast(SE.t('Kaydedilemedi: {err}', { err: err && err.message ? err.message : err }), 'err');
      return false;
    });
  };
  App.snapshot = function () {
    var t = this.currentTarget();
    var h = (this.history[t.id] = this.history[t.id] || { undo: [], redo: [] });
    h.undo.push(JSON.stringify(t.scripts));
    if (h.undo.length > 80) h.undo.shift();
    h.redo = [];
  };
  App.undo = function (redo) {
    var t = this.currentTarget(), h = this.history[t.id];
    if (!h) return;
    var from = redo ? h.redo : h.undo, to = redo ? h.undo : h.redo;
    if (!from.length) return;
    to.push(JSON.stringify(t.scripts));
    t.scripts = JSON.parse(from.pop());
    this.ws.render();
    this.changed('structure');
  };

  /* ---------------- çalıştırma ---------------- */
  App.start = function () {
    this.errorShown = false;
    this.engine.start();
    this.focusStage();
  };
  App.stop = function () {
    this.engine.stop();
  };
  App.focusStage = function () {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  };
  App.runScript = function (block) {
    var e = this.engine;
    if (!e.running) {
      this.errorShown = false;
      e.start({ hats: false });
    }
    var actor = e.originalOf(this.isStageTarget() ? 'stage' : this.targetId);
    if (!actor) return;
    e.toggleScript(actor, block);
  };
  App.evalReporter = function (block) {
    var e = this.engine;
    var actor = e.originalOf(this.isStageTarget() ? 'stage' : this.targetId) || e.stage;
    try {
      return e.evalReporter(block, { actor: actor, frames: [{}], warp: 0, done: false });
    } catch (err) {
      return '';
    }
  };
  App.syncRunState = function () {
    var e = this.engine;
    document.body.classList.toggle('is-running', e.running);
    $('#btn-play').classList.toggle('on', e.running && !e.paused);
    $('#btn-pause').classList.toggle('on', e.running && e.paused);
    $('#btn-pause').disabled = !e.running;
    $('#btn-stop').disabled = !e.running;
    $('#stage-mode').textContent = e.running ? (e.paused ? SE.t('DURAKLATILDI') : SE.t('OYNANIYOR')) : SE.t('DÜZENLEME');
    this.renderInspector();
    this.syncLevelUI();
    if (!e.running && this.touch) this.touch.releaseAll();
  };
  App.tick = function () {
    var e = this.engine;
    this.ws.updateRunning(e);
    $('#fps').textContent = e.running ? e.fps + ' fps' : '';
    if (e.running) {
      var t = this.currentTarget();
      if (t !== this.project.stage) {
        var a = e.originalOf(t.id);
        if (a) this.fillInspectorPos({ x: a.x, y: a.y, direction: a.dir, size: a.size });
      }
    }
  };

  /* ---------------- karakter listesi ---------------- */
  App.renderSprites = function () {
    var self = this, host = $('#sprite-list'), p = this.project;
    host.innerHTML = '';
    p.sprites.forEach(function (s) {
      var tile = UI.el('button', 'sprite-tile' + (s.id === self.targetId ? ' on' : ''));
      tile.type = 'button';
      var c = s.costumes[s.currentCostume | 0] || s.costumes[0];
      var th = UI.el('span', 'st-thumb');
      if (c) {
        var img = document.createElement('img');
        img.src = c.src;
        img.alt = '';
        if (!c.smooth) img.style.imageRendering = 'pixelated';
        th.appendChild(img);
      }
      tile.appendChild(th);
      tile.appendChild(UI.el('span', 'st-name', s.name));
      if (s.physics && s.physics.body !== 'none') tile.appendChild(UI.el('span', 'st-badge', s.physics.body === 'dynamic' ? 'D' : SE.lang === 'tr' ? 'K' : 'S'));
      tile.title = s.name;
      tile.addEventListener('click', function () { self.selectTarget(s.id); });
      tile.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        UI.menu(e.clientX, e.clientY, [
          { label: SE.t('Çoğalt'), value: 'dup' },
          { label: SE.t('Sil'), value: 'del', danger: true }
        ], function (v) {
          if (v === 'dup') self.duplicateSprite(s.id);
          else self.deleteSprite(s.id);
        });
      });
      host.appendChild(tile);
    });
    var add = UI.el('button', 'sprite-tile add', '+');
    add.type = 'button';
    add.title = SE.t('Karakter ekle');
    add.addEventListener('click', function (e) {
      var items = [{ label: SE.t('✏️ Boş piksel karakter'), value: '_blank' }, { label: SE.t('⤒ Resim yükle…'), value: '_upload' }, { sep: true }]
        .concat(StackitLib.items.map(function (it) { return { label: it.name, value: it.id }; }));
      var r = add.getBoundingClientRect();
      UI.menu(r.left, r.top - 8, items, function (v) { self.addSprite(v); });
    });
    host.appendChild(add);

    var st = $('#stage-tile');
    st.classList.toggle('on', this.targetId === 'stage');
    var bd = p.stage.costumes[p.stage.currentCostume | 0];
    var sth = st.querySelector('.st-thumb');
    sth.innerHTML = '';
    sth.style.background = p.stage.bgColor;
    if (bd) {
      var bi = document.createElement('img');
      bi.src = bd.src;
      bi.alt = '';
      bi.style.imageRendering = bd.smooth ? '' : 'pixelated';
      sth.appendChild(bi);
    }
  };

  App.uniqueSpriteName = function (base) {
    var names = this.project.sprites.map(function (s) { return s.name; });
    var root = base.replace(/\d+$/, ''), n = 2, name = base;
    while (names.indexOf(name) >= 0) name = root + n++;
    return name;
  };

  App.addSprite = function (kind) {
    var self = this, costumes, name;
    if (kind === '_upload') {
      UI.pickFile('image/*').then(function (file) {
        if (!file) return;
        var s = StackitExamples.newSprite(self.uniqueSpriteName(file.name.replace(/\.[^.]+$/, '').slice(0, 20) || SE.t('Resim')), []);
        self.project.sprites.push(s);
        self.selectTarget(s.id);
        self.costumes.setTarget(s);
        self.costumes.importImage(file);
      });
      return;
    }
    if (kind === '_blank') {
      costumes = [StackitLib.blank(16, 16, SE.t('kostüm1'))];
      name = SE.t('Karakter');
    } else {
      costumes = StackitLib.make(kind);
      var it = StackitLib.items.filter(function (i) { return i.id === kind; })[0];
      name = it ? it.name : SE.t('Karakter');
    }
    var s = StackitExamples.newSprite(this.uniqueSpriteName(name), costumes);
    var cam = this.engine.editCam;
    s.x = Math.round(cam.x + U.rand(-80, 80));
    s.y = Math.round(cam.y + U.rand(-50, 50));
    if (kind === 'robo' || kind === 'slime') s.rotationStyle = 'lr';
    if (kind === 'ground' || kind === 'platform') s.physics.body = 'static';
    this.project.sprites.push(s);
    this.engine.rebuild();
    this.selectTarget(s.id);
    if (kind === '_blank') this.setTab('costumes');
    this.dirty();
  };

  App.duplicateSprite = function (id) {
    var src = this.project.sprites.filter(function (s) { return s.id === id; })[0];
    if (!src) return;
    var s = U.clone(src);
    s.id = U.uid('spr');
    s.name = this.uniqueSpriteName(src.name);
    s.x += 30;
    s.y -= 20;
    var map = {};
    s.variables.concat(s.lists).forEach(function (v) {
      var nid = U.uid('v');
      map[v.id] = nid;
      v.id = nid;
    });
    s.scripts.forEach(function (sc) {
      B.walk(sc.block, function (b) {
        ['VAR', 'LIST'].forEach(function (k) {
          if (b.inputs && b.inputs[k] && map[b.inputs[k].value]) b.inputs[k].value = map[b.inputs[k].value];
        });
      });
    });
    this.project.sprites.push(s);
    this.engine.rebuild();
    this.selectTarget(s.id);
    this.dirty();
  };

  App.deleteSprite = function (id) {
    var self = this, s = this.project.sprites.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    UI.confirm(SE.t('"{name}" silinsin mi? (betikleri ve kostümleriyle birlikte)', { name: s.name }), SE.t('Sil')).then(function (ok) {
      if (!ok) return;
      if (self.engine.running) self.engine.stop();
      self.project.sprites = self.project.sprites.filter(function (x) { return x.id !== id; });
      self.engine.rebuild();
      var last = self.project.sprites[self.project.sprites.length - 1];
      self.targetId = null;
      self.selectTarget(last ? last.id : 'stage');
      self.dirty();
    });
  };

  /* ---------------- denetçi (inspector) ---------------- */
  function field(label, input, cls) {
    var w = UI.el('label', 'insp-f' + (cls ? ' ' + cls : ''));
    w.appendChild(UI.el('span', 'flabel', label));
    w.appendChild(input);
    return w;
  }
  function numInput(value, step, onChange) {
    var i = document.createElement('input');
    i.type = 'number';
    i.className = 'field';
    i.value = value;
    i.step = step || 1;
    i.addEventListener('change', function () { onChange(U.toNum(i.value)); });
    return i;
  }
  function selectInput(options, value, onChange) {
    var s = document.createElement('select');
    s.className = 'field';
    options.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o[1];
      op.textContent = o[0];
      s.appendChild(op);
    });
    s.value = value;
    s.addEventListener('change', function () { onChange(s.value); });
    return s;
  }

  App.renderInspector = function () {
    var self = this, host = $('#inspector'), t = this.currentTarget(), e = this.engine;
    host.innerHTML = '';
    this.insp = {};
    var fs = document.createElement('fieldset');
    fs.disabled = e.running;
    host.appendChild(fs);
    var commit = function (rebuild) {
      if (rebuild !== false && !e.running) e.rebuild();
      self.dirty();
    };

    if (t === this.project.stage) {
      var row = UI.el('div', 'insp-row');
      var col = document.createElement('input');
      col.type = 'color';
      col.className = 'field color';
      col.value = /^#[0-9a-f]{6}$/i.test(t.bgColor) ? t.bgColor : '#ffffff';
      col.addEventListener('input', function () {
        t.bgColor = col.value;
        e.bgColor = col.value;
        self.renderSprites();
        self.dirty();
      });
      row.appendChild(field(SE.t('Arka plan'), col));
      row.appendChild(field(SE.t('Yerçekimi'), numInput(t.gravity, 0.1, function (v) { t.gravity = v; commit(); })));
      var sizes = [['480×360 (4:3)', '480x360'], ['640×360 (16:9)', '640x360'], ['640×480', '640x480'], ['800×450', '800x450'], ['960×540', '960x540']];
      row.appendChild(field(SE.t('Sahne boyutu'), selectInput(sizes, t.width + 'x' + t.height, function (v) {
        var wh = v.split('x');
        t.width = +wh[0];
        t.height = +wh[1];
        self.applyStageSize();
        commit();
      })));
      row.appendChild(field(SE.t('Dokunmatik tuşlar'), selectInput([[SE.t('otomatik (telefonda)'), 'auto'], [SE.t('her zaman (önizle)'), 'on'], [SE.t('kapalı'), 'off']], t.touch || 'auto', function (v) {
        t.touch = v;
        self.syncTouch();
        self.dirty();
      })));
      fs.appendChild(row);
      fs.appendChild(UI.el('div', 'insp-note', SE.t('Sahne betikleri tüm oyunu yönetir: skor, seviye, müzik… Dekor çizmek için "Dekorlar" sekmesi.')));
      return;
    }

    var r1 = UI.el('div', 'insp-row');
    var name = document.createElement('input');
    name.className = 'field';
    name.value = t.name;
    name.spellcheck = false;
    name.addEventListener('change', function () {
      var v = name.value.trim();
      if (!v) { name.value = t.name; return; }
      t.name = v === t.name ? v : self.uniqueSpriteName(v);
      name.value = t.name;
      $('#target-name').textContent = t.name;
      self.renderSprites();
      self.palette.render();
      self.ws.render();
      commit();
    });
    r1.appendChild(field(SE.t('Ad'), name, 'wide'));
    var pl = this.getPlacement(t);
    this.insp.x = numInput(Math.round(pl.x), 1, function (v) { self.setPlacement(t, { x: v }); commit(); });
    this.insp.y = numInput(Math.round(pl.y), 1, function (v) { self.setPlacement(t, { y: v }); commit(); });
    r1.appendChild(field('x', this.insp.x, 'xs'));
    r1.appendChild(field('y', this.insp.y, 'xs'));
    fs.appendChild(r1);

    var r2 = UI.el('div', 'insp-row');
    this.insp.direction = numInput(t.direction, 15, function (v) { t.direction = U.wrapDir(v); commit(); });
    this.insp.size = numInput(t.size, 10, function (v) { t.size = U.clamp(v, 1, 5000); commit(); });
    r2.appendChild(field(SE.t('Yön'), this.insp.direction, 'xs'));
    r2.appendChild(field(SE.t('Boyut %'), this.insp.size, 'xs'));
    r2.appendChild(field(SE.t('Dönüş'), selectInput(B.menuOptions('rotstyle'), t.rotationStyle, function (v) { t.rotationStyle = v; commit(); })));
    var vis = document.createElement('input');
    vis.type = 'checkbox';
    vis.checked = pl.visible;
    vis.addEventListener('change', function () { self.setPlacement(t, { visible: vis.checked }); commit(); });
    r2.appendChild(field(SE.t('Görünür'), vis, 'check'));
    fs.appendChild(r2);
    if (this.project.levels.length > 1) {
      var lvNote = UI.el('div', 'insp-note lvl-note');
      var lvName = this.project.levels[this.editLevel].name;
      lvNote.appendChild(document.createTextNode(pl.override
        ? SE.t('x, y ve görünürlük yalnızca "{level}" için ayarlı. ', { level: lvName })
        : SE.t('Konum tüm seviyelerde aynı. Sahnede sürüklersen yalnızca "{level}" için değişir. ', { level: lvName })));
      if (pl.override) {
        var rs = UI.el('button', 'linkbtn', SE.t('Varsayılana dön'));
        rs.type = 'button';
        rs.addEventListener('click', function () { self.resetPlacement(t); });
        lvNote.appendChild(rs);
      }
      fs.appendChild(lvNote);
    }

    var ph = t.physics;
    var r3 = UI.el('div', 'insp-row phys');
    r3.appendChild(UI.el('span', 'insp-tag', SE.t('Fizik')));
    r3.appendChild(field(SE.t('Gövde'), selectInput([[SE.t('yok'), 'none'], [SE.t('dinamik (düşer, çarpar)'), 'dynamic'], [SE.t('katı (zemin/duvar)'), 'static']], ph.body, function (v) {
      ph.body = v;
      self.renderSprites();
      self.renderInspector();
      commit();
    })));
    if (ph.body === 'dynamic') {
      r3.appendChild(field(SE.t('Yerçekimi ×'), numInput(ph.gravityScale, 0.1, function (v) { ph.gravityScale = v; commit(); }), 'xs'));
      r3.appendChild(field(SE.t('Sekme'), numInput(ph.bounce, 0.1, function (v) { ph.bounce = U.clamp(v, 0, 1.2); commit(); }), 'xs'));
      r3.appendChild(field(SE.t('Sürtünme'), numInput(ph.friction, 0.05, function (v) { ph.friction = U.clamp(v, 0, 1); commit(); }), 'xs'));
      var sd = document.createElement('input');
      sd.type = 'checkbox';
      sd.checked = !!ph.solidDyn;
      sd.title = SE.t('Açıksa diğer "çarpışan" dinamik karakterlerin içinden geçmez, üstlerinde durabilir');
      sd.addEventListener('change', function () { ph.solidDyn = sd.checked; commit(); });
      r3.appendChild(field(SE.t('Dinamiklerle çarpış'), sd, 'check'));
    }
    fs.appendChild(r3);
  };
  App.fillInspectorPos = function (d) {
    var i = this.insp || {};
    var set = function (el, v) { if (el && document.activeElement !== el) el.value = Math.round(v * 10) / 10; };
    set(i.x, d.x);
    set(i.y, d.y);
    if (d.direction != null) set(i.direction, d.direction);
    if (d.size != null) set(i.size, d.size);
  };

  App.applyStageSize = function () {
    var st = this.project.stage;
    document.documentElement.style.setProperty('--sw', st.width);
    document.documentElement.style.setProperty('--sh', st.height);
    this.engine.penCanvas = null;
  };

  App.costumeChanged = function (structural) {
    if (!this.engine.running) this.engine.rebuild();
    if (this.tab === 'tiles') {
      if (structural) this.palette.render();
      this.dirty();
      return;
    }
    this.renderSprites();
    if (structural) this.palette.render();
    this.dirty();
  };

  /* ---------------- karo haritası ---------------- */
  App.mapChanged = function (rebind) {
    if (rebind && !this.engine.running) this.engine.rebuild();
    this.dirty();
  };
  App.editTiles = function (index) {
    var ts = this.project.tileset;
    if (index >= 0 && index < ts.costumes.length) ts.currentCostume = index;
    this.setTab('tiles');
  };
  App.costumeRemoved = function (c, mode) {
    if (mode !== 'tile') return;
    this.removeTileCells(c.id);
  };
  App.removeTileCells = function (id) {
    this.project.levels.forEach(function (lv) {
      Object.keys(lv.cells).forEach(function (k) { if (String(lv.cells[k]) === String(id)) delete lv.cells[k]; });
    });
    this.mapChanged(true);
  };
  App.deleteTile = function (id) {
    var self = this, ts = this.project.tileset;
    var t = ts.costumes.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!t) return;
    var used = 0;
    this.project.levels.forEach(function (lv) {
      Object.keys(lv.cells).forEach(function (k) { if (String(lv.cells[k]) === String(id)) used++; });
    });
    UI.confirm(SE.t('"{name}" karosu silinsin mi?', { name: t.name }) + (used ? ' ' + SE.t('Haritalarda {n} yerde kullanılıyor; onlar da silinecek.', { n: used }) : ''), SE.t('Sil')).then(function (ok) {
      if (!ok) return;
      ts.costumes.splice(ts.costumes.indexOf(t), 1);
      ts.currentCostume = Math.min(ts.currentCostume, Math.max(0, ts.costumes.length - 1));
      self.removeTileCells(id);
      self.mapEditor.sel = ts.costumes[0] ? ts.costumes[0].id : null;
      self.mapEditor.render();
      self.palette.render();
    });
  };

  /* ---------------- seviyeler ---------------- */
  App.setEditLevel = function (i) {
    var n = this.project.levels.length;
    i = U.clamp(i | 0, 0, n - 1);
    if (this.engine.running) this.engine.stop();
    this.editLevel = i;
    this.engine.editLevel = i;
    this.engine.levelIndex = i;
    this.engine.rebuild();
    this.syncLevelUI();
    this.renderInspector();
    if (this.tab === 'map') this.mapEditor.render();
  };
  App.syncLevelUI = function () {
    var sel = $('#level-select'), e = this.engine, lvs = this.project.levels;
    sel.innerHTML = '';
    lvs.forEach(function (lv, i) {
      var o = document.createElement('option');
      o.value = i;
      o.textContent = (i + 1) + '. ' + lv.name;
      sel.appendChild(o);
    });
    sel.value = e.running ? e.levelIndex : this.editLevel;
    sel.disabled = e.running;
    sel.style.display = lvs.length > 1 || this.tab === 'map' ? '' : 'none';
    if (this.tab === 'map') this.mapEditor.renderLevels();
  };
  App.defaultGround = function () {
    var ts = this.project.tileset.costumes.filter(function (t) { return (t.solid || 'solid') === 'solid'; });
    var cells = {};
    if (!ts.length) return cells;
    var top = ts[0].id, under = (ts[1] || ts[0]).id;
    for (var x = -9; x <= 9; x++) {
      cells[x + ',-5'] = top;
      cells[x + ',-6'] = under;
    }
    return cells;
  };
  App.addLevel = function (copyFrom) {
    var lvs = this.project.levels, lv;
    if (copyFrom != null) {
      lv = U.clone(lvs[copyFrom]);
      lv.id = U.uid('lvl');
      lv.name = lvs[copyFrom].name + ' ' + SE.t('kopya');
    } else {
      lv = { id: U.uid('lvl'), name: SE.t('Seviye {n}', { n: lvs.length + 1 }), cells: this.defaultGround(), place: {}, bgColor: '', backdrop: '' };
    }
    lvs.splice(copyFrom != null ? copyFrom + 1 : lvs.length, 0, lv);
    this.setEditLevel(lvs.indexOf(lv));
    this.palette.render();
    this.dirty();
    UI.toast(SE.t('{name} eklendi — Harita sekmesinde çiz', { name: lv.name }));
  };
  App.renameLevel = function (i) {
    var self = this, lv = this.project.levels[i];
    UI.prompt(SE.t('Seviyeyi yeniden adlandır'), SE.t('Ad'), lv.name).then(function (n) {
      if (!n) return;
      lv.name = n;
      self.syncLevelUI();
      self.palette.render();
      self.dirty();
    });
  };
  App.moveLevel = function (i, j) {
    var lvs = this.project.levels;
    lvs.splice(j, 0, lvs.splice(i, 1)[0]);
    this.setEditLevel(j);
    this.palette.render();
    this.dirty();
  };
  App.deleteLevel = function (i) {
    var self = this, lvs = this.project.levels;
    if (lvs.length < 2) return;
    UI.confirm(SE.t('"{name}" silinsin mi? (haritası ve karakter konumlarıyla)', { name: lvs[i].name }), SE.t('Sil')).then(function (ok) {
      if (!ok) return;
      lvs.splice(i, 1);
      self.setEditLevel(Math.min(self.editLevel, lvs.length - 1));
      self.palette.render();
      self.dirty();
    });
  };
  /* karakterin düzenlenen seviyedeki başlangıç konumu */
  App.getPlacement = function (s) {
    var lv = this.project.levels[this.editLevel], pl = lv && lv.place ? lv.place[s.id] : null;
    return {
      x: pl && pl.x != null ? pl.x : s.x,
      y: pl && pl.y != null ? pl.y : s.y,
      visible: pl && pl.visible != null ? pl.visible : s.visible !== false,
      override: !!pl
    };
  };
  App.setPlacement = function (s, patch) {
    var lv = this.project.levels[this.editLevel];
    var pl = lv && lv.place ? lv.place[s.id] : null;
    if (!pl && this.editLevel === 0) {
      Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
      return;
    }
    var cur = this.getPlacement(s);
    pl = pl || { x: cur.x, y: cur.y, visible: cur.visible };
    Object.assign(pl, patch);
    lv.place[s.id] = pl;
  };
  App.resetPlacement = function (s) {
    var lv = this.project.levels[this.editLevel];
    if (lv && lv.place) delete lv.place[s.id];
    if (!this.engine.running) this.engine.rebuild();
    this.renderInspector();
    this.dirty();
  };
  App.syncTouch = function () {
    this.touch.show(this.project.stage.touch === 'on');
  };

  /* ---------------- değişkenler ---------------- */
  App.createVariable = function (isList) {
    var self = this, isStage = this.isStageTarget();
    var fields = [{ key: 'name', label: isList ? SE.t('Liste adı') : SE.t('Değişken adı'), value: '' }];
    if (!isStage) fields.push({ key: 'scope', type: 'radio', options: [[SE.t('Tüm karakterler için'), 'global'], [SE.t('Sadece bu karakter için'), 'local']], value: 'global' });
    UI.form(isList ? SE.t('Yeni liste') : SE.t('Yeni değişken'), fields, SE.t('Oluştur')).then(function (r) {
      if (!r) return;
      var name = String(r.name || '').trim();
      if (!name) return;
      var owner = r.scope === 'local' ? self.currentTarget() : self.project.stage;
      var key = isList ? 'lists' : 'variables';
      var clash = (self.project.stage[key] || []).concat(owner[key] || []).some(function (v) { return v.name === name; });
      if (clash) { UI.toast(SE.t(isList ? '"{name}" adında bir liste zaten var' : '"{name}" adında bir değişken zaten var', { name: name }), 'err'); return; }
      var v = isList ? { id: U.uid('l'), name: name, items: [] } : { id: U.uid('v'), name: name, value: 0 };
      owner[key].push(v);
      self.changed('vars');
      UI.toast(SE.t(isList ? 'Liste oluşturuldu: {name}' : 'Değişken oluşturuldu: {name}', { name: name }));
    });
  };
  App.findVar = function (id, isList) {
    var key = isList ? 'lists' : 'variables', p = this.project;
    var owners = [p.stage].concat(p.sprites);
    for (var i = 0; i < owners.length; i++) {
      var arr = owners[i][key] || [];
      for (var j = 0; j < arr.length; j++) if (arr[j].id === id) return { v: arr[j], owner: owners[i], arr: arr };
    }
    return null;
  };
  App.renameVariable = function (id, isList) {
    var self = this, f = this.findVar(id, isList);
    if (!f) return;
    UI.prompt(SE.t('Yeniden adlandır'), SE.t('Yeni ad'), f.v.name).then(function (name) {
      if (!name) return;
      f.v.name = name;
      self.ws.render();
      self.changed('vars');
    });
  };
  App.deleteVariable = function (id, isList) {
    var self = this, f = this.findVar(id, isList);
    if (!f) return;
    UI.confirm(SE.t('"{name}" silinsin mi? Onu kullanan bloklar "?" gösterecek.', { name: f.v.name }), SE.t('Sil')).then(function (ok) {
      if (!ok) return;
      f.arr.splice(f.arr.indexOf(f.v), 1);
      self.ws.render();
      self.changed('vars');
    });
  };
  App.setMonitor = function (v, on) {
    v.monitor = on;
    if (on) this.engine.monitors.add(v.id);
    else this.engine.monitors.delete(v.id);
    this.dirty();
  };
  App.ensureMessage = function (name) {
    var m = (this.project.messages = this.project.messages || []);
    if (name && m.indexOf(name) < 0) m.push(name);
  };

  /* ---------------- fonksiyonlar ---------------- */
  function procDefs(t) {
    return (t.scripts || []).map(function (s) { return s.block; }).filter(function (b) { return b && b.op === 'proc_def'; });
  }
  function parseParams(s) {
    return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 8);
  }
  App.createProc = function () {
    var self = this, t = this.currentTarget();
    UI.form(SE.t('Yeni fonksiyon (kendi bloğun)'), [
      { key: 'name', label: SE.t('Blok adı'), value: '', placeholder: SE.t('örn. patla') },
      { key: 'params', label: SE.t('Parametreler (virgülle)'), value: '', placeholder: SE.t('örn. güç, renk') },
      { key: 'warp', type: 'check', label: SE.t('Ekranı yenilemeden çalıştır (çok hızlı)'), value: false }
    ], SE.t('Oluştur')).then(function (r) {
      if (!r) return;
      var name = String(r.name || '').trim();
      if (!name) return;
      if (procDefs(t).some(function (d) { return d.proc === name; })) { UI.toast(SE.t('Bu adda bir fonksiyon zaten var'), 'err'); return; }
      self.snapshot();
      self.ws.addScriptVisible({ op: 'proc_def', proc: name, params: parseParams(r.params), warp: !!r.warp, inputs: {}, next: null });
      self.changed('structure');
    });
  };
  App.editProc = function (def) {
    var self = this, t = this.currentTarget();
    UI.form(SE.t('Fonksiyonu düzenle'), [
      { key: 'name', label: SE.t('Blok adı'), value: def.proc },
      { key: 'params', label: SE.t('Parametreler (virgülle)'), value: (def.params || []).join(', ') },
      { key: 'warp', type: 'check', label: SE.t('Ekranı yenilemeden çalıştır (çok hızlı)'), value: !!def.warp }
    ], SE.t('Kaydet')).then(function (r) {
      if (!r) return;
      var name = String(r.name || '').trim() || def.proc;
      var oldName = def.proc, oldParams = def.params || [], params = parseParams(r.params);
      self.snapshot();
      def.proc = name;
      def.params = params;
      def.warp = !!r.warp;
      B.walk(def.next, function (b) {
        if (b.op === 'proc_arg') {
          var i = oldParams.indexOf(b.arg);
          if (i >= 0 && params[i]) b.arg = params[i];
        }
      });
      t.scripts.forEach(function (s) {
        B.walk(s.block, function (b) {
          if (b.op !== 'proc_call' || b.proc !== oldName) return;
          var ins = {};
          params.forEach(function (p, i) { ins['P' + i] = b.inputs['P' + i] || { value: '' }; });
          b.proc = name;
          b.params = params.slice();
          b.inputs = ins;
        });
      });
      self.ws.render();
      self.changed('structure');
    });
  };

  /* ---------------- üst çubuk ---------------- */
  App.bindTopbar = function () {
    var self = this;
    $('#project-name').addEventListener('change', function () {
      self.project.name = this.value.trim() || SE.t('Oyunum');
      this.value = self.project.name;
      document.title = self.project.name + ' — Stackit Engine';
      self.dirty();
    });
    $('#btn-home').addEventListener('click', function () { self.goHome(); });
    $('#topbar .brand').addEventListener('click', function () { self.goHome(); });
    $('#btn-new').addEventListener('click', function () { Home.newProjectDialog(); });
    $('#btn-open').addEventListener('click', function () { self.importFile(); });
    $('#btn-download').addEventListener('click', function () {
      UI.download(self.fileBase() + '.stackit', JSON.stringify(self.project), 'application/json');
      self.save();
    });
    $('#btn-export').addEventListener('click', function () { self.exportHTML(); });
  };
  App.fileBaseOf = function (name) {
    return (name || SE.t('oyun')).replace(/[^\wçğıöşüÇĞİÖŞÜ\- ]+/g, '').trim().replace(/\s+/g, '-') || SE.t('oyun');
  };
  App.fileBase = function () { return this.fileBaseOf(this.project.name); };

  App.exportHTML = function () {
    var mods = SE.modules.map(function (m) {
      return 'SE.module(' + JSON.stringify(m.name) + ', ' + m.fn.toString() + ');';
    }).join('\n').replace(/<\/script/gi, '<\\/script');
    var proj = JSON.stringify(this.project).replace(/</g, '\\u003c');
    var title = String(this.project.name || SE.t('Oyun')).replace(/[<>&"]/g, '');
    var html = '<!doctype html>\n<html lang="' + SE.lang + '">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>' + title + '</title>\n' +
      '<style>html,body{margin:0;height:100%;background:#0d0f1a;display:flex;align-items:center;justify-content:center;overflow:hidden}#game{max-height:100vh}</style>\n</head>\n<body>\n<div id="game"></div>\n' +
      '<script>\n/* ' + SE.t('{title} — Stackit Engine {v} ile yapıldı', { title: title, v: SE.VERSION }) + ' */\nwindow.SE={modules:[],module:function(n,f){this.modules.push({name:n,fn:f});f(this);}};\n' + mods +
      '\nSE.createPlayer(document.getElementById("game"),' + proj + ');\n<\/script>\n</body>\n</html>\n';
    UI.download(this.fileBase() + '.html', html, 'text/html');
    UI.toast(SE.t('Oyun tek bir HTML dosyası olarak indirildi — her tarayıcıda açılır!'));
  };

  /* ---------------- sahne çubuğu ---------------- */
  App.bindStageBar = function () {
    var self = this, e = this.engine;
    $('#btn-play').addEventListener('click', function () {
      if (e.running && e.paused) e.setPaused(false);
      else self.start();
    });
    $('#btn-pause').addEventListener('click', function () { if (e.running) e.setPaused(!e.paused); });
    $('#btn-stop').addEventListener('click', function () { self.stop(); });
    $('#btn-view').addEventListener('click', function () { e.resetEditView(); });
    $('#btn-size').addEventListener('click', function () {
      document.body.classList.toggle('stage-small');
      self.ws.applyView();
    });
    $('#btn-full').addEventListener('click', function () {
      var w = $('#stage-wrap');
      if (document.fullscreenElement) document.exitFullscreen();
      else if (w.requestFullscreen) w.requestFullscreen();
    });
    $('#stage-tile').addEventListener('click', function () { self.selectTarget('stage'); });
  };

  App.bindKeys = function () {
    var self = this;
    window.addEventListener('keyup', function (e) {
      if (e.key === ' ' && self.tab === 'map') self.mapEditor.spaceDown = false;
    });
    window.addEventListener('keydown', function (e) {
      var t = e.target;
      var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      var mod = e.ctrlKey || e.metaKey;
      if (self.view !== 'editor') return;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        self.save({ thumb: true }).then(function (ok) { if (ok) UI.toast(SE.t('Kaydedildi')); });
        return;
      }
      if (typing) return;
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        if (self.engine.running) self.stop();
        else self.start();
        return;
      }
      if (self.engine.running && !self.engine.paused) return;
      if (self.tab === 'costumes' || self.tab === 'tiles') {
        if (self.costumes.onKey(e)) return;
      } else if (self.tab === 'map') {
        if (self.mapEditor.onKey(e)) return;
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        self.undo(e.shiftKey);
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        self.undo(true);
      }
    });
  };

  document.addEventListener('DOMContentLoaded', function () { App.init(); });
})();
