/* ==========================================================================
   HIS · 工作台总览（第三章 门诊医生工作站）
   ========================================================================== */
(function () {
  'use strict';
  var H = window.HIS, S = H.store;

  H.route('dashboard', {
    title: '工作台总览', group: '工作台',
    render: function (root) {
      var st = H.api.stats();
      var waiting = S.where('patients', function (p) { return p.status === '待诊'; });
      var visits = S.all('visits');
      var rxs = S.all('prescriptions');

      root.appendChild(H.pageHeader({
        title: '工作台总览', ver: '今日',
        desc: '第三章门诊医生工作站的当日视图：候诊、已接诊、处方传送与待检待查，一屏看完。',
        actions: [
          H.btn('开始接诊', { icon: 'stethoscope', cls: 'btn-primary', onclick: function () { H.go('clinic/op'); } }),
          H.btn('操作日志', { icon: 'clock', onclick: showAudit })
        ]
      }));

      var kpi = H.el('div', { class: 'kpi-grid block' });
      kpi.innerHTML =
        H.kpi({ label: '候诊患者', value: st.waiting, unit: '人', foot: '按挂号顺序叫号', spark: [3, 5, 4, 6, 5, 7, 6, 8, 7, st.waiting] }) +
        H.kpi({ label: '今日已接诊', value: st.visitsToday, unit: '人次', foot: '含本次会话提交' }) +
        H.kpi({ label: '待收费处方', value: st.rxPending, unit: '张', foot: '已传送至门诊收费' }) +
        H.kpi({ label: '待检验 / 待检查', value: st.labsPending + st.examsPending, unit: '份', foot: '检验 ' + st.labsPending + ' · 检查 ' + st.examsPending }) +
        H.kpi({ label: '医嘱模板', value: S.all('templates').length, unit: '套', foot: '可按科室套用' }) +
        H.kpi({ label: '已提交病历', value: visits.length, unit: '份', foot: '确认后不可更改' });
      root.appendChild(kpi);

      var grid = H.el('div', { class: 'grid-2' });

      /* 候诊队列 */
      var q = H.el('div');
      q.appendChild(H.table({
        columns: [
          { key: 'name', label: '患者', render: function (r) { return '<div class="cell-main">' + H.esc(r.name) + '</div><div class="cell-sub">' + r.sex + ' · ' + r.age + ' 岁 · ' + H.esc(r.ins) + '</div>'; } },
          { key: 'dept', label: '科室', width: '100px' },
          { key: 'complaint', label: '主诉', render: function (r) { return '<span class="muted small">' + H.esc(r.complaint || '').slice(0, 20) + '…</span>'; } },
          { key: 'op', label: '', width: '74px', align: 'right', render: function () { return '<div class="ops"><button class="btn btn-xs" data-go="1">接诊</button></div>'; } }
        ],
        rows: waiting.slice(0, 6),
        empty: '暂无候诊患者'
      }));
      q.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { H.go('clinic/op'); }); });
      grid.appendChild(H.card('候诊队列 <span class="tag tag-info no-dot">' + waiting.length + ' 人</span>', q, { flush: true }));

      /* 已传送处方 */
      var rxBox = H.el('div');
      rxBox.appendChild(H.table({
        columns: [
          { key: 'patient', label: '患者', width: '80px' },
          { key: 'diagnosis', label: '诊断', render: function (r) { return '<span class="small muted">' + H.esc(r.diagnosis || '—') + '</span>'; } },
          { key: 'total', label: '金额', width: '88px', render: function (r) { return '<span class="mono">' + H.money(r.total) + '</span>'; } },
          { key: 'status', label: '状态', width: '86px', render: function (r) { return H.status(r.status); } },
          { key: 'time', label: '时间', width: '110px', render: function (r) { return '<span class="mono tiny muted">' + H.esc(r.time || '') + '</span>'; } }
        ],
        rows: rxs.slice(0, 6),
        empty: '暂无处方'
      }));
      grid.appendChild(H.card('已提交处方（传送至收费/药房）', rxBox, { flush: true }));
      root.appendChild(grid);

      /* 今日就诊记录 */
      var vBox = H.el('div');
      vBox.appendChild(H.table({
        columns: [
          { key: 'date', label: '日期', width: '100px', render: function (r) { return '<span class="mono small">' + H.esc(r.date) + '</span>'; } },
          { key: 'patient', label: '患者', width: '90px' },
          { key: 'dept', label: '科室', width: '100px' },
          { key: 'diagnosis', label: '诊断' },
          { key: 'total', label: '费用', width: '100px', render: function (r) { return '<span class="mono">' + H.money(r.total) + '</span>'; } },
          { key: 'status', label: '状态', width: '90px', render: function (r) { return H.status(r.status === '已提交' ? '已完成' : r.status); } }
        ],
        rows: visits.slice(0, 8),
        empty: '今日暂无接诊记录'
      }));
      root.appendChild(H.card('门诊接诊记录', vBox, { flush: true }));

      function showAudit() {
        if (!H.auth.can('viewAudit')) return H.toast('当前账号无审计查看权限（管理员可查看）', 'warn');
        H.drawer({ title: '操作审计日志', width: '560px', body: auditHTML() });
      }
      function auditHTML() {
        var logs = S.all('audit').slice(0, 60);
        if (!logs.length) return H.empty('暂无操作记录', '提交病历、作废处方等操作会自动留痕');
        return '<div class="timeline">' + logs.map(function (l) {
          return '<div class="tl-item"><div class="tl-t">' + H.esc(l.action) + ' · ' + H.esc(l.objectId || '') + '</div>' +
            '<div class="tl-s">' + H.esc(l.userName) + '（' + H.esc((H.ROLES[l.role] || {}).name || l.role) + '） · ' + H.esc(l.time) + ' · ' + H.esc(l.ip) + '</div></div>';
        }).join('') + '</div>';
      }
    }
  });
})();
