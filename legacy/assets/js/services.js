/* ==========================================================================
   HIS · 业务服务层 (services.js)
   认证 / RBAC / 事务 / 划价 / 收费 / 发药 / 挂号号源 / 导入 / 智能分诊 / 审计
   说明：本层是浏览器内的"后端替身"，对外暴露与 REST 契约一致的状态码
        （200 / 400 / 401 / 403 / 409），便于将来整体替换为真实后端。
   ========================================================================== */
window.HIS = window.HIS || {};
(function () {
  'use strict';
  var H = window.HIS, C = H.config || {};

  /* ======================================================================
     0. 摘要算法：SHA-256 / HMAC-SHA256 / PBKDF2
     ====================================================================== */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256Bytes(bytes) {
    var H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var l = bytes.length;
    var withOne = l + 1;
    var padLen = (withOne % 64 <= 56 ? 56 - (withOne % 64) : 120 - (withOne % 64));
    var total = withOne + padLen + 8;
    var buf = new Uint8Array(total);
    buf.set(bytes);
    buf[l] = 0x80;
    var bitLen = l * 8;
    var hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
    buf[total - 8] = (hi >>> 24) & 255; buf[total - 7] = (hi >>> 16) & 255; buf[total - 6] = (hi >>> 8) & 255; buf[total - 5] = hi & 255;
    buf[total - 4] = (lo >>> 24) & 255; buf[total - 3] = (lo >>> 16) & 255; buf[total - 2] = (lo >>> 8) & 255; buf[total - 1] = lo & 255;

    var w = new Uint32Array(64);
    for (var off = 0; off < total; off += 64) {
      for (var i = 0; i < 16; i++) {
        w[i] = (buf[off + i * 4] << 24) | (buf[off + i * 4 + 1] << 16) | (buf[off + i * 4 + 2] << 8) | buf[off + i * 4 + 3];
      }
      for (var j = 16; j < 64; j++) {
        var s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        var s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
      }
      var a = H0[0], b = H0[1], c = H0[2], d = H0[3], e = H0[4], f = H0[5], g = H0[6], h = H0[7];
      for (var t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H0[0] = (H0[0] + a) >>> 0; H0[1] = (H0[1] + b) >>> 0; H0[2] = (H0[2] + c) >>> 0; H0[3] = (H0[3] + d) >>> 0;
      H0[4] = (H0[4] + e) >>> 0; H0[5] = (H0[5] + f) >>> 0; H0[6] = (H0[6] + g) >>> 0; H0[7] = (H0[7] + h) >>> 0;
    }
    var out = new Uint8Array(32);
    for (var k = 0; k < 8; k++) {
      out[k * 4] = (H0[k] >>> 24) & 255; out[k * 4 + 1] = (H0[k] >>> 16) & 255;
      out[k * 4 + 2] = (H0[k] >>> 8) & 255; out[k * 4 + 3] = H0[k] & 255;
    }
    return out;
  }

  function hmacBytes(keyBytes, msgBytes) {
    var block = 64;
    if (keyBytes.length > block) keyBytes = sha256Bytes(keyBytes);
    var k = new Uint8Array(block);
    k.set(keyBytes);
    var ipad = new Uint8Array(block), opad = new Uint8Array(block);
    for (var i = 0; i < block; i++) { ipad[i] = k[i] ^ 0x36; opad[i] = k[i] ^ 0x5c; }
    var inner = new Uint8Array(block + msgBytes.length);
    inner.set(ipad); inner.set(msgBytes, block);
    var outer = new Uint8Array(block + 32);
    outer.set(opad); outer.set(sha256Bytes(inner), block);
    return sha256Bytes(outer);
  }

  function utf8(str) {
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0xd800 || c >= 0xe000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else { i++; c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff)); out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
    }
    return new Uint8Array(out);
  }
  function bytes2hex(b) { var s = ''; for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16); return s; }
  function hex2bytes(h) { var a = new Uint8Array(h.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }

  /* PBKDF2-HMAC-SHA256，单块 256bit（与 Python/Node 的 pbkdf2 兼容） */
  function pbkdf2Hex(password, saltHex, iters) {
    var salt = hex2bytes(saltHex);
    var pw = utf8(password);
    var block = new Uint8Array(salt.length + 4);
    block.set(salt); block[salt.length] = 0; block[salt.length + 1] = 0; block[salt.length + 2] = 0; block[salt.length + 3] = 1;
    var u = hmacBytes(pw, block);
    var t = u.slice(0);
    for (var i = 1; i < iters; i++) {
      u = hmacBytes(pw, u);
      for (var j = 0; j < 32; j++) t[j] ^= u[j];
    }
    return bytes2hex(t);
  }

  function webcrypto() {
    try { return (typeof crypto !== 'undefined' && crypto.subtle) ? crypto.subtle : null; } catch (e) { return null; }
  }

  function deriveAsync(password, saltHex, iters) {
    var subtle = webcrypto();
    if (!subtle) return Promise.resolve(pbkdf2Hex(password, saltHex, iters));
    return subtle.importKey('raw', utf8(password), { name: 'PBKDF2' }, false, ['deriveBits'])
      .then(function (key) {
        return subtle.deriveBits({ name: 'PBKDF2', salt: hex2bytes(saltHex), iterations: iters, hash: 'SHA-256' }, key, 256);
      })
      .then(function (bits) { return bytes2hex(new Uint8Array(bits)); })
      .catch(function () { return pbkdf2Hex(password, saltHex, iters); });
  }

  H.crypto = { sha256: function (s) { return bytes2hex(sha256Bytes(utf8(s))); }, hmac: function (k, m) { return bytes2hex(hmacBytes(utf8(k), utf8(m))); }, pbkdf2: pbkdf2Hex, pbkdf2Async: deriveAsync };

  /* ======================================================================
     1. 令牌（JWT 同构：base64url(payload).hmac）
     ====================================================================== */
  function b64url(str) {
    var b = utf8(str), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64url(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), out = [];
    for (var i = 0; i < bin.length; i++) out.push(('%' + ('00' + bin.charCodeAt(i).toString(16)).slice(-2)));
    return decodeURIComponent(out.join(''));
  }

  function issueToken(user) {
    var now = Math.floor(Date.now() / 1000);
    var payload = {
      sub: user.id, username: user.username, name: user.name, role: user.role, dept: user.dept,
      iat: now, exp: now + (C.SESSION_HOURS || 8) * 3600
    };
    var body = b64url(JSON.stringify(payload));
    var sig = bytes2hex(hmacBytes(utf8(C.TOKEN_SECRET || 'his'), utf8(body)));
    return body + '.' + sig;
  }

  function verifyToken(token) {
    if (!token || token.indexOf('.') < 0) return null;
    var parts = token.split('.');
    var expect = bytes2hex(hmacBytes(utf8(C.TOKEN_SECRET || 'his'), utf8(parts[0])));
    if (expect !== parts[1]) return null;
    var payload;
    try { payload = JSON.parse(unb64url(parts[0])); } catch (e) { return null; }
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  }

  /* ======================================================================
     2. 事务（快照 + 回滚）
     ====================================================================== */
  function ApiError(status, message, extra) {
    this.status = status; this.message = message; this.extra = extra || null;
  }
  H.ApiError = ApiError;

  H.tx = function (fn) {
    var snap = JSON.stringify(H.store.data);
    try {
      var r = fn();
      H.store.save();
      return r;
    } catch (e) {
      try { H.store.data = JSON.parse(snap); H.store.save(); } catch (e2) { }
      throw e;
    }
  };

  function fail(status, msg, extra) { return { ok: false, status: status, message: msg, body: extra || null }; }
  function done(body) { return { ok: true, status: 200, body: body }; }

  /* ======================================================================
     3. 角色与权限
     ====================================================================== */
  H.ROLES = {
    doctor: { name: '医生', desc: '接诊、书写病历、下达诊断、开具处方与检查检验申请' },
    admin: { name: '管理员', desc: '只读查看病历与处方、审计日志、数据维护' }
  };

  H.ALL_ROLES = ['doctor', 'admin'];

  var ROUTE_ROLES = {
    'dashboard': ['doctor', 'admin'],
    'clinic/op': ['doctor', 'admin']
  };

  var ACTION_ROLES = {
    prescribe: ['doctor'],
    voidRx: ['doctor'],
    manageTemplate: ['doctor'],
    viewAudit: ['admin'],
    resetData: ['admin']
  };

  H.auth = {
    session: null,
    idleAt: 0,

    init: function () {
      if (!H.store.all('users').length) {
        H.store.data.users = H.clone(H.seed.users || []);
        H.store.save();
      }
      return this;
    },

    login: function (username, password) {
      var self = this;
      var user = H.store.all('users').filter(function (u) { return u.username === String(username || '').trim(); })[0];
      if (!user) return Promise.resolve(fail(401, '用户名或密码错误'));
      if (user.locked) return Promise.resolve(fail(403, '账号已停用，请联系管理员'));
      return deriveAsync(String(password || ''), user.salt, user.iter || C.PBKDF2_ITER || 120000).then(function (hex) {
        if (hex !== user.hash) {
          H.audit('登录失败', user.username, '口令校验未通过', { anon: true });
          return fail(401, '用户名或密码错误');
        }
        var token = issueToken(user);
        self.setSession(token);
        H.audit('登录系统', user.username, '角色 ' + user.role);
        return done({ token: token, user: self.profile() });
      });
    },

    setSession: function (token) {
      try { sessionStorage.setItem('his.token', token); } catch (e) { }
      var p = verifyToken(token);
      this.session = p ? { id: p.sub, username: p.username, name: p.name, role: p.role, dept: p.dept, token: token } : null;
      this.idleAt = Date.now();
      H.session = this.session;
      return this.session;
    },

    restore: function () {
      var t = null;
      try { t = sessionStorage.getItem('his.token'); } catch (e) { }
      if (!t) return null;
      this.setSession(t);
      return this.session;
    },

    logout: function (reason) {
      if (this.session) H.audit('退出系统', this.session.username, reason || '主动退出');
      this.session = null; H.session = null;
      try { sessionStorage.removeItem('his.token'); } catch (e) { }
    },

    profile: function () {
      if (!this.session) return null;
      var r = H.ROLES[this.session.role] || {};
      return { id: this.session.id, username: this.session.username, name: this.session.name, role: this.session.role, roleName: r.name, dept: this.session.dept };
    },

    touch: function () { this.idleAt = Date.now(); },

    idleExpired: function () {
      return this.session && Date.now() - this.idleAt > (C.IDLE_MINUTES || 30) * 60000;
    },

    routeRoles: function (id) { return ROUTE_ROLES[id] || H.ALL_ROLES; },
    canRoute: function (id) {
      if (!this.session) return false;
      return this.routeRoles(id).indexOf(this.session.role) > -1;
    },
    can: function (action) {
      if (!this.session) return false;
      var roles = ACTION_ROLES[action];
      return !roles || roles.indexOf(this.session.role) > -1;
    },
    /** 权限断言：不满足直接抛出 403，由调用方按状态码处理 */
    assert: function (action) {
      if (!this.can(action)) {
        var msg = '当前角色【' + ((H.ROLES[this.session && this.session.role] || {}).name || '未登录') + '】无权执行：' + action;
        var e = new ApiError(403, msg);
        H.audit('越权拦截', action, msg);
        throw e;
      }
      return true;
    },
    require: function () {
      if (!this.restore()) { location.replace('login.html?from=' + encodeURIComponent(location.hash || '#/dashboard')); return false; }
      if (this.idleExpired()) { this.logout('长时间未操作，已自动退出'); location.replace('login.html?expired=1'); return false; }
      this.touch();
      return true;
    }
  };

  /* ======================================================================
     4. 审计日志（自动留痕：谁、何时、做了什么、对象、IP）
     ====================================================================== */
  H.audit = function (action, target, detail, opts) {
    opts = opts || {};
    var s = H.auth && H.auth.session;
    var row = {
      id: H.uid('A'),
      userId: s ? s.id : 'anonymous',
      username: s ? s.username : (opts.anon ? String(target || 'anonymous') : 'anonymous'),
      userName: s ? s.name : '匿名',
      role: s ? s.role : 'anonymous',
      action: action,
      objectType: opts.objectType || guessType(action),
      objectId: target || '',
      detail: detail || '',
      ip: opts.ip || '127.0.0.1（本地）',
      time: H.now()
    };
    if (!H.store.data.audit) H.store.data.audit = [];
    H.store.data.audit.unshift(row);
    if (H.store.data.audit.length > 3000) H.store.data.audit.length = 3000;
    H.store.save();
    return row;
  };

  function guessType(action) {
    if (/登录|退出/.test(action)) return 'auth';
    if (/挂号|号源/.test(action)) return 'registration';
    if (/处方|开方/.test(action)) return 'prescription';
    if (/收费|收费单/.test(action)) return 'charge';
    if (/发药|退药/.test(action)) return 'dispense';
    if (/调价/.test(action)) return 'price';
    if (/导入/.test(action)) return 'import';
    if (/医嘱/.test(action)) return 'order';
    if (/检验|检查|影像/.test(action)) return 'report';
    if (/手术/.test(action)) return 'surgery';
    if (/用户|角色/.test(action)) return 'user';
    return 'other';
  }


  /* ======================================================================
     5. 业务 API（第三章 门诊医生工作站）
     金额只由服务端按字典单价计算；提交在前端事务中完成，失败整体回滚。
     ====================================================================== */
  function money(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  var KIND = {
    drug: function (code) { return H.drug(code); },
    treat: function (code) { return (H.dict.treatments || []).filter(function (t) { return t.code === code; })[0] || null; },
    material: function (code) { return (H.dict.materials || []).filter(function (m) { return m.code === code; })[0] || null; }
  };

  H.api = {
    /* ---- 5.1 划价：金额只认字典单价，忽略前端传入的 price ---- */
    price: function (entries) {
      var lines = [], errors = [], total = 0;
      (entries || []).forEach(function (it, i) {
        var kind = it.kind || 'drug';
        var d = KIND[kind] ? KIND[kind](it.code) : null;
        var qty = Number(it.qty);
        if (!d) { errors.push({ index: i, code: it.code, reason: '项目不存在：' + it.code }); return; }
        if (!(qty > 0) || qty !== Math.floor(qty)) { errors.push({ index: i, code: it.code, reason: '数量必须为正整数' }); return; }
        var price = kind === 'drug' ? d.price : d.price;
        var amount = money(price * qty);
        total = money(total + amount);
        lines.push({
          kind: kind, code: d.code, name: d.name, spec: d.spec || d.unit || '',
          unit: d.unit || '次', qty: qty, price: price, amount: amount,
          ins: d.ins || '自费', usage: it.usage || d.usage || ''
        });
      });
      return { ok: errors.length === 0, lines: lines, total: total, errors: errors };
    },

    /* ---- 5.2 提交门诊病历与处方（完整性审核 + 事务 + 传送） ---- */
    submitVisit: function (patientId, payload) {
      try {
        H.auth.assert('prescribe');
        var p = H.store.get('patients', patientId);
        if (!p) return fail(404, '患者不存在');
        payload = payload || {};
        if (!String(payload.complaint || '').trim()) return fail(400, '主诉不能为空');
        if (!payload.diagnoses || !payload.diagnoses.length) return fail(400, '请至少录入一条诊断');
        var entries = [];
        (payload.items || []).forEach(function (x) { entries.push({ kind: 'drug', code: x.code, qty: x.qty, usage: x.usage }); });
        (payload.treatments || []).forEach(function (x) { entries.push({ kind: 'treat', code: x.code, qty: x.qty }); });
        (payload.materials || []).forEach(function (x) { entries.push({ kind: 'material', code: x.code, qty: x.qty }); });
        if (!entries.length) return fail(400, '处方与处置均为空，无法提交');
        var priced = this.price(entries);
        if (!priced.ok) return fail(400, '明细有误：' + priced.errors.map(function (e) { return e.reason; }).join('；'), priced.errors);

        var out = H.tx(function () {
          var now = H.now();
          var diagText = payload.diagnoses.map(function (c) {
            var i = H.dict.icd.filter(function (x) { return x.code === c; })[0];
            return i ? i.name + '（' + i.code + '）' : c;
          }).join('、');
          var visit = {
            id: H.uid('V'), patientId: p.id, patient: p.name, date: H.today(), time: now,
            dept: p.dept, doctor: H.session.name,
            complaint: payload.complaint, present: payload.present || '', past: payload.past || '',
            exam: payload.exam || '', note: payload.note || '',
            diagnosis: diagText, diags: payload.diagnoses.slice(),
            items: priced.lines.filter(function (l) { return l.kind === 'drug'; }).map(function (l) {
              return { code: l.code, name: l.name, spec: l.spec, qty: l.qty, price: l.price, usage: l.usage };
            }),
            treatments: priced.lines.filter(function (l) { return l.kind === 'treat'; }),
            materials: priced.lines.filter(function (l) { return l.kind === 'material'; }),
            total: priced.total, status: '已提交'
          };
          H.store.insert('visits', visit);

          var rx = null;
          if (visit.items.length) {
            rx = {
              id: H.uid('RX'), visitId: visit.id, patientId: p.id, patient: p.name, dept: p.dept,
              doctor: H.session.name, time: now, status: '待收费', total: priced.total,
              diagnosis: diagText, items: visit.items
            };
            H.store.insert('prescriptions', rx);
          }

          var labs = [];
          (payload.labs || []).forEach(function (code) {
            var lo = H.store.insert('labOrders', {
              id: H.uid('LB'), patientId: p.id, patient: p.name, dept: p.dept, doctor: H.session.name,
              items: [code], specimen: '全血', time: now, status: '待采样', results: [], tech: '', reviewer: '', visitId: visit.id
            });
            labs.push(lo);
          });

          var exams = [];
          (payload.exams || []).forEach(function (e) {
            var ex = H.store.insert('exams', {
              id: H.uid('EX'), patientId: p.id, patient: p.name,
              modality: /CT/.test(e.item) ? 'CT' : /MRI/.test(e.item) ? 'MR' : /超声|彩超/.test(e.item) ? 'US' : 'DR',
              item: e.item, part: e.part || '—', time: now, status: '待检查',
              report: '', conclusion: '', doctor: '', reviewer: '', visitId: visit.id
            });
            exams.push(ex);
          });

          H.store.update('patients', p.id, { status: '已完成', diagnosis: diagText });
          H.audit('提交门诊病历与处方', visit.id, diagText + '；明细 ' + priced.lines.length + ' 项，合计 ' + priced.total + '；检验 ' + labs.length + '、检查 ' + exams.length);
          return { visit: visit, prescription: rx, labs: labs, exams: exams };
        });
        return done(out);
      } catch (e) { return fail(e.status || 500, e.message); }
    },

    /* ---- 5.3 作废处方（确认后不可修改，只能作废重开） ---- */
    voidPrescription: function (rxId, reason) {
      try {
        H.auth.assert('voidRx');
        var rx = H.store.get('prescriptions', rxId);
        if (!rx) return fail(404, '处方不存在');
        if (rx.status !== '待收费') return fail(409, '该处方已进入后续环节，无法作废：' + rx.status);
        var out = H.tx(function () {
          H.store.update('prescriptions', rx.id, { status: '已作废', voidReason: reason || '', voidBy: H.session.name, voidAt: H.now() });
          H.audit('作废处方', rx.id, reason || '未填写原因');
          return rx;
        });
        return done(out);
      } catch (e) { return fail(e.status || 500, e.message); }
    },

    /* ---- 5.4 历史就诊与检验结果比较 ---- */
    history: function (patientId) {
      var visits = H.store.where('visits', function (v) { return v.patientId === patientId; });
      var rxs = H.store.where('prescriptions', function (r) { return r.patientId === patientId; });
      var labs = H.store.where('labOrders', function (l) { return l.patientId === patientId; });
      var exams = H.store.where('exams', function (e) { return e.patientId === patientId; });
      return { visits: visits, prescriptions: rxs, labs: labs, exams: exams };
    },

    trend: function (patientId, code) {
      var pts = [];
      H.store.where('visits', function (v) { return v.patientId === patientId; }).forEach(function (v) {
        (v.labs || []).forEach(function (l) { if (l.code === code) pts.push({ date: v.date, v: l.v }); });
      });
      H.store.where('labOrders', function (l) { return l.patientId === patientId; }).forEach(function (o) {
        (o.results || []).forEach(function (r) { if (r.code === code) pts.push({ date: (o.time || '').slice(0, 10), v: r.v }); });
      });
      pts.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      return pts;
    },

    /* ---- 5.5 医嘱模板（科室/医生常用项目字典） ---- */
    templates: function (dept) {
      return H.store.all('templates').filter(function (t) { return !dept || t.dept === dept || !t.dept; });
    },
    saveTemplate: function (name, items, note) {
      try {
        H.auth.assert('manageTemplate');
        if (!name || !items || !items.length) return fail(400, '模板名称与明细不能为空');
        var t = H.store.insert('templates', {
          id: H.uid('TPL'), name: name, owner: H.session.name, dept: H.session.dept || '',
          items: items.map(function (i) { return { code: i.code, qty: i.qty, usage: i.usage || '' }; }), note: note || ''
        });
        H.audit('保存医嘱模板', t.id, name + '（' + items.length + ' 项）');
        return done(t);
      } catch (e) { return fail(e.status || 500, e.message); }
    },
    removeTemplate: function (id) {
      try {
        H.auth.assert('manageTemplate');
        var t = H.store.get('templates', id);
        if (!t) return fail(404, '模板不存在');
        if (t.owner !== H.session.name) return fail(403, '只能删除本人创建的模板');
        H.store.remove('templates', id);
        H.audit('删除医嘱模板', id, t.name);
        return done(t);
      } catch (e) { return fail(e.status || 500, e.message); }
    },

    /* ---- 5.6 工作台统计 ---- */
    stats: function () {
      var today = H.today();
      return {
        waiting: H.store.where('patients', function (p) { return p.status === '待诊'; }).length,
        done: H.store.where('patients', function (p) { return p.status === '已完成'; }).length,
        visitsToday: H.store.where('visits', function (v) { return v.date === today; }).length,
        rxPending: H.store.where('prescriptions', function (r) { return r.status === '待收费'; }).length,
        labsPending: H.store.where('labOrders', function (l) { return l.status === '待采样' || l.status === '检验中'; }).length,
        examsPending: H.store.where('exams', function (e) { return e.status === '待检查'; }).length
      };
    },

    /* ---- 5.7 费用与传送状态（第三章条款 8、11） ---- */
    transmissions: function (visitId) {
      return {
        prescription: H.store.where('prescriptions', function (r) { return r.visitId === visitId; })[0] || null,
        labs: H.store.where('labOrders', function (l) { return l.visitId === visitId; }),
        exams: H.store.where('exams', function (e) { return e.visitId === visitId; })
      };
    }
  };

  /* 兼容：按字典取项目 */
  H.entry = function (kind, code) { return KIND[kind] ? KIND[kind](code) : null; };
})(window.HIS);
