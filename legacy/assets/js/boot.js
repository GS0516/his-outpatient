/* ==========================================================================
   HIS · 工作台启动（登录守卫 + 导航 + 会话）
   ========================================================================== */
(function () {
  'use strict';
  var H = window.HIS;

  H.addNav('工作台', [
    { id: 'dashboard', title: '工作台总览', icon: 'grid' }
  ]);

  H.addNav('门诊业务', [
    { id: 'clinic/op', title: '门诊医生工作站', icon: 'stethoscope' }
  ]);

  H.defaultRoute = 'dashboard';

  document.addEventListener('DOMContentLoaded', function () {
    if (!H.auth.require()) return;
    H.store.init();
    H.auth.init();
    H.startConsole();

    var p = H.auth.profile();
    var av = document.getElementById('userAv');
    var nm = document.getElementById('userName');
    var rl = document.getElementById('userRole');
    if (p) {
      if (av) av.textContent = (p.name || '?').slice(0, 1);
      if (nm) nm.textContent = p.name;
      if (rl) rl.textContent = p.roleName + ' · ' + (p.dept || '');
    }

    var lo = document.getElementById('btnLogout');
    if (lo) lo.addEventListener('click', function () {
      H.confirm('确认退出登录？').then(function (ok) {
        if (!ok) return;
        H.auth.logout();
        location.replace('login.html');
      });
    });

    ['click', 'keydown', 'mousemove', 'scroll'].forEach(function (ev) {
      window.addEventListener(ev, function () { H.auth.touch(); }, { passive: true });
    });
    setInterval(function () {
      if (!H.auth.session) return;
      if (H.auth.idleExpired()) {
        H.auth.logout('空闲超时自动退出');
        location.replace('login.html?expired=1');
      }
    }, 30000);

    var s = document.getElementById('navSearch');
    if (s) {
      s.addEventListener('input', function () {
        var q = s.value.trim().toLowerCase();
        document.querySelectorAll('.nav-item').forEach(function (a) {
          a.style.display = !q || a.textContent.toLowerCase().indexOf(q) > -1 ? '' : 'none';
        });
      });
    }

    var rb = document.getElementById('btnReset');
    if (rb) {
      if (!H.auth.can('resetData')) rb.style.display = 'none';
      rb.addEventListener('click', function () {
        H.confirm('将清空本地修改并恢复初始演示数据，确认继续？', true).then(function (ok) {
          if (!ok) return;
          var keep = H.auth.session ? H.auth.session.token : null;
          H.store.reset();
          H.auth.init();
          if (keep) { try { sessionStorage.setItem('his.token', keep); } catch (e) { } }
          H.toast('已恢复初始数据', 'ok');
          H.renderRoute();
          H.refreshCounters();
        });
      });
    }

    var lb = document.getElementById('btnLog');
    if (lb) {
      if (!H.auth.can('viewAudit')) lb.style.display = 'none';
      lb.addEventListener('click', function () {
        var logs = H.store.all('audit').slice(0, 60);
        var body = logs.length ? '<div class="timeline">' + logs.map(function (l) {
          return '<div class="tl-item"><div class="tl-t">' + H.esc(l.action) + ' · ' + H.esc(l.objectId || '') + '</div>' +
            '<div class="tl-s">' + H.esc(l.userName) + '（' + H.esc((H.ROLES[l.role] || {}).name || l.role) + '） · ' + H.esc(l.time) + ' · ' + H.esc(l.ip) + '</div></div>';
        }).join('') + '</div>' : H.empty('暂无操作记录', '关键操作会自动留痕');
        H.drawer({ title: '操作日志（不可篡改留痕）', body: body, width: '480px' });
      });
    }

    var uc = document.getElementById('userChip');
    if (uc) uc.addEventListener('click', function (e) {
      if (e.target.closest('#btnLogout')) return;
      var me = H.auth.profile();
      H.modal({
        title: '当前用户与权限', width: '470px',
        body: '<dl class="dl">' +
          '<dt>姓名</dt><dd>' + H.esc(me.name) + '</dd>' +
          '<dt>账号</dt><dd class="mono">' + H.esc(me.username) + '</dd>' +
          '<dt>角色</dt><dd>' + H.esc(me.roleName) + '（' + H.esc(me.role) + '）</dd>' +
          '<dt>科室</dt><dd>' + H.esc(me.dept) + '</dd>' +
          '<dt>会话</dt><dd>' + (H.config.SESSION_HOURS || 8) + ' 小时 · 空闲 ' + (H.config.IDLE_MINUTES || 30) + ' 分钟自动退出</dd>' +
          '</dl><div class="alert alert-info" style="margin-top:14px">' + H.icon('shield', 16, 'ai') +
          '<div>医生可接诊与开方；管理员只读查阅，越权操作返回 403 并写入审计。</div></div>'
      });
    });
  });
})();
