/* ==========================================================================
   HIS · 首页交互 (home.js) · 第三章
   粒子星链 / 心电波形 / 数字滚动 / 滚动揭示 / 卡片微倾斜 / 示例渲染
   ========================================================================== */
(function () {
  'use strict';
  var H = window.HIS || {};

  /* ---------------- 1. 背景粒子 ---------------- */
  (function particles() {
    var cv = document.getElementById('fx');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, Hh = 0, nodes = [], mouse = { x: -9999, y: -9999 };
    var COLORS = ['15,143,134', '37,99,235', '14,165,233'];

    function resize() {
      W = cv.clientWidth; Hh = cv.clientHeight;
      cv.width = W * dpr; cv.height = Hh * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.min(80, Math.round((W * Hh) / 24000));
      nodes = [];
      for (var i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * W, y: Math.random() * Hh,
          vx: (Math.random() - 0.5) * 0.26, vy: (Math.random() - 0.5) * 0.26,
          r: Math.random() * 1.6 + 0.7,
          c: COLORS[Math.floor(Math.random() * COLORS.length)]
        });
      }
    }
    function frame() {
      ctx.clearRect(0, 0, W, Hh);
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.x += n.vx; n.y += n.vy;
        if (n.x < -20) n.x = W + 20; if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = Hh + 20; if (n.y > Hh + 20) n.y = -20;
        var dxm = n.x - mouse.x, dym = n.y - mouse.y;
        var dm = Math.sqrt(dxm * dxm + dym * dym);
        if (dm < 120 && dm > 0.1) { n.x += (dxm / dm) * 0.6; n.y += (dym / dm) * 0.6; }
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + n.c + ',.45)'; ctx.fill();
      }
      for (var a = 0; a < nodes.length; a++) {
        for (var b = a + 1; b < nodes.length; b++) {
          var dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y;
          var d = dx * dx + dy * dy;
          if (d < 14000) {
            ctx.beginPath(); ctx.moveTo(nodes[a].x, nodes[a].y); ctx.lineTo(nodes[b].x, nodes[b].y);
            ctx.strokeStyle = 'rgba(15,143,134,' + ((1 - d / 14000) * 0.28).toFixed(3) + ')';
            ctx.lineWidth = 0.6; ctx.stroke();
          }
        }
      }
      requestAnimationFrame(frame);
    }
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; });
    window.addEventListener('mouseout', function () { mouse.x = -9999; mouse.y = -9999; });
    resize(); frame();
  })();

  /* ---------------- 2. 心电波形 ---------------- */
  (function ecg() {
    var p = document.getElementById('ecgPath');
    if (!p) return;
    var W = 520, base = 46, beats = 5, bw = W / beats;
    var d = 'M0,' + base;
    for (var i = 0; i < beats; i++) {
      var x = i * bw;
      [[0, 0], [0.10, 0], [0.14, -5], [0.18, 0], [0.24, 0], [0.27, 4], [0.30, -26], [0.33, 12], [0.36, 0], [0.42, 0], [0.50, -8], [0.58, -10], [0.66, 0], [1, 0]]
        .forEach(function (pt) { d += ' L' + (x + pt[0] * bw).toFixed(1) + ',' + (base + pt[1]).toFixed(1); });
    }
    p.setAttribute('d', d);
  })();

  /* ---------------- 3. 数字滚动 ---------------- */
  (function counters() {
    var els = document.querySelectorAll('[data-count]');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.textContent = e.dataset.count; }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, target = Number(el.dataset.count) || 0, start = null;
        (function step(t) {
          if (!start) start = t;
          var k = Math.min(1, (t - start) / 1000);
          el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
          if (k < 1) requestAnimationFrame(step);
        })(performance.now());
        io.unobserve(el);
      });
    }, { threshold: 0.4 });
    els.forEach(function (e) { io.observe(e); });
  })();

  /* ---------------- 4. 滚动揭示 ---------------- */
  (function reveal() {
    var nav = document.getElementById('nav');
    var onScroll = function () { if (nav) nav.classList.toggle('scrolled', window.scrollY > 24); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    if (!('IntersectionObserver' in window)) { document.querySelectorAll('.reveal').forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(function (e) { io.observe(e); });
  })();

  /* ---------------- 5. 卡片微倾斜 ---------------- */
  document.addEventListener('mousemove', function (e) {
    var card = e.target.closest ? e.target.closest('.mod') : null;
    document.querySelectorAll('.mod').forEach(function (m) { if (m !== card) m.style.transform = ''; });
    if (!card) return;
    var r = card.getBoundingClientRect();
    var px = (e.clientX - r.left) / r.width - 0.5;
    var py = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = 'perspective(900px) rotateX(' + (-py * 4).toFixed(2) + 'deg) rotateY(' + (px * 5).toFixed(2) + 'deg) translateY(-3px)';
  });

  /* ---------------- 6. 示例处方笺 ---------------- */
  (function rxDemo() {
    var box = document.getElementById('rxDemo');
    if (!box || !H.dict) return;
    var picks = ['Y0002', 'Y0009', 'Y0007'];
    var rows = picks.map(function (code) {
      var d = H.dict.drugs.filter(function (x) { return x.code === code; })[0];
      if (!d) return '';
      return '<tr><td><div class="cell-main">' + H.esc(d.name) + '</div><div class="cell-sub">' + H.esc(d.spec) + ' · 医保 ' + d.ins + ' 类</div></td>' +
        '<td class="mono">' + (d.price) + '</td><td class="mono">1</td><td class="mono">' + d.price.toFixed(2) + '</td></tr>';
    }).join('');
    var total = picks.reduce(function (s, c) {
      var d = H.dict.drugs.filter(function (x) { return x.code === c; })[0];
      return s + (d ? d.price : 0);
    }, 0);
    box.innerHTML = '<div class="table-wrap"><table class="tbl"><thead><tr><th>药品</th><th>单价</th><th>数量</th><th>金额</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>' +
      '<div style="display:flex;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--line)">' +
      '<span class="small muted">诊断：急性支气管炎（J20.900）</span>' +
      '<span class="mono" style="font-weight:650">合计 ¥' + total.toFixed(2) + '</span></div>';
  })();

  /* ---------------- 7. 条款对照表 ---------------- */
  (function specTable() {
    var box = document.getElementById('specTable');
    if (!box) return;
    var rows = [
      ['1', '自动获取或提供病人、诊疗、医生、费用、用药信息', '接诊页患者卡 / 病历 / 费用区'],
      ['2', '处理门诊记录、检查、检验、诊断、处方、治疗处置、卫生材料、手术、收入院', '五个工作页签 + 住院证/手术申请'],
      ['3', '处方自动监测与咨询（剂量、相互作用、配伍禁忌、适应症）', '处方页「合理用药审查」'],
      ['4', '常用临床项目字典、医嘱模板及编辑', '添加药品检索 / 套用模板 / 存为模板'],
      ['5', '完整性审核、记录医生与时间、确认后不可更改、提供作废', '「提交并锁定」+ 作废处方'],
      ['6', '所有医嘱提供备注', '病历备注与处方用法字段'],
      ['7', '查询历次就诊与检验检查结果并提供比较', '「历次就诊」页签 + 结果趋势'],
      ['8', '自动核算就诊费用、支持医保费用管理', '底部合计（服务端划价）+ 医保类别'],
      ['9', '打印处方、检查检验申请单', '打印处方笺 / 病历 / 申请单'],
      ['10', '医生权限管理（部门、等级、功能）', '登录 + RBAC，越权 403'],
      ['11', '自动传送诊疗与费用信息至相关部门', '提交后处方与申请单进入对应队列']
    ];
    box.innerHTML = '<div class="table-wrap"><table class="tbl"><thead><tr><th style="width:56px">条款</th><th>规范要求</th><th>实现位置</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td class="mono">' + r[0] + '</td><td class="small">' + H.esc(r[1]) + '</td><td class="small muted">' + H.esc(r[2]) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  })();
})();
