/* Stackit — proje deposu
 * Projeler tarayıcının IndexedDB'sinde saklanır (localStorage'ın ~5 MB sınırı birden çok
 * projeye yetmez). IndexedDB yoksa localStorage'a düşer. Listeleme için projelerin tamamı
 * değil, küçük "meta" kayıtları (ad, tarih, önizleme) okunur. */
(function () {
  var DB = 'stackit-engine', VER = 1;
  var LS_META = 'stackit.meta', LS_P = 'stackit.p.', LS_LAST = 'stackit.last';
  var db = null, mode = 'idb';

  function req(r) {
    return new Promise(function (res, rej) {
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function done(t) {
    return new Promise(function (res, rej) {
      t.oncomplete = function () { res(); };
      t.onerror = function () { rej(t.error); };
      t.onabort = function () { rej(t.error || new Error('Kayıt iptal edildi (depolama dolu olabilir)')); };
    });
  }
  function lsMeta() {
    try { return JSON.parse(localStorage.getItem(LS_META) || '[]'); } catch (e) { return []; }
  }
  function lsSetMeta(list) { localStorage.setItem(LS_META, JSON.stringify(list)); }

  var S = (window.StackitStore = {
    init: function () {
      return new Promise(function (resolve) {
        if (!window.indexedDB) { mode = 'ls'; resolve(); return; }
        var r;
        try { r = indexedDB.open(DB, VER); } catch (e) { mode = 'ls'; resolve(); return; }
        r.onupgradeneeded = function () {
          var d = r.result;
          if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' });
        };
        r.onsuccess = function () {
          db = r.result;
          resolve();
        };
        r.onerror = function () { mode = 'ls'; resolve(); };
        r.onblocked = function () { mode = 'ls'; resolve(); };
      }).then(function () {
        // tarayıcıdan, yer darlığında projeleri silmemesini iste
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
      });
    },
    mode: function () { return mode; },
    newId: function () {
      return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    },
    list: function () {
      if (mode === 'ls') return Promise.resolve(lsMeta());
      return req(db.transaction('meta').objectStore('meta').getAll());
    },
    getMeta: function (id) {
      if (mode === 'ls') return Promise.resolve(lsMeta().filter(function (m) { return m.id === id; })[0] || null);
      return req(db.transaction('meta').objectStore('meta').get(id)).then(function (m) { return m || null; });
    },
    get: function (id) {
      if (mode === 'ls') {
        try {
          var raw = localStorage.getItem(LS_P + id);
          return Promise.resolve(raw ? JSON.parse(raw) : null);
        } catch (e) { return Promise.reject(e); }
      }
      return req(db.transaction('projects').objectStore('projects').get(id)).then(function (r) { return r ? r.data : null; });
    },
    put: function (id, data, meta) {
      meta.id = id;
      if (mode === 'ls') {
        try {
          localStorage.setItem(LS_P + id, JSON.stringify(data));
          var list = lsMeta().filter(function (m) { return m.id !== id; });
          list.push(meta);
          lsSetMeta(list);
          return Promise.resolve();
        } catch (e) {
          return Promise.reject(new Error('Tarayıcı deposu dolu — projeyi "İndir" ile dosyaya kaydet'));
        }
      }
      var t = db.transaction(['projects', 'meta'], 'readwrite');
      // yapısal kopya yerine JSON: proje içinde yanlışlıkla kopyalanamayan bir şey olsa bile kayıt bozulmaz
      t.objectStore('projects').put({ id: id, data: JSON.parse(JSON.stringify(data)) });
      t.objectStore('meta').put(meta);
      return done(t);
    },
    putMeta: function (meta) {
      if (mode === 'ls') {
        var list = lsMeta().filter(function (m) { return m.id !== meta.id; });
        list.push(meta);
        lsSetMeta(list);
        return Promise.resolve();
      }
      var t = db.transaction('meta', 'readwrite');
      t.objectStore('meta').put(meta);
      return done(t);
    },
    remove: function (id) {
      if (S.getLast() === id) S.setLast('');
      if (mode === 'ls') {
        localStorage.removeItem(LS_P + id);
        lsSetMeta(lsMeta().filter(function (m) { return m.id !== id; }));
        return Promise.resolve();
      }
      var t = db.transaction(['projects', 'meta'], 'readwrite');
      t.objectStore('projects').delete(id);
      t.objectStore('meta').delete(id);
      return done(t);
    },
    getLast: function () {
      try { return localStorage.getItem(LS_LAST) || ''; } catch (e) { return ''; }
    },
    setLast: function (id) {
      try { localStorage.setItem(LS_LAST, id || ''); } catch (e) { /* yoksay */ }
    }
  });
})();
