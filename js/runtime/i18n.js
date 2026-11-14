/* Stackit Engine — dil desteği (Türkçe / English)
 * Kaynak dil Türkçedir: metinler doğrudan anahtar olarak kullanılır, SE.t('…') İngilizcesini döndürür.
 * Dil sistemden (navigator.language) seçilir; kullanıcı Projelerim ekranından değiştirebilir. */
SE.module('i18n', function (SE) {
  var KEY = 'stackit.lang';
  var dict = { en: {} };

  function pref() {
    try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; }
  }
  function detect() {
    var p = pref();
    if (p === 'tr' || p === 'en') return p;
    var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    return /^tr(\b|-|_)/i.test(langs[0] || '') ? 'tr' : 'en';
  }

  SE.lang = detect();

  /* t('Merhaba {ad}', {ad: 'Ece'}) */
  SE.t = function (s, vars) {
    if (s == null) return '';
    var out = s;
    if (SE.lang !== 'tr') {
      var e = dict[SE.lang] && dict[SE.lang][s];
      if (e != null) out = e;
    }
    if (vars) {
      out = String(out).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    }
    return out;
  };

  SE.i18n = {
    dict: dict,
    add: function (lang, entries) {
      dict[lang] = dict[lang] || {};
      for (var k in entries) dict[lang][k] = entries[k];
    },
    pref: pref,
    setPref: function (v) {
      try {
        if (v === 'tr' || v === 'en') localStorage.setItem(KEY, v);
        else localStorage.removeItem(KEY);
      } catch (e) { /* yoksay */ }
    },
    /* HTML içindeki sabit metinleri ve title/placeholder/aria-label niteliklerini çevir */
    translateDOM: function (root) {
      if (SE.lang === 'tr' || !root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var n, list = [];
      while ((n = walker.nextNode())) list.push(n);
      list.forEach(function (node) {
        var raw = node.nodeValue, k = raw.trim();
        if (!k) return;
        var v = SE.t(k);
        if (v !== k) node.nodeValue = raw.replace(k, v);
      });
      root.querySelectorAll('[title],[placeholder],[aria-label]').forEach(function (el) {
        ['title', 'placeholder', 'aria-label'].forEach(function (a) {
          var v = el.getAttribute(a);
          if (v) el.setAttribute(a, SE.t(v));
        });
      });
    }
  };

  /* çalışma zamanı (dışa aktarılan oyunlarda da gereken) metinler */
  SE.i18n.add('en', {
    'Oyun durdu — yeniden başlatmak için ▶': 'Game stopped — press ▶ to restart',
    'Oyunu başlat': 'Start the game',
    'Oyna': 'Play',
    'Yeniden başlat': 'Restart',
    'Tam ekran': 'Full screen',
    'boşluk': 'space',
    'doğru': 'true',
    'yanlış': 'false',
    'Sonsuz': 'Infinity',
    '-Sonsuz': '-Infinity',
    'Bu tarayıcıda ses yok': 'Audio is not available in this browser',
    '[Stackit] Betik hatası:': '[Stackit] Script error:'
  });
});
