/* Stackit Engine — bağımsız oynatıcı (dışa aktarılan HTML oyunlarda kullanılır) + dokunmatik tuşlar */
SE.module('player', function (SE) {
  function svg(path, fill) {
    return '<svg viewBox="0 0 24 24" width="48%" height="48%" aria-hidden="true"><path d="' + path + '" fill="' + (fill ? '#fff' : 'none') + '" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  /* Ekrandaki yön tuşları + A (boşluk) tuşu. Motorun tuş durumunu doğrudan sürer. */
  SE.touchControls = function (host, engine) {
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    var wrap = document.createElement('div');
    wrap.className = 'se-touch';
    wrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:4;user-select:none;-webkit-user-select:none';
    var btnCss = 'position:absolute;display:flex;align-items:center;justify-content:center;border-radius:50%;' +
      'background:rgba(20,22,40,.38);border:2px solid rgba(255,255,255,.55);pointer-events:auto;touch-action:none;' +
      'box-shadow:0 2px 10px rgba(0,0,0,.25);-webkit-tap-highlight-color:transparent;cursor:pointer';
    var pad = document.createElement('div');
    pad.style.cssText = 'position:absolute;left:3%;bottom:5%;width:27%;aspect-ratio:1';
    wrap.appendChild(pad);
    var down = {};
    function make(parent, key, css, inner) {
      var b = document.createElement('div');
      b.style.cssText = btnCss + ';' + css;
      b.innerHTML = inner;
      var press = function (e) {
        e.preventDefault();
        if (down[key]) return;
        down[key] = true;
        b.style.background = 'rgba(124,92,255,.7)';
        engine.pressKey(key);
      };
      var release = function () {
        if (!down[key]) return;
        down[key] = false;
        b.style.background = 'rgba(20,22,40,.38)';
        engine.releaseKey(key);
      };
      b.addEventListener('pointerdown', press);
      b.addEventListener('pointerenter', function (e) { if (e.buttons || e.pointerType === 'touch') press(e); });
      b.addEventListener('pointerup', release);
      b.addEventListener('pointerleave', release);
      b.addEventListener('pointercancel', release);
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      parent.appendChild(b);
      return b;
    }
    var s = 'width:36%;height:36%;';
    make(pad, 'up', s + 'left:32%;top:0', svg('M6 15l6-6 6 6'));
    make(pad, 'down', s + 'left:32%;bottom:0', svg('M6 9l6 6 6-6'));
    make(pad, 'left', s + 'left:0;top:32%', svg('M15 6l-6 6 6 6'));
    make(pad, 'right', s + 'right:0;top:32%', svg('M9 6l6 6-6 6'));
    var a = make(wrap, 'space', 'right:5%;bottom:9%;width:15%;aspect-ratio:1;font:900 clamp(12px,4vw,28px) system-ui,sans-serif;color:#fff', 'A');
    a.title = 'boşluk';
    host.appendChild(wrap);
    return {
      el: wrap,
      show: function (on) { wrap.style.display = on ? '' : 'none'; },
      releaseAll: function () { Object.keys(down).forEach(function (k) { if (down[k]) { down[k] = false; engine.releaseKey(k); } }); }
    };
  };

  SE.isTouchDevice = function () {
    return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
  };

  SE.createPlayer = function (host, project) {
    var W = +project.stage.width || 480, H = +project.stage.height || 360;
    host.innerHTML = '';
    host.style.cssText = 'position:relative;width:min(100vw,calc(100vh*' + W + '/' + H + '));aspect-ratio:' + W + '/' + H + ';margin:auto;background:#000;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:none';
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;image-rendering:pixelated';
    host.appendChild(canvas);
    var engine = new SE.Engine(canvas, { editable: false });
    engine.load(project);

    var mode = project.stage.touch || 'auto';
    if (mode === 'on' || (mode === 'auto' && SE.isTouchDevice())) SE.touchControls(host, engine);

    var overlay = document.createElement('button');
    overlay.setAttribute('aria-label', 'Oyunu başlat');
    overlay.style.cssText = 'position:absolute;inset:0;border:0;background:rgba(10,12,24,.45);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:#fff;font:800 20px system-ui,sans-serif;z-index:6';
    overlay.innerHTML = '<span style="width:84px;height:84px;border-radius:50%;background:#7c5cff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 30px rgba(0,0,0,.4)"><svg width="34" height="34" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="#fff"/></svg></span><span></span>';
    overlay.lastChild.textContent = project.name || 'Oyna';
    host.appendChild(overlay);

    var bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;top:6px;right:6px;display:flex;gap:6px;opacity:.75;z-index:5';
    function btn(path, title, fn) {
      var b = document.createElement('button');
      b.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg>';
      b.title = title;
      b.style.cssText = 'border:0;border-radius:8px;background:rgba(0,0,0,.55);width:32px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center';
      b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
      bar.appendChild(b);
      return b;
    }
    btn('M4 4v6h6M4.6 15a8 8 0 1 0 1.8-8.4L4 10', 'Yeniden başlat', function () { engine.start(); overlay.style.display = 'none'; });
    btn('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', 'Tam ekran', function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (host.requestFullscreen) host.requestFullscreen();
    });
    host.appendChild(bar);

    overlay.addEventListener('click', function () {
      overlay.style.display = 'none';
      engine.start();
    });
    return engine;
  };
});
