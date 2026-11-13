/* Stackit Engine — blok tanımları
 * Her blok: kategori, şekil, metin şablonu ({ARG} yer tutucuları), argümanlar
 * ve çalışma zamanı davranışı (run = komut, value = değer döndüren). */
SE.module('blocks', function (SE) {
  var U = SE.util;

  var cats = [
    { id: 'events', name: 'Olaylar', color: '#E9A92B' },
    { id: 'control', name: 'Kontrol', color: '#EE8432' },
    { id: 'motion', name: 'Hareket', color: '#4A87F0' },
    { id: 'looks', name: 'Görünüm', color: '#9A66EE' },
    { id: 'physics', name: 'Fizik', color: '#17A98F' },
    { id: 'world', name: 'Dünya', color: '#5468D4' },
    { id: 'level', name: 'Seviye', color: '#A86F38' },
    { id: 'sound', name: 'Ses', color: '#D9549A' },
    { id: 'sensing', name: 'Algılama', color: '#2FA4CF' },
    { id: 'ops', name: 'İşlemler', color: '#4FAE45' },
    { id: 'vars', name: 'Değişken', color: '#EC6A3F' },
    { id: 'lists', name: 'Listeler', color: '#C9453B' },
    { id: 'pen', name: 'Kalem', color: '#0E9C8A' },
    { id: 'procs', name: 'Fonksiyon', color: '#DE5B7D' }
  ];

  var defs = {};
  var order = [];
  function def(op, o) {
    o.op = op;
    o.args = o.args || {};
    defs[op] = o;
    order.push(op);
  }
  /* argüman yardımcıları */
  function num(v) { return { t: 'num', v: v }; }
  function txt(v) { return { t: 'text', v: v }; }
  function bool() { return { t: 'bool' }; }
  function menu(name, v, drop) { return { t: 'menu', menu: name, v: v, drop: !!drop }; }
  function color(v) { return { t: 'color', v: v }; }

  /* ---------------- menüler (editör + çalışma zamanı) ---------------- */
  var M = {};
  function spriteOpts(env, exceptSelf) {
    var t = env.target;
    return env.project.sprites
      .filter(function (s) { return !exceptSelf || !t || s.id !== t.id; })
      .map(function (s) { return [s.name, s.id]; });
  }
  M.keys = function () {
    var o = [['boşluk', 'space'], ['yukarı ok', 'up'], ['aşağı ok', 'down'], ['sağ ok', 'right'], ['sol ok', 'left'], ['enter', 'enter'], ['shift', 'shift'], ['herhangi bir', 'any']];
    'abcdefghijklmnopqrstuvwxyz0123456789'.split('').forEach(function (c) { o.push([c, c]); });
    return o;
  };
  M.touch = function (env) { return [['fare', '_mouse_'], ['kenar', '_edge_']].concat(spriteOpts(env, true)); };
  M.collide = function (env) { return [['kenar', '_edge_']].concat(spriteOpts(env, true)); };
  M.goto = function (env) { return [['rastgele konum', '_random_'], ['fare', '_mouse_']].concat(spriteOpts(env, true)); };
  M.towards = function (env) { return [['fare', '_mouse_']].concat(spriteOpts(env, true)); };
  M.clone = function (env) {
    var base = env.isStage ? [] : [['kendimin', '_myself_']];
    return base.concat(spriteOpts(env, !env.isStage));
  };
  M.follow = function (env) {
    var base = env.isStage ? [['hiç kimseyi', '_none_']] : [['beni', '_myself_'], ['hiç kimseyi', '_none_']];
    return base.concat(spriteOpts(env, true));
  };
  M.sprites = function (env) { return spriteOpts(env, false); };
  M.camaxis = [['her iki', 'both'], ['yatay', 'x'], ['dikey', 'y']];
  M.onoff = [['açık', 'on'], ['kapalı', 'off']];
  function tileOpts(env) {
    var t = env.project.tileset;
    return ((t && t.costumes) || []).map(function (c) { return [c.name, String(c.id)]; });
  }
  M.tiles = function (env) { return [['herhangi bir katı', '_solid_'], ['herhangi bir', '_any_']].concat(tileOpts(env)); };
  M.tilesSet = function (env) { return [['boş (sil)', '_empty_']].concat(tileOpts(env)); };
  M.levels = function (env) {
    return (env.project.levels || []).map(function (l, i) { return [l.name, String(i + 1)]; })
      .concat([['sonraki', '_next_'], ['önceki', '_prev_'], ['bu seviye (baştan)', '_same_']]);
  };
  M.sounds = function (env) {
    var out = [], seen = {};
    var list = ((env.target && env.target.sounds) || []).concat(env.isStage ? [] : env.project.stage.sounds || []);
    list.forEach(function (s) {
      if (seen[s.name]) return;
      seen[s.name] = 1;
      out.push([(s.type === 'music' ? '♪ ' : '') + s.name, s.name]);
    });
    return out;
  };
  M.costumes = function (env) {
    return ((env.target && env.target.costumes) || []).map(function (c) { return [c.name, c.name]; });
  };
  M.backdrops = function (env) {
    return (env.project.stage.costumes || []).map(function (c) { return [c.name, c.name]; });
  };
  M.messages = function (env) {
    return (env.project.messages || []).map(function (m) { return [m, m]; }).concat([['+ yeni mesaj…', '__new__']]);
  };
  function scoped(env, key) {
    var out = [];
    (env.project.stage[key] || []).forEach(function (v) { out.push([v.name, v.id]); });
    if (env.target && !env.isStage) (env.target[key] || []).forEach(function (v) { out.push([v.name, v.id]); });
    return out;
  }
  M.vars = function (env) { return scoped(env, 'variables'); };
  M.lists = function (env) { return scoped(env, 'lists'); };
  M.sfx = [['zıplama', 'jump'], ['altın', 'coin'], ['patlama', 'explosion'], ['lazer', 'laser'], ['vuruş', 'hit'], ['güçlenme', 'powerup'], ['tık', 'click'], ['pıt', 'pop'], ['kaybetme', 'lose'], ['kazanma', 'win']];
  M.waves = [['kare', 'square'], ['testere', 'sawtooth'], ['üçgen', 'triangle'], ['sinüs', 'sine']];
  M.effects = [['renk', 'color'], ['hayalet', 'ghost'], ['parlaklık', 'brightness']];
  M.math = [['mutlak', 'abs'], ['aşağı yuvarla', 'floor'], ['yukarı yuvarla', 'ceil'], ['karekök', 'sqrt'], ['sin', 'sin'], ['cos', 'cos'], ['tan', 'tan'], ['asin', 'asin'], ['acos', 'acos'], ['atan', 'atan'], ['ln', 'ln'], ['log', 'log'], ['e ^', 'exp'], ['10 ^', 'pow10']];
  M.stop = [['hepsini', 'all'], ['bu betiği', 'this'], ['diğer betikleri', 'other']];
  M.rotstyle = [['her yöne', 'all'], ['sağ-sol', 'lr'], ['dönme', 'none']];
  M.body = [['yok', 'none'], ['dinamik', 'dynamic'], ['katı', 'static']];
  M.layer = [['en öne', 'front'], ['en arkaya', 'back']];
  M.props = [['x konumu', 'x'], ['y konumu', 'y'], ['yönü', 'dir'], ['boyutu', 'size'], ['kostüm #', 'costume'], ['x hızı', 'vx'], ['y hızı', 'vy'], ['görünürlüğü', 'visible']];
  M.time = [['yıl', 'year'], ['ay', 'month'], ['gün', 'date'], ['haftanın günü', 'day'], ['saat', 'hour'], ['dakika', 'minute'], ['saniye', 'second']];

  function menuOptions(name, env) {
    var m = M[name];
    if (!m) return [];
    return typeof m === 'function' ? m(env) : m;
  }

  /* ---------------- yardımcılar ---------------- */
  function waitSecs(c, secs) {
    var end = c.rt.now() + secs * 1000;
    return (function* () {
      yield;
      while (c.rt.now() < end) yield;
    })();
  }
  function* glide(c, x1, y1, secs) {
    var a = c.actor, x0 = a.x, y0 = a.y, t0 = c.rt.now(), dur = secs * 1000;
    if (dur <= 0) { a.setPos(x1, y1); return; }
    for (;;) {
      var t = (c.rt.now() - t0) / dur;
      if (t >= 1) { a.setPos(x1, y1); return; }
      a.setPos(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      yield;
    }
  }
  function listIndex(v, len) {
    var s = U.toStr(v).toLowerCase();
    if (s === 'son' || s === 'last') return len - 1;
    if (s === 'rastgele' || s === 'random') return len ? Math.floor(Math.random() * len) : -1;
    return Math.round(U.toNum(v)) - 1;
  }
  function targetActor(c, id) {
    if (id === '_myself_') return c.actor;
    return c.rt.originalOf(id);
  }

  /* ================= OLAYLAR ================= */
  def('when_start', { cat: 'events', shape: 'hat', text: '▶ oyun başlayınca' });
  def('when_key', { cat: 'events', shape: 'hat', text: '{KEY} tuşuna basılınca', args: { KEY: menu('keys', 'space') } });
  def('when_clicked', { cat: 'events', shape: 'hat', text: 'bana tıklanınca' });
  def('when_collide', { cat: 'events', shape: 'hat', only: 'sprite', text: '{TARGET} ile çarpışınca', args: { TARGET: menu('collide', '_edge_') } });
  def('when_msg', { cat: 'events', shape: 'hat', text: '{MSG} mesajı gelince', args: { MSG: menu('messages', 'mesaj1') } });
  def('broadcast', {
    cat: 'events', shape: 'stack', text: '{MSG} mesajını yay', args: { MSG: menu('messages', 'mesaj1', true) },
    run: function (c) { c.rt.broadcast(c.s('MSG')); }
  });
  def('broadcast_wait', {
    cat: 'events', shape: 'stack', text: '{MSG} mesajını yay ve bekle', args: { MSG: menu('messages', 'mesaj1', true) },
    run: function* (c) {
      var ts = c.rt.broadcast(c.s('MSG'));
      yield;
      while (ts.some(function (t) { return !t.done; })) yield;
    }
  });

  /* ================= KONTROL ================= */
  def('wait', {
    cat: 'control', shape: 'stack', text: '{SECS} saniye bekle', args: { SECS: num(1) },
    run: function (c) { return waitSecs(c, c.n('SECS')); }
  });
  def('repeat', {
    cat: 'control', shape: 'c', text: '{TIMES} kez tekrarla', args: { TIMES: num(10) },
    run: function* (c) {
      var n = Math.round(c.n('TIMES'));
      for (var i = 0; i < n; i++) {
        yield* c.exec('SUBSTACK');
        if (c.thread.done) return;
        if (c.yieldable()) yield;
      }
    }
  });
  def('forever', {
    cat: 'control', shape: 'ccap', text: 'sürekli tekrarla',
    run: function* (c) {
      for (;;) {
        yield* c.exec('SUBSTACK');
        if (c.thread.done) return;
        if (c.yieldable()) yield;
      }
    }
  });
  def('if', {
    cat: 'control', shape: 'c', text: 'eğer {COND} ise', args: { COND: bool() },
    run: function* (c) { if (c.b('COND')) yield* c.exec('SUBSTACK'); }
  });
  def('if_else', {
    cat: 'control', shape: 'c2', text: 'eğer {COND} ise', text2: 'değilse', args: { COND: bool() },
    run: function* (c) {
      if (c.b('COND')) yield* c.exec('SUBSTACK');
      else yield* c.exec('SUBSTACK2');
    }
  });
  def('wait_until', {
    cat: 'control', shape: 'stack', text: '{COND} olana kadar bekle', args: { COND: bool() },
    run: function* (c) { while (!c.b('COND')) yield; }
  });
  def('repeat_until', {
    cat: 'control', shape: 'c', text: '{COND} olana kadar tekrarla', args: { COND: bool() },
    run: function* (c) {
      while (!c.b('COND')) {
        yield* c.exec('SUBSTACK');
        if (c.thread.done) return;
        if (c.yieldable()) yield;
      }
    }
  });
  def('while', {
    cat: 'control', shape: 'c', text: '{COND} oldukça tekrarla', args: { COND: bool() },
    run: function* (c) {
      while (c.b('COND')) {
        yield* c.exec('SUBSTACK');
        if (c.thread.done) return;
        if (c.yieldable()) yield;
      }
    }
  });
  def('for_range', {
    cat: 'control', shape: 'c', text: 'say: {VAR} = {FROM} → {TO}', args: { VAR: menu('vars', '@firstVar'), FROM: num(1), TO: num(10) },
    run: function* (c) {
      var id = c.raw('VAR'), a = c.n('FROM'), b = c.n('TO');
      var st = a <= b ? 1 : -1;
      for (var i = a; st > 0 ? i <= b : i >= b; i += st) {
        c.rt.setVar(c.actor, id, i);
        yield* c.exec('SUBSTACK');
        if (c.thread.done) return;
        if (c.yieldable()) yield;
      }
    }
  });
  def('stop', {
    cat: 'control', shape: 'stack', text: '{WHAT} durdur', args: { WHAT: menu('stop', 'all') },
    run: function (c) {
      var w = c.s('WHAT');
      if (w === 'all') c.rt.stopAll();
      else if (w === 'this') c.thread.done = true;
      else c.rt.threads.forEach(function (t) { if (t.actor === c.actor && t !== c.thread) t.done = true; });
    }
  });
  def('when_clone', { cat: 'control', shape: 'hat', only: 'sprite', text: 'klon olarak başlayınca' });
  def('create_clone', {
    cat: 'control', shape: 'stack', text: '{TARGET} klonunu oluştur', args: { TARGET: menu('clone', '@cloneDefault') },
    run: function (c) {
      var src = targetActor(c, c.s('TARGET'));
      if (src && !src.isStage) c.rt.createClone(src);
    }
  });
  def('delete_clone', {
    cat: 'control', shape: 'cap', only: 'sprite', text: 'bu klonu sil',
    run: function (c) {
      if (c.actor.isClone) {
        c.rt.deleteClone(c.actor);
        c.thread.done = true;
      }
    }
  });
  def('is_clone', { cat: 'control', shape: 'bool', only: 'sprite', text: 'klon muyum?', value: function (c) { return c.actor.isClone; } });

  /* ================= HAREKET ================= */
  def('move', {
    cat: 'motion', shape: 'stack', only: 'sprite', text: '{STEPS} adım git', args: { STEPS: num(10) },
    run: function (c) {
      var a = c.actor, s = c.n('STEPS'), r = a.dir * Math.PI / 180;
      a.setPos(a.x + Math.sin(r) * s, a.y + Math.cos(r) * s);
    }
  });
  def('turn_cw', {
    cat: 'motion', shape: 'stack', only: 'sprite', text: '↻ {DEG} derece dön', args: { DEG: num(15) },
    run: function (c) { c.actor.dir = U.wrapDir(c.actor.dir + c.n('DEG')); }
  });
  def('turn_ccw', {
    cat: 'motion', shape: 'stack', only: 'sprite', text: '↺ {DEG} derece dön', args: { DEG: num(15) },
    run: function (c) { c.actor.dir = U.wrapDir(c.actor.dir - c.n('DEG')); }
  });
  def('goto', {
    cat: 'motion', shape: 'stack', only: 'sprite', text: '{TARGET} konumuna git', args: { TARGET: menu('goto', '_random_') },
    run: function (c) {
      var p = c.rt.targetPos(c.s('TARGET'), c.actor);
      if (p) c.actor.setPos(p.x, p.y);
    }
  });
  def('goto_xy', {
    cat: 'motion', shape: 'stack', only: 'sprite', text: 'x: {X} y: {Y} konumuna git', args: { X: num(0), Y: num(0) },
    run: function (c) { c.actor.setPos(c.n('X'), c.n('Y')); }
  });
  def('glide_xy', {
    cat: 'motion', shape: 'stack', only: 'sprite', text: '{SECS} sn içinde x: {X} y: {Y} konumuna kay', args: { SECS: num(1), X: num(0), Y: num(0) },
    run: function (c) { return glide(c, c.n('X'), c.n('Y'), c.n('SECS')); }
  });
  def('glide_to', {
    cat: 'motion', shape: 'stack', only: 'sprite', text: '{SECS} sn içinde {TARGET} konumuna kay', args: { SECS: num(1), TARGET: menu('goto', '_mouse_') },
    run: function (c) {
      var p = c.rt.targetPos(c.s('TARGET'), c.actor);
      if (p) return glide(c, p.x, p.y, c.n('SECS'));
    }
  });
  def('point_dir', {
    cat: 'motion', shape: 'stack', only: 'sprite', text: '{DIR} yönüne dön', args: { DIR: num(90) },
    run: function (c) { c.actor.dir = U.wrapDir(c.n('DIR')); }
  });
  def('point_towards', {
    cat: 'motion', shape: 'stack', only: 'sprite', text: '{TARGET} tarafına dön', args: { TARGET: menu('towards', '_mouse_') },
    run: function (c) {
      var a = c.actor, p = c.rt.targetPos(c.s('TARGET'), a);
      if (!p) return;
      var dx = p.x - a.x, dy = p.y - a.y;
      if (dx || dy) a.dir = U.wrapDir(Math.atan2(dx, dy) * 180 / Math.PI);
    }
  });
  def('change_x', {
    cat: 'motion', shape: 'stack', only: 'sprite', text: "x'i {DX} değiştir", args: { DX: num(10) },
    run: function (c) { c.actor.setPos(c.actor.x + c.n('DX'), c.actor.y); }
  });
  def('set_x', {
    cat: 'motion', shape: 'stack', only: 'sprite', text: "x'i {X} yap", args: { X: num(0) },
    run: function (c) { c.actor.setPos(c.n('X'), c.actor.y); }
  });
  def('change_y', {
    cat: 'motion', shape: 'stack', only: 'sprite', text: "y'yi {DY} değiştir", args: { DY: num(10) },
    run: function (c) { c.actor.setPos(c.actor.x, c.actor.y + c.n('DY')); }
  });
  def('set_y', {
    cat: 'motion', shape: 'stack', only: 'sprite', text: "y'yi {Y} yap", args: { Y: num(0) },
    run: function (c) { c.actor.setPos(c.actor.x, c.n('Y')); }
  });
  def('bounce_edge', {
    cat: 'motion', shape: 'stack', only: 'sprite', text: 'kenara değerse sek',
    run: function (c) {
      var a = c.actor, b = a.bounds(), v = c.rt.viewRect();
      var r = a.dir * Math.PI / 180, dx = Math.sin(r), dy = Math.cos(r), hx = false, hy = false;
      if (b.l < v.l) { dx = Math.abs(dx); a.x += v.l - b.l; hx = true; }
      else if (b.r > v.r) { dx = -Math.abs(dx); a.x -= b.r - v.r; hx = true; }
      if (b.b < v.b) { dy = Math.abs(dy); a.y += v.b - b.b; hy = true; }
      else if (b.t > v.t) { dy = -Math.abs(dy); a.y -= b.t - v.t; hy = true; }
      if (hx || hy) {
        a.dir = U.wrapDir(Math.atan2(dx, dy) * 180 / Math.PI);
        if (hx) a.vx = Math.sign(dx) * Math.abs(a.vx);
        if (hy) a.vy = Math.sign(dy) * Math.abs(a.vy);
      }
    }
  });
  def('rot_style', {
    cat: 'motion', shape: 'stack', only: 'sprite', text: 'dönüş stili: {STYLE}', args: { STYLE: menu('rotstyle', 'lr') },
    run: function (c) { c.actor.rotationStyle = c.s('STYLE'); }
  });
  def('x_pos', { cat: 'motion', shape: 'rep', only: 'sprite', text: 'x konumu', value: function (c) { return Math.round(c.actor.x * 100) / 100; } });
  def('y_pos', { cat: 'motion', shape: 'rep', only: 'sprite', text: 'y konumu', value: function (c) { return Math.round(c.actor.y * 100) / 100; } });
  def('direction', { cat: 'motion', shape: 'rep', only: 'sprite', text: 'yön', value: function (c) { return c.actor.dir; } });

  /* ================= GÖRÜNÜM ================= */
  def('say_for', {
    cat: 'looks', shape: 'stack', only: 'sprite', text: '{TEXT} de, {SECS} saniye', args: { TEXT: txt('Merhaba!'), SECS: num(2) },
    run: function* (c) {
      var a = c.actor, msg = { text: c.s('TEXT'), think: false };
      a.say = msg;
      yield* waitSecs(c, c.n('SECS'));
      if (a.say === msg) a.say = null;
    }
  });
  def('say', {
    cat: 'looks', shape: 'stack', only: 'sprite', text: '{TEXT} de', args: { TEXT: txt('Merhaba!') },
    run: function (c) {
      var t = c.s('TEXT');
      c.actor.say = t === '' ? null : { text: t, think: false };
    }
  });
  def('think', {
    cat: 'looks', shape: 'stack', only: 'sprite', text: '{TEXT} diye düşün', args: { TEXT: txt('Hımm...') },
    run: function (c) {
      var t = c.s('TEXT');
      c.actor.say = t === '' ? null : { text: t, think: true };
    }
  });
  def('switch_costume', {
    cat: 'looks', shape: 'stack', only: 'sprite', text: 'kostümü {COSTUME} yap', args: { COSTUME: menu('costumes', '@firstCostume', true) },
    run: function (c) {
      c.actor.anim = null;
      c.actor.setCostume(c.v('COSTUME'));
    }
  });
  def('next_costume', {
    cat: 'looks', shape: 'stack', only: 'sprite', text: 'sonraki kostüm',
    run: function (c) {
      var a = c.actor, n = a.costumes.length;
      a.anim = null;
      if (n) a.costume = (a.costume + 1) % n;
    }
  });
  def('play_anim', {
    cat: 'looks', shape: 'stack', only: 'sprite', text: 'animasyon: kostüm {FROM} → {TO}, {FPS} fps', args: { FROM: num(1), TO: num(2), FPS: num(8) },
    run: function (c) {
      var a = c.actor, n = a.costumes.length;
      if (!n) return;
      var f = U.clamp(Math.round(c.n('FROM')), 1, n), t = U.clamp(Math.round(c.n('TO')), 1, n), fps = c.n('FPS');
      if (f > t) { var x = f; f = t; t = x; }
      if (a.anim && a.anim.from === f && a.anim.to === t) { a.anim.fps = fps; return; }
      a.anim = { from: f, to: t, fps: fps, t: 0, i: 0 };
      a.costume = f - 1;
    }
  });
  def('stop_anim', {
    cat: 'looks', shape: 'stack', only: 'sprite', text: 'animasyonu durdur',
    run: function (c) { c.actor.anim = null; }
  });
  def('switch_backdrop', {
    cat: 'looks', shape: 'stack', text: 'dekoru {BD} yap', args: { BD: menu('backdrops', '@firstBackdrop', true) },
    run: function (c) { c.rt.stage.setCostume(c.v('BD')); }
  });
  def('next_backdrop', {
    cat: 'looks', shape: 'stack', text: 'sonraki dekor',
    run: function (c) {
      var s = c.rt.stage, n = s.costumes.length;
      if (n) s.costume = (s.costume + 1) % n;
    }
  });
  def('change_size', {
    cat: 'looks', shape: 'stack', only: 'sprite', text: 'boyutu {D} değiştir', args: { D: num(10) },
    run: function (c) { c.actor.size = U.clamp(c.actor.size + c.n('D'), 1, 5000); }
  });
  def('set_size', {
    cat: 'looks', shape: 'stack', only: 'sprite', text: 'boyutu %{S} yap', args: { S: num(100) },
    run: function (c) { c.actor.size = U.clamp(c.n('S'), 1, 5000); }
  });
  def('change_effect', {
    cat: 'looks', shape: 'stack', only: 'sprite', text: '{EFFECT} efektini {V} değiştir', args: { EFFECT: menu('effects', 'color'), V: num(25) },
    run: function (c) {
      var e = c.s('EFFECT'), fx = c.actor.effects;
      fx[e] = (fx[e] || 0) + c.n('V');
      if (e === 'ghost') fx[e] = U.clamp(fx[e], 0, 100);
    }
  });
  def('set_effect', {
    cat: 'looks', shape: 'stack', only: 'sprite', text: '{EFFECT} efektini {V} yap', args: { EFFECT: menu('effects', 'ghost'), V: num(50) },
    run: function (c) {
      var e = c.s('EFFECT');
      c.actor.effects[e] = e === 'ghost' ? U.clamp(c.n('V'), 0, 100) : c.n('V');
    }
  });
  def('clear_effects', {
    cat: 'looks', shape: 'stack', only: 'sprite', text: 'efektleri temizle',
    run: function (c) { c.actor.effects = { color: 0, ghost: 0, brightness: 0 }; }
  });
  def('show', { cat: 'looks', shape: 'stack', only: 'sprite', text: 'göster', run: function (c) { c.actor.visible = true; } });
  def('hide', { cat: 'looks', shape: 'stack', only: 'sprite', text: 'gizle', run: function (c) { c.actor.visible = false; } });
  def('layer', {
    cat: 'looks', shape: 'stack', only: 'sprite', text: '{WHERE} git', args: { WHERE: menu('layer', 'front') },
    run: function (c) {
      var list = c.rt.actors, i = list.indexOf(c.actor);
      if (i < 0) return;
      list.splice(i, 1);
      if (c.s('WHERE') === 'back') list.unshift(c.actor);
      else list.push(c.actor);
    }
  });
  def('costume_num', { cat: 'looks', shape: 'rep', only: 'sprite', text: 'kostüm numarası', value: function (c) { return c.actor.costume + 1; } });
  def('costume_name', {
    cat: 'looks', shape: 'rep', only: 'sprite', text: 'kostüm adı',
    value: function (c) { var d = c.actor.costumeData(); return d ? d.name : ''; }
  });
  def('backdrop_name', {
    cat: 'looks', shape: 'rep', text: 'dekor adı',
    value: function (c) { var d = c.rt.stage.costumeData(); return d ? d.name : ''; }
  });
  def('size', { cat: 'looks', shape: 'rep', only: 'sprite', text: 'boyut', value: function (c) { return Math.round(c.actor.size); } });

  /* ================= FİZİK ================= */
  def('set_body', {
    cat: 'physics', shape: 'stack', only: 'sprite', text: 'fizik gövdesi: {TYPE}', args: { TYPE: menu('body', 'dynamic') },
    run: function (c) { c.actor.body = c.s('TYPE'); }
  });
  def('set_vel', {
    cat: 'physics', shape: 'stack', only: 'sprite', text: 'hızı x: {VX} y: {VY} yap', args: { VX: num(0), VY: num(0) },
    run: function (c) { c.actor.vx = c.n('VX'); c.actor.vy = c.n('VY'); }
  });
  def('set_vx', {
    cat: 'physics', shape: 'stack', only: 'sprite', text: 'x hızını {V} yap', args: { V: num(4) },
    run: function (c) { c.actor.vx = c.n('V'); }
  });
  def('change_vx', {
    cat: 'physics', shape: 'stack', only: 'sprite', text: 'x hızını {V} değiştir', args: { V: num(1) },
    run: function (c) { c.actor.vx += c.n('V'); }
  });
  def('set_vy', {
    cat: 'physics', shape: 'stack', only: 'sprite', text: 'y hızını {V} yap', args: { V: num(10) },
    run: function (c) { c.actor.vy = c.n('V'); }
  });
  def('change_vy', {
    cat: 'physics', shape: 'stack', only: 'sprite', text: 'y hızını {V} değiştir', args: { V: num(1) },
    run: function (c) { c.actor.vy += c.n('V'); }
  });
  def('jump', {
    cat: 'physics', shape: 'stack', only: 'sprite', text: 'yerdeysen {P} güçle zıpla', args: { P: num(12) },
    run: function (c) {
      var a = c.actor;
      if (a.onGround) { a.vy = c.n('P'); a.onGround = false; }
    }
  });
  def('push', {
    cat: 'physics', shape: 'stack', only: 'sprite', text: '{DIR} yönüne {F} itiş ver', args: { DIR: num(90), F: num(5) },
    run: function (c) {
      var r = c.n('DIR') * Math.PI / 180, f = c.n('F');
      c.actor.vx += Math.sin(r) * f;
      c.actor.vy += Math.cos(r) * f;
    }
  });
  def('set_gscale', {
    cat: 'physics', shape: 'stack', only: 'sprite', text: 'yerçekimi etkisini {G} yap', args: { G: num(1) },
    run: function (c) { c.actor.gravityScale = c.n('G'); }
  });
  def('set_bounce', {
    cat: 'physics', shape: 'stack', only: 'sprite', text: 'sekme oranını {B} yap', args: { B: num(0.5) },
    run: function (c) { c.actor.bounce = U.clamp(c.n('B'), 0, 1.2); }
  });
  def('set_friction', {
    cat: 'physics', shape: 'stack', only: 'sprite', text: 'sürtünmeyi {F} yap', args: { F: num(0.2) },
    run: function (c) { c.actor.friction = U.clamp(c.n('F'), 0, 1); }
  });
  def('set_solid_dyn', {
    cat: 'physics', shape: 'stack', only: 'sprite', text: 'diğer dinamiklerle çarpışma: {ON}', args: { ON: menu('onoff', 'on') },
    run: function (c) { c.actor.solidDyn = c.s('ON') === 'on'; }
  });
  def('on_ground', { cat: 'physics', shape: 'bool', only: 'sprite', text: 'yerde mi?', value: function (c) { return c.actor.onGround; } });
  def('hit_wall', { cat: 'physics', shape: 'bool', only: 'sprite', text: 'duvara çarptı mı?', value: function (c) { return c.actor.hitWall; } });
  def('hit_ceil', { cat: 'physics', shape: 'bool', only: 'sprite', text: 'tavana çarptı mı?', value: function (c) { return c.actor.hitCeil; } });
  def('vx', { cat: 'physics', shape: 'rep', only: 'sprite', text: 'x hızı', value: function (c) { return Math.round(c.actor.vx * 100) / 100; } });
  def('vy', { cat: 'physics', shape: 'rep', only: 'sprite', text: 'y hızı', value: function (c) { return Math.round(c.actor.vy * 100) / 100; } });

  /* ================= DÜNYA (kamera, yerçekimi, parçacık) ================= */
  def('set_gravity', {
    cat: 'world', shape: 'stack', text: 'dünya yerçekimini {G} yap', args: { G: num(0.8) },
    run: function (c) { c.rt.gravity = c.n('G'); }
  });
  def('cam_follow', {
    cat: 'world', shape: 'stack', text: 'kamera {TARGET} takip etsin', args: { TARGET: menu('follow', '@followDefault') },
    run: function (c) {
      var t = c.s('TARGET'), cam = c.rt.camera;
      if (t === '_none_') { cam.follow = null; return; }
      var a = targetActor(c, t);
      if (a && !a.isStage) {
        cam.follow = a;
        if (cam.axis !== 'y') cam.x = a.x;
        if (cam.axis !== 'x') cam.y = a.y;
      }
    }
  });
  def('cam_axis', {
    cat: 'world', shape: 'stack', text: 'kamera {AXIS} eksende takip etsin', args: { AXIS: menu('camaxis', 'x') },
    run: function (c) { c.rt.camera.axis = c.s('AXIS'); }
  });
  def('cam_goto', {
    cat: 'world', shape: 'stack', text: 'kamerayı x: {X} y: {Y} konumuna al', args: { X: num(0), Y: num(0) },
    run: function (c) {
      var cam = c.rt.camera;
      cam.follow = null;
      cam.x = c.n('X');
      cam.y = c.n('Y');
    }
  });
  def('cam_zoom', {
    cat: 'world', shape: 'stack', text: 'kamera yakınlaştırmasını %{Z} yap', args: { Z: num(100) },
    run: function (c) { c.rt.camera.zoom = U.clamp(c.n('Z') / 100, 0.1, 10); }
  });
  def('cam_shake', {
    cat: 'world', shape: 'stack', text: 'ekranı {S} güçle {SECS} sn salla', args: { S: num(6), SECS: num(0.3) },
    run: function (c) {
      var cam = c.rt.camera;
      cam.shake = c.n('S');
      cam.shakeUntil = c.rt.now() + c.n('SECS') * 1000;
    }
  });
  def('particles', {
    cat: 'world', shape: 'stack', text: '{N} parçacık patlat, renk {C}', args: { N: num(20), C: color('#ffcc33') },
    run: function (c) {
      var a = c.actor, x = a.isStage ? c.rt.camera.x : a.x, y = a.isStage ? c.rt.camera.y : a.y;
      c.rt.emitParticles(x, y, c.n('N'), c.s('C'));
    }
  });
  def('set_bg', {
    cat: 'world', shape: 'stack', text: 'arka plan rengini {C} yap', args: { C: color('#87ceeb') },
    run: function (c) { c.rt.bgColor = c.s('C'); }
  });
  def('cam_x', { cat: 'world', shape: 'rep', text: 'kamera x', value: function (c) { return Math.round(c.rt.camera.x); } });
  def('cam_y', { cat: 'world', shape: 'rep', text: 'kamera y', value: function (c) { return Math.round(c.rt.camera.y); } });

  /* ================= SEVİYE & KARO HARİTASI ================= */
  function tileIdOf(v) { return v === '_empty_' || v === '' ? null : v; }
  def('when_level', { cat: 'level', shape: 'hat', text: 'seviye başlayınca' });
  def('goto_level', {
    cat: 'level', shape: 'stack', text: '{LEVEL} seviyesine geç', args: { LEVEL: menu('levels', '_next_', true) },
    run: function (c) { c.rt.requestLevel(c.s('LEVEL')); }
  });
  def('level_num', { cat: 'level', shape: 'rep', text: 'seviye numarası', value: function (c) { return c.rt.levelIndex + 1; } });
  def('level_name', { cat: 'level', shape: 'rep', text: 'seviye adı', value: function (c) { return c.rt.level ? c.rt.level.name : ''; } });
  def('level_count', { cat: 'level', shape: 'rep', text: 'seviye sayısı', value: function (c) { return (c.rt.project.levels || []).length; } });
  def('touching_tile', {
    cat: 'level', shape: 'bool', only: 'sprite', text: '{TILE} karosuna değiyor mu?', args: { TILE: menu('tiles', '_solid_') },
    value: function (c) { return c.rt.touchingTile(c.actor, c.s('TILE')); }
  });
  def('replace_touching', {
    cat: 'level', shape: 'stack', only: 'sprite', text: 'değdiğim {TILE} karolarını {NEW} yap', args: { TILE: menu('tiles', '@firstTile'), NEW: menu('tilesSet', '_empty_') },
    run: function (c) { c.rt.replaceTouching(c.actor, c.s('TILE'), tileIdOf(c.s('NEW'))); }
  });
  def('set_tile', {
    cat: 'level', shape: 'stack', text: 'x: {X} y: {Y} noktasına {TILE} koy', args: { X: num(0), Y: num(0), TILE: menu('tilesSet', '@firstTile') },
    run: function (c) { c.rt.setTileAtWorld(c.n('X'), c.n('Y'), tileIdOf(c.s('TILE'))); }
  });
  def('tile_at', {
    cat: 'level', shape: 'rep', text: 'x: {X} y: {Y} noktasındaki karo', args: { X: num(0), Y: num(0) },
    value: function (c) { var td = c.rt.tileDef(c.rt.tileAtWorld(c.n('X'), c.n('Y'))); return td ? td.name : ''; }
  });
  def('tile_under', {
    cat: 'level', shape: 'rep', only: 'sprite', text: 'ayağımın altındaki karo',
    value: function (c) {
      var a = c.actor, td = c.rt.tileDef(c.rt.tileAtWorld(a.x, a.bounds().b - 2));
      return td ? td.name : '';
    }
  });
  def('tile_size', { cat: 'level', shape: 'rep', text: 'karo boyutu', value: function (c) { return c.rt.tileSize; } });

  /* ================= SES ================= */
  def('play_sound', {
    cat: 'sound', shape: 'stack', text: '{SOUND} sesini çal', args: { SOUND: menu('sounds', '@firstSound', true) }, needs: 'sounds',
    run: function (c) { c.rt.playSound(c.actor, c.s('SOUND')); }
  });
  def('play_sound_wait', {
    cat: 'sound', shape: 'stack', text: '{SOUND} sesini sonuna kadar çal', args: { SOUND: menu('sounds', '@firstSound', true) }, needs: 'sounds',
    run: function* (c) {
      var h = c.rt.playSound(c.actor, c.s('SOUND'));
      if (!h) return;
      yield;
      while (!h.done) yield;
    }
  });
  def('play_music', {
    cat: 'sound', shape: 'stack', text: '{SOUND} müziğini döngüde çal', args: { SOUND: menu('sounds', '@firstSound', true) }, needs: 'sounds',
    run: function (c) { c.rt.playMusic(c.actor, c.s('SOUND')); }
  });
  def('stop_music', { cat: 'sound', shape: 'stack', text: 'müziği durdur', run: function (c) { c.rt.stopMusic(); } });
  def('play_sfx', {
    cat: 'sound', shape: 'stack', text: '{SFX} efektini çal', args: { SFX: menu('sfx', 'jump') },
    run: function (c) { SE.audio.play(c.s('SFX')); }
  });
  def('play_note', {
    cat: 'sound', shape: 'stack', text: '{NOTE} notasını {SECS} sn çal', args: { NOTE: num(60), SECS: num(0.25) },
    run: function (c) {
      var d = Math.max(0, c.n('SECS'));
      SE.audio.note(c.n('NOTE'), d, c.actor.instrument);
      return waitSecs(c, d);
    }
  });
  def('set_instrument', {
    cat: 'sound', shape: 'stack', text: 'enstrümanı {W} yap', args: { W: menu('waves', 'square') },
    run: function (c) { c.actor.instrument = c.s('W'); }
  });
  def('set_volume', {
    cat: 'sound', shape: 'stack', text: 'ses seviyesini %{V} yap', args: { V: num(100) },
    run: function (c) { SE.audio.setVolume(c.n('V') / 100); }
  });
  def('stop_sounds', {
    cat: 'sound', shape: 'stack', text: 'tüm sesleri durdur',
    run: function (c) { SE.audio.stopAll(); c.rt.music = null; }
  });
  def('volume', { cat: 'sound', shape: 'rep', text: 'ses seviyesi', value: function () { return Math.round(SE.audio.getVolume() * 100); } });

  /* ================= ALGILAMA ================= */
  def('touching', {
    cat: 'sensing', shape: 'bool', only: 'sprite', text: '{TARGET} değiyor mu?', args: { TARGET: menu('touch', '_mouse_') },
    value: function (c) { return c.rt.isTouching(c.actor, c.s('TARGET')); }
  });
  def('key_pressed', {
    cat: 'sensing', shape: 'bool', text: '{KEY} tuşu basılı mı?', args: { KEY: menu('keys', 'space') },
    value: function (c) {
      var k = c.s('KEY');
      return k === 'any' ? c.rt.keys.size > 0 : c.rt.keys.has(k);
    }
  });
  def('mouse_down', { cat: 'sensing', shape: 'bool', text: 'fare basılı mı?', value: function (c) { return c.rt.mouse.down; } });
  def('mouse_x', { cat: 'sensing', shape: 'rep', text: 'fare x', value: function (c) { return c.rt.mouse.x; } });
  def('mouse_y', { cat: 'sensing', shape: 'rep', text: 'fare y', value: function (c) { return c.rt.mouse.y; } });
  def('distance_to', {
    cat: 'sensing', shape: 'rep', only: 'sprite', text: '{TARGET} uzaklığı', args: { TARGET: menu('towards', '_mouse_') },
    value: function (c) {
      var p = c.rt.targetPos(c.s('TARGET'), c.actor);
      if (!p) return 10000;
      return Math.round(Math.hypot(p.x - c.actor.x, p.y - c.actor.y) * 100) / 100;
    }
  });
  def('ask', {
    cat: 'sensing', shape: 'stack', text: '{TEXT} diye sor ve bekle', args: { TEXT: txt('Adın ne?') },
    run: function* (c) {
      while (c.rt.askState && !c.rt.askState.done) yield;
      var st = c.rt.ask(c.s('TEXT'));
      while (!st.done) yield;
    }
  });
  def('answer', { cat: 'sensing', shape: 'rep', text: 'cevap', value: function (c) { return c.rt.answer; } });
  def('timer', {
    cat: 'sensing', shape: 'rep', text: 'zamanlayıcı',
    value: function (c) { return Math.round((c.rt.now() - c.rt.timerStart) / 10) / 100; }
  });
  def('reset_timer', { cat: 'sensing', shape: 'stack', text: 'zamanlayıcıyı sıfırla', run: function (c) { c.rt.timerStart = c.rt.now(); } });
  def('prop_of', {
    cat: 'sensing', shape: 'rep', text: '{SPRITE} karakterinin {PROP}', args: { SPRITE: menu('sprites', '@firstSprite'), PROP: menu('props', 'x') },
    value: function (c) {
      var a = c.rt.originalOf(c.s('SPRITE'));
      if (!a || a.isStage) return '';
      switch (c.s('PROP')) {
        case 'x': return Math.round(a.x * 100) / 100;
        case 'y': return Math.round(a.y * 100) / 100;
        case 'dir': return a.dir;
        case 'size': return Math.round(a.size);
        case 'costume': return a.costume + 1;
        case 'vx': return Math.round(a.vx * 100) / 100;
        case 'vy': return Math.round(a.vy * 100) / 100;
        case 'visible': return a.visible;
      }
      return '';
    }
  });
  def('current', {
    cat: 'sensing', shape: 'rep', text: 'şu anki {UNIT}', args: { UNIT: menu('time', 'hour') },
    value: function (c) {
      var d = new Date();
      switch (c.s('UNIT')) {
        case 'year': return d.getFullYear();
        case 'month': return d.getMonth() + 1;
        case 'date': return d.getDate();
        case 'day': return d.getDay() || 7;
        case 'hour': return d.getHours();
        case 'minute': return d.getMinutes();
        case 'second': return d.getSeconds();
      }
      return '';
    }
  });

  /* ================= İŞLEMLER ================= */
  function binop(op, sym, fn, shape) {
    def(op, {
      cat: 'ops', shape: shape || 'rep', text: '{A} ' + sym + ' {B}', args: { A: num(''), B: num('') },
      value: function (c) { return fn(c); }
    });
  }
  binop('add', '+', function (c) { return c.n('A') + c.n('B'); });
  binop('sub', '−', function (c) { return c.n('A') - c.n('B'); });
  binop('mul', '×', function (c) { return c.n('A') * c.n('B'); });
  binop('div', '÷', function (c) { return c.n('A') / c.n('B'); });
  binop('mod', 'mod', function (c) {
    var a = c.n('A'), b = c.n('B');
    var r = a % b;
    return r / b < 0 ? r + b : r;
  });
  def('random', {
    cat: 'ops', shape: 'rep', text: '{A} ile {B} arası rastgele', args: { A: num(1), B: num(10) },
    value: function (c) {
      var ra = c.v('A'), rb = c.v('B'), a = U.toNum(ra), b = U.toNum(rb);
      if (a > b) { var t = a; a = b; b = t; }
      var dec = String(ra).indexOf('.') >= 0 || String(rb).indexOf('.') >= 0 || !Number.isInteger(a) || !Number.isInteger(b);
      return dec ? U.rand(a, b) : a + Math.floor(Math.random() * (b - a + 1));
    }
  });
  def('gt', { cat: 'ops', shape: 'bool', text: '{A} > {B}', args: { A: txt(''), B: txt('50') }, value: function (c) { return U.compare(c.v('A'), c.v('B')) > 0; } });
  def('lt', { cat: 'ops', shape: 'bool', text: '{A} < {B}', args: { A: txt(''), B: txt('50') }, value: function (c) { return U.compare(c.v('A'), c.v('B')) < 0; } });
  def('eq', { cat: 'ops', shape: 'bool', text: '{A} = {B}', args: { A: txt(''), B: txt('50') }, value: function (c) { return U.compare(c.v('A'), c.v('B')) === 0; } });
  def('and', { cat: 'ops', shape: 'bool', text: '{A} ve {B}', args: { A: bool(), B: bool() }, value: function (c) { return c.b('A') && c.b('B'); } });
  def('or', { cat: 'ops', shape: 'bool', text: '{A} veya {B}', args: { A: bool(), B: bool() }, value: function (c) { return c.b('A') || c.b('B'); } });
  def('not', { cat: 'ops', shape: 'bool', text: '{A} değil', args: { A: bool() }, value: function (c) { return !c.b('A'); } });
  def('join', {
    cat: 'ops', shape: 'rep', text: 'birleştir {A} {B}', args: { A: txt('elma '), B: txt('armut') },
    value: function (c) { return c.s('A') + c.s('B'); }
  });
  def('letter_of', {
    cat: 'ops', shape: 'rep', text: '{S} metninin {I}. harfi', args: { S: txt('elma'), I: num(1) },
    value: function (c) { return c.s('S').charAt(Math.round(c.n('I')) - 1); }
  });
  def('length_of', { cat: 'ops', shape: 'rep', text: '{S} uzunluğu', args: { S: txt('elma') }, value: function (c) { return c.s('S').length; } });
  def('contains', {
    cat: 'ops', shape: 'bool', text: '{A} içinde {B} var mı?', args: { A: txt('elma'), B: txt('e') },
    value: function (c) { return c.s('A').toLocaleLowerCase('tr').indexOf(c.s('B').toLocaleLowerCase('tr')) >= 0; }
  });
  def('round', { cat: 'ops', shape: 'rep', text: '{A} yuvarla', args: { A: num('') }, value: function (c) { return Math.round(c.n('A')); } });
  def('math', {
    cat: 'ops', shape: 'rep', text: '{FN} ( {A} )', args: { FN: menu('math', 'abs'), A: num('') },
    value: function (c) {
      var x = c.n('A'), d = Math.PI / 180;
      switch (c.s('FN')) {
        case 'abs': return Math.abs(x);
        case 'floor': return Math.floor(x);
        case 'ceil': return Math.ceil(x);
        case 'sqrt': return Math.sqrt(x);
        case 'sin': return Math.round(Math.sin(x * d) * 1e10) / 1e10;
        case 'cos': return Math.round(Math.cos(x * d) * 1e10) / 1e10;
        case 'tan': return Math.tan(x * d);
        case 'asin': return Math.asin(x) / d;
        case 'acos': return Math.acos(x) / d;
        case 'atan': return Math.atan(x) / d;
        case 'ln': return Math.log(x);
        case 'log': return Math.log10(x);
        case 'exp': return Math.exp(x);
        case 'pow10': return Math.pow(10, x);
      }
      return 0;
    }
  });

  /* ================= DEĞİŞKENLER ================= */
  def('var', {
    cat: 'vars', shape: 'rep', text: '{VAR}', args: { VAR: { t: 'varname', v: '@firstVar' } }, palette: false,
    value: function (c) { return c.rt.getVar(c.actor, c.raw('VAR')); }
  });
  def('set_var', {
    cat: 'vars', shape: 'stack', text: '{VAR} değişkenini {V} yap', args: { VAR: menu('vars', '@firstVar'), V: txt('0') }, needs: 'vars',
    run: function (c) { c.rt.setVar(c.actor, c.raw('VAR'), c.v('V')); }
  });
  def('change_var', {
    cat: 'vars', shape: 'stack', text: '{VAR} değişkenini {V} artır', args: { VAR: menu('vars', '@firstVar'), V: num(1) }, needs: 'vars',
    run: function (c) {
      var id = c.raw('VAR');
      c.rt.setVar(c.actor, id, U.toNum(c.rt.getVar(c.actor, id)) + c.n('V'));
    }
  });
  def('show_var', {
    cat: 'vars', shape: 'stack', text: '{VAR} değişkenini göster', args: { VAR: menu('vars', '@firstVar') }, needs: 'vars',
    run: function (c) { c.rt.monitors.add(c.raw('VAR')); }
  });
  def('hide_var', {
    cat: 'vars', shape: 'stack', text: '{VAR} değişkenini gizle', args: { VAR: menu('vars', '@firstVar') }, needs: 'vars',
    run: function (c) { c.rt.monitors.delete(c.raw('VAR')); }
  });

  /* ================= LİSTELER ================= */
  function L(c) { return c.rt.getList(c.actor, c.raw('LIST')) || []; }
  def('list', {
    cat: 'lists', shape: 'rep', text: '{LIST}', args: { LIST: { t: 'varname', v: '@firstList' } }, palette: false,
    value: function (c) { return L(c).map(U.toStr).join(' '); }
  });
  def('list_add', {
    cat: 'lists', shape: 'stack', text: '{V} öğesini {LIST} listesine ekle', args: { V: txt('şey'), LIST: menu('lists', '@firstList') }, needs: 'lists',
    run: function (c) { var l = L(c); if (l.length < 200000) l.push(c.v('V')); }
  });
  def('list_del', {
    cat: 'lists', shape: 'stack', text: '{LIST} listesinden {I}. öğeyi sil', args: { LIST: menu('lists', '@firstList'), I: num(1) }, needs: 'lists',
    run: function (c) {
      var l = L(c), i = listIndex(c.v('I'), l.length);
      if (i >= 0 && i < l.length) l.splice(i, 1);
    }
  });
  def('list_clear', {
    cat: 'lists', shape: 'stack', text: '{LIST} listesini temizle', args: { LIST: menu('lists', '@firstList') }, needs: 'lists',
    run: function (c) { L(c).length = 0; }
  });
  def('list_insert', {
    cat: 'lists', shape: 'stack', text: '{V} öğesini {LIST} listesinde {I}. sıraya ekle', args: { V: txt('şey'), LIST: menu('lists', '@firstList'), I: num(1) }, needs: 'lists',
    run: function (c) {
      var l = L(c), i = listIndex(c.v('I'), l.length + 1);
      if (i >= 0 && i <= l.length) l.splice(i, 0, c.v('V'));
    }
  });
  def('list_set', {
    cat: 'lists', shape: 'stack', text: '{LIST} listesinin {I}. öğesini {V} yap', args: { LIST: menu('lists', '@firstList'), I: num(1), V: txt('şey') }, needs: 'lists',
    run: function (c) {
      var l = L(c), i = listIndex(c.v('I'), l.length);
      if (i >= 0 && i < l.length) l[i] = c.v('V');
    }
  });
  def('list_item', {
    cat: 'lists', shape: 'rep', text: '{LIST} listesinin {I}. öğesi', args: { LIST: menu('lists', '@firstList'), I: num(1) }, needs: 'lists',
    value: function (c) {
      var l = L(c), i = listIndex(c.v('I'), l.length);
      return i >= 0 && i < l.length ? l[i] : '';
    }
  });
  def('list_len', {
    cat: 'lists', shape: 'rep', text: '{LIST} uzunluğu', args: { LIST: menu('lists', '@firstList') }, needs: 'lists',
    value: function (c) { return L(c).length; }
  });
  def('list_has', {
    cat: 'lists', shape: 'bool', text: '{LIST} listesi {V} içeriyor mu?', args: { LIST: menu('lists', '@firstList'), V: txt('şey') }, needs: 'lists',
    value: function (c) {
      var v = c.v('V');
      return L(c).some(function (x) { return U.compare(x, v) === 0; });
    }
  });

  /* ================= KALEM ================= */
  def('pen_clear', { cat: 'pen', shape: 'stack', text: 'çizimleri temizle', run: function (c) { c.rt.penClear(); } });
  def('stamp', { cat: 'pen', shape: 'stack', only: 'sprite', text: 'damga bas', run: function (c) { c.rt.stamp(c.actor); } });
  def('pen_down', {
    cat: 'pen', shape: 'stack', only: 'sprite', text: 'kalemi indir',
    run: function (c) {
      var a = c.actor;
      a.pen.down = true;
      c.rt.penLine(a.x, a.y, a.x, a.y, a.pen);
    }
  });
  def('pen_up', { cat: 'pen', shape: 'stack', only: 'sprite', text: 'kalemi kaldır', run: function (c) { c.actor.pen.down = false; } });
  def('pen_color', {
    cat: 'pen', shape: 'stack', only: 'sprite', text: 'kalem rengini {C} yap', args: { C: color('#3b82f6') },
    run: function (c) { c.actor.pen.color = c.s('C'); }
  });
  def('pen_size', {
    cat: 'pen', shape: 'stack', only: 'sprite', text: 'kalem kalınlığını {S} yap', args: { S: num(3) },
    run: function (c) { c.actor.pen.size = U.clamp(c.n('S'), 0.5, 500); }
  });

  /* ================= FONKSİYONLAR ================= */
  def('proc_def', { cat: 'procs', shape: 'hat', text: 'tanımla', palette: false });
  def('proc_call', {
    cat: 'procs', shape: 'stack', text: '', palette: false,
    run: function* (c) {
      var b = c.block, d = c.rt.findProc(c.actor, b.proc);
      if (!d) return;
      var frame = {};
      (d.params || []).forEach(function (p, i) { frame[p] = c.v('P' + i); });
      c.thread.frames.push(frame);
      if (d.warp) c.thread.warp++;
      yield* c.rt.execStack(d.next, c.thread);
      if (d.warp) c.thread.warp--;
      c.thread.frames.pop();
    }
  });
  def('proc_arg', {
    cat: 'procs', shape: 'rep', text: '', palette: false,
    value: function (c) {
      var f = c.thread.frames[c.thread.frames.length - 1];
      return f && Object.prototype.hasOwnProperty.call(f, c.block.arg) ? f[c.block.arg] : '';
    }
  });

  /* ---------------- dış API ---------------- */
  var catMap = {};
  cats.forEach(function (c) { catMap[c.id] = c; });

  function resolveDefault(v, env) {
    if (typeof v !== 'string' || v.charAt(0) !== '@') return v;
    if (!env) return '';
    var o;
    switch (v) {
      case '@firstVar': o = M.vars(env); return o.length ? o[0][1] : '';
      case '@firstList': o = M.lists(env); return o.length ? o[0][1] : '';
      case '@firstCostume': o = M.costumes(env); return o.length ? o[Math.min(1, o.length - 1)][1] : '';
      case '@firstBackdrop': o = M.backdrops(env); return o.length ? o[0][1] : '';
      case '@firstSprite': o = M.sprites(env); return o.length ? o[0][1] : '';
      case '@cloneDefault': return env.isStage ? (env.project.sprites[0] ? env.project.sprites[0].id : '') : '_myself_';
      case '@followDefault': return env.isStage ? (env.project.sprites[0] ? env.project.sprites[0].id : '_none_') : '_myself_';
      case '@firstTile': o = (env.project.tileset && env.project.tileset.costumes) || []; return o.length ? String(o[0].id) : '_empty_';
      case '@firstSound': o = M.sounds(env); return o.length ? o[0][1] : '';
    }
    return '';
  }

  function shapeOf(b) {
    var d = b && defs[b.op];
    return d ? d.shape : 'stack';
  }

  SE.blocks = {
    defs: defs,
    order: order,
    cats: cats,
    cat: function (id) { return catMap[id]; },
    menus: M,
    menuOptions: menuOptions,
    shapeOf: shapeOf,
    resolveDefault: resolveDefault,
    isHat: function (b) { return shapeOf(b) === 'hat'; },
    isReporter: function (b) { var s = shapeOf(b); return s === 'rep' || s === 'bool'; },
    /* Varsayılan girdilerle yeni bir blok modeli üret. */
    create: function (op, env, inputs) {
      var d = defs[op];
      var b = { op: op, inputs: {}, next: null };
      if (!d) return b;
      Object.keys(d.args).forEach(function (k) {
        var a = d.args[k];
        b.inputs[k] = { value: a.v == null ? '' : resolveDefault(a.v, env) };
      });
      if (d.shape === 'c' || d.shape === 'ccap') b.substacks = { SUBSTACK: null };
      if (d.shape === 'c2') b.substacks = { SUBSTACK: null, SUBSTACK2: null };
      if (inputs) Object.keys(inputs).forEach(function (k) { b.inputs[k] = { value: inputs[k] }; });
      return b;
    },
    cloneBlock: function (b) { return U.clone(b); },
    /* Bir blok ağacındaki tüm blokları ziyaret et */
    walk: function walk(b, fn) {
      while (b) {
        fn(b);
        if (b.inputs) for (var k in b.inputs) if (b.inputs[k] && b.inputs[k].block) walk(b.inputs[k].block, fn);
        if (b.substacks) for (var s in b.substacks) if (b.substacks[s]) walk(b.substacks[s], fn);
        b = b.next;
      }
    }
  };
});
