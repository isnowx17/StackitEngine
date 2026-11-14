/* Stackit — başlangıç ve örnek projeler (bloklarla kurulur) */
(function () {
  var U = SE.util;
  var Ex = (window.StackitExamples = {});

  /* ---- küçük blok kurma dili ---- */
  function blk(op, inputs, extra) {
    var b = SE.blocks.create(op, null);
    if (inputs) {
      Object.keys(inputs).forEach(function (k) {
        var v = inputs[k];
        if (v && typeof v === 'object' && v.op) b.inputs[k] = { value: '', block: v };
        else b.inputs[k] = { value: v };
      });
    }
    if (extra) Object.assign(b, extra);
    return b;
  }
  function seq(list) {
    list = (list || []).filter(Boolean);
    for (var i = 0; i < list.length; i++) list[i].next = list[i + 1] || null;
    return list[0] || null;
  }
  function C(op, inputs, body, body2) {
    var b = blk(op, inputs);
    b.substacks.SUBSTACK = seq(body);
    if (body2) b.substacks.SUBSTACK2 = seq(body2);
    return b;
  }
  function script(x, y, list) { return { x: x, y: y, block: seq(list) }; }
  function key(k) { return blk('key_pressed', { KEY: k }); }
  function v(id) { return blk('var', { VAR: id }); }

  function sprite(id, name, costumes, props) {
    return Object.assign({
      id: id, name: name, x: 0, y: 0, direction: 90, size: 100, visible: true, rotationStyle: 'all',
      currentCostume: 0, costumes: costumes,
      physics: { body: 'none', gravityScale: 1, bounce: 0, friction: 0.2 },
      scripts: [], variables: [], lists: []
    }, props || {});
  }
  function stage(props) {
    return Object.assign({
      id: 'stage', name: SE.t('Sahne'), width: 480, height: 360, bgColor: '#f4f6fb', gravity: 0.8,
      currentCostume: 0, costumes: [], scripts: [], variables: [], lists: []
    }, props || {});
  }
  Ex.newSprite = function (name, costumes) {
    return sprite(U.uid('spr'), name, costumes);
  };

  /* ---------- Boş proje ---------- */
  Ex.blank = function () {
    var robo = sprite(U.uid('spr'), SE.t('Robo'), StackitLib.make('robo'), { rotationStyle: 'lr' });
    robo.scripts.push(script(30, 30, [
      blk('when_start'),
      blk('say_for', { TEXT: SE.t('Merhaba! Ben Robo.'), SECS: 2 })
    ]));
    return { format: 'stackit-1', name: SE.t('Yeni Oyun'), stage: stage(), sprites: [robo], messages: [SE.t('mesaj1')] };
  };

  /* ---------- Örnek: Platform Macerası (karo haritası + 2 seviye) ---------- */
  function cellsBuilder() {
    var c = {};
    return {
      c: c,
      set: function (x, y, id) { c[x + ',' + y] = id; },
      fill: function (x0, y0, x1, y1, id) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) c[x + ',' + y] = id; },
      clear: function (x0, y0, x1, y1) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) delete c[x + ',' + y]; }
    };
  }
  Ex.platformer = function () {
    var ROBO = 'spr_robo', SKOR = 'v_skor';
    // StackitLib.tileset() sırası: 1 çimen, 2 toprak, 3 taş, 4 tuğla, 5 tahta, 6 su, 7 diken, 8 lav, 9 altın, 10 soru kutusu, 11 buz
    var T = { grass: 1, dirt: 2, stone: 3, brick: 4, plank: 5, spike: 7, lava: 8, coin: 9, qbox: 10 };

    var L1 = cellsBuilder();
    L1.fill(-10, -5, 62, -5, T.grass);
    L1.fill(-10, -7, 62, -6, T.dirt);
    L1.clear(17, -7, 18, -5);
    L1.clear(33, -7, 40, -5);
    L1.fill(7, -2, 10, -2, T.plank);
    L1.fill(12, 0, 15, 0, T.plank);
    L1.fill(23, -4, 23, -3, T.stone);
    L1.set(26, -1, T.qbox);
    L1.fill(28, -4, 29, -4, T.spike);
    L1.set(43, -4, T.stone);
    L1.set(51, -4, T.stone);
    [[8, -1], [9, -1], [13, 1], [14, 1], [17, -3], [18, -3], [36, -2], [37, -2], [45, -3], [47, -3], [49, -3], [55, -4], [56, -4]].forEach(function (q) { L1.set(q[0], q[1], T.coin); });

    var L2 = cellsBuilder();
    L2.fill(-10, -7, 52, -5, T.stone);
    L2.fill(10, -6, 12, -5, T.lava);
    L2.fill(16, -4, 16, -3, T.brick);
    L2.fill(20, -4, 21, -4, T.spike);
    L2.fill(24, -6, 29, -5, T.lava);
    L2.fill(25, -3, 28, -3, T.plank);
    L2.set(33, -4, T.brick);
    L2.fill(34, -4, 34, -3, T.brick);
    L2.fill(35, -4, 35, -2, T.brick);
    L2.fill(36, -4, 36, -3, T.brick);
    L2.set(37, -4, T.brick);
    L2.set(41, -1, T.qbox);
    [[10, -2], [11, -2], [12, -2], [25, -1], [26, -1], [27, -1], [28, -1], [35, -1], [44, -4], [45, -4]].forEach(function (q) { L2.set(q[0], q[1], T.coin); });

    var song = StackitLib.melodies[0].make();
    song.name = SE.t('tema');
    song.id = 'snd_tema';
    var st = stage({
      bgColor: '#9bd4ff', costumes: [StackitLib.skyBackdrop(), StackitLib.spaceBackdrop()],
      variables: [{ id: SKOR, name: SE.t('skor'), value: 0, monitor: true }],
      sounds: [song]
    });
    st.scripts.push(script(30, 30, [
      blk('when_start'),
      blk('set_var', { VAR: SKOR, V: '0' }),
      blk('set_gravity', { G: 0.8 }),
      blk('play_music', { SOUND: SE.t('tema') })
    ]));

    var robo = sprite(ROBO, SE.t('Robo'), StackitLib.make('robo'), {
      x: -160, y: -100, rotationStyle: 'lr',
      physics: { body: 'dynamic', gravityScale: 1, bounce: 0, friction: 0.25 }
    });
    var tile = function (id) { return blk('touching_tile', { TILE: String(id) }); };
    robo.scripts.push(script(30, 30, [
      blk('when_level'),
      blk('goto_xy', { X: -160, Y: -100 }),
      blk('point_dir', { DIR: 90 }),
      blk('set_vel', { VX: 0, VY: 0 }),
      blk('cam_axis', { AXIS: 'x' }),
      blk('cam_follow', { TARGET: '_myself_' }),
      C('forever', null, [
        C('if', { COND: key('right') }, [blk('set_vx', { V: 4 }), blk('point_dir', { DIR: 90 })]),
        C('if', { COND: key('left') }, [blk('set_vx', { V: -4 }), blk('point_dir', { DIR: -90 })]),
        C('if', { COND: blk('and', { A: blk('or', { A: key('up'), B: key('space') }), B: blk('on_ground') }) }, [
          blk('jump', { P: 13 }),
          blk('play_sfx', { SFX: 'jump' })
        ]),
        C('if_else', { COND: blk('and', { A: blk('on_ground'), B: blk('gt', { A: blk('math', { FN: 'abs', A: blk('vx') }), B: '0.5' }) }) },
          [blk('play_anim', { FROM: 2, TO: 3, FPS: 8 })],
          [blk('switch_costume', { COSTUME: SE.t('robo-dur') })]),
        C('if', { COND: tile(T.coin) }, [
          blk('replace_touching', { TILE: String(T.coin), NEW: '_empty_' }),
          blk('play_sfx', { SFX: 'coin' }),
          blk('change_var', { VAR: SKOR, V: 1 })
        ]),
        C('if', { COND: blk('and', { A: blk('hit_ceil'), B: tile(T.qbox) }) }, [
          blk('replace_touching', { TILE: String(T.qbox), NEW: String(T.stone) }),
          blk('play_sfx', { SFX: 'powerup' }),
          blk('change_var', { VAR: SKOR, V: 5 }),
          blk('particles', { N: 20, C: '#ffd23f' })
        ]),
        C('if', { COND: blk('or', { A: blk('lt', { A: blk('y_pos'), B: '-400' }), B: blk('or', { A: tile(T.spike), B: tile(T.lava) }) }) }, [
          blk('broadcast', { MSG: SE.t('öldün') })
        ])
      ])
    ]));
    robo.scripts.push(script(800, 30, [
      blk('when_msg', { MSG: SE.t('öldün') }),
      blk('play_sfx', { SFX: 'lose' }),
      blk('cam_shake', { S: 8, SECS: 0.4 }),
      blk('particles', { N: 30, C: '#ff4d6d' }),
      blk('goto_xy', { X: -160, Y: -100 }),
      blk('set_vel', { VX: 0, VY: 0 })
    ]));
    robo.scripts.push(script(800, 290, [blk('when_msg', { MSG: SE.t('zıplat') }), blk('set_vy', { V: 10 })]));
    robo.scripts.push(script(800, 400, [blk('when_start'), blk('say_for', { TEXT: SE.t('← → yürü, ↑ zıpla!'), SECS: 2.5 })]));

    var lift = sprite('spr_asansor', SE.t('Asansör'), [StackitLib.ground(32, 6, 4, SE.t('asansör'))], {
      x: 1120, y: -140, physics: { body: 'static', gravityScale: 1, bounce: 0, friction: 0.2 }
    });
    lift.scripts.push(script(30, 30, [
      blk('when_level'),
      C('if_else', { COND: blk('eq', { A: blk('level_num'), B: '1' }) }, [
        blk('show'),
        blk('goto_xy', { X: 1120, Y: -140 }),
        blk('set_vx', { V: 1.5 }),
        C('forever', null, [
          C('if', { COND: blk('gt', { A: blk('x_pos'), B: '1248' }) }, [blk('set_vx', { V: -1.5 })]),
          C('if', { COND: blk('lt', { A: blk('x_pos'), B: '1120' }) }, [blk('set_vx', { V: 1.5 })])
        ])
      ], [blk('hide')])
    ]));

    var slime = sprite('spr_jole', SE.t('Jöle'), StackitLib.make('slime'), {
      x: 1504, y: -100, direction: -90, rotationStyle: 'lr',
      physics: { body: 'dynamic', gravityScale: 1, bounce: 0, friction: 0.2 }
    });
    slime.scripts.push(script(30, 30, [
      blk('when_level'),
      C('if_else', { COND: blk('eq', { A: blk('level_num'), B: '1' }) }, [
        blk('goto_xy', { X: 1504, Y: -100 }),
        blk('point_dir', { DIR: -90 }),
        blk('show'),
        C('forever', null, [
          C('if_else', { COND: blk('eq', { A: blk('direction'), B: '90' }) }, [blk('set_vx', { V: 1.6 })], [blk('set_vx', { V: -1.6 })]),
          C('if', { COND: blk('hit_wall') }, [blk('turn_cw', { DEG: 180 })]),
          blk('play_anim', { FROM: 1, TO: 2, FPS: 4 }),
          C('if', { COND: blk('touching', { TARGET: ROBO }) }, [
            C('if_else', { COND: blk('gt', { A: blk('prop_of', { SPRITE: ROBO, PROP: 'y' }), B: blk('add', { A: blk('y_pos'), B: 20 }) }) }, [
              blk('play_sfx', { SFX: 'hit' }),
              blk('particles', { N: 24, C: '#3ddc68' }),
              blk('broadcast', { MSG: SE.t('zıplat') }),
              blk('change_var', { VAR: SKOR, V: 5 }),
              blk('hide'),
              blk('wait', { SECS: 3 }),
              blk('goto_xy', { X: 1504, Y: -100 }),
              blk('show')
            ], [
              blk('broadcast', { MSG: SE.t('öldün') }),
              blk('wait', { SECS: 0.5 })
            ])
          ])
        ])
      ], [blk('hide')])
    ]));

    var flag = sprite('spr_bayrak', SE.t('Bayrak'), StackitLib.make('flag'), { x: 1872, y: -96 });
    flag.scripts.push(script(30, 30, [
      blk('when_level'),
      blk('wait_until', { COND: blk('touching', { TARGET: ROBO }) }),
      blk('play_sfx', { SFX: 'win' }),
      C('if_else', { COND: blk('lt', { A: blk('level_num'), B: blk('level_count') }) }, [
        blk('particles', { N: 40, C: '#7c5cff' }),
        blk('say_for', { TEXT: SE.t('Harika! Sıradaki seviye…'), SECS: 1.2 }),
        blk('goto_level', { LEVEL: '_next_' })
      ], [
        blk('particles', { N: 70, C: '#ffd23f' }),
        blk('stop_music'),
        blk('say', { TEXT: blk('join', { A: SE.t('Kazandın! Skor: '), B: v(SKOR) }) }),
        blk('wait', { SECS: 2 }),
        blk('stop', { WHAT: 'all' })
      ])
    ]));

    return {
      format: 'stackit-1', name: SE.t('Platform Macerası'), stage: st,
      tileset: StackitLib.tileset(32),
      levels: [
        { id: 'lvl_1', name: SE.t('Çayır'), cells: L1.c, place: {}, bgColor: '', backdrop: SE.t('gökyüzü') },
        {
          id: 'lvl_2', name: SE.t('Kale'), cells: L2.c, bgColor: '#1b1733', backdrop: SE.t('uzay'),
          place: { spr_asansor: { x: 1120, y: -140, visible: false }, spr_jole: { x: 1504, y: -100, visible: false }, spr_bayrak: { x: 1552, y: -96, visible: true } }
        }
      ],
      sprites: [lift, flag, slime, robo],
      messages: [SE.t('öldün'), SE.t('zıplat')]
    };
  };

  /* ---------- Örnek: Uzay Atıcı ---------- */
  Ex.shooter = function () {
    var SHIP = 'spr_gemi', BUL = 'spr_mermi', EN = 'spr_dusman', SKOR = 'v_skor';
    var st = stage({
      bgColor: '#141230', costumes: [StackitLib.spaceBackdrop()], gravity: 0,
      variables: [{ id: SKOR, name: SE.t('skor'), value: 0, monitor: true }]
    });
    st.scripts.push(script(30, 30, [blk('when_start'), blk('set_var', { VAR: SKOR, V: '0' })]));

    var ship = sprite(SHIP, SE.t('Gemi'), StackitLib.make('ship'), { y: -140, rotationStyle: 'none' });
    ship.scripts.push(script(30, 30, [
      blk('when_start'),
      blk('show'),
      blk('goto_xy', { X: 0, Y: -140 }),
      C('forever', null, [
        C('if', { COND: key('left') }, [blk('change_x', { DX: -6 })]),
        C('if', { COND: key('right') }, [blk('change_x', { DX: 6 })]),
        C('if', { COND: blk('gt', { A: blk('x_pos'), B: '215' }) }, [blk('set_x', { X: 215 })]),
        C('if', { COND: blk('lt', { A: blk('x_pos'), B: '-215' }) }, [blk('set_x', { X: -215 })])
      ])
    ]));
    ship.scripts.push(script(420, 30, [
      blk('when_key', { KEY: 'space' }),
      blk('create_clone', { TARGET: BUL }),
      blk('play_sfx', { SFX: 'laser' })
    ]));
    ship.scripts.push(script(420, 210, [
      blk('when_msg', { MSG: SE.t('bitti') }),
      blk('play_sfx', { SFX: 'explosion' }),
      blk('particles', { N: 80, C: '#ff8a3d' }),
      blk('cam_shake', { S: 10, SECS: 0.6 }),
      blk('hide'),
      blk('say', { TEXT: '' }),
      blk('wait', { SECS: 1 }),
      blk('stop', { WHAT: 'all' })
    ]));
    ship.scripts.push(script(420, 540, [blk('when_start'), blk('say_for', { TEXT: SE.t('← → hareket, boşluk ateş!'), SECS: 2 })]));

    var bullet = sprite(BUL, SE.t('Mermi'), StackitLib.make('bullet'), { visible: false, y: -100 });
    bullet.scripts.push(script(30, 30, [blk('when_start'), blk('hide')]));
    bullet.scripts.push(script(30, 140, [
      blk('when_clone'),
      blk('goto', { TARGET: SHIP }),
      blk('change_y', { DY: 24 }),
      blk('show'),
      blk('set_vel', { VX: 0, VY: 10 }),
      blk('wait_until', { COND: blk('or', { A: blk('gt', { A: blk('y_pos'), B: '200' }), B: blk('touching', { TARGET: EN }) }) }),
      blk('delete_clone')
    ]));

    var enemy = sprite(EN, SE.t('Düşman'), StackitLib.make('slime'), { visible: false, y: 200 });
    enemy.scripts.push(script(30, 30, [
      blk('when_start'),
      blk('hide'),
      blk('wait', { SECS: 1 }),
      C('forever', null, [
        blk('create_clone', { TARGET: '_myself_' }),
        blk('wait', { SECS: blk('random', { A: '0.4', B: '1.1' }) })
      ])
    ]));
    enemy.scripts.push(script(420, 30, [
      blk('when_clone'),
      blk('goto_xy', { X: blk('random', { A: -210, B: 210 }), Y: 210 }),
      blk('set_effect', { EFFECT: 'color', V: blk('random', { A: 0, B: 100 }) }),
      blk('show'),
      blk('play_anim', { FROM: 1, TO: 2, FPS: 5 }),
      blk('set_vel', { VX: 0, VY: blk('random', { A: '-3.5', B: '-1.5' }) }),
      blk('wait_until', { COND: blk('or', { A: blk('touching', { TARGET: BUL }), B: blk('or', { A: blk('touching', { TARGET: SHIP }), B: blk('lt', { A: blk('y_pos'), B: '-210' }) }) }) }),
      C('if', { COND: blk('touching', { TARGET: BUL }) }, [
        blk('play_sfx', { SFX: 'explosion' }),
        blk('particles', { N: 26, C: '#3ddc68' }),
        blk('change_var', { VAR: SKOR, V: 1 })
      ]),
      C('if', { COND: blk('touching', { TARGET: SHIP }) }, [blk('broadcast', { MSG: SE.t('bitti') })]),
      blk('delete_clone')
    ]));

    return {
      format: 'stackit-1', name: SE.t('Uzay Atıcı'), stage: st,
      sprites: [bullet, enemy, ship],
      messages: [SE.t('bitti')]
    };
  };

  /* ---------- 3D görünümlü örnekler: yalnızca mevcut bloklarla (kalem + matematik + listeler) ---------- */
  function op(name, a, b) { return blk(name, { A: a, B: b }); }
  function mul(a, b) { return op('mul', a, b); }
  function add(a, b) { return op('add', a, b); }
  function sub(a, b) { return op('sub', a, b); }
  function div(a, b) { return op('div', a, b); }
  function gt(a, b) { return op('gt', a, b); }
  function lt(a, b) { return op('lt', a, b); }
  function eq(a, b) { return op('eq', a, b); }
  function fn(f, a) { return blk('math', { FN: f, A: a }); }
  /* "ekranı yenilemeden çalıştır" fonksiyonu: her kare tek seferde çizilir */
  function procDef(name, body) {
    var d = { op: 'proc_def', proc: name, params: [], warp: true, inputs: {}, next: null };
    d.next = seq(body);
    return d;
  }
  function procCall(name) { return { op: 'proc_call', proc: name, params: [], inputs: {}, next: null }; }
  /* karakterin yerel değişken ve listeleri için kısayollar */
  function scope(sp) {
    var ids = {};
    var S = {
      v: function (n, shown) {
        ids[n] = U.uid('v');
        sp.variables.push({ id: ids[n], name: shown || n, value: 0 });
      },
      list: function (n, shown, items) {
        ids['L:' + n] = U.uid('l');
        sp.lists.push({ id: ids['L:' + n], name: shown || n, items: items || [] });
      },
      id: function (n) { return ids[n]; },
      get: function (n) { return blk('var', { VAR: ids[n] }); },
      set: function (n, val) { return blk('set_var', { VAR: ids[n], V: val }); },
      chg: function (n, val) { return blk('change_var', { VAR: ids[n], V: val }); },
      item: function (n, i) { return blk('list_item', { LIST: ids['L:' + n], I: i }); },
      push: function (n, val) { return blk('list_add', { V: val, LIST: ids['L:' + n] }); },
      clear: function (n) { return blk('list_clear', { LIST: ids['L:' + n] }); }
    };
    return S;
  }
  function infoSprite(text, y) {
    var info = sprite(U.uid('spr'), SE.t('Bilgi'), [StackitLib.blank(16, 16, SE.t('kostüm'))], { x: 0, y: y });
    info.scripts.push(script(30, 30, [blk('when_start'), blk('goto_xy', { X: 0, Y: y }), blk('show'), blk('say_for', { TEXT: text, SECS: 4 })]));
    return info;
  }

  /* 3D Küp: köşeler döndürülür (sin/cos), perspektifle ekrana yansıtılır, kenarlar kalemle çizilir.
   * Arkadaki kenarlar önce, ince ve soluk; öndekiler sonra, kalın ve parlak çizilir. */
  Ex.cube3d = function () {
    var st = stage({ bgColor: '#141826' });
    var cube = sprite(U.uid('spr'), SE.t('Küp'), [StackitLib.blank(16, 16, SE.t('kostüm'))], { visible: false });
    var S = scope(cube), P = 80;
    S.v('ay', SE.t('açıY'));
    S.v('ax', SE.t('açıX'));
    S.v('dep', SE.t('derinlik'));
    ['x', 'y', 'z', 'x1', 'z1', 'y2', 'z2', 'k', 'i', 'e', 'a', 'b'].forEach(function (n) { S.v(n); });
    S.list('kx', SE.t('köşeX'), [-P, P, P, -P, -P, P, P, -P]);
    S.list('ky', SE.t('köşeY'), [-P, -P, P, P, -P, -P, P, P]);
    S.list('kz', SE.t('köşeZ'), [-P, -P, -P, -P, P, P, P, P]);
    S.list('ex', SE.t('ekranX'));
    S.list('ey', SE.t('ekranY'));
    S.list('ez', SE.t('ekranZ'));
    S.list('ed', SE.t('kenarlar'), [1, 2, 2, 3, 3, 4, 4, 1, 5, 6, 6, 7, 7, 8, 8, 5, 1, 5, 2, 6, 3, 7, 4, 8]);
    var ROT = SE.t('döndür ve yansıt'), DRAW = SE.t('küpü çiz');
    var g = S.get;
    cube.scripts.push(script(30, 30, [
      blk('when_start'),
      blk('hide'),
      S.set('ay', 30),
      S.set('ax', -20),
      C('forever', null, [
        C('if_else', { COND: blk('mouse_down') },
          [S.set('ay', blk('mouse_x')), S.set('ax', blk('mouse_y'))],
          [S.chg('ay', 1.5), S.chg('ax', 0.6)]),
        procCall(ROT),
        procCall(DRAW)
      ])
    ]));
    cube.scripts.push({ x: 30, y: 330, block: procDef(ROT, [
      S.clear('ex'), S.clear('ey'), S.clear('ez'),
      C('for_range', { VAR: S.id('i'), FROM: 1, TO: 8 }, [
        S.set('x', S.item('kx', g('i'))),
        S.set('y', S.item('ky', g('i'))),
        S.set('z', S.item('kz', g('i'))),
        S.set('x1', sub(mul(g('x'), fn('cos', g('ay'))), mul(g('z'), fn('sin', g('ay'))))),
        S.set('z1', add(mul(g('x'), fn('sin', g('ay'))), mul(g('z'), fn('cos', g('ay'))))),
        S.set('y2', sub(mul(g('y'), fn('cos', g('ax'))), mul(g('z1'), fn('sin', g('ax'))))),
        S.set('z2', add(mul(g('y'), fn('sin', g('ax'))), mul(g('z1'), fn('cos', g('ax'))))),
        S.set('k', div(400, add(g('z2'), 400))),
        S.push('ex', mul(g('x1'), g('k'))),
        S.push('ey', mul(g('y2'), g('k'))),
        S.push('ez', g('z2'))
      ])
    ]) });
    function edges(back) {
      var isBack = gt(g('dep'), 0);
      return C('for_range', { VAR: S.id('e'), FROM: 1, TO: 12 }, [
        S.set('a', S.item('ed', sub(mul(g('e'), 2), 1))),
        S.set('b', S.item('ed', mul(g('e'), 2))),
        S.set('dep', div(add(S.item('ez', g('a')), S.item('ez', g('b'))), 2)),
        C('if', { COND: back ? isBack : blk('not', { A: isBack }) }, [
          blk('pen_size', { S: sub(7, div(g('dep'), 22)) }),
          blk('pen_color', { C: back ? '#4b3f8f' : '#c9b8ff' }),
          blk('goto_xy', { X: S.item('ex', g('a')), Y: S.item('ey', g('a')) }),
          blk('pen_down'),
          blk('goto_xy', { X: S.item('ex', g('b')), Y: S.item('ey', g('b')) }),
          blk('pen_up')
        ])
      ]);
    }
    cube.scripts.push({ x: 560, y: 30, block: procDef(DRAW, [
      blk('pen_clear'),
      blk('pen_color', { C: '#0b0d16' }),
      blk('pen_size', { S: 34 }),
      blk('goto_xy', { X: -95, Y: -150 }),
      blk('pen_down'),
      blk('goto_xy', { X: 95, Y: -150 }),
      blk('pen_up'),
      edges(true),
      edges(false),
      blk('pen_color', { C: '#5ef2d0' }),
      C('for_range', { VAR: S.id('i'), FROM: 1, TO: 8 }, [
        blk('pen_size', { S: sub(15, div(S.item('ez', g('i')), 12)) }),
        blk('goto_xy', { X: S.item('ex', g('i')), Y: S.item('ey', g('i')) }),
        blk('pen_down'),
        blk('pen_up')
      ])
    ]) });
    return {
      format: 'stackit-1', name: SE.t('3D Küp'), stage: st,
      // son karakter açılışta seçili gelir: 3D kodu görünsün
      sprites: [infoSprite(SE.t('Fareyle sürükle: küpü döndür!'), 150), cube], messages: []
    };
  };

  /* Labirent 3D: her ekran sütunu için bir ışın, karoya çarpana kadar adım adım ilerler.
   * Uzaklık ne kadar azsa duvar o kadar uzun ve parlak çizilir. Labirent "Harita & Seviyeler" sekmesindedir. */
  Ex.maze3d = function () {
    var rows = [
      '############',
      '#..#.......#',
      '#..#.BBB.#.#',
      '#....B...#.#',
      'BBB.BB.###.#',
      '#...#..#...#',
      '#.###.##.###',
      '#.#...#....#',
      '#.#.###.BB.#',
      '#...#...B..#',
      '#.#...#.B..Q',
      '############'
    ];
    var TILE = { '#': 3, B: 4, Q: 10 }, cells = {};
    rows.forEach(function (row, r) {
      row.split('').forEach(function (ch, c) { if (TILE[ch]) cells[20 + c + ',' + (5 - r)] = TILE[ch]; });
    });
    var st = stage({ bgColor: '#6fb3e8' });
    var blank = function () { return [StackitLib.blank(16, 16, SE.t('kostüm'))]; };
    var PLAYER = 'spr_oyuncu', WIN = SE.t('kazandın');
    var EXIT = SE.t('soru kutusu'), BRICK = SE.t('tuğla');

    // başlangıç: üst koridorun başı, koridora bakarak (karo 24,4)
    var player = sprite(PLAYER, SE.t('Oyuncu'), blank(), { x: 784, y: 144, visible: false });
    var ahead = function (sign, dist) {
      var o = function (a, b) { return sign > 0 ? add(a, b) : sub(a, b); };
      return blk('tile_at', {
        X: o(blk('x_pos'), mul(fn('sin', blk('direction')), dist)),
        Y: o(blk('y_pos'), mul(fn('cos', blk('direction')), dist))
      });
    };
    player.scripts.push(script(30, 30, [
      blk('when_start'),
      blk('hide'),
      blk('goto_xy', { X: 784, Y: 144 }),
      blk('point_dir', { DIR: 90 }),
      C('forever', null, [
        C('if', { COND: key('left') }, [blk('turn_ccw', { DEG: 4 })]),
        C('if', { COND: key('right') }, [blk('turn_cw', { DEG: 4 })]),
        C('if', { COND: key('up') }, [C('if', { COND: eq(ahead(1, 14), '') }, [blk('move', { STEPS: 3 })])]),
        C('if', { COND: key('down') }, [C('if', { COND: eq(ahead(-1, 14), '') }, [blk('move', { STEPS: -3 })])]),
        C('if', { COND: eq(ahead(1, 24), EXIT) }, [blk('broadcast', { MSG: WIN }), blk('stop', { WHAT: 'this' })])
      ])
    ]));

    var screen = sprite(U.uid('spr'), SE.t('Ekran'), blank(), { visible: false });
    var S = scope(screen), g = S.get;
    ['px', 'py', 'pd', 'i', 'dx', 'dy', 'rx', 'ry', 'd', 'h', 'sx'].forEach(function (n) { S.v(n); });
    S.v('ang', SE.t('açı'));
    S.v('kind', SE.t('tür'));
    S.v('lit', SE.t('ışık'));
    var DRAW = SE.t('çiz');
    function band(colors) {
      return [
        blk('pen_color', { C: colors[0] }),
        C('if', { COND: gt(g('lit'), 0.5) }, [blk('pen_color', { C: colors[1] })]),
        C('if', { COND: gt(g('lit'), 1.5) }, [blk('pen_color', { C: colors[2] })]),
        C('if', { COND: gt(g('lit'), 2.5) }, [blk('pen_color', { C: colors[3] })])
      ];
    }
    var mx = blk('mod', { A: g('rx'), B: 32 });
    screen.scripts.push(script(30, 30, [blk('when_start'), blk('hide'), C('forever', null, [procCall(DRAW)])]));
    screen.scripts.push({ x: 30, y: 200, block: procDef(DRAW, [
      blk('pen_clear'),
      blk('pen_color', { C: '#3d4a3e' }),
      blk('pen_size', { S: 190 }),
      blk('goto_xy', { X: -320, Y: -95 }),
      blk('pen_down'),
      blk('goto_xy', { X: 320, Y: -95 }),
      blk('pen_up'),
      blk('pen_size', { S: 9 }),
      S.set('px', blk('prop_of', { SPRITE: PLAYER, PROP: 'x' })),
      S.set('py', blk('prop_of', { SPRITE: PLAYER, PROP: 'y' })),
      S.set('pd', blk('prop_of', { SPRITE: PLAYER, PROP: 'dir' })),
      C('for_range', { VAR: S.id('i'), FROM: 0, TO: 59 }, [
        S.set('ang', add(sub(g('pd'), 30), g('i'))),
        S.set('dx', mul(fn('sin', g('ang')), 4)),
        S.set('dy', mul(fn('cos', g('ang')), 4)),
        S.set('rx', g('px')),
        S.set('ry', g('py')),
        S.set('d', 0),
        C('repeat_until', { COND: blk('or', { A: blk('not', { A: eq(blk('tile_at', { X: g('rx'), Y: g('ry') }), '') }), B: gt(g('d'), 700) }) }, [
          S.chg('rx', g('dx')),
          S.chg('ry', g('dy')),
          S.chg('d', 4)
        ]),
        S.set('kind', blk('tile_at', { X: g('rx'), Y: g('ry') })),
        S.set('d', mul(g('d'), fn('cos', sub(g('ang'), g('pd'))))),
        S.set('h', div(13000, add(g('d'), 1))),
        C('if', { COND: gt(g('h'), 380) }, [S.set('h', 380)]),
        S.set('lit', 0),
        C('if', { COND: lt(g('d'), 420) }, [S.set('lit', 1)]),
        C('if', { COND: lt(g('d'), 240) }, [S.set('lit', 2)]),
        C('if', { COND: lt(g('d'), 110) }, [S.set('lit', 3)]),
        C('if', { COND: blk('or', { A: lt(mx, 4), B: gt(blk('mod', { A: g('rx'), B: 32 }), 28) }) }, [S.chg('lit', -1)]),
        C('if_else', { COND: eq(g('kind'), BRICK) },
          band(['#3a1714', '#6e2a24', '#a23c33', '#d4594b']),
          [C('if_else', { COND: eq(g('kind'), EXIT) },
            band(['#5a4300', '#9a7400', '#d9a800', '#ffd23f']),
            band(['#2c3038', '#585e6c', '#8a91a2', '#bcc3d2']))]),
        S.set('sx', add(-236, mul(g('i'), 8))),
        blk('goto_xy', { X: g('sx'), Y: div(g('h'), 2) }),
        blk('pen_down'),
        blk('goto_xy', { X: g('sx'), Y: sub(0, div(g('h'), 2)) }),
        blk('pen_up')
      ])
    ]) });

    var info = infoSprite(SE.t('← → dön, ↑ ↓ yürü. Sarı duvarı bul!'), 140);
    info.scripts.push(script(30, 180, [
      blk('when_msg', { MSG: WIN }),
      blk('play_sfx', { SFX: 'win' }),
      blk('say', { TEXT: SE.t('Çıkışı buldun! 🎉') }),
      blk('wait', { SECS: 2 }),
      blk('stop', { WHAT: 'all' })
    ]));

    return {
      format: 'stackit-1', name: SE.t('Labirent 3D'), stage: st,
      tileset: StackitLib.tileset(32),
      levels: [{ id: 'lvl_1', name: SE.t('Labirent'), cells: cells, place: {}, bgColor: '', backdrop: '' }],
      sprites: [info, player, screen], messages: [WIN]
    };
  };

  Ex.list = [
    { id: 'platformer', name: SE.t('Platform Macerası'), make: Ex.platformer },
    { id: 'shooter', name: SE.t('Uzay Atıcı'), make: Ex.shooter },
    { id: 'cube3d', name: SE.t('3D Küp'), make: Ex.cube3d },
    { id: 'maze3d', name: SE.t('Labirent 3D'), make: Ex.maze3d }
  ];
})();
