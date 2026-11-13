/* Stackit Engine — betik yorumlayıcısı
 * Her betik bir "thread"dir (JS generator). Döngüler her turda bir kare bekler;
 * böylece binlerce betik aynı anda, oyunu dondurmadan çalışır. */
SE.module('vm', function (SE) {
  var U = SE.util;
  var Engine = SE.Engine;

  class Thread {
    constructor(engine, actor, top) {
      this.engine = engine;
      this.actor = actor;
      this.top = top;
      this.done = false;
      this.warp = 0;
      this.frames = [];
      var def = SE.blocks.defs[top.op];
      var start = def && def.shape === 'hat' ? top.next : top;
      this.gen = engine.execStack(start, this);
    }
  }
  SE.Thread = Thread;

  class Ctx {
    constructor(engine, thread, block) {
      this.rt = engine;
      this.thread = thread;
      this.block = block;
      this.actor = thread.actor;
    }
    v(name) {
      var inp = this.block.inputs && this.block.inputs[name];
      if (!inp) return '';
      if (inp.block) return this.rt.evalReporter(inp.block, this.thread);
      return inp.value == null ? '' : inp.value;
    }
    n(name) { return U.toNum(this.v(name)); }
    s(name) { return U.toStr(this.v(name)); }
    b(name) { return U.toBool(this.v(name)); }
    raw(name) {
      var inp = this.block.inputs && this.block.inputs[name];
      return inp ? inp.value : '';
    }
    exec(name) {
      var sub = this.block.substacks && this.block.substacks[name];
      return this.rt.execStack(sub, this.thread);
    }
    /* Döngü sonunda kare beklenmeli mi? (hızlı fonksiyonlarda beklenmez) */
    yieldable() {
      return !this.thread.warp || performance.now() - this.rt.stepStart > 500;
    }
  }
  SE.Ctx = Ctx;

  var P = Engine.prototype;

  P.execStack = function* (block, thread) {
    var defs = SE.blocks.defs;
    while (block) {
      if (thread.done) return;
      var def = defs[block.op];
      if (def && def.run) {
        var r = def.run(new Ctx(this, thread, block));
        if (r && typeof r.next === 'function') yield* r;
      }
      if (thread.done) return;
      block = block.next;
    }
  };

  P.evalReporter = function (block, thread) {
    var def = SE.blocks.defs[block.op];
    if (!def || !def.value) return '';
    var v = def.value(new Ctx(this, thread, block));
    return v == null ? '' : v;
  };

  P.startThread = function (actor, top, mode) {
    for (var i = 0; i < this.threads.length; i++) {
      var t = this.threads[i];
      if (t.actor === actor && t.top === top && !t.done) {
        if (mode === 'skip') return null;
        t.done = true;
      }
    }
    var th = new Thread(this, actor, top);
    this.threads.push(th);
    return th;
  };

  P.fireHat = function (op, match, actors) {
    actors = actors || this.allActors();
    var started = [];
    var restart = op === 'when_msg';
    for (var i = 0; i < actors.length; i++) {
      var a = actors[i];
      if (!a || a.dead) continue;
      var scripts = a.data.scripts || [];
      for (var k = 0; k < scripts.length; k++) {
        var b = scripts[k].block;
        if (!b || b.op !== op) continue;
        if (match && !match(b, a)) continue;
        var t = this.startThread(a, b, restart ? 'restart' : 'skip');
        if (t) started.push(t);
      }
    }
    return started;
  };

  P.broadcast = function (msg) {
    var m = U.toStr(msg).toLocaleLowerCase('tr');
    return this.fireHat('when_msg', function (b) {
      var v = b.inputs && b.inputs.MSG ? U.toStr(b.inputs.MSG.value) : '';
      return v.toLocaleLowerCase('tr') === m;
    });
  };

  P.runThreads = function () {
    var list = this.threads;
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (t.done) continue;
      if (t.actor.dead) { t.done = true; continue; }
      try {
        if (t.gen.next().done) t.done = true;
      } catch (err) {
        t.done = true;
        console.error('[Stackit] Betik hatası:', err);
        this.emit('error', err);
      }
      if (this.halted) break;
    }
    if (this.halted) this.threads = [];
    else this.threads = this.threads.filter(function (t) { return !t.done; });
  };

  /* Editörde bir betiğe tıklanınca: çalışıyorsa durdur, değilse başlat. */
  P.toggleScript = function (actor, top) {
    for (var i = 0; i < this.threads.length; i++) {
      var t = this.threads[i];
      if (t.top === top && t.actor === actor && !t.done) {
        t.done = true;
        return false;
      }
    }
    if (this.halted) this.halted = false;
    this.startThread(actor, top, 'restart');
    return true;
  };

  P.isScriptRunning = function (top) {
    for (var i = 0; i < this.threads.length; i++) if (this.threads[i].top === top && !this.threads[i].done) return true;
    return false;
  };

  P.findProc = function (actor, name) {
    var key = actor.data.id + '::' + name;
    var hit = this.procCache.get(key);
    if (hit && hit.op === 'proc_def' && hit.proc === name) return hit;
    var scripts = actor.data.scripts || [];
    for (var i = 0; i < scripts.length; i++) {
      var b = scripts[i].block;
      if (b && b.op === 'proc_def' && b.proc === name) {
        this.procCache.set(key, b);
        return b;
      }
    }
    return null;
  };
});
