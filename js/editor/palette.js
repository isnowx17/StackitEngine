/* Stackit — blok paleti (kategoriler + sürüklenebilir şablon bloklar) */
(function () {
  var B = SE.blocks;

  function Palette(app, catsEl, listEl) {
    this.app = app;
    this.catsEl = catsEl;
    this.listEl = listEl;
    this.sections = [];
    var self = this;
    listEl.addEventListener('scroll', function () { self.syncCat(); });
    listEl.addEventListener('contextmenu', function (e) { self.onContext(e); });
  }
  var P = Palette.prototype;

  P.render = function () {
    var app = this.app, env = app.blockEnv({ palette: true });
    var isStage = env.isStage, self = this;
    var scroll = this.listEl.scrollTop;
    this.catsEl.innerHTML = '';
    this.listEl.innerHTML = '';
    this.sections = [];

    B.cats.forEach(function (cat) {
      var col = BV.catColors[cat.id];
      var ops = B.order.filter(function (op) {
        var d = B.defs[op];
        return d.cat === cat.id && d.palette !== false && (!d.only || d.only === (isStage ? 'stage' : 'sprite'));
      });
      var sec = UI.el('div', 'pal-sec');
      var head = UI.el('div', 'pal-head', cat.name);
      head.style.setProperty('--c', col.c);
      sec.appendChild(head);
      var count = 0;

      if (cat.id === 'vars' || cat.id === 'lists') {
        var isList = cat.id === 'lists';
        var mk = UI.el('button', 'pal-btn', isList ? '+ Liste oluştur' : '+ Değişken oluştur');
        mk.type = 'button';
        mk.addEventListener('click', function () { app.createVariable(isList); });
        sec.appendChild(mk);
        var key = isList ? 'lists' : 'variables';
        var mine = (app.project.stage[key] || []).map(function (v) { return { v: v, owner: app.project.stage }; });
        if (!isStage) mine = mine.concat((env.target[key] || []).map(function (v) { return { v: v, owner: env.target }; }));
        mine.forEach(function (it) {
          var row = UI.el('div', 'pal-var');
          var cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = !!it.v.monitor;
          cb.title = 'Sahnede göster';
          cb.addEventListener('change', function () { app.setMonitor(it.v, cb.checked); });
          row.appendChild(cb);
          var blk = B.create(isList ? 'list' : 'var', env);
          blk.inputs[isList ? 'LIST' : 'VAR'] = { value: it.v.id };
          var el = BV.render(blk, env);
          el.dataset.varId = it.v.id;
          el.dataset.isList = isList ? '1' : '';
          row.appendChild(el);
          if (it.owner !== app.project.stage) row.appendChild(UI.el('span', 'pal-local', 'yerel'));
          sec.appendChild(row);
        });
        if (!mine.length) ops = [];
      }

      if (cat.id === 'procs') {
        var mkp = UI.el('button', 'pal-btn', '+ Fonksiyon oluştur');
        mkp.type = 'button';
        mkp.addEventListener('click', function () { app.createProc(); });
        sec.appendChild(mkp);
        (env.target.scripts || []).forEach(function (s) {
          var d = s.block;
          if (!d || d.op !== 'proc_def') return;
          var call = { op: 'proc_call', proc: d.proc, params: (d.params || []).slice(), inputs: {}, next: null };
          (d.params || []).forEach(function (p, i) { call.inputs['P' + i] = { value: '' }; });
          sec.appendChild(self.item(call, env));
          (d.params || []).forEach(function (p) {
            sec.appendChild(self.item({ op: 'proc_arg', arg: p, inputs: {}, next: null }, env));
          });
          count++;
        });
        if (!count) sec.appendChild(UI.el('div', 'pal-note', 'Kendi bloklarını yap: tekrar eden işleri tek bir blokta topla.'));
      }

      ops.forEach(function (op) {
        var d = B.defs[op];
        if (d.needs === 'vars' && !B.menus.vars(env).length) return;
        if (d.needs === 'lists' && !B.menus.lists(env).length) return;
        if (d.needs === 'sounds' && !B.menus.sounds(env).length) {
          if (!sec._soundNote) {
            sec._soundNote = true;
            sec.appendChild(UI.el('div', 'pal-note', '"Sesler" sekmesinden müzik yap ya da ses yükle; çalma blokları burada görünür.'));
          }
          return;
        }
        sec.appendChild(self.item(B.create(op, env), env));
        count++;
      });

      if (!count && cat.id !== 'vars' && cat.id !== 'lists' && cat.id !== 'procs') {
        if (!isStage) return;
        sec.appendChild(UI.el('div', 'pal-note', 'Sahne seçiliyken bu kategoride blok yok. Bir karakter seç.'));
      }

      self.listEl.appendChild(sec);
      var btn = UI.el('button', 'cat-btn');
      btn.type = 'button';
      btn.style.setProperty('--c', col.c);
      btn.appendChild(UI.el('span', 'cat-dot'));
      btn.appendChild(UI.el('span', 'cat-name', cat.name));
      btn.addEventListener('click', function () {
        self.listEl.scrollTo({ top: sec.offsetTop - 6, behavior: 'smooth' });
      });
      self.catsEl.appendChild(btn);
      self.sections.push({ sec: sec, btn: btn });
    });
    this.listEl.scrollTop = scroll;
    this.syncCat();
  };

  P.item = function (block, env) {
    var w = UI.el('div', 'pal-item');
    w.appendChild(BV.render(block, env));
    return w;
  };

  P.syncCat = function () {
    var top = this.listEl.scrollTop + 30, cur = null;
    this.sections.forEach(function (s) { if (s.sec.offsetTop <= top) cur = s; });
    if (!cur && this.sections.length) cur = this.sections[0];
    this.sections.forEach(function (s) { s.btn.classList.toggle('active', s === cur); });
  };

  P.onContext = function (e) {
    var el = e.target.closest('[data-var-id]');
    if (!el) return;
    e.preventDefault();
    var app = this.app, id = el.dataset.varId, isList = !!el.dataset.isList;
    UI.menu(e.clientX, e.clientY, [
      { label: 'Yeniden adlandır', value: 'rename' },
      { label: 'Sil', value: 'delete', danger: true }
    ], function (v) {
      if (v === 'rename') app.renameVariable(id, isList);
      else app.deleteVariable(id, isList);
    });
  };

  window.Palette = Palette;
})();
