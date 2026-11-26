/* ==========================================================================
   HIS · 登录页逻辑 (login.js)
   ========================================================================== */
(function () {
  'use strict';
  var H = window.HIS;

  document.addEventListener('DOMContentLoaded', function () {
    H.store.init();
    H.auth.init();

    /* 已登录且令牌有效则直接进入 */
    if (H.auth.restore() && !H.auth.idleExpired()) {
      location.replace('console.html' + (location.hash || '#/dashboard'));
      return;
    }

    var form = document.getElementById('loginForm');
    var uEl = document.getElementById('username');
    var pEl = document.getElementById('password');
    var errEl = document.getElementById('loginError');
    var btn = document.getElementById('loginBtn');
    var remember = document.getElementById('remember');

    try {
      var last = localStorage.getItem('his.lastUser');
      if (last) { uEl.value = last; remember.checked = true; }
    } catch (e) { }

    if (location.search.indexOf('expired=1') > -1) errEl.textContent = '登录已过期，请重新登录。';

    /* 演示账号一键填入 */
    document.querySelectorAll('.demo-item').forEach(function (b) {
      b.addEventListener('click', function () {
        uEl.value = b.dataset.u;
        pEl.value = b.dataset.p;
        errEl.textContent = '';
        pEl.focus();
      });
    });

    /* 显示/隐藏口令 */
    var eye = document.getElementById('pwEye');
    eye.addEventListener('click', function () {
      var show = pEl.type === 'password';
      pEl.type = show ? 'text' : 'password';
      eye.textContent = show ? '隐藏' : '显示';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errEl.textContent = '';
      var u = uEl.value.trim(), p = pEl.value;
      if (!u || !p) { errEl.textContent = '请输入用户名与密码'; return; }
      btn.disabled = true;
      btn.textContent = '登录中…';
      H.auth.login(u, p).then(function (res) {
        btn.disabled = false;
        btn.textContent = '登 录';
        if (!res.ok) {
          errEl.textContent = res.status === 403 ? res.message : '用户名或密码错误（401）';
          pEl.value = '';
          pEl.focus();
          return;
        }
        try {
          if (remember.checked) localStorage.setItem('his.lastUser', u);
          else localStorage.removeItem('his.lastUser');
        } catch (e2) { }
        var from = new URLSearchParams(location.search).get('from') || '#/dashboard';
        location.replace('console.html' + (from.indexOf('#') === 0 ? from : '#/dashboard'));
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = '登 录';
        errEl.textContent = '登录异常：' + err.message;
      });
    });
  });
})();
