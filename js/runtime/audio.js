/* Stackit Engine — ses motoru (WebAudio)
 * Sentez efektleri, nota çalma, yüklenen ses dosyaları ve adım tabanlı müzik (sequencer). */
SE.module('audio', function (SE) {
  var ctx = null;
  var master = null;
  var volume = 1;
  var noiseBuf = null;
  var handles = new Set();
  var buffers = new Map();

  function ac() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      makeMaster();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function makeMaster() {
    master = ctx.createGain();
    master.gain.value = 0.5 * volume;
    master.connect(ctx.destination);
  }

  function tone(type, f0, f1, dur, vol, delay, dest, at) {
    var c = ac();
    if (!c) return;
    var t = (at != null ? at : c.currentTime) + (delay || 0);
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, freq, delay, dest, at, highpass) {
    var c = ac();
    if (!c) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var t = (at != null ? at : c.currentTime) + (delay || 0);
    var s = c.createBufferSource();
    s.buffer = noiseBuf;
    var f = c.createBiquadFilter();
    f.type = highpass ? 'highpass' : 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    if (!highpass) f.frequency.exponentialRampToValueAtTime(80, t + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest || master);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  function seq(type, freqs, step, len, vol) {
    freqs.forEach(function (f, i) { tone(type, f, 0, len, vol, i * step); });
  }

  var SFX = {
    jump: function () { tone('square', 260, 720, 0.17, 0.22); },
    coin: function () { tone('square', 988, 0, 0.09, 0.18); tone('square', 1319, 0, 0.28, 0.18, 0.08); },
    explosion: function () { noise(0.7, 0.7, 1400); tone('sine', 90, 30, 0.5, 0.4); },
    laser: function () { tone('sawtooth', 1500, 160, 0.22, 0.16); },
    hit: function () { noise(0.14, 0.5, 3200); tone('square', 200, 60, 0.16, 0.22); },
    powerup: function () { seq('square', [523, 659, 784, 1047, 1319], 0.07, 0.12, 0.16); },
    click: function () { tone('sine', 1000, 500, 0.06, 0.3); },
    lose: function () { seq('triangle', [523, 440, 370, 294], 0.17, 0.24, 0.35); },
    win: function () { seq('square', [523, 659, 784, 1047, 784, 1047], 0.1, 0.16, 0.16); },
    pop: function () { tone('sine', 400, 1200, 0.08, 0.35); }
  };

  function midiFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function noteAt(midi, dur, wave, t, dest) {
    var c = ac();
    if (!c) return;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = wave || 'square';
    o.frequency.value = midiFreq(midi);
    var v = wave === 'sine' || wave === 'triangle' ? 0.32 : 0.13;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.01);
    g.gain.setValueAtTime(v, t + Math.max(0.02, dur - 0.05));
    g.gain.linearRampToValueAtTime(0.0001, t + Math.max(0.03, dur));
    o.connect(g);
    g.connect(dest || master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function drum(kind, t, dest) {
    if (kind === 'kick') {
      tone('sine', 165, 42, 0.24, 0.9, 0, dest, t);
    } else if (kind === 'snare') {
      noise(0.16, 0.42, 1500, 0, dest, t, true);
      tone('triangle', 230, 120, 0.08, 0.28, 0, dest, t);
    } else if (kind === 'hat') {
      noise(0.045, 0.22, 7500, 0, dest, t, true);
    }
  }

  /* adım tabanlı müzik: {bpm, steps, wave, notes:[[adım, midi, uzunluk]], drums:[[adım, 'kick'|'snare'|'hat']]} */
  function playSeq(sq, loop) {
    var c = ac();
    var h = { done: false, loop: !!loop, start: 0, stepDur: 0.125, steps: 16, stop: function () {} };
    if (!c) { h.done = true; return h; }
    var g = c.createGain();
    g.gain.value = 1;
    g.connect(master);
    var bpm = Math.max(30, Math.min(300, +sq.bpm || 120));
    var steps = Math.max(1, +sq.steps || 16), sd = 60 / bpm / 4, wave = sq.wave || 'square';
    var t0 = c.currentTime + 0.05;
    h.start = t0;
    h.stepDur = sd;
    h.steps = steps;
    function bar(start) {
      (sq.notes || []).forEach(function (n) {
        if (n[0] < steps) noteAt(n[1], sd * (n[2] || 1) * 0.92, wave, start + n[0] * sd, g);
      });
      (sq.drums || []).forEach(function (d) {
        if (d[0] < steps) drum(d[1], start + d[0] * sd, g);
      });
    }
    bar(t0);
    var next = t0 + steps * sd, timer;
    if (loop) {
      timer = setInterval(function () {
        while (next - ctx.currentTime < 0.3) {
          bar(next);
          next += steps * sd;
        }
      }, 60);
    } else {
      timer = setTimeout(function () {
        h.done = true;
        handles.delete(h);
      }, (next - c.currentTime) * 1000 + 40);
    }
    h.stop = function () {
      h.done = true;
      clearInterval(timer);
      clearTimeout(timer);
      try { g.disconnect(); } catch (e) { /* yoksay */ }
      handles.delete(h);
    };
    handles.add(h);
    return h;
  }

  function dataToBuffer(src) {
    var i = src.indexOf(','), bin = atob(src.slice(i + 1)), u = new Uint8Array(bin.length);
    for (var k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
    return u.buffer;
  }
  function decode(src) {
    var c = ac();
    if (!c) return Promise.reject(new Error('Bu tarayıcıda ses yok'));
    var p = buffers.get(src);
    if (p) return p;
    p = new Promise(function (res, rej) {
      try { c.decodeAudioData(dataToBuffer(src), res, rej); } catch (e) { rej(e); }
    });
    buffers.set(src, p);
    if (buffers.size > 60) buffers.delete(buffers.keys().next().value);
    return p;
  }
  function playSample(src, loop) {
    var h = { done: false, loop: !!loop, node: null };
    h.stop = function () {
      h.done = true;
      if (h.node) try { h.node.stop(); } catch (e) { /* yoksay */ }
      handles.delete(h);
    };
    handles.add(h);
    decode(src).then(function (buf) {
      if (h.done) return;
      var s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = !!loop;
      s.connect(master);
      s.onended = function () { h.done = true; handles.delete(h); };
      s.start();
      h.node = s;
      h.start = ctx.currentTime;
      h.duration = buf.duration;
    }, function () { h.done = true; handles.delete(h); });
    return h;
  }

  SE.audio = {
    unlock: function () { ac(); },
    now: function () { return ctx ? ctx.currentTime : 0; },
    play: function (name) {
      var f = SFX[name];
      if (f) try { f(); } catch (e) { /* ses yoksa sessiz geç */ }
    },
    note: function (midi, dur, wave) {
      var c = ac();
      if (c) noteAt(midi, dur, wave, c.currentTime);
    },
    drum: function (kind) {
      var c = ac();
      if (c) drum(kind, c.currentTime);
    },
    playSeq: playSeq,
    playSample: playSample,
    decode: decode,
    playAsset: function (s, loop) {
      if (s.type === 'music') return playSeq(s, loop);
      if (s.src) return playSample(s.src, loop);
      return { done: true, stop: function () {} };
    },
    setVolume: function (v) {
      volume = Math.max(0, Math.min(1, v));
      if (master) master.gain.value = 0.5 * volume;
    },
    getVolume: function () { return volume; },
    stopAll: function () {
      handles.forEach(function (h) { h.stop(); });
      handles.clear();
      if (!ctx || !master) return;
      try { master.disconnect(); } catch (e) { /* yoksay */ }
      makeMaster();
    },
    names: Object.keys(SFX)
  };
});
