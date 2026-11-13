/* Stackit Engine — 2D motor
 * Sabit 60 Hz simülasyon adımı, kamera, fizik (yerçekimi + AABB çözümleme),
 * piksel hassasiyetinde çarpışma, klonlar, parçacıklar, kalem katmanı. */
SE.module('engine', function (SE) {
  var U = SE.util;
  var STEP = 1000 / 60;
  var EPS = 0.01;
  var MAX_CLONES = 300;
  var HAS_FILTER = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;

  /* ---------------- Görsel önbelleği + çarpışma maskeleri ---------------- */
  var cache = new Map();

  function buildMask(e) {
    try {
      var c = document.createElement('canvas');
      c.width = e.w;
      c.height = e.h;
      var g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(e.img, 0, 0);
      var d = g.getImageData(0, 0, e.w, e.h).data;
      var m = new Uint8Array(e.w * e.h);
      var x0 = e.w, y0 = e.h, x1 = -1, y1 = -1;
      for (var y = 0; y < e.h; y++) {
        for (var x = 0; x < e.w; x++) {
          if (d[(y * e.w + x) * 4 + 3] > 24) {
            m[y * e.w + x] = 1;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      e.mask = m;
      e.trim = x1 >= 0 ? { x0: x0, y0: y0, x1: x1 + 1, y1: y1 + 1 } : null;
    } catch (err) {
      e.mask = null;
      e.trim = null;
    }
  }

  SE.getImage = function (src) {
    if (!src) return null;
    var e = cache.get(src);
    if (e) return e;
    e = { img: new Image(), ready: false, w: 0, h: 0, mask: null, trim: null };
    e.img.onload = function () {
      e.w = e.img.naturalWidth;
      e.h = e.img.naturalHeight;
      buildMask(e);
      e.ready = true;
    };
    e.img.onerror = function () { e.failed = true; };
    e.img.src = src;
    cache.set(src, e);
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return e;
  };

  function keyName(e) {
    var c = e.code || '';
    if (c.indexOf('Key') === 0) return c.slice(3).toLowerCase();
    if (c.indexOf('Digit') === 0) return c.slice(5);
    if (c.indexOf('Numpad') === 0 && /\d$/.test(c)) return c.slice(-1);
    switch (e.key) {
      case ' ': case 'Spacebar': return 'space';
      case 'ArrowUp': return 'up';
      case 'ArrowDown': return 'down';
      case 'ArrowLeft': return 'left';
      case 'ArrowRight': return 'right';
      case 'Enter': return 'enter';
      case 'Shift': return 'shift';
    }
    return null;
  }
  SE.keyName = keyName;

  /* ---------------- Aktör (karakter / klon / sahne) ---------------- */
  var actorSeq = 0;

  class Actor {
    constructor(engine, data, isStage) {
      this.engine = engine;
      this.data = data;
      this.isStage = !!isStage;
      this.uid = ++actorSeq;
      this.isClone = false;
      this.dead = false;
      this.x = +data.x || 0;
      this.y = +data.y || 0;
      this.dir = data.direction == null ? 90 : +data.direction;
      this.size = data.size == null ? 100 : +data.size;
      this.visible = data.visible !== false;
      this.costume = data.currentCostume | 0;
      this.rotationStyle = data.rotationStyle || 'all';
      this.effects = { color: 0, ghost: 0, brightness: 0 };
      this.vars = new Map();
      this.lists = new Map();
      var self = this;
      (data.variables || []).forEach(function (v) { self.vars.set(v.id, v.value); });
      (data.lists || []).forEach(function (l) { self.lists.set(l.id, (l.items || []).slice()); });
      var ph = data.physics || {};
      this.body = ph.body || 'none';
      this.gravityScale = ph.gravityScale == null ? 1 : +ph.gravityScale;
      this.bounce = +ph.bounce || 0;
      this.friction = ph.friction == null ? 0.2 : +ph.friction;
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
      this.hitWall = false;
      this.hitCeil = false;
      this.say = null;
      this.pen = { down: false, color: '#3b82f6', size: 3 };
      this.anim = null;
      this.instrument = 'square';
      this.collideState = new Map();
      this.solidDyn = !!ph.solidDyn;
      this.contacts = new Set();
      this.tileContacts = new Set();
      this.ground = null;
      this.lastX = this.x;
      this.lastY = this.y;
    }
    get name() { return this.data.name; }
    get costumes() { return this.data.costumes || []; }

    costumeData() {
      var cs = this.costumes;
      if (!cs.length) return null;
      return cs[((this.costume % cs.length) + cs.length) % cs.length];
    }
    setCostume(v) {
      var cs = this.costumes, n = cs.length;
      if (!n) return;
      var i = -1;
      if (typeof v === 'string') {
        for (var k = 0; k < n; k++) if (cs[k].name === v) { i = k; break; }
        if (i < 0 && v === 'sonraki') i = this.costume + 1;
        if (i < 0 && v === 'önceki') i = this.costume - 1;
        if (i < 0 && U.isNumeric(v)) i = Math.round(U.toNum(v)) - 1;
      } else i = Math.round(U.toNum(v)) - 1;
      if (i < 0 && typeof v === 'string' && !U.isNumeric(v)) return;
      this.costume = ((i % n) + n) % n;
    }
    scale() {
      var c = this.costumeData();
      return ((c && c.scale) || 1) * this.size / 100;
    }
    flipped() {
      return this.rotationStyle === 'lr' && U.wrapDir(this.dir) < 0;
    }
    /* Eksen hizalı sınır kutusu (dünya koordinatları, y yukarı). Saydam kenarlar kırpılır. */
    bounds() {
      var c = this.costumeData();
      if (!c) return { l: this.x, r: this.x, b: this.y, t: this.y };
      var e = SE.getImage(c.src);
      var s = this.scale(), w = c.w * s, h = c.h * s;
      var x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
      if (e && e.trim && e.w) {
        x0 = (e.trim.x0 / e.w - 0.5) * w;
        x1 = (e.trim.x1 / e.w - 0.5) * w;
        y0 = (e.trim.y0 / e.h - 0.5) * h;
        y1 = (e.trim.y1 / e.h - 0.5) * h;
      }
      if (this.rotationStyle === 'all' && U.wrapDir(this.dir) !== 90) {
        var a = (this.dir - 90) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
        var xs = [x0, x1, x0, x1], ys = [y0, y0, y1, y1];
        var minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
        for (var i = 0; i < 4; i++) {
          var px = xs[i] * ca - ys[i] * sa, py = xs[i] * sa + ys[i] * ca;
          if (px < minx) minx = px;
          if (px > maxx) maxx = px;
          if (py < miny) miny = py;
          if (py > maxy) maxy = py;
        }
        return { l: this.x + minx, r: this.x + maxx, t: this.y - miny, b: this.y - maxy };
      }
      if (this.flipped()) { var t = x0; x0 = -x1; x1 = -t; }
      return { l: this.x + x0, r: this.x + x1, t: this.y - y0, b: this.y - y1 };
    }
    /* Dünya noktası kostümün opak bir pikseline denk geliyor mu? */
    hitPoint(wx, wy) {
      if (!this.visible || this.isStage) return false;
      var c = this.costumeData();
      if (!c) return false;
      var e = SE.getImage(c.src);
      var s = this.scale(), w = c.w * s, h = c.h * s;
      if (w <= 0 || h <= 0) return false;
      var sx = wx - this.x, sy = this.y - wy;
      if (this.rotationStyle === 'all') {
        var a = (this.dir - 90) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
        var lx = sx * ca + sy * sa, ly = -sx * sa + sy * ca;
        sx = lx;
        sy = ly;
      } else if (this.flipped()) sx = -sx;
      var u = sx / w + 0.5, v = sy / h + 0.5;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
      if (!e || !e.mask) return true;
      return e.mask[Math.floor(v * e.h) * e.w + Math.floor(u * e.w)] === 1;
    }
    setPos(x, y) {
      if (this.pen.down && !this.isStage) this.engine.penLine(this.x, this.y, x, y, this.pen);
      this.x = x;
      this.y = y;
    }
    makeClone() {
      var c = new Actor(this.engine, this.data, false);
      c.isClone = true;
      c.x = this.x;
      c.y = this.y;
      c.dir = this.dir;
      c.size = this.size;
      c.visible = this.visible;
      c.costume = this.costume;
      c.rotationStyle = this.rotationStyle;
      c.effects = Object.assign({}, this.effects);
      c.vars = new Map(this.vars);
      c.lists = new Map();
      this.lists.forEach(function (v, k) { c.lists.set(k, v.slice()); });
      c.body = this.body;
      c.gravityScale = this.gravityScale;
      c.bounce = this.bounce;
      c.friction = this.friction;
      c.vx = this.vx;
      c.vy = this.vy;
      c.pen = Object.assign({}, this.pen);
      c.instrument = this.instrument;
      c.anim = this.anim ? Object.assign({}, this.anim) : null;
      c.solidDyn = this.solidDyn;
      c.lastX = c.x;
      c.lastY = c.y;
      return c;
    }
  }
  SE.Actor = Actor;

  /* ---------------- Motor ---------------- */
  class Engine extends SE.Emitter {
    constructor(canvas, opts) {
      super();
      opts = opts || {};
      this.canvas = canvas;
      this.g = canvas.getContext('2d');
      this.editable = !!opts.editable;
      this.project = null;
      this.stage = null;
      this.actors = [];
      this.threads = [];
      this.running = false;
      this.paused = false;
      this.halted = false;
      this.frame = 0;
      this.acc = 0;
      this.last = 0;
      this.fps = 60;
      this._fpsT = 0;
      this._fpsN = 0;
      this.keys = new Set();
      this.keyQueue = [];
      this.clickQueue = [];
      this.mouse = { x: 0, y: 0, down: false, inside: false };
      this.editCam = { x: 0, y: 0, zoom: 1 };
      this.selectedId = null;
      this.showGrid = false;
      this.suspended = false;
      this._loop = this._loop.bind(this);
      // headless: girdi ve döngü yok, sadece elle render (önizleme resimleri için)
      if (!opts.headless) {
        this._bindInput();
        requestAnimationFrame(this._loop);
      }
    }

    get W() { return (this.project && +this.project.stage.width) || 480; }
    get H() { return (this.project && +this.project.stage.height) || 360; }
    now() { return this.frame * STEP; }

    load(project) {
      this.project = project;
      this.rebuild();
    }

    /* Proje verisinden sahneyi (yeniden) kur. Durdurulunca da çağrılır: sahne başlangıç haline döner. */
    rebuild() {
      var p = this.project;
      if (!p) return;
      var self = this;
      this.threads = [];
      this.stage = new Actor(this, p.stage, true);
      this.actors = p.sprites.map(function (s) { return new Actor(self, s, false); });
      this.cloneCount = 0;
      this.gravity = p.stage.gravity == null ? 0.8 : +p.stage.gravity;
      this.bgColor = p.stage.bgColor || '#ffffff';
      this.pendingLevel = null;
      this.applyLevel();
      this.camera = { x: 0, y: 0, zoom: 1, follow: null, axis: 'both', shake: 0, shakeUntil: 0, ox: 0, oy: 0 };
      this.particles = [];
      this.penClear();
      this.answer = '';
      this.closeAsk();
      this.halted = false;
      this.frame = 0;
      this.timerStart = 0;
      this.procCache = new Map();
      this.varIndex = new Map();
      this.monitors = new Set();
      var addVars = function (owner, isStage) {
        (owner.variables || []).forEach(function (v) {
          self.varIndex.set(v.id, { name: v.name, owner: isStage ? null : owner.name, spriteId: isStage ? null : owner.id, list: false });
          if (v.monitor) self.monitors.add(v.id);
        });
        (owner.lists || []).forEach(function (l) {
          self.varIndex.set(l.id, { name: l.name, owner: isStage ? null : owner.name, spriteId: isStage ? null : owner.id, list: true });
          if (l.monitor) self.monitors.add(l.id);
        });
      };
      addVars(p.stage, true);
      p.sprites.forEach(function (s) { addVars(s, false); });
    }

    start(opts) {
      if (SE.audio) SE.audio.unlock();
      this.running = true;
      this.paused = false;
      this.acc = 0;
      this.music = null;
      this.levelIndex = this.editLevel || 0;
      this.rebuild();
      if (!opts || opts.hats !== false) {
        this.fireHat('when_start', null, this.originals());
        this.fireHat('when_level', null, this.originals());
      }
      this.emit('state');
    }

    stop() {
      this.running = false;
      this.paused = false;
      if (SE.audio) SE.audio.stopAll();
      this.music = null;
      this.levelIndex = this.editLevel || 0;
      this.rebuild();
      this.emit('state');
    }

    /* ---------- seviyeler ---------- */
    applyLevel() {
      var p = this.project, self = this, lvs = p.levels || [];
      if (!(this.levelIndex >= 0 && this.levelIndex < lvs.length)) this.levelIndex = 0;
      var lv = (this.level = lvs[this.levelIndex] || null);
      var tset = p.tileset || {};
      this.tileSize = Math.max(4, +tset.tileSize || 32);
      this.tileDefs = new Map();
      (tset.costumes || []).forEach(function (t) { self.tileDefs.set(String(t.id), t); });
      if (lv) lv.cells = lv.cells || {};
      // oyun sırasında harita kopyalanır: bloklarla yapılan değişiklikler projeyi bozmaz
      this.cells = lv ? (this.running ? Object.assign({}, lv.cells) : lv.cells) : {};
      this.bgColor = (lv && lv.bgColor) || p.stage.bgColor || '#ffffff';
      if (lv && lv.backdrop) this.stage.setCostume(lv.backdrop);
      if (lv && lv.place) {
        this.actors.forEach(function (a) {
          var pl = lv.place[a.data.id];
          if (!pl || a.isClone) return;
          if (pl.x != null) a.x = +pl.x;
          if (pl.y != null) a.y = +pl.y;
          if (pl.visible != null) a.visible = !!pl.visible;
          a.lastX = a.x;
          a.lastY = a.y;
        });
      }
    }
    requestLevel(v) {
      var lvs = this.project.levels || [], n = lvs.length, i = -1, s = U.toStr(v);
      if (!n) return false;
      if (s === '_next_') i = this.levelIndex + 1;
      else if (s === '_prev_') i = this.levelIndex - 1;
      else if (s === '_same_') i = this.levelIndex;
      else if (U.isNumeric(s)) i = Math.round(U.toNum(s)) - 1;
      else for (var k = 0; k < n; k++) if (lvs[k].name === s) { i = k; break; }
      if (i < 0 || i >= n) return false;
      this.pendingLevel = i;
      this.threads.forEach(function (t) { t.done = true; });
      return true;
    }
    _switchLevel(i) {
      var p = this.project, self = this;
      var ks = { v: this.stage.vars, l: this.stage.lists, c: this.stage.costume };
      var keep = new Map();
      this.actors.forEach(function (a) { if (!a.isClone) keep.set(a.data.id, { v: a.vars, l: a.lists }); });
      this.threads = [];
      this.stage = new Actor(this, p.stage, true);
      this.stage.vars = ks.v;
      this.stage.lists = ks.l;
      this.stage.costume = ks.c;
      this.actors = p.sprites.map(function (s) {
        var a = new Actor(self, s, false), k = keep.get(s.id);
        if (k) { a.vars = k.v; a.lists = k.l; }
        return a;
      });
      this.cloneCount = 0;
      this.particles = [];
      this.penClear();
      this.closeAsk();
      this.camera = { x: 0, y: 0, zoom: 1, follow: null, axis: 'both', shake: 0, shakeUntil: 0, ox: 0, oy: 0 };
      this.levelIndex = i;
      this.applyLevel();
      this.fireHat('when_level', null, this.originals());
      this.emit('level', i);
    }

    /* ---------- karo haritası ---------- */
    tileDef(id) { return id == null ? null : this.tileDefs.get(String(id)) || null; }
    tileAtWorld(x, y) {
      var ts = this.tileSize;
      return this.cells ? this.cells[Math.floor(x / ts) + ',' + Math.floor(y / ts)] : undefined;
    }
    setTileAtWorld(x, y, id) {
      if (!this.cells) return;
      var ts = this.tileSize, k = Math.floor(x / ts) + ',' + Math.floor(y / ts);
      if (id == null || id === '') delete this.cells[k];
      else this.cells[k] = +id;
    }
    _tileMatch(id, filter) {
      var td = this.tileDef(id);
      if (!td) return false;
      if (filter === '_any_') return true;
      if (filter === '_solid_') return (td.solid || 'solid') !== 'none';
      return String(id) === String(filter);
    }
    _tileHit(td, cx, cy, x, y) {
      var e = SE.getImage(td.src);
      if (!e || !e.mask) return true;
      var ts = this.tileSize, u = (x - cx * ts) / ts, v = 1 - (y - cy * ts) / ts;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
      return e.mask[Math.floor(v * e.h) * e.w + Math.floor(u * e.w)] === 1;
    }
    _tileOverlap(a, cx, cy, td) {
      var ts = this.tileSize, b = a.bounds();
      var l = Math.max(b.l, cx * ts), r = Math.min(b.r, cx * ts + ts), bo = Math.max(b.b, cy * ts), t = Math.min(b.t, cy * ts + ts);
      if (l >= r || bo >= t) return false;
      var step = Math.max(1, Math.sqrt(((r - l) * (t - bo)) / 300));
      for (var y = bo + step / 2; y < t; y += step) {
        for (var x = l + step / 2; x < r; x += step) {
          if (a.hitPoint(x, y) && this._tileHit(td, cx, cy, x, y)) return true;
        }
      }
      return false;
    }
    _cellsNear(a, pad, fn) {
      if (!this.cells) return;
      var ts = this.tileSize, b = a.bounds();
      var cx0 = Math.floor((b.l - pad) / ts), cx1 = Math.floor((b.r + pad) / ts);
      var cy0 = Math.floor((b.b - pad) / ts), cy1 = Math.floor((b.t + pad) / ts);
      if ((cx1 - cx0 + 1) * (cy1 - cy0 + 1) > 2500) return;
      for (var cy = cy0; cy <= cy1; cy++) {
        for (var cx = cx0; cx <= cx1; cx++) {
          var k = cx + ',' + cy, id = this.cells[k];
          if (id != null) fn(cx, cy, id, k);
        }
      }
    }
    touchingTile(a, filter) {
      if (!a || a.isStage || !a.visible || !this.cells) return false;
      var self = this, found = false;
      a.tileContacts.forEach(function (id) { if (!found && self._tileMatch(id, filter)) found = true; });
      if (found) return true;
      this._cellsNear(a, 0, function (cx, cy, id) {
        if (!found && self._tileMatch(id, filter) && self._tileOverlap(a, cx, cy, self.tileDef(id))) found = true;
      });
      return found;
    }
    /* değilen karoları başka bir karoyla değiştir (null = sil). Kaç karo değişti? */
    replaceTouching(a, filter, newId) {
      if (!a || a.isStage || !a.visible || !this.cells) return 0;
      var self = this, b = a.bounds(), ts = this.tileSize, n = 0, P = 1.5;
      this._cellsNear(a, P, function (cx, cy, id, k) {
        if (!self._tileMatch(id, filter)) return;
        var td = self.tileDef(id);
        var ok = (td.solid || 'solid') === 'none'
          ? self._tileOverlap(a, cx, cy, td)
          : b.r > cx * ts - P && b.l < cx * ts + ts + P && b.t > cy * ts - P && b.b < cy * ts + ts + P;
        if (!ok) return;
        if (newId == null) delete self.cells[k];
        else self.cells[k] = +newId;
        n++;
      });
      return n;
    }

    /* ---------- sesler ---------- */
    findSound(actor, name) {
      var n = U.toStr(name), i, l = (actor && actor.data.sounds) || [];
      for (i = 0; i < l.length; i++) if (l[i].name === n) return l[i];
      l = this.project.stage.sounds || [];
      for (i = 0; i < l.length; i++) if (l[i].name === n) return l[i];
      return null;
    }
    playSound(actor, name) {
      var s = this.findSound(actor, name);
      return s && SE.audio ? SE.audio.playAsset(s, false) : null;
    }
    playMusic(actor, name) {
      var s = this.findSound(actor, name);
      if (!s || !SE.audio) return;
      this.stopMusic();
      this.music = SE.audio.playAsset(s, true);
    }
    stopMusic() {
      if (this.music) this.music.stop();
      this.music = null;
    }

    /* ---------- tuşlar (klavye + dokunmatik) ---------- */
    pressKey(k) {
      if (this.keys.has(k)) return;
      this.keys.add(k);
      if (this.running) this.keyQueue.push(k);
    }
    releaseKey(k) { this.keys.delete(k); }

    setPaused(p) {
      this.paused = !!p;
      this.emit('state');
    }

    /* "hepsini durdur" bloğu: betikler biter, sahne olduğu gibi donar. */
    stopAll() {
      this.threads.forEach(function (t) { t.done = true; });
      this.threads = [];
      this.halted = true;
      if (SE.audio) SE.audio.stopAll();
      this.emit('state');
    }

    allActors() { return [this.stage].concat(this.actors); }
    originals() {
      return [this.stage].concat(this.actors.filter(function (a) { return !a.isClone; }));
    }
    originalOf(spriteId) {
      if (!spriteId || spriteId === 'stage') return this.stage;
      for (var i = 0; i < this.actors.length; i++) {
        var a = this.actors[i];
        if (a.data.id === spriteId && !a.isClone && !a.dead) return a;
      }
      for (var j = 0; j < this.actors.length; j++) if (this.actors[j].data.id === spriteId && !this.actors[j].dead) return this.actors[j];
      return null;
    }

    /* ---------- klonlar ---------- */
    createClone(src) {
      if (!src || src.isStage || this.cloneCount >= MAX_CLONES) return null;
      var cl = src.makeClone();
      var i = this.actors.indexOf(src);
      this.actors.splice(i < 0 ? this.actors.length : i, 0, cl);
      this.cloneCount++;
      this.fireHat('when_clone', null, [cl]);
      return cl;
    }
    deleteClone(a) {
      if (!a.isClone || a.dead) return;
      a.dead = true;
      this.cloneCount--;
      var i = this.actors.indexOf(a);
      if (i >= 0) this.actors.splice(i, 1);
      if (this.camera.follow === a) this.camera.follow = null;
    }

    /* ---------- değişkenler ---------- */
    _varStore(actor, id, isList) {
      var key = isList ? 'lists' : 'vars';
      if (actor && actor[key].has(id)) return actor[key];
      if (this.stage[key].has(id)) return this.stage[key];
      return null;
    }
    getVar(actor, id) {
      var st = this._varStore(actor, id, false);
      return st ? st.get(id) : '';
    }
    setVar(actor, id, v) {
      var st = this._varStore(actor, id, false);
      if (st) st.set(id, v);
    }
    getList(actor, id) {
      var st = this._varStore(actor, id, true);
      return st ? st.get(id) : null;
    }

    /* ---------- hedefler ---------- */
    viewRect() {
      var c = this.camera, hw = this.W / 2 / c.zoom, hh = this.H / 2 / c.zoom;
      return { l: c.x - hw, r: c.x + hw, b: c.y - hh, t: c.y + hh };
    }
    targetPos(t, self) {
      if (t === '_mouse_') return { x: this.mouse.x, y: this.mouse.y };
      if (t === '_random_') {
        var v = this.viewRect();
        return { x: Math.round(U.rand(v.l, v.r)), y: Math.round(U.rand(v.b, v.t)) };
      }
      if (t === '_myself_') return self ? { x: self.x, y: self.y } : null;
      var a = this.originalOf(t);
      return a ? { x: a.x, y: a.y } : null;
    }
    touchesActor(a, b) {
      if (a === b || !a.visible || !b.visible || a.dead || b.dead) return false;
      var A = a.bounds(), B = b.bounds();
      var l = Math.max(A.l, B.l), r = Math.min(A.r, B.r), bo = Math.max(A.b, B.b), t = Math.min(A.t, B.t);
      if (l >= r || bo >= t) return false;
      var step = Math.max(1, Math.sqrt(((r - l) * (t - bo)) / 1600));
      for (var y = bo + step / 2; y < t; y += step) {
        for (var x = l + step / 2; x < r; x += step) {
          if (a.hitPoint(x, y) && b.hitPoint(x, y)) return true;
        }
      }
      return false;
    }
    touchingEdge(a) {
      var b = a.bounds(), v = this.viewRect();
      return b.l < v.l || b.r > v.r || b.b < v.b || b.t > v.t;
    }
    isTouching(a, target) {
      if (!a || a.isStage || !a.visible) return false;
      if (target === '_mouse_') return this.mouse.inside && a.hitPoint(this.mouse.x, this.mouse.y);
      if (target === '_edge_') return this.touchingEdge(a);
      for (var i = 0; i < this.actors.length; i++) {
        var o = this.actors[i];
        if (o.data.id === target && o !== a && (a.contacts.has(o) || this.touchesActor(a, o))) return true;
      }
      return false;
    }
    actorAt(x, y) {
      for (var i = this.actors.length - 1; i >= 0; i--) {
        var a = this.actors[i];
        if (a.visible && !a.dead && a.hitPoint(x, y)) return a;
      }
      return null;
    }

    /* ---------- efektler ---------- */
    emitParticles(x, y, n, color, spread) {
      n = Math.min(500, Math.max(0, Math.round(n)));
      spread = spread || 1;
      for (var i = 0; i < n; i++) {
        if (this.particles.length > 3000) break;
        var ang = Math.random() * Math.PI * 2, sp = U.rand(1, 5) * spread;
        var life = Math.round(U.rand(28, 60));
        this.particles.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp + 1.2, life: life, max: life, size: U.rand(2, 5), color: color });
      }
    }
    penCtx() {
      if (!this.penCanvas) {
        var c = document.createElement('canvas');
        this.penW = this.W * 3;
        this.penH = this.H * 3;
        c.width = this.penW;
        c.height = this.penH;
        this.penCanvas = c;
        this.penG = c.getContext('2d');
      }
      return this.penG;
    }
    penClear() {
      if (this.penCanvas) {
        if (this.penW !== this.W * 3 || this.penH !== this.H * 3) {
          this.penCanvas = null;
          return;
        }
        this.penG.clearRect(0, 0, this.penW, this.penH);
      }
    }
    penLine(x0, y0, x1, y1, pen) {
      var g = this.penCtx();
      g.strokeStyle = pen.color;
      g.lineWidth = pen.size;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(x0 + this.penW / 2, this.penH / 2 - y0);
      g.lineTo(x1 + this.penW / 2 + (x0 === x1 && y0 === y1 ? 0.01 : 0), this.penH / 2 - y1);
      g.stroke();
    }
    stamp(a) {
      var g = this.penCtx();
      g.save();
      g.translate(this.penW / 2, this.penH / 2);
      this.drawActor(g, a);
      g.restore();
    }

    /* ---------- soru sor ---------- */
    ask(question) {
      var self = this;
      var st = { done: false };
      var host = this.canvas.parentElement;
      if (!host) { st.done = true; return st; }
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      var box = document.createElement('form');
      box.className = 'se-ask';
      box.style.cssText = 'position:absolute;left:8px;right:8px;bottom:8px;background:#fff;border:2px solid #c7cbe0;border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px;font:600 14px system-ui,sans-serif;color:#1f2433;z-index:5;box-shadow:0 6px 20px rgba(0,0,0,.25)';
      var q = document.createElement('div');
      q.textContent = question;
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px';
      var inp = document.createElement('input');
      inp.className = 'se-ask-input';
      inp.style.cssText = 'flex:1;min-width:0;border:1px solid #c7cbe0;border-radius:999px;padding:6px 12px;font:inherit;font-weight:500;outline:none';
      var ok = document.createElement('button');
      ok.type = 'submit';
      ok.textContent = '✓';
      ok.style.cssText = 'border:0;border-radius:999px;width:34px;background:#7c5cff;color:#fff;font-weight:800;cursor:pointer';
      row.appendChild(inp);
      row.appendChild(ok);
      if (question) box.appendChild(q);
      box.appendChild(row);
      box.addEventListener('submit', function (e) {
        e.preventDefault();
        self.answer = inp.value;
        st.done = true;
        box.remove();
        if (self.askState === st) self.askState = null;
      });
      box.addEventListener('keydown', function (e) { e.stopPropagation(); });
      host.appendChild(box);
      setTimeout(function () { inp.focus(); }, 0);
      st.box = box;
      this.askState = st;
      return st;
    }
    closeAsk() {
      if (this.askState && this.askState.box) this.askState.box.remove();
      this.askState = null;
    }

    /* ---------- girdi ---------- */
    _bindInput() {
      var self = this, cv = this.canvas;
      var typing = function (t) {
        return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      };
      window.addEventListener('keydown', function (e) {
        if (typing(e.target)) return;
        var k = keyName(e);
        if (!k) return;
        if (self.running && !self.paused && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (k === 'space' || k === 'up' || k === 'down' || k === 'left' || k === 'right') e.preventDefault();
        }
        if (!self.keys.has(k) && !e.repeat && !e.ctrlKey && !e.metaKey) self.pressKey(k);
      });
      window.addEventListener('keyup', function (e) {
        var k = keyName(e);
        if (k) self.releaseKey(k);
      });
      window.addEventListener('blur', function () { self.keys.clear(); });

      cv.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        try { cv.setPointerCapture(e.pointerId); } catch (err) { /* yoksay */ }
        self._updateMouse(e);
        self.mouse.down = true;
        if (SE.audio) SE.audio.unlock();
        if (self.running) {
          if (!self.paused && !self.halted) self.clickQueue.push({ x: self.mouse.x, y: self.mouse.y });
        } else if (self.editable) self._editDown(e);
      });
      cv.addEventListener('pointermove', function (e) {
        self._updateMouse(e);
        if (self._edit) self._editMove(e);
      });
      var up = function () {
        self.mouse.down = false;
        if (self._edit) {
          var ed = self._edit;
          self._edit = null;
          cv.style.cursor = '';
          if (ed.actor && ed.moved) self.emit('spriteMoved', ed.actor.data);
        }
      };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
      cv.addEventListener('pointerleave', function () { self.mouse.inside = false; });
      cv.addEventListener('pointerenter', function () { self.mouse.inside = true; });
      cv.addEventListener('wheel', function (e) {
        if (self.running || !self.editable) return;
        e.preventDefault();
        var f = Math.exp(-e.deltaY * 0.0015);
        self.editCam.zoom = U.clamp(self.editCam.zoom * f, 0.15, 4);
      }, { passive: false });
      cv.addEventListener('dblclick', function () {
        if (!self.running && self.editable && !self.actorAt(self.mouse.x, self.mouse.y)) self.resetEditView();
      });
    }
    resetEditView() {
      this.editCam.x = 0;
      this.editCam.y = 0;
      this.editCam.zoom = 1;
    }
    _toStage(e) {
      var r = this.canvas.getBoundingClientRect();
      return { sx: ((e.clientX - r.left) / r.width) * this.W, sy: ((e.clientY - r.top) / r.height) * this.H };
    }
    _updateMouse(e) {
      var p = this._toStage(e);
      var w = this.screenToWorld(p.sx, p.sy);
      this.mouse.x = Math.round(w.x);
      this.mouse.y = Math.round(w.y);
      this.mouse.inside = true;
    }
    _editDown(e) {
      var a = this.actorAt(this.mouse.x, this.mouse.y);
      var p = this._toStage(e);
      if (a) {
        this.emit('select', a.data.id);
        this._edit = { actor: a, dx: a.x - this.mouse.x, dy: a.y - this.mouse.y, moved: false };
        this.canvas.style.cursor = 'grabbing';
      } else {
        this._edit = { pan: true, sx: p.sx, sy: p.sy, cx: this.editCam.x, cy: this.editCam.y };
        this.canvas.style.cursor = 'move';
      }
    }
    _editMove(e) {
      var ed = this._edit;
      if (ed.pan) {
        var p = this._toStage(e);
        this.editCam.x = ed.cx - (p.sx - ed.sx) / this.editCam.zoom;
        this.editCam.y = ed.cy + (p.sy - ed.sy) / this.editCam.zoom;
        return;
      }
      var a = ed.actor;
      a.x = Math.round(this.mouse.x + ed.dx);
      a.y = Math.round(this.mouse.y + ed.dy);
      if (this.placeHook) this.placeHook(a.data, a.x, a.y);
      else {
        a.data.x = a.x;
        a.data.y = a.y;
      }
      ed.moved = true;
      this.emit('spriteDragging', { id: a.data.id, x: a.x, y: a.y });
    }

    viewCam() {
      if (this.running) {
        var c = this.camera;
        return { x: c.x + c.ox, y: c.y + c.oy, zoom: c.zoom };
      }
      return this.editable ? this.editCam : { x: 0, y: 0, zoom: 1 };
    }
    screenToWorld(sx, sy) {
      var c = this.viewCam();
      return { x: c.x + (sx - this.W / 2) / c.zoom, y: c.y - (sy - this.H / 2) / c.zoom };
    }
    worldToScreen(x, y) {
      var c = this.viewCam();
      return { x: this.W / 2 + (x - c.x) * c.zoom, y: this.H / 2 - (y - c.y) * c.zoom };
    }

    /* ---------- simülasyon ---------- */
    _loop(ts) {
      requestAnimationFrame(this._loop);
      if (this.suspended) {
        this.last = 0;
        return;
      }
      if (!this.last) this.last = ts;
      var dt = Math.min(ts - this.last, 200);
      this.last = ts;
      this._fpsT += dt;
      this._fpsN++;
      if (this._fpsT >= 500) {
        this.fps = Math.round((this._fpsN * 1000) / this._fpsT);
        this._fpsT = 0;
        this._fpsN = 0;
      }
      if (this.running && !this.paused && !this.halted) {
        this.acc += dt;
        var n = 0;
        while (this.acc >= STEP - 1 && n < 4) {
          this.step();
          this.acc -= STEP;
          n++;
        }
        if (n >= 4) this.acc = 0;
      }
      if (this.project) this.render();
    }

    step() {
      this.frame++;
      this.stepStart = performance.now();
      var self = this;
      while (this.keyQueue.length) {
        var k = this.keyQueue.shift();
        this.fireHat('when_key', function (b) {
          var v = b.inputs && b.inputs.KEY && b.inputs.KEY.value;
          return v === k || v === 'any';
        });
      }
      while (this.clickQueue.length) {
        var c = this.clickQueue.shift();
        var hit = this.actorAt(c.x, c.y);
        this.fireHat('when_clicked', null, [hit || this.stage]);
      }
      this.runThreads();
      if (this.pendingLevel != null) {
        var li = this.pendingLevel;
        this.pendingLevel = null;
        this._switchLevel(li);
        return;
      }
      if (this.halted) return;
      this.physicsStep();
      this.animStep();
      this.collisionHats();
      this.cameraStep();
      this.particleStep();
      self.emit('step');
    }

    physicsStep() {
      var list = this.actors, solids = [], dyn = [], i, a;
      for (i = 0; i < list.length; i++) {
        a = list[i];
        a.contacts.clear();
        a.tileContacts.clear();
        if (a.dead) continue;
        if (a.body === 'static' && a.visible) solids.push(a);
        else if (a.body === 'dynamic') dyn.push(a);
      }
      // 1) fiziksiz ve katı gövdeler: hız varsa sabit hızla (kinematik) hareket eder
      for (i = 0; i < list.length; i++) {
        a = list[i];
        if (!a.dead && a.body !== 'dynamic' && (a.vx || a.vy)) a.setPos(a.x + a.vx, a.y + a.vy);
      }
      var dynSolids = dyn.filter(function (d) { return d.solidDyn && d.visible; });
      // 2) dinamik gövdeler
      for (i = 0; i < dyn.length; i++) {
        a = dyn[i];
        if (a.dead) continue;
        var ox = a.x, oy = a.y;
        var others = a.solidDyn && dynSolids.length > 1 ? solids.concat(dynSolids) : solids;
        // üzerinde durduğu platform hareket ettiyse onunla birlikte taşın
        var gnd = a.ground;
        if (gnd && !gnd.dead && gnd.visible && others.indexOf(gnd) >= 0) {
          var gdx = gnd.x - gnd.lastX, gdy = gnd.y - gnd.lastY;
          if (gdx || gdy) { a.x += gdx; a.y += gdy; }
        }
        this._depenetrate(a, solids);
        a.vy -= this.gravity * a.gravityScale;
        a.vx = U.clamp(a.vx, -60, 60);
        a.vy = U.clamp(a.vy, -60, 60);
        a.onGround = false;
        a.hitWall = false;
        a.hitCeil = false;
        a.ground = null;
        this._moveAxis(a, true, a.vx, others);
        this._moveAxis(a, false, a.vy, others);
        a.vx *= 1 - U.clamp(a.friction, 0, 1);
        if (Math.abs(a.vx) < 0.01) a.vx = 0;
        if (a.pen.down && (ox !== a.x || oy !== a.y)) this.penLine(ox, oy, a.x, a.y, a.pen);
      }
      for (i = 0; i < list.length; i++) {
        list[i].lastX = list[i].x;
        list[i].lastY = list[i].y;
      }
    }
    /* hareket eden bir katı gövde içine girdiyse dinamik gövdeyi en kısa yoldan dışarı it */
    _depenetrate(a, solids) {
      for (var j = 0; j < solids.length; j++) {
        var s = solids[j];
        if (s === a) continue;
        var ab = a.bounds(), sb = s.bounds();
        var ox = Math.min(ab.r, sb.r) - Math.max(ab.l, sb.l), oy = Math.min(ab.t, sb.t) - Math.max(ab.b, sb.b);
        if (ox <= EPS || oy <= EPS) continue;
        if (ox < oy) a.x += ab.l + ab.r < sb.l + sb.r ? -ox : ox;
        else a.y += ab.b + ab.t < sb.b + sb.t ? -oy : oy;
      }
    }
    _push(a, isX, dv, ab, sb) {
      if (isX) {
        if (dv > 0) a.x -= ab.r - sb.l;
        else a.x += sb.r - ab.l;
      } else {
        if (dv > 0) a.y -= ab.t - sb.b;
        else a.y += sb.t - ab.b;
      }
    }
    _moveAxis(a, isX, v, solids) {
      if (!v) return;
      var steps = Math.max(1, Math.ceil(Math.abs(v) / 6)), dv = v / steps, ts = this.tileSize, cells = this.cells;
      for (var s = 0; s < steps; s++) {
        if (isX) a.x += dv;
        else a.y += dv;
        var ab = a.bounds(), hit = false, hitActor = null;
        for (var j = 0; j < solids.length; j++) {
          var so = solids[j];
          if (so === a) continue;
          var sb = so.bounds();
          if (ab.r > sb.l + EPS && ab.l < sb.r - EPS && ab.t > sb.b + EPS && ab.b < sb.t - EPS) {
            this._push(a, isX, dv, ab, sb);
            ab = a.bounds();
            hit = true;
            hitActor = so;
            a.contacts.add(so);
            so.contacts.add(a);
          }
        }
        if (cells) {
          var cx0 = Math.floor(ab.l / ts), cx1 = Math.floor((ab.r - EPS) / ts);
          var cy0 = Math.floor(ab.b / ts), cy1 = Math.floor((ab.t - EPS) / ts);
          if ((cx1 - cx0 + 1) * (cy1 - cy0 + 1) <= 400) {
            for (var cy = cy0; cy <= cy1; cy++) {
              for (var cx = cx0; cx <= cx1; cx++) {
                var id = cells[cx + ',' + cy];
                if (id == null) continue;
                var td = this.tileDefs.get(String(id));
                if (!td) continue;
                var kind = td.solid || 'solid';
                if (kind === 'none') continue;
                var tb = { l: cx * ts, r: cx * ts + ts, b: cy * ts, t: cy * ts + ts };
                if (!(ab.r > tb.l + EPS && ab.l < tb.r - EPS && ab.t > tb.b + EPS && ab.b < tb.t - EPS)) continue;
                // tek yönlü karo: sadece yukarıdan düşerken taşır
                if (kind === 'oneway' && (isX || dv >= 0 || ab.b - dv < tb.t - 0.5)) continue;
                this._push(a, isX, dv, ab, tb);
                ab = a.bounds();
                hit = true;
                hitActor = null;
                a.tileContacts.add(String(id));
              }
            }
          }
        }
        if (hit) {
          if (isX) {
            a.hitWall = true;
            a.vx = -a.vx * a.bounce;
          } else {
            if (dv < 0) {
              a.onGround = true;
              a.ground = hitActor;
            } else a.hitCeil = true;
            a.vy = Math.abs(a.vy * a.bounce) < 1.5 ? 0 : -a.vy * a.bounce;
          }
          return;
        }
      }
    }

    animStep() {
      var list = this.actors;
      for (var i = 0; i < list.length; i++) {
        var a = list[i], an = a.anim;
        if (!an || an.fps <= 0) continue;
        an.t += an.fps / 60;
        if (an.t >= 1) {
          var n = Math.floor(an.t);
          an.t -= n;
          var span = an.to - an.from + 1;
          an.i = (an.i + n) % span;
          a.costume = an.from - 1 + an.i;
        }
      }
    }
    collisionHats() {
      for (var i = 0; i < this.actors.length; i++) {
        var a = this.actors[i];
        if (a.dead) continue;
        var scripts = a.data.scripts;
        if (!scripts) continue;
        for (var k = 0; k < scripts.length; k++) {
          var b = scripts[k].block;
          if (!b || b.op !== 'when_collide') continue;
          var target = b.inputs && b.inputs.TARGET && b.inputs.TARGET.value;
          var now = this.isTouching(a, target);
          var was = a.collideState.get(b) || false;
          a.collideState.set(b, now);
          if (now && !was) this.startThread(a, b, 'skip');
        }
      }
    }
    cameraStep() {
      var c = this.camera;
      if (c.follow) {
        if (c.follow.dead) c.follow = null;
        else {
          if (c.axis !== 'y') c.x += (c.follow.x - c.x) * 0.14;
          if (c.axis !== 'x') c.y += (c.follow.y - c.y) * 0.14;
        }
      }
      if (this.now() < c.shakeUntil) {
        c.ox = (Math.random() * 2 - 1) * c.shake;
        c.oy = (Math.random() * 2 - 1) * c.shake;
      } else c.ox = c.oy = 0;
    }
    particleStep() {
      var ps = this.particles;
      for (var i = ps.length - 1; i >= 0; i--) {
        var p = ps[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.12;
        p.vx *= 0.98;
        if (--p.life <= 0) ps.splice(i, 1);
      }
    }

    /* ---------- çizim ---------- */
    resize() {
      var r = this.canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var cw = r.width ? Math.round(r.width * dpr) : this.W;
      var ch = r.height ? Math.round(r.height * dpr) : this.H;
      if (this.canvas.width !== cw || this.canvas.height !== ch) {
        this.canvas.width = cw;
        this.canvas.height = ch;
      }
    }
    render() {
      this.resize();
      var g = this.g, W = this.W, H = this.H;
      g.setTransform(this.canvas.width / W, 0, 0, this.canvas.height / H, 0, 0);
      g.globalAlpha = 1;
      g.fillStyle = this.bgColor || '#fff';
      g.fillRect(0, 0, W, H);
      var bd = this.stage && this.stage.costumeData();
      if (bd) {
        var be = SE.getImage(bd.src);
        if (be && be.ready) {
          g.imageSmoothingEnabled = !!bd.smooth;
          g.drawImage(be.img, 0, 0, W, H);
        }
      }
      var cam = this.viewCam();
      g.save();
      g.translate(W / 2, H / 2);
      g.scale(cam.zoom, cam.zoom);
      g.translate(-cam.x, cam.y);
      if (!this.running && this.editable) this._drawEditGuides(g, cam);
      this.drawTiles(g, cam, W, H);
      if (this.penCanvas) {
        g.imageSmoothingEnabled = true;
        g.drawImage(this.penCanvas, -this.penW / 2, -this.penH / 2, this.penW, this.penH);
      }
      for (var i = 0; i < this.actors.length; i++) this.drawActor(g, this.actors[i]);
      var ps = this.particles;
      for (var j = 0; j < ps.length; j++) {
        var p = ps[j];
        g.globalAlpha = p.life / p.max;
        g.fillStyle = p.color;
        g.fillRect(p.x - p.size / 2, -p.y - p.size / 2, p.size, p.size);
      }
      g.globalAlpha = 1;
      if (!this.running && this.editable) this._drawSelection(g, cam);
      g.restore();
      for (var k = 0; k < this.actors.length; k++) {
        var a = this.actors[k];
        if (a.say && a.visible) this._drawBubble(g, a);
      }
      this._drawMonitors(g);
      if (this.halted) {
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.fillRect(0, H - 22, W, 22);
        g.fillStyle = '#fff';
        g.font = '700 12px system-ui,sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('Oyun durdu — yeniden başlatmak için ▶', W / 2, H - 11);
        g.textAlign = 'left';
      }
    }
    /* görünür karoları çiz (dünya koordinatlarında, y yukarı) */
    drawTiles(g, cam, W, H) {
      var cells = this.cells;
      if (!cells) return;
      var ts = this.tileSize, hw = W / 2 / cam.zoom, hh = H / 2 / cam.zoom;
      var cx0 = Math.floor((cam.x - hw) / ts), cx1 = Math.floor((cam.x + hw) / ts);
      var cy0 = Math.floor((cam.y - hh) / ts), cy1 = Math.floor((cam.y + hh) / ts);
      var ov = 0.6 / cam.zoom, self = this;
      g.imageSmoothingEnabled = false;
      var draw = function (cx, cy, id) {
        var td = self.tileDefs.get(String(id));
        if (!td) return;
        var e = SE.getImage(td.src);
        if (e && e.ready) g.drawImage(e.img, cx * ts, -(cy + 1) * ts, ts + ov, ts + ov);
      };
      if ((cx1 - cx0 + 1) * (cy1 - cy0 + 1) > 6000) {
        Object.keys(cells).forEach(function (k) {
          var c = k.split(','), cx = +c[0], cy = +c[1];
          if (cx >= cx0 && cx <= cx1 && cy >= cy0 && cy <= cy1) draw(cx, cy, cells[k]);
        });
        return;
      }
      for (var cy = cy0; cy <= cy1; cy++) {
        for (var cx = cx0; cx <= cx1; cx++) {
          var id = cells[cx + ',' + cy];
          if (id != null) draw(cx, cy, id);
        }
      }
    }
    drawActor(g, a) {
      if (!a.visible || a.dead) return;
      var c = a.costumeData();
      if (!c) return;
      var e = SE.getImage(c.src);
      if (!e || !e.ready) return;
      var s = a.scale(), w = c.w * s, h = c.h * s;
      g.save();
      g.translate(a.x, -a.y);
      if (a.rotationStyle === 'all') g.rotate((a.dir - 90) * Math.PI / 180);
      else if (a.flipped()) g.scale(-1, 1);
      var fx = a.effects;
      if (fx.ghost) g.globalAlpha = 1 - U.clamp(fx.ghost, 0, 100) / 100;
      if (HAS_FILTER && (fx.color || fx.brightness)) {
        g.filter = (fx.color ? 'hue-rotate(' + fx.color * 3.6 + 'deg) ' : '') + (fx.brightness ? 'brightness(' + Math.max(0, 100 + fx.brightness) + '%)' : '');
      }
      g.imageSmoothingEnabled = !!c.smooth;
      g.drawImage(e.img, -w / 2, -h / 2, w, h);
      g.restore();
    }
    _drawEditGuides(g, cam) {
      var W = this.W, H = this.H;
      g.save();
      g.lineWidth = 1 / cam.zoom;
      g.strokeStyle = 'rgba(0,0,0,.12)';
      g.beginPath();
      g.moveTo(-5000, 0);
      g.lineTo(5000, 0);
      g.moveTo(0, -5000);
      g.lineTo(0, 5000);
      g.stroke();
      if (cam.zoom !== 1 || cam.x || cam.y) {
        g.setLineDash([6 / cam.zoom, 4 / cam.zoom]);
        g.strokeStyle = 'rgba(124,92,255,.9)';
        g.lineWidth = 2 / cam.zoom;
        g.strokeRect(-W / 2, -H / 2, W, H);
      }
      g.restore();
    }
    _drawSelection(g, cam) {
      if (!this.selectedId) return;
      var a = this.originalOf(this.selectedId);
      if (!a || a.isStage || !a.visible) return;
      var b = a.bounds();
      g.save();
      g.setLineDash([5 / cam.zoom, 3 / cam.zoom]);
      g.lineWidth = 1.5 / cam.zoom;
      g.strokeStyle = 'rgba(124,92,255,.95)';
      g.strokeRect(b.l - 2, -b.t - 2, b.r - b.l + 4, b.t - b.b + 4);
      g.restore();
    }
    _drawBubble(g, a) {
      var b = a.bounds();
      var p = this.worldToScreen(b.r - (b.r - b.l) * 0.25, b.t);
      var text = U.toStr(a.say.text).slice(0, 330);
      g.font = '600 12px system-ui,sans-serif';
      var words = text.split(/\s+/), lines = [], line = '';
      for (var i = 0; i < words.length; i++) {
        var test = line ? line + ' ' + words[i] : words[i];
        if (g.measureText(test).width > 150 && line) {
          lines.push(line);
          line = words[i];
        } else line = test;
      }
      if (line) lines.push(line);
      var w = 16, lh = 15;
      lines.forEach(function (l) { w = Math.max(w, g.measureText(l).width); });
      w += 16;
      var h = lines.length * lh + 12;
      var x = U.clamp(p.x, 4, this.W - w - 4), y = U.clamp(p.y - h - 12, 4, this.H - h - 4);
      g.fillStyle = '#fff';
      g.strokeStyle = 'rgba(30,35,55,.35)';
      g.lineWidth = 1.5;
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, w, h, 10);
      else g.rect(x, y, w, h);
      g.fill();
      g.stroke();
      if (a.say.think) {
        g.beginPath();
        g.arc(x + 12, y + h + 6, 4, 0, Math.PI * 2);
        g.arc(x + 6, y + h + 13, 2.5, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      } else {
        g.beginPath();
        g.moveTo(x + 10, y + h - 1);
        g.lineTo(x + 6, y + h + 10);
        g.lineTo(x + 22, y + h - 1);
        g.fill();
        g.stroke();
        g.fillRect(x + 9, y + h - 3, 14, 3);
      }
      g.fillStyle = '#1f2433';
      g.textBaseline = 'top';
      lines.forEach(function (l, i) { g.fillText(l, x + 8, y + 7 + i * lh); });
    }
    _drawMonitors(g) {
      if (!this.monitors.size) return;
      var y = 6, self = this;
      g.font = '700 11px system-ui,sans-serif';
      g.textBaseline = 'middle';
      this.monitors.forEach(function (id) {
        var info = self.varIndex.get(id);
        if (!info) return;
        var holder = info.spriteId ? self.originalOf(info.spriteId) : self.stage;
        var label = (info.owner ? info.owner + ': ' : '') + info.name;
        var val;
        if (info.list) {
          var arr = self.getList(holder, id) || [];
          val = '[' + arr.slice(0, 8).map(U.toStr).join(', ') + (arr.length > 8 ? ', …' : '') + ']';
        } else val = U.toStr(self.getVar(holder, id));
        if (val.length > 40) val = val.slice(0, 40) + '…';
        var lw = g.measureText(label).width, vw = Math.max(18, g.measureText(val).width + 10);
        var w = lw + vw + 16;
        g.fillStyle = 'rgba(255,255,255,.92)';
        g.strokeStyle = 'rgba(30,35,55,.25)';
        g.beginPath();
        if (g.roundRect) g.roundRect(6, y, w, 20, 6);
        else g.rect(6, y, w, 20);
        g.fill();
        g.stroke();
        g.fillStyle = '#3a4058';
        g.fillText(label, 12, y + 10.5);
        g.fillStyle = info.list ? '#d2463f' : '#f0623e';
        g.beginPath();
        if (g.roundRect) g.roundRect(14 + lw, y + 3, vw, 14, 4);
        else g.rect(14 + lw, y + 3, vw, 14);
        g.fill();
        g.fillStyle = '#fff';
        g.fillText(val, 19 + lw, y + 10.5);
        y += 24;
      });
    }
  }
  SE.Engine = Engine;
  SE.STEP = STEP;
});
