/* Stackit — açılış ekranı: projelerim, devam et, yeni proje */
(function () {
  var Home = (window.Home = { sort: 'modified', query: '', tplThumbs: {} });

  function icon(path, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
  }
  var IC_PLUS = 'M12 5v14M5 12h14';
  var IC_PLAY = 'M8 5l11 7-11 7z';
  var IC_MORE = 'M5 12h.01M12 12h.01M19 12h.01';
  var IC_FOLDER = 'M3 6h6l2 2h10v11H3zM3 10h18';

  Home.templates = function () {
    var Ex = StackitExamples;
    return [
      { id: 'blank', name: 'Boş proje', desc: 'Robo ve boş bir sahne. Her şeyi sen kur.', make: Ex.blank },
      { id: 'platformer', name: 'Platform Macerası', desc: 'Karo haritası, 2 seviye, asansör, düşman ve müzik.', make: Ex.platformer },
      { id: 'shooter', name: 'Uzay Atıcı', desc: 'Klonlarla mermiler, düşman dalgaları, patlamalar.', make: Ex.shooter }
    ];
  };

  Home.relTime = function (ts) {
    if (!ts) return '';
    var s = Math.round((Date.now() - ts) / 1000);
    if (s < 45) return 'az önce';
    var m = Math.round(s / 60);
    if (m < 60) return m + ' dk önce';
    var h = Math.round(m / 60);
    if (h < 24) return h + ' saat önce';
    var d = Math.round(h / 24);
    if (d === 1) return 'dün';
    if (d < 7) return d + ' gün önce';
    return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  Home.init = function (app) {
    var self = this;
    this.app = app;
    document.getElementById('home-new').addEventListener('click', function () { self.newProjectDialog(); });
    document.getElementById('home-import').addEventListener('click', function () { app.importFile(); });
    var q = document.getElementById('home-search');
    q.addEventListener('input', function () {
      self.query = q.value.trim().toLocaleLowerCase('tr');
      self.renderGrid();
    });
    var so = document.getElementById('home-sort');
    so.addEventListener('change', function () {
      self.sort = so.value;
      self.renderGrid();
    });
    document.querySelector('#home .brand').addEventListener('click', function () { self.render(); });
  };

  Home.render = function () {
    var self = this;
    return StackitStore.list().then(function (metas) {
      self.metas = metas || [];
      self.renderHero();
      self.renderGrid();
      self.renderTemplates();
      var note = document.getElementById('home-storage');
      note.textContent = StackitStore.mode() === 'idb'
        ? 'Projelerin bu tarayıcıda otomatik kaydedilir. Başka bir bilgisayara taşımak için projeyi "İndir" ile dosya olarak al.'
        : 'Bu tarayıcı geniş depolamayı desteklemiyor; projeler sınırlı alana kaydediliyor. Önemli projeleri "İndir" ile yedekle.';
    });
  };

  Home.thumbImg = function (src, cls) {
    var w = UI.el('div', cls || 'proj-thumb');
    if (src) {
      var img = document.createElement('img');
      img.src = src;
      img.alt = '';
      w.appendChild(img);
    } else w.appendChild(UI.el('span', 'thumb-empty', '🎮'));
    return w;
  };

  Home.renderHero = function () {
    var host = document.getElementById('home-continue'), metas = this.metas, app = this.app;
    host.innerHTML = '';
    var lastId = StackitStore.getLast();
    var sorted = metas.slice().sort(function (a, b) { return (b.modified || 0) - (a.modified || 0); });
    var last = metas.filter(function (m) { return m.id === lastId; })[0] || sorted[0];
    document.getElementById('home-title').textContent = metas.length ? 'Tekrar hoş geldin! Bugün ne yapıyoruz?' : 'Merhaba! İlk oyununu yapmaya hazır mısın?';
    if (!last) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    var card = UI.el('button', 'hero-card continue');
    card.type = 'button';
    card.appendChild(this.thumbImg(last.thumb, 'hero-thumb'));
    var info = UI.el('div', 'hero-info');
    var tag = UI.el('span', 'hero-tag');
    tag.innerHTML = icon(IC_PLAY, 'fill') + 'Devam et';
    info.appendChild(tag);
    info.appendChild(UI.el('b', 'hero-name', last.name || 'Adsız'));
    info.appendChild(UI.el('span', 'hero-sub', 'Son düzenleme: ' + this.relTime(last.modified)));
    card.appendChild(info);
    card.addEventListener('click', function () { app.goProject(last.id); });
    host.appendChild(card);
  };

  Home.renderGrid = function () {
    var self = this, app = this.app, grid = document.getElementById('proj-grid');
    var metas = this.metas || [];
    document.getElementById('proj-count').textContent = metas.length ? String(metas.length) : '';
    var list = metas.filter(function (m) { return !self.query || (m.name || '').toLocaleLowerCase('tr').indexOf(self.query) >= 0; });
    list.sort(function (a, b) {
      if (self.sort === 'name') return (a.name || '').localeCompare(b.name || '', 'tr');
      if (self.sort === 'created') return (b.created || 0) - (a.created || 0);
      return (b.modified || 0) - (a.modified || 0);
    });
    grid.innerHTML = '';
    if (!metas.length) {
      var empty = UI.el('div', 'proj-empty');
      empty.innerHTML = '<b>Henüz projen yok</b><span>Yukarıdan <i>Yeni proje oluştur</i>\'a bas ya da aşağıdaki örneklerden birini seç.</span>';
      grid.appendChild(empty);
      return;
    }
    if (!list.length) {
      grid.appendChild(UI.el('div', 'proj-empty', '"' + this.query + '" ile eşleşen proje yok.'));
      return;
    }
    list.forEach(function (m) {
      var card = UI.el('div', 'proj-card');
      card.tabIndex = 0;
      card.appendChild(self.thumbImg(m.thumb));
      var info = UI.el('div', 'proj-info');
      info.appendChild(UI.el('b', 'proj-name', m.name || 'Adsız'));
      var bits = [self.relTime(m.modified)];
      if (m.sprites != null) bits.push(m.sprites + ' karakter');
      if (m.levels > 1) bits.push(m.levels + ' seviye');
      info.appendChild(UI.el('span', 'proj-sub', bits.join(' · ')));
      card.appendChild(info);
      var more = UI.el('button', 'proj-more');
      more.type = 'button';
      more.title = 'Seçenekler';
      more.innerHTML = icon(IC_MORE);
      card.appendChild(more);
      var menu = function (x, y) {
        UI.menu(x, y, [
          { label: 'Aç', value: 'open' },
          { label: 'Yeniden adlandır', value: 'ren' },
          { label: 'Çoğalt', value: 'dup' },
          { label: 'İndir (.stackit)', value: 'dl' },
          { sep: true },
          { label: 'Sil', value: 'del', danger: true }
        ], function (v) { self.action(v, m); });
      };
      more.addEventListener('click', function (e) {
        e.stopPropagation();
        var r = more.getBoundingClientRect();
        menu(r.left, r.bottom + 4);
      });
      card.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        menu(e.clientX, e.clientY);
      });
      card.addEventListener('click', function () { app.goProject(m.id); });
      card.addEventListener('keydown', function (e) { if (e.key === 'Enter') app.goProject(m.id); });
      grid.appendChild(card);
    });
  };

  Home.uniqueName = function (base) {
    var names = (this.metas || []).map(function (m) { return m.name; }), name = base, n = 2;
    while (names.indexOf(name) >= 0) name = base + ' ' + n++;
    return name;
  };

  Home.action = function (v, m) {
    var self = this, app = this.app;
    if (v === 'open') app.goProject(m.id);
    else if (v === 'ren') {
      UI.prompt('Projeyi yeniden adlandır', 'Proje adı', m.name).then(function (name) {
        if (!name || name === m.name) return;
        StackitStore.get(m.id).then(function (p) {
          if (!p) return;
          p.name = name;
          m.name = name;
          return StackitStore.put(m.id, p, m);
        }).then(function () { self.render(); });
      });
    } else if (v === 'dup') {
      StackitStore.get(m.id).then(function (p) {
        if (!p) return;
        p.name = self.uniqueName((m.name || 'Proje') + ' kopya');
        return app.storeNew(p, m.thumb);
      }).then(function () {
        self.render();
        UI.toast('Proje çoğaltıldı');
      });
    } else if (v === 'dl') {
      StackitStore.get(m.id).then(function (p) {
        if (p) UI.download(app.fileBaseOf(p.name) + '.stackit', JSON.stringify(p), 'application/json');
      });
    } else if (v === 'del') {
      UI.confirm('"' + (m.name || 'Adsız') + '" kalıcı olarak silinsin mi? Bu geri alınamaz.', 'Sil').then(function (ok) {
        if (!ok) return;
        StackitStore.remove(m.id).then(function () {
          self.render();
          UI.toast('Proje silindi');
        });
      });
    }
  };

  /* şablon önizlemeleri bir kez üretilir */
  Home.tplThumb = function (t, img) {
    var self = this;
    if (this.tplThumbs[t.id]) { img.src = this.tplThumbs[t.id]; return; }
    this.app.makeThumb(t.make()).then(function (src) {
      self.tplThumbs[t.id] = src;
      img.src = src;
    }, function () {});
  };

  Home.renderTemplates = function () {
    var self = this, grid = document.getElementById('tpl-grid');
    grid.innerHTML = '';
    this.templates().forEach(function (t) {
      var card = UI.el('button', 'proj-card tpl-card');
      card.type = 'button';
      var th = UI.el('div', 'proj-thumb');
      var img = document.createElement('img');
      img.alt = '';
      th.appendChild(img);
      self.tplThumb(t, img);
      card.appendChild(th);
      var info = UI.el('div', 'proj-info');
      info.appendChild(UI.el('b', 'proj-name', t.name));
      info.appendChild(UI.el('span', 'proj-sub', t.desc));
      card.appendChild(info);
      card.addEventListener('click', function () { self.newProjectDialog(t.id); });
      grid.appendChild(card);
    });
  };

  /* yeni proje: ad + başlangıç şablonu */
  Home.newProjectDialog = function (preset) {
    var self = this, app = this.app;
    var start = this.metas ? Promise.resolve() : StackitStore.list().then(function (m) { self.metas = m; });
    return start.then(function () {
      var back = UI.el('div', 'modal-back');
      var box = UI.el('form', 'modal modal-wide');
      box.appendChild(UI.el('h3', null, 'Yeni proje oluştur'));
      var row = UI.el('label', 'mrow');
      row.appendChild(UI.el('span', 'mlabel', 'Proje adı'));
      var name = document.createElement('input');
      name.type = 'text';
      name.placeholder = 'Oyunum';
      name.spellcheck = false;
      name.maxLength = 60;
      row.appendChild(name);
      box.appendChild(row);
      box.appendChild(UI.el('span', 'mlabel', 'Nasıl başlamak istersin?'));
      var pick = UI.el('div', 'tpl-pick'), chosen = preset || 'blank';
      self.templates().forEach(function (t) {
        var opt = UI.el('button', 'tpl-opt' + (t.id === chosen ? ' on' : ''));
        opt.type = 'button';
        var th = UI.el('div', 'tpl-opt-thumb');
        var img = document.createElement('img');
        img.alt = '';
        th.appendChild(img);
        self.tplThumb(t, img);
        opt.appendChild(th);
        opt.appendChild(UI.el('b', null, t.name));
        opt.appendChild(UI.el('span', null, t.desc));
        opt.addEventListener('click', function () {
          chosen = t.id;
          pick.querySelectorAll('.tpl-opt').forEach(function (o) { o.classList.toggle('on', o === opt); });
        });
        opt.addEventListener('dblclick', function () { box.requestSubmit(); });
        pick.appendChild(opt);
      });
      box.appendChild(pick);
      var btns = UI.el('div', 'mbtns');
      var cancel = UI.el('button', 'btn ghost', 'Vazgeç');
      cancel.type = 'button';
      var ok = UI.el('button', 'btn primary');
      ok.type = 'submit';
      ok.innerHTML = icon(IC_PLUS) + 'Oluştur';
      btns.appendChild(cancel);
      btns.appendChild(ok);
      box.appendChild(btns);
      back.appendChild(box);
      document.body.appendChild(back);
      setTimeout(function () { name.focus(); }, 20);
      var close = function () { back.remove(); };
      cancel.addEventListener('click', close);
      back.addEventListener('pointerdown', function (e) { if (e.target === back) close(); });
      box.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
      box.addEventListener('submit', function (e) {
        e.preventDefault();
        var t = self.templates().filter(function (x) { return x.id === chosen; })[0];
        var p = t.make();
        p.name = self.uniqueName(name.value.trim() || (t.id === 'blank' ? 'Oyunum' : t.name));
        ok.disabled = true;
        app.createProject(p).then(close, function (err) {
          ok.disabled = false;
          UI.toast('Proje oluşturulamadı: ' + (err && err.message ? err.message : err), 'err');
        });
      });
    });
  };
})();
