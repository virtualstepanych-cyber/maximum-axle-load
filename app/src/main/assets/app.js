/* Осевая нагрузка — расчёт по ПП РФ № 2200 (прил. 1 и 3) */
(function () {
  'use strict';

  /* ---------------- нормативная база ---------------- */

  var NORM = {
    '6': {
      single: { one: 5.5, dual: 6 },
      g2: [{ max: 1, one: 8, dual: 9 }, { max: 1.3, one: 9, dual: 10 }, { max: 1.8, one: 10, dual: 11 }, { max: 2.5, one: 11, dual: 12 }],
      g3: [{ max: 1, one: 11, dual: 12 }, { max: 1.3, one: 12, dual: 13 }, { max: 1.8, one: 13.5, dual: 15 }, { max: 2.5, one: 15, dual: 16 }],
      g4: [{ max: 1, one: 3.5, dual: 4 }, { max: 1.3, one: 4, dual: 4.5 }, { max: 1.8, one: 4.5, dual: 5 }, { max: 2.5, one: 5, dual: 5.5 }]
    },
    '10': {
      single: { one: 9, dual: 10 },
      g2: [{ max: 1, one: 10, dual: 11 }, { max: 1.3, one: 13, dual: 14 }, { max: 1.8, one: 15, dual: 16 }, { max: 2.5, one: 17, dual: 18 }],
      g3: [{ max: 1, one: 15, dual: 16.5 }, { max: 1.3, one: 18, dual: 19.5 }, { max: 1.8, one: 21, dual: 22.5 }, { max: 2.5, one: 22, dual: 23 }],
      g4: [{ max: 1, one: 5, dual: 5.5 }, { max: 1.3, one: 6, dual: 6.5 }, { max: 1.8, one: 6.5, dual: 7 }, { max: 2.5, one: 7, dual: 7.5 }]
    },
    '11.5': {
      single: { one: 10.5, dual: 11.5 },
      g2: [{ max: 1, one: 11.5, dual: 12.5 }, { max: 1.3, one: 14, dual: 16 }, { max: 1.8, one: 17, dual: 18 }, { max: 2.5, one: 18, dual: 20 }],
      g3: [{ max: 1, one: 17, dual: 18 }, { max: 1.3, one: 20, dual: 21 }, { max: 1.8, one: 23.5, dual: 24 }, { max: 2.5, one: 25, dual: 26 }],
      g4: [{ max: 1, one: 5.5, dual: 6 }, { max: 1.3, one: 6.5, dual: 7 }, { max: 1.8, one: 7.5, dual: 8 }, { max: 2.5, one: 8.5, dual: 9 }]
    }
  };

  var ROAD_NAME = { '6': '6 т на ось', '10': '10 т на ось', '11.5': '11,5 т на ось' };
  var MASS_RIGID = { 2: 18, 3: 25, 4: 32, 5: 38 };
  var MASS_TRAIN = { 3: 28, 4: 36, 5: 40, 6: 44 };
  var STORE = 'axleLoadSaves_v1';

  var scheme = /^#(A|B|C)$/.test(location.hash) ? location.hash.charAt(1) : 'A';
  var road = '11.5';

  /* ---------------- утилиты ---------------- */

  function $(id) { return document.getElementById(id); }

  function num(v, def) {
    if (v === null || v === undefined) return def || 0;
    var s = String(v).replace(/\s/g, '').replace(',', '.');
    var x = parseFloat(s);
    return isFinite(x) ? x : (def || 0);
  }

  function fmt(x, d) {
    if (!isFinite(x)) x = 0;
    var s = x.toFixed(d === undefined ? 2 : d);
    return s.replace('.', ',');
  }

  function ratio(x, y) { return y > 0 ? x / y : 0; }

  /* ---------------- чтение полей ---------------- */

  function readInputs() {
    var o = { scheme: scheme, road: road };
    var nodes = document.querySelectorAll('#panel-A input, #panel-A select, #panel-B input, #panel-B select, #panel-C input, #panel-C select');
    for (var i = 0; i < nodes.length; i++) o[nodes[i].id] = nodes[i].value;
    return o;
  }

  function inflow(inp, id, def) { return num(inp[id], def); }

  function wheelsOf(v) { return String(v) === 'one' ? 'one' : 'dual'; }

  function cargoTotal(inp) {
    if (inp.scheme === 'A') return inflow(inp, 'a_m');
    if (inp.scheme === 'B') return inflow(inp, 'b_m');
    return inflow(inp, 'c_m1') + inflow(inp, 'c_m2');
  }

  function withUnitCargo(inp) {
    var c = {};
    for (var k in inp) if (Object.prototype.hasOwnProperty.call(inp, k)) c[k] = inp[k];
    if (inp.scheme === 'A') { c.a_m = '1'; }
    else if (inp.scheme === 'B') { c.b_m = '1'; }
    else if (inp.scheme === 'C') {
      var m1 = inflow(inp, 'c_m1'), m2 = inflow(inp, 'c_m2');
      if (m1 <= 0 && m2 <= 0) { c.c_m1 = '1'; c.c_m2 = '0'; }
      else if (m1 <= 0) { c.c_m1 = '1'; c.c_m2 = '0'; }
      else { c.c_m1 = '1'; c.c_m2 = '0'; }
    }
    return c;
  }

  /* ---------------- расчёт нагрузок ---------------- */

  function calc(inp, k) {
    var n = function (id, def) { return inflow(inp, id, def); };
    var g = [];

    if (inp.scheme === 'A') {
      var F0 = n('a_f'), R0 = n('a_r'), L = n('a_L'), nr = Math.round(n('a_n', 2)),
          d = n('a_d'), m = n('a_m'), xp = n('a_x', L);

      var kf = L > 0 ? 1 - xp / L : 1;
      var kr = L > 0 ? xp / L : 0;

      g.push({ name: 'Передняя ось', count: 1, spacing: 99, wheels: 'one', load: Math.max(0, F0 + m * k * kf) });
      g.push({ name: 'Задняя группа', count: nr, spacing: d, wheels: wheelsOf(inp.a_w), load: Math.max(0, R0 + m * k * kr) });

      return { kind: 'rigid', groups: g, totalMass: F0 + R0 + m * k, cargo: m * k,
               clamp: (F0 + m * k * kf) < 0 };
    }

    if (inp.scheme === 'B') {
      var Ft = n('b_f'), Rt = n('b_r'), Lb = n('b_L'), nrT = Math.round(n('b_n', 2)), dT = n('b_d'),
          xs = n('b_xs'), Sp = n('b_sp'), St = n('b_st'), S = n('b_S'), nrS = Math.round(n('b_ns', 2)),
          dS = n('b_ds'), mB = n('b_m'), xpB = n('b_x', S / 2);

      var kKing = S > 0 ? 1 - xpB / S : 1;
      var kBogie = S > 0 ? xpB / S : 0;
      var king = Sp + mB * k * kKing;
      var trBogie = St + mB * k * kBogie;

      var pFront = Lb > 0 ? 1 - xs / Lb : 1;
      var pRear = Lb > 0 ? xs / Lb : 0;

      g.push({ name: 'Передняя ось тягача', count: 1, spacing: 99, wheels: 'one', load: Math.max(0, Ft + king * pFront) });
      g.push({ name: 'Тележка тягача', count: nrT, spacing: dT, wheels: 'dual', load: Math.max(0, Rt + king * pRear) });
      g.push({ name: 'Тележка полуприцепа', count: nrS, spacing: dS, wheels: wheelsOf(inp.b_ws), load: Math.max(0, trBogie) });

      return { kind: 'train', groups: g, totalMass: Ft + Rt + Sp + St + mB * k, cargo: mB * k,
               clamp: (Ft + king * pFront) < 0, saddle: king };
    }

    var F0c = n('c_f'), R0c = n('c_r'), Lc = n('c_L'), nrc = Math.round(n('c_n', 2)), dc = n('c_d'),
        xh = n('c_xh'), H0 = n('c_h'), T0 = n('c_t'), B = n('c_B'), nrt = Math.round(n('c_nt', 2)),
        dt = n('c_dt'), m1 = n('c_m1'), x1 = n('c_x1', Lc / 2), m2 = n('c_m2'), x2 = n('c_x2', B / 2);

    var kHitch = B > 0 ? 1 - x2 / B : 1;
    var kAx = B > 0 ? x2 / B : 0;
    var hitch = H0 + m2 * k * kHitch;
    var trAxles = T0 + m2 * k * kAx;

    var f1 = Lc > 0 ? 1 - x1 / Lc : 1;
    var r1 = Lc > 0 ? x1 / Lc : 0;
    var f2 = Lc > 0 ? 1 - xh / Lc : 1;
    var r2 = Lc > 0 ? xh / Lc : 0;

    g.push({ name: 'Передняя ось', count: 1, spacing: 99, wheels: 'one', load: Math.max(0, F0c + m1 * k * f1 + hitch * f2) });
    g.push({ name: 'Задняя группа', count: nrc, spacing: dc, wheels: wheelsOf(inp.c_w), load: Math.max(0, R0c + m1 * k * r1 + hitch * r2) });
    g.push({ name: 'Оси прицепа', count: nrt, spacing: dt, wheels: wheelsOf(inp.c_wt), load: Math.max(0, trAxles) });

    return { kind: 'train', groups: g, totalMass: F0c + R0c + H0 + T0 + m1 * k + m2 * k, cargo: m1 * k + m2 * k,
             clamp: (F0c + m1 * k * f1 + hitch * f2) < 0, hitch: hitch };
  }

  /* ---------------- нормы ---------------- */

  function groupLimit(count, spacing, wheels, roadKey) {
    var t = NORM[roadKey] || NORM['11.5'];
    var side = wheels === 'one' ? 'one' : 'dual';
    if (count <= 1) return t.single[side];

    var rows = count === 2 ? t.g2 : (count === 3 ? t.g3 : t.g4);
    var r = rows[rows.length - 1];
    for (var i = 0; i < rows.length; i++) {
      if (spacing <= rows[i].max + 1e-9) { r = rows[i]; break; }
    }
    if (count >= 4) return r[side] * count;
    return r[side];
  }

  function singleLimit(wheels, roadKey) {
    var t = NORM[roadKey] || NORM['11.5'];
    return t.single[wheels === 'one' ? 'one' : 'dual'];
  }

  function totalLimit(kind, axles) {
    if (kind === 'rigid') {
      if (axles <= 5) return MASS_RIGID[axles] || 18;
      return MASS_RIGID[5];
    }
    if (axles <= 6) return MASS_TRAIN[axles] || 28;
    return MASS_TRAIN[6];
  }

  function axleCountOf(res) {
    var s = 0;
    for (var i = 0; i < res.groups.length; i++) s += res.groups[i].count;
    return s;
  }

  /* ---------------- поиск максимальной загрузки ---------------- */

  function solveMax(inp) {
    var total = cargoTotal(inp);
    var ref = total > 0 ? inp : withUnitCargo(inp);
    var c0 = calc(ref, 0), c1 = calc(ref, 1);
    var k = 1e9;

    for (var i = 0; i < c1.groups.length; i++) {
      var g1 = c1.groups[i], g0 = c0.groups[i];
      var lim = groupLimit(g1.count, g1.spacing, g1.wheels, inp.road);
      var b = g1.load - g0.load;
      if (b > 1e-9) k = Math.min(k, (lim - g0.load) / b);
      else if (g0.load > lim) k = 0;
    }

    var limT = totalLimit(c1.kind, axleCountOf(c1));
    var bT = c1.totalMass - c0.totalMass;
    if (bT > 1e-9) k = Math.min(k, (limT - c0.totalMass) / bT);

    k = Math.max(0, k);
    if (k > 100) k = 100;
    var maxCargo = total > 0 ? k * total : k;
    return { k: k, maxCargo: maxCargo, perUnit: total > 0 ? false : true, emptyTotal: c0.totalMass, totalLimit: limT };
  }

  /* ---------------- рендер ---------------- */

  function statusClass(r) {
    if (r > 1.0001) return 'bad';
    if (r > 0.97) return 'warn';
    return 'ok';
  }

  function axesWord(n) {
    var a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return 'ось';
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'оси';
    return 'осей';
  }

  function groupKindLabel(g) {
    if (g.count <= 1) return 'одиночная ось';
    if (g.count === 2) return 'сдвоенные оси';
    if (g.count === 3) return 'строенные оси';
    return g.count + ' осей';
  }

  function render() {
    var inp = readInputs();
    var res = calc(inp, 1);
    var mx = solveMax(inp);

    var axles = axleCountOf(res);
    var massLim = totalLimit(res.kind, axles);
    var massRatio = ratio(res.totalMass, massLim);

    var worst = 0, worstName = '';
    var html = '';

    var items = [];
    for (var i = 0; i < res.groups.length; i++) {
      var g = res.groups[i];
      var lim = groupLimit(g.count, g.spacing, g.wheels, inp.road);
      var r = ratio(g.load, lim);
      if (r > worst) { worst = r; worstName = g.name; }
      items.push({ g: g, lim: lim, r: r });
    }
    var overall = Math.max(worst, massRatio);
    var st = statusClass(overall);

    var statusText = st === 'ok'
      ? (overall > 0.9 ? 'В норме, без большого запаса' : 'В норме')
      : (st === 'warn' ? 'На пределе' : 'Перегруз');

    html += '<div class="verdict ' + st + '">';
    html += '<div class="status"><span class="dot"></span>' + statusText + '</div>';
    html += '<div class="big-num">' + fmt(res.totalMass) + '<small>т полная масса</small></div>';
    html += '<div class="sub">Предел полной массы: ' + fmt(massLim, 0) + ' т · ' + axles + ' ' + axesWord(axles) + ' · дорога ' + ROAD_NAME[inp.road] + '</div>';
    if (worst > 1.0001) {
      html += '<div class="sub" style="color:var(--bad);margin-top:6px">Перегруз: ' + worstName + ' — ' + fmt((worst - 1) * 100, 1) + '%</div>';
    }
    if (res.clamp) {
      html += '<div class="warnline">! Передняя ось полностью разгружена — проверьте положение центра масс груза.</div>';
    }
    html += '</div>';

    html += '<div class="axles" style="margin:0 0 10px">';
    for (var q = 0; q < items.length; q++) {
      var it = items[q];
      for (var a = 0; a < it.g.count; a++) {
        var load = it.g.load / it.g.count;
        var per = singleLimit(it.g.wheels, inp.road);
        var cls = load > per + 1e-9 ? 'over' : (load > per * 0.97 ? 'warn' : '');
        html += '<div class="axle ' + cls + '"><b>' + fmt(load) + '</b><small>ось · норма ' + fmt(per, 1) + '</small></div>';
      }
    }
    html += '</div>';

    for (var j = 0; j < items.length; j++) {
      var itm = items[j], gg = itm.g, rr = itm.r;
      var s2 = statusClass(rr);
      var pct = Math.min(100, Math.round(rr * 100));
      var color = s2 === 'bad' ? 'var(--bad)' : (s2 === 'warn' ? 'var(--warn)' : 'var(--ok)');
      var meta = groupKindLabel(gg) + (gg.count > 1 ? ' · ' + fmt(gg.spacing) + ' м' : '') + (gg.wheels === 'one' ? ' · односкатные' : ' · двускатные');

      html += '<div class="group ' + (rr > 1.0001 ? 'over' : '') + '">';
      html += '<div class="ghead"><span class="gname">' + gg.name + '</span>';
      html += '<span class="gnum">' + fmt(gg.load) + ' <span>/ ' + fmt(itm.lim, 1) + ' т</span></span></div>';
      html += '<div class="bar"><i style="width:' + pct + '%;background:' + color + '"></i></div>';
      html += '<div class="gmeta"><span>' + meta + '</span>';
      html += '<span class="tag ' + s2 + '">' + (rr > 1.0001 ? '+' + fmt((rr - 1) * 100, 1) + '%' : Math.round(rr * 100) + '%') + '</span></div>';
      html += '</div>';
    }

    var maxTxt;
    if (mx.perUnit) maxTxt = fmt(mx.maxCargo, 1) + ' <small>т</small>';
    else maxTxt = fmt(mx.maxCargo, 1) + ' <small>т</small>';
    var extra = '';
    if (cargoTotal(inp) > 0) {
      var diff = mx.maxCargo - cargoTotal(inp);
      if (diff < -0.001) extra = 'Сейчас ' + fmt(cargoTotal(inp)) + ' т — снимите ' + fmt(-diff, 2) + ' т.';
      else if (diff > 0.02) extra = 'Сейчас ' + fmt(cargoTotal(inp)) + ' т — запас ' + fmt(diff, 2) + ' т.';
      else extra = 'Сейчас ' + fmt(cargoTotal(inp)) + ' т — ровно по пределу.';
    } else {
      extra = 'Груз не задан — значение для груза в центре кузова.';
    }

    html += '<div class="maxload"><div class="t">Максимальная масса груза при текущем расположении</div>';
    html += '<div class="v">' + maxTxt + '</div><div class="t">' + extra + '</div></div>';

    $('result').innerHTML = html;
  }

  /* ---------------- модальное окно нормативов ---------------- */

  function modalHtml() {
    var t = NORM[road];
    var R = ['<h3>Осевые нагрузки · дорога ' + ROAD_NAME[road] + '</h3>'];
    R.push('<table><thead><tr><th>Оси</th><th>Расст.</th><th>Односкат</th><th>Двускат</th></tr></thead><tbody>');
    R.push('<tr><td>Одиночная ось</td><td>&gt;2,5 м</td><td>' + fmt(t.single.one, 1) + '</td><td>' + fmt(t.single.dual, 1) + '</td></tr>');
    var rng = ['до 1 м', '1–1,3', '1,3–1,8', '1,8–2,5'];
    var maps = [['Сдвоенные', t.g2], ['Строенные', t.g3], ['Более 3 осей (на ось)', t.g4]];
    for (var i = 0; i < maps.length; i++) {
      for (var j = 0; j < 4; j++) {
        R.push('<tr><td>' + (j === 0 ? maps[i][0] : '') + '</td><td>' + rng[j] + ' м</td><td>' + fmt(maps[i][1][j].one, 1) + '</td><td>' + fmt(maps[i][1][j].dual, 1) + '</td></tr>');
      }
    }
    R.push('</tbody></table>');
    R.push('<p class="note">Значения — приложение № 3 к Правилам перевозок грузов (ПП РФ от 21.12.2020 № 2200, ред. 27.05.2025), т. Для групп сдвоенных и строенных осей приведена допустимая нагрузка на группу.</p>');

    R.push('<h3>Допустимая полная масса</h3>');
    R.push('<table><thead><tr><th>Тип</th><th>Осей</th><th>Масса</th></tr></thead><tbody>');
    R.push('<tr><td>Одиночные</td><td>2</td><td>18 т</td></tr>');
    R.push('<tr><td>Одиночные</td><td>3</td><td>25 т</td></tr>');
    R.push('<tr><td>Одиночные</td><td>4</td><td>32 т</td></tr>');
    R.push('<tr><td>Одиночные</td><td>5 и более</td><td>38 т</td></tr>');
    R.push('<tr><td>Автопоезда</td><td>3</td><td>28 т</td></tr>');
    R.push('<tr><td>Автопоезда</td><td>4</td><td>36 т</td></tr>');
    R.push('<tr><td>Автопоезда</td><td>5</td><td>40 т</td></tr>');
    R.push('<tr><td>Автопоезда</td><td>6 и более</td><td>44 т</td></tr>');
    R.push('</tbody></table>');
    R.push('<p class="note">Приложение № 1 к тем же Правилам.</p>');

    R.push('<h3>Как считается</h3>');
    R.push('<p class="note">Нагрузки на оси определяются по схеме балки на двух опорах: передняя ось и середина задней группы (тележки). Груз учитывается как точечная масса в точке его центра. Внутри группы (тележки, полуприцепа, прицепа) нагрузка принята равномерной. Расчёт статический, без учёта динамики, крена и податливости подвески.</p>');
    R.push('<p class="note">Результат — справочный. Обязательны дорожные знаки с фактической допустимой нагрузкой и данные контрольного взвешивания.</p>');
    return R.join('');
  }

  /* ---------------- сохранения ---------------- */

  function loadSaves() {
    try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch (e) { return []; }
  }
  function writeSaves(arr) {
    try { localStorage.setItem(STORE, JSON.stringify(arr)); } catch (e) {}
  }

  function renderSaves() {
    var arr = loadSaves(), box = $('savedList');
    if (!arr.length) { box.innerHTML = '<div class="saved-empty">Пока пусто. Нажмите «Сохранить расчёт».</div>'; return; }
    var h = '';
    for (var i = 0; i < arr.length; i++) {
      var s = arr[i];
      h += '<div class="sitem"><div class="s-main"><div class="s-name">' + s.name + '</div>';
      h += '<div class="s-sub">' + s.sub + '</div></div>';
      h += '<button data-open="' + s.id + '" title="Открыть">›</button>';
      h += '<button data-del="' + s.id + '" title="Удалить">×</button></div>';
    }
    box.innerHTML = h;
  }

  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 1900);
  }

  function snapshot() {
    var o = { scheme: scheme, road: road };
    var nodes = document.querySelectorAll('#panel-A input, #panel-A select, #panel-B input, #panel-B select, #panel-C input, #panel-C select');
    for (var i = 0; i < nodes.length; i++) o[nodes[i].id] = nodes[i].value;
    return o;
  }

  function applySnapshot(o) {
    var nodes = document.querySelectorAll('#panel-A input, #panel-A select, #panel-B input, #panel-B select, #panel-C input, #panel-C select');
    for (var i = 0; i < nodes.length; i++) {
      var v = o[nodes[i].id];
      if (v !== undefined && v !== null) nodes[i].value = v;
    }
    scheme = o.scheme || 'A';
    road = o.road || '11.5';
    var tb = document.querySelectorAll('#tabs button');
    for (var j = 0; j < tb.length; j++) tb[j].classList.toggle('on', tb[j].getAttribute('data-s') === scheme);
    var rb = document.querySelectorAll('#roadSeg button');
    for (var m = 0; m < rb.length; m++) rb[m].classList.toggle('on', rb[m].getAttribute('data-r') === road);
    $('roadHint').textContent = ROAD_NAME[road];
    ['A', 'B', 'C'].forEach(function (s) {
      $('panel-' + s).classList.toggle('hidden', s !== scheme);
    });
    render();
  }

  function schemeName(s) { return s === 'A' ? 'Одиночный' : (s === 'B' ? 'Тягач + п/п' : 'Автопоезд'); }

  /* ---------------- события ---------------- */

  function bind() {
    $('tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      scheme = b.getAttribute('data-s');
      var btns = this.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', btns[i] === b);
      ['A', 'B', 'C'].forEach(function (s) { $('panel-' + s).classList.toggle('hidden', s !== scheme); });
      render();
    });

    $('roadSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      road = b.getAttribute('data-r');
      var btns = this.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', btns[i] === b);
      $('roadHint').textContent = ROAD_NAME[road];
      render();
    });

    document.addEventListener('input', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') render();
    });
    document.addEventListener('change', function (e) {
      if (e.target.tagName === 'SELECT') render();
    });

    $('infoBtn').addEventListener('click', function () {
      $('modalBody').innerHTML = modalHtml();
      $('modal').classList.remove('hidden');
    });
    $('modalClose').addEventListener('click', function () { $('modal').classList.add('hidden'); });
    $('modal').addEventListener('click', function (e) { if (e.target === this) this.classList.add('hidden'); });

    $('saveBtn').addEventListener('click', function () {
      var inp = snapshot();
      var res = calc(inp, 1);
      var mx = solveMax(inp);
      var arr = loadSaves();
      arr.unshift({
        id: 's' + Date.now(),
        name: schemeName(scheme) + ' · ' + fmt(res.totalMass) + ' т',
        sub: 'груз до ' + fmt(mx.maxCargo, 1) + ' т · ' + ROAD_NAME[inp.road],
        data: inp
      });
      writeSaves(arr.slice(0, 40));
      renderSaves();
      toast('Расчёт сохранён');
    });

    $('clearBtn').addEventListener('click', function () {
      writeSaves([]); renderSaves(); toast('Список очищен');
    });

    $('savedList').addEventListener('click', function (e) {
      var open = e.target.getAttribute('data-open');
      var del = e.target.getAttribute('data-del');
      if (open) {
        var arr = loadSaves();
        for (var i = 0; i < arr.length; i++) if (arr[i].id === open) { applySnapshot(arr[i].data); toast('Расчёт открыт'); break; }
      } else if (del) {
        writeSaves(loadSaves().filter(function (x) { return x.id !== del; }));
        renderSaves();
      }
    });

    $('copyBtn').addEventListener('click', copyResult);
  }

  function copyResult() {
    var inp = snapshot();
    var res = calc(inp, 1);
    var mx = solveMax(inp);
    var lines = [];
    lines.push('Осевая нагрузка · ' + schemeName(scheme) + ' · дорога ' + ROAD_NAME[inp.road]);
    lines.push('Полная масса: ' + fmt(res.totalMass) + ' т (предел ' + fmt(totalLimit(res.kind, axleCountOf(res)), 0) + ' т)');
    for (var i = 0; i < res.groups.length; i++) {
      var g = res.groups[i];
      var lim = groupLimit(g.count, g.spacing, g.wheels, inp.road);
      lines.push(g.name + ': ' + fmt(g.load) + ' т из ' + fmt(lim, 1) + ' т' + (g.count > 1 ? ' (по ' + fmt(g.load / g.count) + ' т на ось)' : ''));
    }
    lines.push('Максимальная масса груза: ' + fmt(mx.maxCargo, 1) + ' т');

    var text = lines.join('\n');
    var done = function () { toast('Скопировано'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else fallbackCopy(text, done);
  }

  function fallbackCopy(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); cb(); } catch (e) { toast('Не удалось скопировать'); }
    document.body.removeChild(ta);
  }

  bind();
  render();
  renderSaves();
})();
