/* Stackit — Android (Capacitor) uyarlamaları
 * Yalnızca Android uygulamasında yüklenir (scripts/build-web.js --android). */
(function () {
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform() || !window.capacitorExports) return;
  var reg = window.capacitorExports.registerPlugin;
  var AppPlugin = reg('App');
  var Filesystem = reg('Filesystem');
  var Share = reg('Share');
  document.documentElement.classList.add('is-android');

  /* 1) "İndir" ve "Oyunu dışa aktar": Android WebView <a download> ile dosya indiremez.
   *    Dosyayı uygulamanın geçici klasörüne yazıp paylaşım menüsünü açıyoruz
   *    (Dosyalar'a kaydet, Drive, WhatsApp, e-posta…). */
  function toText(content) {
    return content instanceof Blob ? content.text() : Promise.resolve(String(content));
  }
  UI.download = function (filename, content) {
    toText(content)
      .then(function (text) {
        return Filesystem.writeFile({ path: filename, data: text, directory: 'CACHE', encoding: 'utf8' });
      })
      .then(function (res) {
        return Share.share({ title: filename, dialogTitle: filename + ' — kaydet ya da paylaş', files: [res.uri] });
      })
      .catch(function (err) {
        var msg = String((err && err.message) || err);
        if (/cancel/i.test(msg)) return;
        UI.toast('Dosya paylaşılamadı: ' + msg, 'err');
      });
  };

  /* 2) Geri tuşu: açık pencereyi kapat → oyunu durdur → Projelerim'e dön → uygulamadan çık */
  AppPlugin.addListener('backButton', function () {
    var modal = document.querySelector('.modal-back');
    if (modal) {
      var cancel = modal.querySelector('.btn.ghost');
      if (cancel) cancel.click();
      else modal.remove();
      return;
    }
    if (document.querySelector('.popmenu')) {
      UI.closeMenu();
      return;
    }
    if (window.App && App.view === 'editor') {
      if (App.engine.running) App.stop();
      else if (App.tab === 'tiles') App.setTab('map');
      else App.goHome();
      return;
    }
    AppPlugin.exitApp();
  });

  /* 3) Uygulama arka plana geçince oyunu duraklat ve bekleyen kaydı hemen yaz */
  AppPlugin.addListener('pause', function () {
    if (!window.App || !App.engine) return;
    if (App.engine.running && !App.engine.paused) App.engine.setPaused(true);
    if (App._saveT) App.save();
  });
})();
