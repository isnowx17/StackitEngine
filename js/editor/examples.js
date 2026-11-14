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

  Ex.list = [
    { id: 'platformer', name: SE.t('Platform Macerası'), make: Ex.platformer },
    { id: 'shooter', name: SE.t('Uzay Atıcı'), make: Ex.shooter }
  ];
})();
