/* Stackit Engine — çekirdek
 * Çalışma zamanı modülleri SE.module(...) ile kaydedilir; böylece oyun
 * "tek dosya HTML" olarak dışa aktarılırken kaynakları yeniden kullanılabilir. */
(function () {
  var SE = (window.SE = window.SE || {});
  SE.modules = SE.modules || [];
  SE.module = function (name, fn) {
    SE.modules.push({ name: name, fn: fn });
    fn(SE);
  };
})();

SE.module('core', function (SE) {
  SE.VERSION = '1.0.0';
  var U = (SE.util = {});

  U.isNumeric = function (v) {
    if (typeof v === 'number') return !isNaN(v);
    if (typeof v !== 'string') return false;
    var s = v.trim();
    if (s === '') return false;
    return !isNaN(Number(s.replace(',', '.')));
  };

  U.toNum = function (v) {
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v == null) return 0;
    var s = String(v).trim();
    if (s === '') return 0;
    var n = Number(s.replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };

  U.toStr = function (v) {
    if (v == null) return '';
    if (typeof v === 'boolean') return v ? 'doğru' : 'yanlış';
    if (typeof v === 'number') {
      if (!isFinite(v)) return v > 0 ? 'Sonsuz' : v < 0 ? '-Sonsuz' : '0';
      if (Number.isInteger(v)) return String(v);
      return String(parseFloat(v.toFixed(10)));
    }
    return String(v);
  };

  U.toBool = function (v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0 && !isNaN(v);
    var s = String(v == null ? '' : v).trim().toLowerCase();
    return !(s === '' || s === '0' || s === 'false' || s === 'yanlış');
  };

  U.compare = function (a, b) {
    if (U.isNumeric(a) && U.isNumeric(b)) return U.toNum(a) - U.toNum(b);
    var x = U.toStr(a).toLocaleLowerCase('tr');
    var y = U.toStr(b).toLocaleLowerCase('tr');
    return x < y ? -1 : x > y ? 1 : 0;
  };

  U.clamp = function (v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  };

  U.wrapDir = function (d) {
    d = ((((d + 180) % 360) + 360) % 360) - 180;
    return d === -180 ? 180 : d;
  };

  U.uid = function (prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  };

  U.clone = function (o) {
    return o == null ? o : JSON.parse(JSON.stringify(o));
  };

  U.rand = function (a, b) {
    return a + Math.random() * (b - a);
  };

  /* Basit olay yayıcı */
  SE.Emitter = class {
    constructor() {
      this._h = {};
    }
    on(ev, fn) {
      (this._h[ev] = this._h[ev] || []).push(fn);
      return this;
    }
    emit(ev, data) {
      var l = this._h[ev];
      if (l) l.slice().forEach(function (fn) { fn(data); });
    }
  };
});
