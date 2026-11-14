/* Stackit — hazır piksel-art kütüphanesi (tamamı kodla üretilir) */
(function () {
  var Lib = (window.StackitLib = {});

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  function finish(name, c, scale) {
    return { name: name, src: c.toDataURL('image/png'), w: c.width, h: c.height, scale: scale || 3, smooth: false };
  }
  function grid(name, rows, pal, scale) {
    var h = rows.length, w = rows[0].length, c = canvas(w, h), g = c.getContext('2d');
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var ch = rows[y].charAt(x);
        if (ch !== '.' && pal[ch]) {
          g.fillStyle = pal[ch];
          g.fillRect(x, y, 1, 1);
        }
      }
    }
    return finish(name, c, scale);
  }
  /* inside(x,y) ile tanımlı bir şekli dış çizgi ve gölgeyle boya */
  function shape(name, w, h, inside, colorAt, outline, scale) {
    var c = canvas(w, h), g = c.getContext('2d');
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (!inside(x, y)) continue;
        var edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        g.fillStyle = edge && outline ? outline : colorAt(x, y);
        g.fillRect(x, y, 1, 1);
      }
    }
    return finish(name, c, scale);
  }
  /* tekrarlanabilir sözde-rastgele */
  function rng(seed) {
    return function () {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  var ROBO = { k: '#1e2235', w: '#eef1f8', g: '#b7bfd3', s: '#2b3350', c: '#5ef2d0', o: '#ff8a3d', y: '#ffd23f' };
  var roboHead = [
    '......yy........',
    '.......k........',
    '...kkkkkkkkkk...',
    '..kwwwwwwwwwwk..',
    '..kwssssssssgk..',
    '..kwsssscsscgk..',
    '..kwsssscsscgk..',
    '..kwssssssssgk..',
    '..kggggggggggk..',
    '...kkkkkkkkkk...',
    '....kooooook....',
    '...kowwwwwwok...',
    '...kowwoowwok...',
    '....kkkkkkkk....'
  ];
  function robo(name, legs) { return grid(name, roboHead.concat(legs), ROBO, 3); }

  var SLIME = { k: '#173b23', g: '#3ddc68', G: '#1f9e47', w: '#ffffff', e: '#10202a', h: '#b6f7c8' };
  var E = '................';

  Lib.items = [
    {
      id: 'robo', name: SE.t('Robo'), make: function () {
        return [
          robo(SE.t('robo-dur'), ['....kok..kok....', '....kkk..kkk....']),
          robo(SE.t('robo-yürü1'), ['...kok....kok...', '...kkk....kkk...']),
          robo(SE.t('robo-yürü2'), ['.....kok.kok....', '.....kkk.kkk....'])
        ];
      }
    },
    {
      id: 'slime', name: SE.t('Jöle'), make: function () {
        return [
          grid(SE.t('jöle1'), [E, E, E, E,
            '......kkkk......',
            '....kkggggkk....',
            '...kghggggggk...',
            '..kghgwwggwwgk..',
            '..kgggweggwegk..',
            '.kggggggggggggk.',
            '.kgggGGGGGGgggk.',
            '.kggggggggggggk.',
            '.kGGGGGGGGGGGGk.',
            '..kkkkkkkkkkkk..', E, E], SLIME, 3),
          grid(SE.t('jöle2'), [E, E, E, E, E, E,
            '.....kkkkkk.....',
            '...kkghgggggkk..',
            '..kgggwwggwwggk.',
            '.kggggweggweggk.',
            '.kgggggggggggggk',
            '.kgggGGGGGGGgggk',
            '.kGGGGGGGGGGGGGk',
            '..kkkkkkkkkkkkk.', E, E], SLIME, 3)
        ];
      }
    },
    {
      id: 'coin', name: SE.t('Altın'), make: function () {
        return [5.5, 3.8, 1.4, 3.8].map(function (rx, i) {
          return shape(SE.t('altın') + (i + 1), 12, 12, function (x, y) {
            if (x < 0 || y < 0 || x >= 12 || y >= 12) return false;
            var dx = (x + 0.5 - 6) / rx, dy = (y + 0.5 - 6) / 5.6;
            return dx * dx + dy * dy <= 1;
          }, function (x, y) {
            var dx = x + 0.5 - 6;
            if (rx > 2 && dx < -rx * 0.25 && y > 2 && y < 9) return '#fff3b8';
            if (dx > rx * 0.45) return '#f0a400';
            return '#ffcf1f';
          }, '#9a5200', 3);
        });
      }
    },
    {
      id: 'heart', name: SE.t('Kalp'), make: function () {
        return [grid(SE.t('kalp'), [E, E,
          '...kkk....kkk...',
          '..krrrk..krrrk..',
          '.krwwrrkkrrrrrk.',
          '.krwrrrrrrrrrrk.',
          '.krrrrrrrrrrrRk.',
          '.krrrrrrrrrrrRk.',
          '..krrrrrrrrrRk..',
          '...krrrrrrrRk...',
          '....krrrrrRk....',
          '.....krrrRk.....',
          '......krRk......',
          '.......kk.......', E, E], { k: '#3b0a14', r: '#ff4d6d', R: '#c9184a', w: '#ffd6de' }, 3)];
      }
    },
    {
      id: 'crate', name: SE.t('Sandık'), make: function () {
        return [grid(SE.t('sandık'), [
          'kkkkkkkkkkkkkkkk',
          'kBBBBBBBBBBBBBBk',
          'kBbbbbbbbbbbbbBk',
          'kBbBbbbbbbbbBbBk',
          'kBbbBbbbbbbBbbBk',
          'kBbbbBbbbbBbbbBk',
          'kBbbbbBbbBbbbbBk',
          'kBbbbbbBBbbbbbBk',
          'kBbbbbbBBbbbbbBk',
          'kBbbbbBbbBbbbbBk',
          'kBbbbBbbbbBbbbBk',
          'kBbbBbbbbbbBbbBk',
          'kBbBbbbbbbbbBbBk',
          'kBbbbbbbbbbbbbBk',
          'kBBBBBBBBBBBBBBk',
          'kkkkkkkkkkkkkkkk'], { k: '#3a2210', B: '#8a5426', b: '#c98a4b' }, 3)];
      }
    },
    {
      id: 'flag', name: SE.t('Bayrak'), make: function () {
        return [grid(SE.t('bayrak'), [
          '.kk.............',
          '.kgkkkkkkkkk....',
          '.kgkrrrrrrrrk...',
          '.kgkrrwwrrrrk...',
          '.kgkrwwwwrrrk...',
          '.kgkrrwwrrrrk...',
          '.kgkrrrrrrrrk...',
          '.kgkkkkkkkkkk...',
          '.kgk............',
          '.kgk............',
          '.kgk............',
          '.kgk............',
          '.kgk............',
          '.kgk............',
          'kkkkk...........',
          'kgggk...........'], { k: '#1e2235', g: '#d9dde8', r: '#7c5cff', w: '#ffd23f' }, 4)];
      }
    },
    {
      id: 'star', name: SE.t('Yıldız'), make: function () {
        var pts = [];
        for (var i = 0; i < 10; i++) {
          var a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 3.3 : 7.6;
          pts.push([8 + Math.cos(a) * r, 8.4 + Math.sin(a) * r]);
        }
        function inPoly(x, y) {
          var px = x + 0.5, py = y + 0.5, c = false;
          for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
            if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
          }
          return c;
        }
        return [shape(SE.t('yıldız'), 16, 16, inPoly, function (x, y) { return x < 7 && y < 9 ? '#fff6a8' : '#ffd23f'; }, '#a86a00', 3)];
      }
    },
    {
      id: 'ball', name: SE.t('Top'), make: function () {
        return [shape(SE.t('top'), 14, 14, function (x, y) {
          var dx = x + 0.5 - 7, dy = y + 0.5 - 7;
          return dx * dx + dy * dy <= 42;
        }, function (x, y) {
          var dx = x + 0.5 - 5, dy = y + 0.5 - 5;
          var d = Math.sqrt(dx * dx + dy * dy);
          return d < 2 ? '#c9f0ff' : d < 6 ? '#3fa9ff' : '#1d6fd6';
        }, '#0b2f66', 3)];
      }
    },
    {
      id: 'bullet', name: SE.t('Mermi'), make: function () {
        return [shape(SE.t('mermi'), 8, 8, function (x, y) {
          var dx = x + 0.5 - 4, dy = y + 0.5 - 4;
          return dx * dx + dy * dy <= 12;
        }, function (x, y) {
          var dx = x + 0.5 - 4, dy = y + 0.5 - 4;
          return dx * dx + dy * dy < 4 ? '#ffffff' : '#ffe066';
        }, '#ff8a00', 2)];
      }
    },
    {
      id: 'ship', name: SE.t('Uzay Gemisi'), make: function () {
        return [grid(SE.t('gemi'), [
          '.......kk.......',
          '......kwwk......',
          '......kwwk......',
          '.....kwccwk.....',
          '.....kwccwk.....',
          '....kwwccwwk....',
          '....kwwwwwwk....',
          '...kwwwwwwwwk...',
          '..kpkwwwwwwkpk..',
          '.kppkwwwwwwkppk.',
          'kpppkwwwwwwkpppk',
          'kppkkkkkkkkkkppk',
          'kkk..koook...kkk',
          '......kook......',
          '.......kk.......',
          E], { k: '#1e2235', w: '#e8ecf6', c: '#5ef2d0', p: '#7c5cff', o: '#ff8a3d' }, 3)];
      }
    },
    {
      id: 'cloud', name: SE.t('Bulut'), make: function () {
        return [shape(SE.t('bulut'), 24, 12, function (x, y) {
          var cs = [[7, 7, 4.6], [12, 5, 5.2], [17, 7.5, 4.2], [12, 8.5, 4]];
          for (var i = 0; i < cs.length; i++) {
            var dx = x + 0.5 - cs[i][0], dy = y + 0.5 - cs[i][1];
            if (dx * dx + dy * dy <= cs[i][2] * cs[i][2] && y < 12) return true;
          }
          return false;
        }, function (x, y) { return y > 8 ? '#dfe8f5' : '#ffffff'; }, '#a9b7cc', 3)];
      }
    },
    { id: 'ground', name: SE.t('Zemin'), make: function () { return [Lib.ground(96, 10, 5, SE.t('zemin'))]; } },
    { id: SE.t('platform'), name: SE.t('Platform'), make: function () { return [Lib.ground(32, 6, 4, SE.t('platform'))]; } },
    { id: 'block', name: SE.t('Kare'), make: function () { return [Lib.blank(16, 16, SE.t('kare'), '#7c5cff')]; } }
  ];

  Lib.make = function (id) {
    for (var i = 0; i < Lib.items.length; i++) if (Lib.items[i].id === id) return Lib.items[i].make();
    return [];
  };

  Lib.ground = function (w, h, scale, name) {
    var c = canvas(w, h), g = c.getContext('2d'), r = rng(w * 31 + h);
    for (var x = 0; x < w; x++) {
      var grass = 2 + (r() < 0.3 ? 1 : 0);
      for (var y = 0; y < h; y++) {
        var col;
        if (y < grass) col = y === 0 ? '#7ee081' : r() < 0.2 ? '#2fae4f' : '#46c35f';
        else if (y === grass) col = '#5a3a1c';
        else col = r() < 0.12 ? '#6b4423' : r() < 0.08 ? '#b07a45' : '#8d5a2f';
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
    return finish(name || SE.t('zemin'), c, scale);
  };

  Lib.blank = function (w, h, name, fill) {
    var c = canvas(w, h);
    if (fill) {
      var g = c.getContext('2d');
      g.fillStyle = '#1e2235';
      g.fillRect(0, 0, w, h);
      g.fillStyle = fill;
      g.fillRect(1, 1, w - 2, h - 2);
    }
    return finish(name || SE.t('kostüm'), c, w >= 60 ? Math.max(1, Math.round(480 / w)) : 3);
  };

  /* Piksel gökyüzü dekoru: gradyan, güneş, bulutlar, tepeler */
  Lib.skyBackdrop = function () {
    var w = 120, h = 90, c = canvas(w, h), g = c.getContext('2d'), r = rng(7);
    var bands = ['#5fb7ff', '#6cc0ff', '#7ac8ff', '#89d0ff', '#98d8ff', '#a8e0ff', '#b9e8ff'];
    for (var y = 0; y < h; y++) {
      g.fillStyle = bands[Math.min(bands.length - 1, Math.floor((y / h) * bands.length * 1.1))];
      g.fillRect(0, y, w, 1);
    }
    g.fillStyle = '#fff3a0';
    for (var sy = -6; sy <= 6; sy++) for (var sx = -6; sx <= 6; sx++) if (sx * sx + sy * sy <= 30) g.fillRect(96 + sx, 16 + sy, 1, 1);
    g.fillStyle = '#ffe066';
    for (sy = -4; sy <= 4; sy++) for (sx = -4; sx <= 4; sx++) if (sx * sx + sy * sy <= 14) g.fillRect(96 + sx, 16 + sy, 1, 1);
    function cloud(cx, cy, s) {
      var parts = [[0, 0, 3 * s], [3 * s, -1.5 * s, 3.4 * s], [6.5 * s, 0, 2.8 * s]];
      parts.forEach(function (p) {
        for (var yy = -p[2]; yy <= p[2]; yy++) for (var xx = -p[2]; xx <= p[2]; xx++) {
          if (xx * xx + yy * yy <= p[2] * p[2] && yy < 2) {
            g.fillStyle = yy > 0 ? '#e6f1ff' : '#ffffff';
            g.fillRect(Math.round(cx + p[0] + xx), Math.round(cy + p[1] + yy), 1, 1);
          }
        }
      });
    }
    cloud(14, 18, 1.2);
    cloud(52, 10, 1);
    cloud(70, 30, 0.8);
    var far = [], near = [];
    for (var x = 0; x < w; x++) {
      far.push(58 + Math.round(Math.sin(x / 9) * 4 + Math.sin(x / 23) * 6));
      near.push(68 + Math.round(Math.sin(x / 13 + 2) * 4 + Math.sin(x / 31) * 5));
    }
    for (x = 0; x < w; x++) {
      for (y = far[x]; y < h; y++) {
        g.fillStyle = y === far[x] ? '#8fd3a8' : '#74c08f';
        g.fillRect(x, y, 1, 1);
      }
      for (y = near[x]; y < h; y++) {
        g.fillStyle = y === near[x] ? '#5cc46f' : r() < 0.05 ? '#3a9c50' : '#47ae5c';
        g.fillRect(x, y, 1, 1);
      }
    }
    return finish(SE.t('gökyüzü'), c, 4);
  };

  Lib.spaceBackdrop = function () {
    var w = 120, h = 90, c = canvas(w, h), g = c.getContext('2d'), r = rng(42);
    for (var y = 0; y < h; y++) {
      var t = y / h;
      g.fillStyle = 'rgb(' + Math.round(14 + 20 * t) + ',' + Math.round(12 + 8 * t) + ',' + Math.round(38 + 30 * t) + ')';
      g.fillRect(0, y, w, 1);
    }
    for (var i = 0; i < 90; i++) {
      g.fillStyle = r() < 0.2 ? '#ffe9a8' : r() < 0.3 ? '#a8d8ff' : '#ffffff';
      g.globalAlpha = 0.4 + r() * 0.6;
      g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1);
    }
    g.globalAlpha = 1;
    return finish(SE.t('uzay'), c, 4);
  };

  /* ---------------- karolar (16×16, kodla çizilir) ---------------- */
  function tile(name, solid, fn) {
    var n = 16, c = canvas(n, n), g = c.getContext('2d'), r = rng(name.length * 977 + name.charCodeAt(0) * 31);
    var set = function (x, y, col) {
      if (x < 0 || y < 0 || x >= n || y >= n) return;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    };
    fn(set, r);
    var o = finish(name, c, 2);
    o.solid = solid;
    return o;
  }
  function dirt(set, r, y0) {
    for (var y = y0; y < 16; y++) for (var x = 0; x < 16; x++) set(x, y, r() < 0.12 ? '#7a4a24' : r() < 0.08 ? '#b8773f' : '#94592c');
  }
  var QMARK = ['.####.', '##..##', '....##', '...##.', '..##..', '..##..', '......', '..##..'];
  Lib.tileItems = [
    { id: 'grass', name: SE.t('çimen'), make: function () {
      return tile(SE.t('çimen'), 'solid', function (set, r) {
        for (var x = 0; x < 16; x++) {
          set(x, 0, '#8af07f');
          set(x, 1, '#4fd866');
          set(x, 2, '#3fcf5c');
          set(x, 3, x % 3 === 0 || r() < 0.3 ? '#2ea64a' : '#5a3a1c');
          if (r() < 0.25) set(x, 4, '#2ea64a');
        }
        dirt(set, r, 4);
        for (x = 0; x < 16; x++) { set(x, 3, x % 3 === 0 || r() < 0.35 ? '#2ea64a' : '#5a3a1c'); if (x % 4 === 1) set(x, 4, '#2ea64a'); }
      });
    } },
    { id: 'dirt', name: SE.t('toprak'), make: function () { return tile(SE.t('toprak'), 'solid', function (set, r) { dirt(set, r, 0); }); } },
    { id: 'stone', name: SE.t('taş'), make: function () {
      return tile(SE.t('taş'), 'solid', function (set, r) {
        for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
          var off = Math.floor(y / 8) % 2 ? 4 : 0, bx = (x + off) % 8, by = y % 8;
          set(x, y, by === 7 || bx === 7 ? '#555c70' : by === 0 || bx === 0 ? '#b0b7c9' : r() < 0.1 ? '#7d8599' : '#8b93a7');
        }
      });
    } },
    { id: 'brick', name: SE.t('tuğla'), make: function () {
      return tile(SE.t('tuğla'), 'solid', function (set, r) {
        for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
          var off = Math.floor(y / 4) % 2 ? 4 : 0, bx = (x + off) % 8, by = y % 4;
          set(x, y, by === 3 || bx === 7 ? '#6e2620' : by === 0 ? '#e0675a' : r() < 0.12 ? '#b03b32' : '#c2453b');
        }
      });
    } },
    { id: 'plank', name: SE.t('tahta'), make: function () {
      return tile(SE.t('tahta'), 'oneway', function (set) {
        for (var y = 0; y < 6; y++) for (var x = 0; x < 16; x++) {
          set(x, y, y === 0 ? '#e7b27a' : y === 5 || x === 0 || x === 15 ? '#6b3f1d' : x === 7 || x === 8 ? '#a8692f' : '#c98a4b');
        }
        set(2, 2, '#3a2210');
        set(13, 2, '#3a2210');
        for (y = 6; y < 9; y++) { set(3, y, '#6b3f1d'); set(12, y, '#6b3f1d'); }
      });
    } },
    { id: 'water', name: SE.t('su'), make: function () {
      return tile(SE.t('su'), 'none', function (set) {
        for (var y = 2; y < 16; y++) for (var x = 0; x < 16; x++) {
          set(x, y, y === 2 ? (x % 6 < 3 ? '#cde9ff' : '#7cc4ff') : y < 6 ? 'rgba(59,130,246,.78)' : 'rgba(37,99,235,.84)');
        }
      });
    } },
    { id: 'spikes', name: SE.t('diken'), make: function () {
      return tile(SE.t('diken'), 'none', function (set) {
        for (var k = 0; k < 4; k++) {
          for (var h = 0; h < 8; h++) {
            var w = Math.round(((8 - h) / 8) * 2);
            for (var dx = -w; dx < w; dx++) set(k * 4 + 2 + dx, 15 - h, dx < 0 ? '#eef1f8' : '#9aa3b8');
          }
        }
        for (var x = 0; x < 16; x++) set(x, 15, '#5d6478');
      });
    } },
    { id: 'lava', name: SE.t('lav'), make: function () {
      return tile(SE.t('lav'), 'none', function (set, r) {
        for (var y = 3; y < 16; y++) for (var x = 0; x < 16; x++) {
          set(x, y, y === 3 ? (x % 5 < 3 ? '#ffe066' : '#ff9a3d') : r() < 0.08 ? '#ffd23f' : r() < 0.5 ? '#ff6b1a' : '#f04a12');
        }
      });
    } },
    { id: 'coin', name: SE.t('altın'), make: function () {
      return tile(SE.t('altın'), 'none', function (set) {
        for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
          var dx = x + 0.5 - 8, dy = y + 0.5 - 8, d = dx * dx / 22 + dy * dy / 30;
          if (d > 1) continue;
          var edge = d > 0.7;
          set(x, y, edge ? '#9a5200' : dx < -1.5 && dy > -3 && dy < 3 ? '#fff3b8' : dx > 1.5 ? '#f0a400' : '#ffcf1f');
        }
      });
    } },
    { id: 'qbox', name: SE.t('soru kutusu'), make: function () {
      return tile(SE.t('soru kutusu'), 'solid', function (set) {
        for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
          set(x, y, x === 0 || y === 0 || x === 15 || y === 15 ? '#7a4a00' : y === 1 || x === 1 ? '#ffe680' : '#ffc61a');
        }
        [[2, 2], [13, 2], [2, 13], [13, 13]].forEach(function (p) { set(p[0], p[1], '#7a4a00'); });
        QMARK.forEach(function (row, j) {
          for (var i = 0; i < row.length; i++) if (row.charAt(i) === '#') { set(5 + i + 1, 4 + j + 1, '#b07800'); }
        });
        QMARK.forEach(function (row, j) {
          for (var i = 0; i < row.length; i++) if (row.charAt(i) === '#') set(5 + i, 4 + j, '#ffffff');
        });
      });
    } },
    { id: 'ice', name: SE.t('buz'), make: function () {
      return tile(SE.t('buz'), 'solid', function (set, r) {
        for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
          set(x, y, x === 0 || y === 0 ? '#e8fbff' : x === 15 || y === 15 ? '#5aa9c9' : (x + y) % 9 === 0 ? '#ffffff' : r() < 0.1 ? '#a5e4f5' : '#bdeefa');
        }
      });
    } }
  ];
  Lib.makeTile = function (id) {
    for (var i = 0; i < Lib.tileItems.length; i++) if (Lib.tileItems[i].id === id) return Lib.tileItems[i].make();
    return null;
  };
  Lib.tileset = function (tileSize) {
    var list = Lib.tileItems.map(function (t, i) {
      var c = t.make();
      c.id = i + 1;
      return c;
    });
    return { tileSize: tileSize || 32, costumes: list, currentCostume: 0, nextId: list.length + 1 };
  };

  /* ---------------- hazır melodiler (adım tabanlı) ---------------- */
  function every(from, step, until) { var o = []; for (var i = from; i < until; i += step) o.push(i); return o; }
  function drums(kick, snare, hat) {
    return kick.map(function (s) { return [s, 'kick']; })
      .concat(snare.map(function (s) { return [s, 'snare']; }))
      .concat(hat.map(function (s) { return [s, 'hat']; }));
  }
  Lib.melodies = [
    { id: 'happy', name: SE.t('neşeli'), make: function () {
      return {
        type: 'music', name: SE.t('neşeli'), bpm: 140, steps: 32, wave: 'square',
        notes: [[0, 72], [2, 76], [4, 79], [6, 76], [8, 81], [10, 79], [12, 76], [14, 74], [16, 72], [18, 76], [20, 79], [22, 84], [24, 83], [26, 79], [28, 81], [30, 79],
          [0, 60], [8, 60], [16, 65], [24, 67]],
        drums: drums([0, 8, 16, 24], [4, 12, 20, 28], every(2, 4, 32))
      };
    } },
    { id: 'adventure', name: SE.t('macera'), make: function () {
      return {
        type: 'music', name: SE.t('macera'), bpm: 118, steps: 32, wave: 'triangle',
        notes: [[0, 69], [2, 72], [4, 76], [6, 81], [8, 79], [10, 76], [12, 74], [14, 76], [16, 77], [18, 76], [20, 74], [22, 72], [24, 71], [26, 72], [28, 74], [30, 76],
          [0, 64], [8, 64], [16, 65], [24, 67]],
        drums: drums([0, 6, 8, 16, 22, 24], [4, 12, 20, 28], every(2, 4, 32))
      };
    } },
    { id: 'beat', name: SE.t('ritim'), make: function () {
      return { type: 'music', name: SE.t('ritim'), bpm: 110, steps: 16, wave: 'square', notes: [], drums: drums([0, 8, 10], [4, 12], every(0, 2, 16)) };
    } }
  ];

  Lib.thumb = function (costume) {
    return costume ? costume.src : '';
  };
})();
