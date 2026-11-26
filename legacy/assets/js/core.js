/* ==========================================================================
   HIS · 前端内核 (core.js)
   数据存储 / 工具 / 组件库 / 路由 / 操作留痕
   ========================================================================== */
window.HIS = window.HIS || {};
(function (H) {
  'use strict';

  /* ======================================================================
     1. 基础工具
     ====================================================================== */
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  H.esc = esc;

  H.pad = function (n) { return (n < 10 ? '0' : '') + n; };
  H.now = function (d) {
    d = d || new Date();
    return d.getFullYear() + '-' + H.pad(d.getMonth() + 1) + '-' + H.pad(d.getDate()) + ' ' + H.pad(d.getHours()) + ':' + H.pad(d.getMinutes());
  };
  H.today = function (d) {
    d = d || new Date();
    return d.getFullYear() + '-' + H.pad(d.getMonth() + 1) + '-' + H.pad(d.getDate());
  };
  H.uid = function (prefix) {
    var t = Date.now().toString(36).toUpperCase().slice(-6);
    var r = Math.random().toString(36).toUpperCase().slice(2, 5);
    return (prefix || 'ID') + t + r;
  };
  H.money = function (n) { return '¥' + (Number(n) || 0).toFixed(2); };
  H.num = function (n, d) { return (Number(n) || 0).toFixed(d == null ? 0 : d); };
  H.days = function (a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); };
  H.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  H.byId = function (id) { return document.getElementById(id); };

  H.el = function (tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') n.className = v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'dataset') Object.assign(n.dataset, v);
        else n.setAttribute(k, v);
      });
    }
    (Array.isArray(children) ? children : children ? [children] : []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  };

  /* ======================================================================
     2. 数据存储（localStorage 持久化 + 内存回退）
     ====================================================================== */
  var LS_KEY = 'his.console.v2';

  H.store = {
    data: {},
    dirty: false,
    init: function (force) {
      var saved = null;
      if (!force) {
        try { saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { saved = null; }
      }
      this.data = saved || H.clone(H.seed);
      if (!this.data.audit) this.data.audit = [];
      if (!this.data.counters) this.data.counters = {};
      this.save();
      return this;
    },
    all: function (coll) { return this.data[coll] || []; },
    get: function (coll, id) {
      var list = this.all(coll);
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    where: function (coll, fn) { return this.all(coll).filter(fn); },
    insert: function (coll, obj) {
      if (!this.data[coll]) this.data[coll] = [];
      if (!obj.id) obj.id = H.uid(coll.slice(0, 2).toUpperCase());
      this.data[coll].unshift(obj);
      this.save();
      return obj;
    },
    update: function (coll, id, patch) {
      var row = this.get(coll, id);
      if (!row) return null;
      Object.assign(row, patch);
      this.save();
      return row;
    },
    remove: function (coll, id) {
      var list = this.all(coll);
      var i = list.findIndex(function (r) { return r.id === id; });
      if (i > -1) list.splice(i, 1);
      this.save();
    },
    save: function () {
      try { localStorage.setItem(LS_KEY, JSON.stringify(this.data)); } catch (e) { /* 隐私模式回退为内存 */ }
    },
    reset: function () {
      try { localStorage.removeItem(LS_KEY); } catch (e) { }
      this.init(true);
    }
  };

  /* 操作留痕：记录操作员、时间、动作（规范要求"一经确认不得更改"） */
  H.audit = function (action, target) {
    H.store.insert('audit', {
      id: H.uid('A'),
      action: action,
      target: target || '',
      user: (H.session && H.session.name) || '陈志远',
      role: (H.session && H.session.role) || '门诊医生',
      time: H.now()
    });
  };

  /* ======================================================================
     3. 图标
     ====================================================================== */
  var P = {
    stethoscope: '<path d="M4 3v6a5 5 0 0 0 10 0V3"/><path d="M9 14v2a5 5 0 0 0 10 0v-2"/><circle cx="19" cy="11" r="2.2"/>',
    bed: '<path d="M3 18V8m0 4h18m0 6v-5a3 3 0 0 0-3-3H9"/><circle cx="6.5" cy="9.5" r="1.8"/>',
    nurse: '<circle cx="12" cy="7" r="3.2"/><path d="M5 21v-1.5A5.5 5.5 0 0 1 10.5 14h3a5.5 5.5 0 0 1 5.5 5.5V21"/><path d="M12 16.5v3M10.5 18h3"/>',
    flask: '<path d="M9 3h6M10 3v5.5L4.8 18A2 2 0 0 0 6.6 21h10.8a2 2 0 0 0 1.8-3L14 8.5V3"/><path d="M7.5 14h9"/>',
    droplet: '<path d="M12 3s6 6.4 6 10.6A6 6 0 0 1 6 13.6C6 9.4 12 3 12 3z"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M4 12h16"/>',
    scissors: '<circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><path d="M20 4 8.6 15.4M8.6 8.6 20 20"/>',
    pill: '<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-45 12 12)"/><path d="M8.5 8.5l7 7"/>',
    boxes: '<path d="M3 8l4.5-3L12 8l-4.5 3z"/><path d="M3 8v7l4.5 3V10.5"/><path d="M12 8v7l-4.5 3"/><path d="M12 8l4.5-3L21 8l-4.5 3z"/><path d="M12 8v7l4.5 3V10.5"/><path d="M21 8v7l-4.5 3"/>',
    store: '<path d="M4 9h16v11H4z"/><path d="M3 9l2-5h14l2 5"/><path d="M9 20v-6h6v6"/>',
    calc: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M16 12h.01M8 16h2M12 16h2M16 16h.01"/>',
    factory: '<path d="M3 21V10l6 4V10l6 4V7l6 4v10z"/><path d="M3 21h18"/><path d="M7 17h.01M12 17h.01M17 17h.01"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3.5 3L20 7"/>',
    link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M6 16h12v5H6z"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.4"/><path d="M20 4v7h-7"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    alert: '<path d="M12 3l9 17H3z"/><path d="M12 9v5M12 17h.01"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 17h6"/>',
    send: '<path d="M21 3L3 10l7 3 3 7z"/><path d="M21 3l-8 11"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    heart: '<path d="M12 20s-7-4.6-7-9.6A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 7 3.4C19 15.4 12 20 12 20z"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    book: '<path d="M4 4h7v16H4z"/><path d="M13 4h7v16h-7z"/>',
    logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h9"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>'
  };
  H.icon = function (name, size, cls) {
    var d = P[name] || P.grid;
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="' + (size || 16) + '" height="' + (size || 16) +
      '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  };

  /* ======================================================================
     4. 提示 / 模态 / 抽屉
     ====================================================================== */
  H.toast = function (msg, type) {
    var box = H.byId('toasts');
    if (!box) { box = H.el('div', { id: 'toasts' }); document.body.appendChild(box); }
    var t = H.el('div', { class: 'toast ' + (type || '') , html: '<i class="dot"></i><div>' + esc(msg) + '</div>' });
    box.appendChild(t);
    setTimeout(function () {
      t.classList.add('out');
      setTimeout(function () { t.remove(); }, 240);
    }, 2600);
  };

  H.modal = function (opts) {
    var ov = H.el('div', { class: 'overlay' });
    var m = H.el('div', { class: 'modal', style: { width: opts.width || '720px' } });
    var hd = H.el('div', { class: 'modal-hd' }, [
      H.el('h3', { text: opts.title || '' }),
      H.el('button', { class: 'x-btn', html: H.icon('x', 16), onclick: close })
    ]);
    var bd = H.el('div', { class: 'modal-bd' });
    if (typeof opts.body === 'string') bd.innerHTML = opts.body; else if (opts.body) bd.appendChild(opts.body);
    m.appendChild(hd); m.appendChild(bd);
    var ft;
    if (opts.footer !== false) {
      ft = H.el('div', { class: 'modal-ft' });
      if (opts.footer) ft.appendChild(opts.footer); else {
        ft.appendChild(H.el('button', { class: 'btn', text: '关闭', onclick: close }));
        if (opts.onOk) ft.appendChild(H.el('button', { class: 'btn btn-primary', text: opts.okText || '确定', onclick: function () { if (opts.onOk() !== false) close(); } }));
      }
      m.appendChild(ft);
    }
    ov.appendChild(m);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov && opts.maskClose !== false) close(); });
    document.body.appendChild(ov);
    function close() { ov.remove(); document.removeEventListener('keydown', key); if (opts.onClose) opts.onClose(); }
    function key(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', key);
    return { el: m, body: bd, foot: ft, close: close };
  };

  H.confirm = function (msg, danger) {
    return new Promise(function (res) {
      var m = H.modal({
        title: '操作确认', width: '430px',
        body: '<div style="font-size:13.5px;line-height:1.8;color:var(--ink-2)">' + esc(msg) + '</div>',
        footer: H.el('div', { class: 'flex gap10', style: { marginLeft: 'auto' } }, [
          H.el('button', { class: 'btn', text: '取消', onclick: function () { m.close(); res(false); } }),
          H.el('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), text: '确定', onclick: function () { m.close(); res(true); } })
        ])
      });
    });
  };

  H.drawer = function (opts) {
    var ov = H.el('div', { class: 'overlay', style: { padding: 0, justifyContent: 'flex-end' } });
    var d = H.el('div', { class: 'drawer', style: { width: opts.width || '520px' } });
    var hd = H.el('div', { class: 'modal-hd' }, [H.el('h3', { text: opts.title || '' }), H.el('button', { class: 'x-btn', html: H.icon('x', 16), onclick: close })]);
    var bd = H.el('div', { class: 'modal-bd', style: { flex: 1 } });
    if (typeof opts.body === 'string') bd.innerHTML = opts.body; else if (opts.body) bd.appendChild(opts.body);
    d.appendChild(hd); d.appendChild(bd);
    if (opts.footer) { var f = H.el('div', { class: 'modal-ft' }); f.appendChild(opts.footer); d.appendChild(f); }
    ov.appendChild(d);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    document.body.appendChild(ov);
    function close() { ov.remove(); }
    return { el: d, body: bd, close: close };
  };

  /* ======================================================================
     5. 表单
     ====================================================================== */
  /**
   * fields: [{key,label,type:'text|number|select|date|time|textarea|checkbox|static',
   *           options:[{value,label}|'str'], value, required, span, hint, placeholder, min,max,step,readonly}]
   */
  H.fields = function (fields, values) {
    values = values || {};
    var wrap = H.el('div', { class: 'form-grid' });
    fields.forEach(function (f) {
      var v = values[f.key] !== undefined ? values[f.key] : (f.value !== undefined ? f.value : '');
      var fw = H.el('div', { class: 'field' + (f.span === 2 ? ' span2' : '') });
      if (f.type !== 'checkbox') {
        fw.appendChild(H.el('label', { html: esc(f.label || '') + (f.required ? ' <span class="req">*</span>' : '') }));
      }
      var inp;
      if (f.type === 'select') {
        inp = H.el('select', { class: 'select', name: f.key });
        if (!f.required) inp.appendChild(H.el('option', { value: '', text: f.emptyText || '— 请选择 —' }));
        (f.options || []).forEach(function (o) {
          var val = typeof o === 'object' ? o.value : o;
          var lab = typeof o === 'object' ? o.label : o;
          inp.appendChild(H.el('option', { value: val, text: lab, selected: String(val) === String(v) ? 'selected' : null }));
        });
      } else if (f.type === 'textarea') {
        inp = H.el('textarea', { class: 'textarea', name: f.key, placeholder: f.placeholder || '' });
        inp.value = v == null ? '' : v;
      } else if (f.type === 'checkbox') {
        var cb = H.el('label', { class: 'checkline', style: { padding: '6px 0' } });
        inp = H.el('input', { type: 'checkbox', name: f.key });
        inp.checked = !!v;
        cb.appendChild(inp); cb.appendChild(document.createTextNode(' ' + (f.label || '')));
        fw.appendChild(cb);
      } else if (f.type === 'static') {
        inp = H.el('div', { class: 'input', style: { display: 'flex', alignItems: 'center', opacity: .8 }, text: v });
      } else {
        inp = H.el('input', {
          class: 'input', name: f.key, type: f.type || 'text',
          placeholder: f.placeholder || '', min: f.min, max: f.max, step: f.step,
          readonly: f.readonly ? 'readonly' : null
        });
        inp.value = v == null ? '' : v;
      }
      if (inp && inp.tagName !== 'LABEL') fw.appendChild(inp);
      if (f.hint) fw.appendChild(H.el('div', { class: 'hint', text: f.hint }));
      if (f.after) fw.appendChild(f.after);
      wrap.appendChild(fw);
    });
    wrap.readValues = function () {
      var out = {};
      fields.forEach(function (f) {
        var node = wrap.querySelector('[name="' + f.key + '"]');
        if (!node) return;
        if (f.type === 'checkbox') out[f.key] = node.checked;
        else if (f.type === 'number') out[f.key] = node.value === '' ? '' : Number(node.value);
        else out[f.key] = node.value;
      });
      return out;
    };
    wrap.validate = function () {
      var ok = true;
      fields.forEach(function (f) {
        if (!f.required) return;
        var node = wrap.querySelector('[name="' + f.key + '"]');
        if (node && !String(node.value || '').trim()) {
          ok = false;
          node.style.borderColor = 'rgba(255,107,129,.6)';
          node.addEventListener('input', function h() { node.style.borderColor = ''; node.removeEventListener('input', h); });
        }
      });
      if (!ok) H.toast('请填写必填项', 'warn');
      return ok;
    };
    return wrap;
  };

  H.formModal = function (opts) {
    return new Promise(function (res) {
      var f = H.fields(opts.fields, opts.values);
      var m = H.modal({
        title: opts.title || '编辑', width: opts.width || '660px',
        body: f,
        footer: H.el('div', { class: 'flex gap10', style: { marginLeft: 'auto' } }, [
          H.el('button', { class: 'btn', text: '取消', onclick: function () { m.close(); res(null); } }),
          H.el('button', { class: 'btn btn-primary', text: opts.okText || '保存', onclick: function () { if (!f.validate()) return; m.close(); res(f.readValues()); } })
        ])
      });
    });
  };

  /* ======================================================================
     6. 组件
     ====================================================================== */
  H.tag = function (text, tone) { return '<span class="tag tag-' + (tone || 'mute') + '">' + esc(text) + '</span>'; };

  var STATUS_TONE = {
    '待诊': 'info', '就诊中': 'brand', '已完成': 'ok', '住院': 'violet',
    '待收费': 'warn', '待发药': 'warn', '已发药': 'ok', '已退药': 'mute',
    '开立': 'info', '已审核': 'brand', '已执行': 'ok', '已作废': 'mute', '已停止': 'mute',
    '待采样': 'warn', '检验中': 'info', '待审核': 'warn', '已发布': 'ok', '已检查': 'info',
    '在库': 'ok', '已配血': 'brand', '已发出': 'mute', '报废': 'danger',
    '申请': 'info', '待审批': 'warn', '已排台': 'brand', '已完成': 'ok',
    '占用': 'brand', '空床': 'mute', '已收费': 'ok', '异常': 'danger', '正常': 'ok'
  };
  H.status = function (s) { return '<span class="tag tag-' + (STATUS_TONE[s] || 'mute') + '">' + esc(s) + '</span>'; };

  H.table = function (opts) {
    var wrap = H.el('div', { class: 'table-wrap' });
    if (opts.maxHeight) wrap.style.maxHeight = opts.maxHeight;
    var t = H.el('table', { class: 'tbl', style: opts.minWidth ? { minWidth: opts.minWidth } : null });
    var thead = H.el('thead'), tr = H.el('tr');
    (opts.columns || []).forEach(function (c) {
      tr.appendChild(H.el('th', { text: c.label, style: { width: c.width || 'auto', textAlign: c.align || 'left' } }));
    });
    thead.appendChild(tr); t.appendChild(thead);
    var tb = H.el('tbody');
    var rows = opts.rows || [];
    if (!rows.length) {
      var td = H.el('td', { colspan: (opts.columns || []).length });
      td.appendChild(H.el('div', { class: 'tbl-empty', text: opts.empty || '暂无数据' }));
      var etr = H.el('tr'); etr.appendChild(td); tb.appendChild(etr);
    } else {
      rows.forEach(function (row) {
        var rtr = H.el('tr', { style: opts.onRow ? { cursor: 'pointer' } : null });
        if (opts.activeId && row.id === opts.activeId) rtr.classList.add('is-active');
        (opts.columns || []).forEach(function (c) {
          var td = H.el('td', { style: { textAlign: c.align || 'left' } });
          var val = c.render ? c.render(row) : esc(row[c.key] == null ? '' : row[c.key]);
          if (c.render && typeof val === 'string') td.innerHTML = val;
          else if (val && val.nodeType) td.appendChild(val);
          else td.textContent = val == null ? '' : val;
          rtr.appendChild(td);
        });
        if (opts.onRow) rtr.addEventListener('click', function (e) {
          if (e.target.closest('.ops') || e.target.closest('button')) return;
          opts.onRow(row);
        });
        tb.appendChild(rtr);
      });
    }
    t.appendChild(tb); wrap.appendChild(t);
    return wrap;
  };

  H.kpi = function (o) {
    return '<div class="kpi">' +
      '<div class="k-label">' + esc(o.label) + '</div>' +
      '<div class="k-val">' + (o.value == null ? '—' : o.value) + (o.unit ? '<small>' + esc(o.unit) + '</small>' : '') + '</div>' +
      '<div class="k-foot">' + (o.foot || '') + '</div>' +
      (o.spark ? '<svg class="k-spark" viewBox="0 0 96 44" preserveAspectRatio="none">' + sparkPath(o.spark) + '</svg>' : '') +
      '</div>';
  };
  function sparkPath(arr) {
    var max = Math.max.apply(null, arr), min = Math.min.apply(null, arr), r = (max - min) || 1;
    var pts = arr.map(function (v, i) {
      var x = (i / (arr.length - 1)) * 96, y = 40 - ((v - min) / r) * 32;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<polyline points="' + pts + '" fill="none" stroke="#0f8f86" stroke-width="1.6" opacity=".8"/>' +
      '<polyline points="' + pts + ' 96,44 0,44" fill="rgba(15,143,134,.10)" stroke="none"/>';
  }

  H.tabs = function (items, activeId, onChange) {
    var box = H.el('div', { class: 'tabs' });
    items.forEach(function (it) {
      var b = H.el('button', { class: 'tab' + (it.id === activeId ? ' on' : '') });
      b.innerHTML = esc(it.label) + (it.count != null ? '<span class="cnt">' + it.count + '</span>' : '');
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(box.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
        onChange(it.id);
      });
      box.appendChild(b);
    });
    return box;
  };

  H.empty = function (text, sub) {
    return '<div class="empty">' + H.icon('file', 36) + '<b>' + esc(text || '暂无数据') + '</b>' + (sub ? '<span class="small">' + esc(sub) + '</span>' : '') + '</div>';
  };

  H.pageHeader = function (o) {
    var hd = H.el('div', { class: 'page-hd' });
    var l = H.el('div', { class: 'ph-l' });
    l.innerHTML = '<h1>' + esc(o.title) + (o.ver ? '<span class="ver">' + esc(o.ver) + '</span>' : '') + '</h1>' +
      (o.desc ? '<div class="ph-desc">' + o.desc + '</div>' : '');
    hd.appendChild(l);
    if (o.actions) {
      var r = H.el('div', { class: 'ph-r' });
      (Array.isArray(o.actions) ? o.actions : [o.actions]).forEach(function (a) { if (a) r.appendChild(a); });
      hd.appendChild(r);
    }
    return hd;
  };

  H.btn = function (text, opts) {
    opts = opts || {};
    var b = H.el('button', { class: 'btn ' + (opts.cls || ''), html: (opts.icon ? H.icon(opts.icon, 15) : '') + (text ? '<span>' + esc(text) + '</span>' : '') });
    if (opts.onclick) b.addEventListener('click', opts.onclick);
    if (opts.id) b.id = opts.id;
    return b;
  };

  H.card = function (title, bodyEl, opts) {
    opts = opts || {};
    var c = H.el('div', { class: 'card ' + (opts.cls || '') });
    if (title) {
      var hd = H.el('div', { class: 'card-hd' });
      hd.appendChild(H.el('h3', { html: title }));
      if (opts.extra) { var e = H.el('div', { class: 'flex gap8' }); if (typeof opts.extra === 'string') e.innerHTML = opts.extra; else e.appendChild(opts.extra); hd.appendChild(e); }
      c.appendChild(hd);
    }
    var bd = H.el('div', { class: 'card-bd' + (opts.flush ? ' flush' : '') });
    if (typeof bodyEl === 'string') bd.innerHTML = bodyEl; else if (bodyEl) bd.appendChild(bodyEl);
    c.appendChild(bd);
    return c;
  };

  H.searchInput = function (placeholder, onInput) {
    var w = H.el('div', { class: 'search' });
    w.innerHTML = H.icon('search', 15);
    var i = H.el('input', { class: 'input', placeholder: placeholder || '搜索…' });
    i.addEventListener('input', function () { onInput(i.value.trim()); });
    w.appendChild(i);
    w.input = i;
    return w;
  };

  /* ======================================================================
     7. 路由与导航
     ====================================================================== */
  H.pages = {};
  H.navGroups = [];
  H.route = function (id, def) { H.pages[id] = def; };
  H.addNav = function (group, items) {
    var g = H.navGroups.filter(function (x) { return x.group === group; })[0];
    if (!g) { g = { group: group, items: [] }; H.navGroups.push(g); }
    items.forEach(function (it) { g.items.push(it); });
  };
  H.go = function (id) { location.hash = '#/' + id; };
  H.current = function () {
    var h = (location.hash || '').replace(/^#\/?/, '');
    return H.pages[h] ? h : (H.defaultRoute || 'dashboard');
  };
  /* 403 视图：路由级权限拦截 */
  H.forbidden = function (inner, id) {
    var s = (H.auth && H.auth.session) || { name: '未登录', role: '' };
    var roles = H.auth ? H.auth.routeRoles(id) : [];
    var need = roles.map(function (r) { return (H.ROLES[r] || {}).name || r; }).join('、');
    inner.innerHTML = '<div class="card card-pad" style="max-width:620px;margin:70px auto;text-align:center">' +
      '<div style="font-family:var(--mono);font-size:44px;font-weight:700;color:var(--danger);letter-spacing:.06em">403</div>' +
      '<h3 style="margin:10px 0 8px;font-size:17px">无权访问该功能</h3>' +
      '<p class="muted small" style="line-height:1.9">当前账号 <b class="ink2">' + H.esc(s.name) + '</b>（' + H.esc((H.ROLES[s.role] || {}).name || s.role) + '）没有此模块权限。<br>' +
      '该模块允许的角色：' + H.esc(need) + '</p>' +
      '<div class="flex gap8" style="justify-content:center;margin-top:18px"><a class="btn btn-sm" href="#/dashboard">返回总览</a></div></div>';
    if (H.audit) H.audit('越权拦截', id, '路由 ' + id + ' 需要 ' + need);
  };

  H.renderRoute = function () {    var view = H.byId('view');
    if (!view) return;
    var id = H.current();
    var def = H.pages[id];
    if (!def) return;
    view.scrollTop = 0;
    view.innerHTML = '';
    var inner = H.el('div', { class: 'view-inner' });
    view.appendChild(inner);
    // RBAC 路由守卫：无权限直接渲染 403，不执行业务渲染
    if (H.auth && H.auth.session && !H.auth.canRoute(id)) {
      H.forbidden(inner, id);
      return;
    }
    try { def.render(inner, def); } catch (err) {
      inner.innerHTML = '<div class="alert alert-danger">页面渲染异常：' + esc(err.message) + '</div>';
      console.error(err);
    }
    // 侧栏高亮 + 面包屑
    Array.prototype.forEach.call(document.querySelectorAll('.nav-item'), function (n) {
      n.classList.toggle('on', n.dataset.route === id);
    });
    var crumb = H.byId('crumb');
    if (crumb) crumb.innerHTML = '<span>' + esc(def.group || '工作台') + '</span><span class="sep">/</span><b>' + esc(def.title) + '</b>';
    document.title = def.title + ' · 医院信息系统';
  };

  H.startConsole = function () {
    H.store.init();
    var nav = H.byId('nav');
    H.navGroups.forEach(function (g) {
      var gd = H.el('div', { class: 'nav-group' });
      gd.innerHTML = '<div class="gh"><span>' + esc(g.group) + '</span><span class="line"></span></div>';
      g.items.forEach(function (it) {
        if (H.auth && H.auth.session && !H.auth.canRoute(it.id)) return;
        var a = H.el('a', {
          class: 'nav-item', href: '#/' + it.id, dataset: { route: it.id },
          html: H.icon(it.icon || 'grid', 15) + '<span>' + esc(it.title) + '</span>' +
            (it.count ? '<span class="cnt" data-count="' + it.id + '">' + it.count + '</span>' : '') +
            (it.wip ? '<span class="tag-mini">框架</span>' : '')
        });
        gd.appendChild(a);
      });
      if (gd.querySelectorAll('.nav-item').length) nav.appendChild(gd);
    });
    H.refreshCounters();
    window.addEventListener('hashchange', H.renderRoute);
    if (!location.hash) location.hash = '#/' + (H.defaultRoute || 'dashboard');
    H.renderRoute();
    var clock = H.byId('clock');
    if (clock) {
      var tick = function () {
        var d = new Date();
        clock.textContent = H.today(d) + ' ' + H.pad(d.getHours()) + ':' + H.pad(d.getMinutes()) + ':' + H.pad(d.getSeconds());
      };
      tick(); setInterval(tick, 1000);
    }
  };

  H.refreshCounters = function () {
    document.querySelectorAll('[data-count]').forEach(function (n) {
      var c = H.counter(n.dataset.count);
      if (c == null) { n.style.display = 'none'; return; }
      n.style.display = c > 0 ? '' : 'none';
      n.textContent = c;
    });
  };

  /* 侧栏待办计数 */
  H.counter = function (route) {
    var s = H.store;
    if (route === 'clinic/op') return s.where('patients', function (p) { return p.status === '待诊'; }).length;
    if (route === 'dashboard') return s.where('labOrders', function (o) { return o.status === '待采样' || o.status === '检验中'; }).length;
    return null;
  };

  /* ======================================================================
     8. 业务公用
     ====================================================================== */
  H.drug = function (code) { return H.dict.drugs.filter(function (d) { return d.code === code; })[0] || null; };
  H.patient = function (id) { return H.store.get('patients', id); };
  H.icdOptions = function () {
    return H.dict.icd.map(function (i) { return { value: i.code, label: i.code + ' ' + i.name }; });
  };
  H.drugOptions = function () {
    return H.dict.drugs.map(function (d) { return { value: d.code, label: d.name + '  ' + d.spec }; });
  };
  H.ageGroup = function (age) { return age < 14 ? '儿童' : age >= 65 ? '老年' : '成人'; };

  /* 合理用药审查引擎：过敏 / 相互作用 / 剂量 / 重复 / 禁忌 */
  H.rxCheck = function (patient, items) {
    var issues = [];
    var seenGeneric = {};
    var codes = items.map(function (i) { return i.code; }).filter(Boolean);
    items.forEach(function (it) {
      var d = H.drug(it.code);
      if (!d) return;
      if (patient && patient.allergy && d.allergen && patient.allergy === d.allergen) {
        issues.push({ level: 'danger', title: '药物过敏', text: '患者过敏史【' + patient.allergy + '】，' + d.name + ' 属同类药物，禁用。' });
      }
      if (d.contra && patient && patient.diagnosis && d.contra.indexOf(patient.diagnosis) > -1) {
        issues.push({ level: 'danger', title: '禁忌症', text: d.name + ' 说明书禁忌：' + d.contra + '（患者诊断：' + patient.diagnosis + '）' });
      }
      if (patient && patient.age && patient.age < 18 && d.code === 'Y0004') {
        issues.push({ level: 'danger', title: '年龄禁忌', text: '左氧氟沙星 18 岁以下禁用，患者 ' + patient.age + ' 岁。' });
      }
      if (seenGeneric[d.generic]) {
        issues.push({ level: 'warn', title: '重复用药', text: '存在成分相同的药物：' + d.name + ' 与 ' + seenGeneric[d.generic] + '（通用名 ' + d.generic + '）' });
      } else seenGeneric[d.generic] = d.name;
      // 剂量粗判：qty×单价无关，按单次剂量与日频次估算
      if (d.maxDose && it.dosePer && it.freqPerDay) {
        var total = it.dosePer * it.freqPerDay;
        if (total > d.maxDose * 1.0001) {
          issues.push({ level: 'warn', title: '剂量超量', text: d.name + ' 日剂量 ' + total + (d.doseUnit || '') + '，超过上限 ' + d.maxDose + (d.doseUnit || '') + '。' });
        }
      }
    });
    // 两两相互作用
    for (var i = 0; i < items.length; i++) {
      for (var j = i + 1; j < items.length; j++) {
        var a = H.drug(items[i].code), b = H.drug(items[j].code);
        if (!a || !b) continue;
        H.dict.interactions.forEach(function (r) {
          var hit = (a.generic === r.a && b.generic === r.b) || (a.generic === r.b && b.generic === r.a);
          if (hit) issues.push({ level: r.level === '禁忌' ? 'danger' : r.level === '严重' ? 'danger' : 'warn', title: '相互作用 · ' + r.level, text: a.name + ' × ' + b.name + '：' + r.note });
        });
      }
    }
    return issues;
  };

  H.alertHTML = function (level, title, text) {
    var cls = level === 'danger' ? 'alert-danger' : level === 'warn' ? 'alert-warn' : 'alert-ok';
    return '<div class="alert ' + cls + '" style="margin-bottom:8px">' + H.icon('alert', 16, 'ai') +
      '<div><b>' + esc(title) + '</b> ' + esc(text) + '</div></div>';
  };

  /* 简单打印：把 HTML 放到新窗口 */
  H.print = function (title, html) {
    var w = window.open('', '_blank', 'width=820,height=900');
    if (!w) { H.toast('浏览器拦截了打印窗口，请允许弹窗', 'warn'); return; }
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>body{font-family:"Microsoft YaHei",sans-serif;color:#111;padding:28px;font-size:13px;line-height:1.8}' +
      'h2{text-align:center;font-size:18px;letter-spacing:.2em;margin:0 0 4px}.sub{text-align:center;color:#666;font-size:11px;margin-bottom:16px}' +
      'table{width:100%;border-collapse:collapse;font-size:12px}td,th{border:1px solid #bbb;padding:6px 8px;text-align:left}' +
      'th{background:#f2f2f2}.sign{margin-top:36px;display:flex;justify-content:flex-end;gap:60px}' +
      '@media print{body{padding:0}}</style></head><body>' + html + '</body></html>');
    w.document.close();
    setTimeout(function () { w.focus(); w.print(); }, 320);
  };

  H.debounce = function (fn, wait) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, wait || 200);
    };
  };
})(window.HIS);
