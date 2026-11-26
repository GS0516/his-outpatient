/* ==========================================================================
   HIS · 第三章 门诊医生工作站分系统
   功能覆盖：门诊记录 / 诊断 / 处方 / 治疗处置 / 卫生材料 / 检查 / 检验 /
             手术与收入院申请 / 合理用药审查 / 医嘱模板 / 历次就诊比较 / 打印
   ========================================================================== */
(function () {
  'use strict';
  var H = window.HIS, S = H.store;

  var drafts = {};   // patientId -> 草稿
  var FREQ = [
    { v: 'qd', label: '每日一次', n: 1 }, { v: 'bid', label: '每日两次', n: 2 },
    { v: 'tid', label: '每日三次', n: 3 }, { v: 'q8h', label: '每8小时', n: 3 },
    { v: 'q12h', label: '每12小时', n: 2 }, { v: 'st', label: '立即一次', n: 1 },
    { v: 'prn', label: '必要时', n: 1 }
  ];
  function freqN(v) { var f = FREQ.filter(function (x) { return x.v === v; })[0]; return f ? f.n : 1; }
  function icd(code) { return H.dict.icd.filter(function (x) { return x.code === code; })[0] || { code: code, name: code }; }
  function initials(n) { return (n || '?').slice(0, 1); }

  function draft(pid) {
    if (!drafts[pid]) drafts[pid] = {
      complaint: '', present: '', past: '', exam: '', note: '',
      diags: [], items: [], treatments: [], materials: [], labs: [], exams: [],
      locked: false, visitId: null, rxId: null
    };
    return drafts[pid];
  }

  function patientCard(p) {
    var el = H.el('div', { class: 'card card-pad pt-card' });
    el.innerHTML =
      '<div class="pt-top">' +
      '<div class="pt-av">' + initials(p.name) + '</div>' +
      '<div style="min-width:0"><div class="pt-name">' + H.esc(p.name) +
      '<span class="tag tag-mute no-dot">' + H.esc(p.sex) + ' · ' + p.age + ' 岁</span>' +
      (p.allergy ? '<span class="tag tag-danger no-dot">过敏：' + H.esc(p.allergy) + '</span>' : '') +
      '<span class="tag ' + (p.status === '待诊' ? 'tag-warn' : 'tag-ok') + ' no-dot">' + H.esc(p.status) + '</span></div>' +
      '<div class="pt-sub">' + H.esc(p.card) + ' · 病案号 ' + H.esc(p.mrn) + ' · ' + H.esc(p.ins) + ' · 身份证 ' + H.esc(p.idMasked) + '</div></div>' +
      '</div>' +
      '<div class="pt-info">' +
      '<div><div class="k">就诊科室</div><div class="v">' + H.esc(p.dept || '—') + '</div></div>' +
      '<div><div class="k">接诊医生</div><div class="v">' + H.esc(p.doctor || '—') + '</div></div>' +
      '<div><div class="k">体温 / 脉搏</div><div class="v">' + (p.temp || '—') + ' ℃ / ' + (p.pulse || '—') + ' 次</div></div>' +
      '<div><div class="k">血压</div><div class="v">' + (p.bp || '—') + ' mmHg</div></div>' +
      '</div>' +
      '<div style="margin-top:10px;font-size:12.5px;color:var(--ink-2);line-height:1.75"><span class="muted">主诉：</span>' + H.esc(p.complaint || '—') + '</div>';
    return el;
  }

  /* 选药弹层：字典检索 */
  function pickDrug(cb) {
    var m = H.modal({ title: '选择药品（药品字典）', width: '660px', footer: false });
    var search = H.searchInput('输入药品名 / 别名 / 编码…', function (q) { paint(q); });
    var listBox = H.el('div', { style: { maxHeight: '400px', overflow: 'auto', marginTop: '10px' } });
    m.body.appendChild(search); m.body.appendChild(listBox);
    function paint(q) {
      q = (q || '').toLowerCase();
      var rows = H.dict.drugs.filter(function (d) {
        return !q || d.name.toLowerCase().indexOf(q) > -1 || (d.alias || '').toLowerCase().indexOf(q) > -1 || d.code.toLowerCase().indexOf(q) > -1;
      });
      listBox.innerHTML = '';
      if (!rows.length) listBox.innerHTML = '<div class="empty small">无匹配药品</div>';
      rows.forEach(function (d) {
        var it = H.el('div', { class: 'pick-item' });
        it.innerHTML = '<div style="flex:1;min-width:0"><div class="pi-n">' + H.esc(d.name) +
          ' <span class="tag tag-mute no-dot tiny">' + H.esc(d.form) + '</span>' +
          (d.ins === '甲' ? ' <span class="tag tag-ok no-dot tiny">甲类</span>' : '') + '</div>' +
          '<div class="pi-s">' + H.esc(d.spec) + ' · ' + H.esc(d.mfr) + ' · ' + H.money(d.price) + ' · 库存 ' + d.stock + '</div></div>';
        it.addEventListener('click', function () { m.close(); cb(d); });
        listBox.appendChild(it);
      });
    }
    paint('');
  }

  /* 通用字典选择（处置 / 卫生材料） */
  function pickEntry(kind, list, cb) {
    var m = H.modal({ title: '选择' + (kind === 'treat' ? '治疗处置项目' : '卫生材料'), width: '560px', footer: false });
    var box = H.el('div', { style: { maxHeight: '360px', overflow: 'auto' } });
    list.forEach(function (d) {
      var it = H.el('div', { class: 'pick-item' });
      it.innerHTML = '<div style="flex:1"><div class="pi-n">' + H.esc(d.name) + '</div><div class="pi-s">' + H.esc(d.spec || d.unit) + ' · ' + H.money(d.price) + ' · 医保' + H.esc(d.ins) + '</div></div>';
      it.addEventListener('click', function () { m.close(); cb(d); });
      box.appendChild(it);
    });
    m.body.appendChild(box);
  }

  H.route('clinic/op', {
    title: '门诊医生工作站', group: '门诊业务',
    render: function (root) {
      var sel = (S.where('patients', function (p) { return p.status === '待诊'; })[0] || {}).id || (S.all('patients')[0] || {}).id || null;
      var tab = 'emr';
      var readonly = !H.auth.can('prescribe');

      function draw() {
        root.innerHTML = '';
        var p = sel ? S.get('patients', sel) : null;
        var d = p ? draft(p.id) : null;
        if (d && !d._init) {
          d.complaint = p.complaint || '';
          d.present = p.present || '';
          d.past = p.past || '';
          d.exam = p.exam || '';
          d._init = true;
        }

        root.appendChild(H.pageHeader({
          title: '门诊医生工作站', ver: '第三章',
          desc: '处理门诊记录、诊断、处方、治疗处置、卫生材料、检查、检验、手术与收入院申请；' +
            '处方自动监测并提示合理用药，医嘱确认后不可更改，仅可作废重开。',
          actions: [
            H.btn('门诊病历', { icon: 'file', onclick: function () { if (p) printRecord(p, d); } }),
            H.btn('刷新队列', { icon: 'refresh', onclick: draw })
          ]
        }));

        if (readonly) {
          var ro = H.el('div', { class: 'alert alert-info block' });
          ro.innerHTML = H.icon('shield', 16, 'ai') + '<div>当前账号为管理员，仅可查阅门诊病历与处方，<b>不能开方</b>（开方返回 403）。</div>';
          root.appendChild(ro);
        }

        var split = H.el('div', { class: 'split-fix' });

        /* -------- 左：候诊队列 -------- */
        var left = H.el('div', { class: 'card' });
        left.innerHTML = '<div class="card-hd"><h3>候诊队列</h3><span class="tag tag-brand no-dot">' +
          S.where('patients', function (x) { return x.status === '待诊'; }).length + ' 待诊</span></div>';
        var tabsBox = H.el('div', { style: { padding: '8px 12px 4px' } });
        tabsBox.appendChild(H.tabs([
          { id: 'wait', label: '待诊', count: S.where('patients', function (x) { return x.status === '待诊'; }).length },
          { id: 'done', label: '已完成', count: S.where('patients', function (x) { return x.status === '已完成'; }).length }
        ], p && p.status === '已完成' ? 'done' : 'wait', function (id) {
          var list = S.where('patients', function (x) { return id === 'wait' ? x.status === '待诊' : x.status === '已完成'; });
          if (list.length) { sel = list[0].id; tab = 'emr'; }
          draw();
        }));
        left.appendChild(tabsBox);

        var listWrap = H.el('div', { class: 'list', style: { padding: '4px 8px 12px', maxHeight: '62vh', overflow: 'auto' } });
        var rows = S.where('patients', function (x) {
          return p && p.status === '已完成' ? x.status === '已完成' : x.status === '待诊';
        });
        if (!rows.length) listWrap.innerHTML = '<div class="empty small">该队列暂无患者</div>';
        rows.forEach(function (x) {
          var a = H.el('div', { class: 'list-item' + (sel === x.id ? ' on' : '') });
          a.innerHTML = '<span class="av">' + initials(x.name) + '</span>' +
            '<span class="li-main"><span class="li-t">' + H.esc(x.name) + ' <span class="muted tiny">' + x.sex + ' ' + x.age + '岁</span></span>' +
            '<span class="li-s">' + H.esc(x.complaint || '').slice(0, 16) + '…</span></span>' +
            (x.allergy ? '<span class="tag tag-danger no-dot tiny">过敏</span>' : '<span class="tag tag-mute no-dot tiny">' + H.esc(x.dept) + '</span>');
          a.addEventListener('click', function () { sel = x.id; tab = 'emr'; draw(); });
          listWrap.appendChild(a);
        });
        left.appendChild(listWrap);
        split.appendChild(left);

        /* -------- 右：工作区 -------- */
        var right = H.el('div', { class: 'stack' });
        if (!p) {
          right.appendChild(H.card('', H.el('div', { html: H.empty('请选择患者', '从左侧候诊队列选择后开始接诊') })));
          split.appendChild(right); root.appendChild(split); return;
        }

        right.appendChild(patientCard(p));

        /* 锁定态：只读摘要 */
        if (d.locked || (p.status === '已完成' && !d.visitId)) {
          right.appendChild(lockedCard(p, d));
          split.appendChild(right); root.appendChild(split); return;
        }

        /* 工作标签页 */
        var work = H.el('div', { class: 'card' });
        var tabBar = H.el('div', { style: { padding: '6px 12px 0' } });
        tabBar.appendChild(H.tabs([
          { id: 'emr', label: '门诊病历', count: d.diags.length },
          { id: 'rx', label: '处方', count: d.items.length },
          { id: 'treat', label: '处置 / 材料', count: d.treatments.length + d.materials.length },
          { id: 'apply', label: '检查检验', count: d.labs.length + d.exams.length },
          { id: 'history', label: '历次就诊' }
        ], tab, function (id) { tab = id; draw(); }));
        work.appendChild(tabBar);
        var body = H.el('div', { class: 'card-bd' });
        work.appendChild(body);
        right.appendChild(work);

        if (tab === 'emr') body.appendChild(emrTab(p, d));
        else if (tab === 'rx') body.appendChild(rxTab(p, d));
        else if (tab === 'treat') body.appendChild(treatTab(p, d));
        else if (tab === 'apply') body.appendChild(applyTab(p, d));
        else body.appendChild(historyTab(p, d));

        /* 底部：金额 + 动作 */
        var priced = H.api.price(entriesOf(d));
        var bar = H.el('div', { class: 'card card-pad flex-b', style: { gap: '12px', flexWrap: 'wrap' } });
        bar.innerHTML = '<div><div class="tiny muted">本次费用（服务端按字典单价核算）</div>' +
          '<div class="mono" style="font-size:22px;font-weight:650">' + H.money(priced.total) + '</div>' +
          '<div class="tiny muted">药品 ' + d.items.length + ' · 处置 ' + d.treatments.length + ' · 材料 ' + d.materials.length + ' · 检验 ' + d.labs.length + ' · 检查 ' + d.exams.length + '</div></div>';
        var acts = H.el('div', { class: 'flex gap8', style: { flexWrap: 'wrap' } });
        acts.appendChild(H.btn('保存草稿', { icon: 'file', cls: 'btn-sm', onclick: function () { H.toast('草稿已保存（本地）', 'ok'); } }));
        acts.appendChild(H.btn('打印处方', { icon: 'print', cls: 'btn-sm', onclick: function () { printRx(p, d); } }));
        acts.appendChild(H.btn('打印申请单', { icon: 'print', cls: 'btn-sm', onclick: function () { printApply(p, d); } }));
        if (!readonly) acts.appendChild(H.btn('提交并锁定', { icon: 'check', cls: 'btn-primary btn-sm', onclick: submit }));
        bar.appendChild(acts);
        right.appendChild(bar);

        split.appendChild(right);
        root.appendChild(split);

        /* ---------------- 各标签页 ---------------- */
        function emrTab(p, d) {
          var wrap = H.el('div');
          var g = H.el('div', { class: 'form-grid' });
          var c1 = H.el('textarea', { class: 'textarea', placeholder: '主诉', style: { minHeight: '44px' } });
          c1.value = d.complaint || p.complaint || '';
          c1.addEventListener('input', function () { d.complaint = c1.value; });
          var w1 = H.el('div', { class: 'field span2' });
          w1.appendChild(H.el('label', { html: '主诉 <span class="req">*</span>' })); w1.appendChild(c1); g.appendChild(w1);

          var c2 = H.el('textarea', { class: 'textarea', placeholder: '现病史：起病时间、症状演变、伴随症状、诊疗经过…' });
          c2.value = d.present || p.present || '';
          c2.addEventListener('input', function () { d.present = c2.value; });
          var w2 = H.el('div', { class: 'field span2' });
          w2.appendChild(H.el('label', { text: '现病史' })); w2.appendChild(c2); g.appendChild(w2);

          var c3 = H.el('textarea', { class: 'textarea', placeholder: '既往史、过敏史、手术史、家族史…' });
          c3.value = d.past || p.past || '';
          c3.addEventListener('input', function () { d.past = c3.value; });
          var w3 = H.el('div', { class: 'field span2' });
          w3.appendChild(H.el('label', { text: '既往史 / 过敏史' })); w3.appendChild(c3); g.appendChild(w3);

          var c4 = H.el('input', { class: 'input', placeholder: '体格检查：咽部、双肺呼吸音、心律、腹部…' });
          c4.value = d.exam || p.exam || '';
          c4.addEventListener('input', function () { d.exam = c4.value; });
          var w4 = H.el('div', { class: 'field span2' });
          w4.appendChild(H.el('label', { text: '体格检查' })); w4.appendChild(c4); g.appendChild(w4);
          wrap.appendChild(g);

          /* 诊断 */
          var diagHead = H.el('div', { class: 'flex gap8', style: { marginTop: '14px', flexWrap: 'wrap' } });
          var selIcd = H.el('select', { class: 'select', style: { maxWidth: '340px' } });
          selIcd.appendChild(H.el('option', { value: '', text: '— 选择 ICD-10 诊断 —' }));
          H.dict.icd.forEach(function (i) { selIcd.appendChild(H.el('option', { value: i.code, text: i.code + ' ' + i.name })); });
          diagHead.appendChild(selIcd);
          diagHead.appendChild(H.btn('添加诊断', { icon: 'plus', cls: 'btn-sm', onclick: function () {
            if (!selIcd.value) return H.toast('请选择诊断', 'warn');
            if (d.diags.indexOf(selIcd.value) > -1) return H.toast('该诊断已添加', 'warn');
            d.diags.push(selIcd.value); draw();
          } }));
          diagHead.appendChild(H.btn('转住院申请', { icon: 'send', cls: 'btn-sm', onclick: function () { applyAdmission(p, d); } }));
          diagHead.appendChild(H.btn('手术申请', { icon: 'scissors', cls: 'btn-sm', onclick: function () { applySurgery(p, d); } }));
          wrap.appendChild(diagHead);

          if (d.diags.length) {
            var tags = H.el('div', { class: 'flex gap6', style: { marginTop: '10px', flexWrap: 'wrap' } });
            d.diags.forEach(function (code) {
              var t = H.el('span', { class: 'tag tag-brand', html: H.esc(icd(code).name) + '（' + H.esc(code) + '） <b style="cursor:pointer;margin-left:4px" data-rm="' + code + '">×</b>' });
              tags.appendChild(t);
            });
            wrap.appendChild(tags);
            tags.querySelectorAll('[data-rm]').forEach(function (x) {
              x.addEventListener('click', function () { d.diags = d.diags.filter(function (c) { return c !== x.dataset.rm; }); draw(); });
            });
          } else {
            wrap.appendChild(H.el('div', { class: 'tiny muted', style: { marginTop: '8px' }, text: '尚未下达诊断（提交前至少需要一条诊断）' }));
          }

          /* 备注 */
          var note = H.el('input', { class: 'input', placeholder: '医嘱备注 / 注意事项（所有医嘱均支持备注）', style: { marginTop: '12px' } });
          note.value = d.note || '';
          note.addEventListener('input', function () { d.note = note.value; });
          wrap.appendChild(note);
          return wrap;
        }

        function rxTab(p, d) {
          var wrap = H.el('div');
          var head = H.el('div', { class: 'flex-b', style: { marginBottom: '10px', flexWrap: 'wrap', gap: '8px' } });
          head.innerHTML = '<div class="small muted">处方明细 · ' + d.items.length + ' 项</div>';

          var tools = H.el('div', { class: 'flex gap6', style: { flexWrap: 'wrap' } });
          tools.appendChild(H.btn('添加药品', { icon: 'plus', cls: 'btn-sm btn-primary', onclick: function () {
            pickDrug(function (drug) {
              d.items.push({ code: drug.code, qty: 1, days: 3, freq: 'bid', dosePer: Number(drug.maxDose) / 2 || 1, usage: drug.usage });
              draw();
            });
          } }));
          tools.appendChild(H.btn('套用模板', { icon: 'grid', cls: 'btn-sm', onclick: function () {
            var tpls = H.api.templates(p.dept);
            if (!tpls.length) return H.toast('本科室暂无模板', 'warn');
            H.formModal({
              title: '套用医嘱模板', width: '520px',
              fields: [{ key: 'id', label: '模板', type: 'select', required: true, options: tpls.map(function (t) { return { value: t.id, label: t.name + '（' + t.items.length + ' 项）' }; }) }]
            }).then(function (v) {
              if (!v) return;
              var t = S.get('templates', v.id);
              t.items.forEach(function (it) {
                d.items.push({ code: it.code, qty: it.qty, days: 3, freq: 'bid', dosePer: (H.drug(it.code) || {}).maxDose || 1, usage: it.usage });
              });
              H.toast('已套用模板：' + t.name, 'ok'); draw();
            });
          } }));
          tools.appendChild(H.btn('存为模板', { icon: 'file', cls: 'btn-sm', onclick: function () {
            if (!d.items.length) return H.toast('处方为空，无法保存模板', 'warn');
            H.formModal({ title: '保存为医嘱模板', width: '480px', fields: [{ key: 'name', label: '模板名称', required: true }] }).then(function (v) {
              if (!v) return;
              var res = H.api.saveTemplate(v.name, d.items, d.note);
              H.toast(res.ok ? '模板已保存' : res.message, res.ok ? 'ok' : 'err');
            });
          } }));
          head.appendChild(tools);
          wrap.appendChild(head);

          if (!d.items.length) {
            wrap.appendChild(H.el('div', { html: H.empty('尚未开具药品', '点击「添加药品」从药品字典选择，或套用模板') }));
          } else {
            var tw = H.el('div', { class: 'table-wrap' });
            var t = H.el('table', { class: 'tbl' });
            t.innerHTML = '<thead><tr><th>药品 / 规格</th><th style="width:96px">单次剂量</th><th style="width:110px">频次</th><th style="width:70px">天数</th><th style="width:70px">数量</th><th style="width:88px">金额</th><th style="width:52px"></th></tr></thead>';
            var tb = H.el('tbody');
            d.items.forEach(function (it, idx) {
              var drug = H.drug(it.code) || { name: it.code, spec: '', price: 0, doseUnit: '', stock: 0 };
              var tr = H.el('tr');
              var freqSel = '<select class="select" style="height:30px" data-f="freq" data-i="' + idx + '">' +
                FREQ.map(function (f) { return '<option value="' + f.v + '"' + (it.freq === f.v ? ' selected' : '') + '>' + f.label + '</option>'; }).join('') + '</select>';
              tr.innerHTML = '<td><div class="cell-main">' + H.esc(drug.name) + '</div><div class="cell-sub">' + H.esc(drug.spec) + ' · ' + H.money(drug.price) + ' · 库存 ' + drug.stock + '</div></td>' +
                '<td><input class="input" style="height:30px" value="' + (it.dosePer || '') + '" data-f="dose" data-i="' + idx + '"><div class="tiny muted">' + H.esc(drug.doseUnit || '') + '</div></td>' +
                '<td>' + freqSel + '</td>' +
                '<td><input class="input" style="height:30px" value="' + it.days + '" data-f="days" data-i="' + idx + '"></td>' +
                '<td><input class="input" style="height:30px" value="' + it.qty + '" data-f="qty" data-i="' + idx + '"></td>' +
                '<td class="mono">' + H.money(drug.price * it.qty) + '</td>' +
                '<td class="tr"><button class="btn btn-xs btn-ghost" data-del="' + idx + '">删</button></td>';
              tb.appendChild(tr);
            });
            t.appendChild(tb); tw.appendChild(t); wrap.appendChild(tw);
            wrap.querySelectorAll('input[data-f],select[data-f]').forEach(function (inp) {
              inp.addEventListener('change', function () {
                var i = +inp.dataset.i, f = inp.dataset.f, v = inp.value;
                if (f === 'qty' || f === 'days') d.items[i][f] = Number(v) || 0;
                else if (f === 'dose') d.items[i].dosePer = Number(v) || 0;
                else d.items[i][f] = v;
                draw();
              });
            });
            wrap.querySelectorAll('[data-del]').forEach(function (b) {
              b.addEventListener('click', function () { d.items.splice(+b.dataset.del, 1); draw(); });
            });
          }

          /* 合理用药审查 */
          var pat = { allergy: p.allergy, age: p.age, diagnosis: d.diags.length ? icd(d.diags[0]).name : '' };
          var issues = H.rxCheck(pat, d.items.map(function (i) { return { code: i.code, dosePer: i.dosePer, freqPerDay: freqN(i.freq) }; }));
          d.items.forEach(function (i) {
            var drug = H.drug(i.code);
            if (drug && drug.stock < i.qty) issues.push({ level: 'warn', title: '库存不足', text: drug.name + ' 库存 ' + drug.stock + '，本次开具 ' + i.qty + '（发药前需补货）' });
          });
          var check = H.el('div', { style: { marginTop: '12px' } });
          check.innerHTML = '<div class="small muted" style="margin-bottom:8px">合理用药审查</div>';
          var alerts = H.el('div');
          check.appendChild(alerts);
          if (!issues.length) {
            alerts.innerHTML = '<div class="alert alert-ok">' + H.icon('check', 16, 'ai') + '<div>合理用药审查通过：过敏史、相互作用、剂量、重复用药均未发现异常。</div></div>';
          } else {
            issues.forEach(function (i) { alerts.innerHTML += H.alertHTML(i.level, i.title, i.text); });
          }
          wrap.appendChild(check);
          wrap.appendChild(H.el('div', { class: 'tiny muted', style: { marginTop: '8px' }, text: '审查依据：过敏类别 / 两两相互作用 / 日剂量上限 / 同通用名重复用药。' }));
          return wrap;
        }

        function treatTab(p, d) {
          var wrap = H.el('div');
          var head = H.el('div', { class: 'flex-b', style: { marginBottom: '10px' } });
          head.innerHTML = '<div class="small muted">治疗处置与卫生材料</div>';
          var tools = H.el('div', { class: 'flex gap6' });
          tools.appendChild(H.btn('添加处置', { icon: 'plus', cls: 'btn-sm', onclick: function () {
            pickEntry('treat', H.dict.treatments, function (t) { d.treatments.push({ code: t.code, qty: 1 }); draw(); });
          } }));
          tools.appendChild(H.btn('添加材料', { icon: 'plus', cls: 'btn-sm', onclick: function () {
            pickEntry('material', H.dict.materials, function (m) { d.materials.push({ code: m.code, qty: 1 }); draw(); });
          } }));
          head.appendChild(tools); wrap.appendChild(head);

          function table(title, list, dict, key, kind) {
            var box = H.el('div', { style: { marginBottom: '14px' } });
            box.innerHTML = '<div class="tiny muted" style="margin-bottom:6px">' + title + '</div>';
            if (!list.length) { box.innerHTML += '<div class="muted small" style="padding:6px 0">未添加</div>'; return box; }
            var tw = H.el('div', { class: 'table-wrap' });
            var t = H.el('table', { class: 'tbl' });
            t.innerHTML = '<thead><tr><th>项目</th><th style="width:90px">单价</th><th style="width:90px">数量</th><th style="width:100px">金额</th><th style="width:60px"></th></tr></thead>';
            var tb = H.el('tbody');
            list.forEach(function (it, idx) {
              var it0 = dict.filter(function (x) { return x.code === it.code; })[0] || { name: it.code, price: 0, unit: '' };
              var tr = H.el('tr');
              tr.innerHTML = '<td><div class="cell-main">' + H.esc(it0.name) + '</div><div class="cell-sub">' + H.esc(it0.spec || it0.unit) + ' · 医保' + H.esc(it0.ins || '') + '</div></td>' +
                '<td class="mono">' + H.money(it0.price) + '</td>' +
                '<td><input class="input" style="height:30px" value="' + it.qty + '" data-k="' + kind + '" data-i="' + idx + '"></td>' +
                '<td class="mono">' + H.money(it0.price * it.qty) + '</td>' +
                '<td class="tr"><button class="btn btn-xs btn-ghost" data-dk="' + kind + '" data-di="' + idx + '">删</button></td>';
              tb.appendChild(tr);
            });
            t.appendChild(tb); tw.appendChild(t); box.appendChild(tw);
            box.querySelectorAll('input[data-k]').forEach(function (inp) {
              inp.addEventListener('change', function () {
                var arr = inp.dataset.k === 'treat' ? d.treatments : d.materials;
                arr[+inp.dataset.i].qty = Number(inp.value) || 1; draw();
              });
            });
            box.querySelectorAll('[data-dk]').forEach(function (b) {
              b.addEventListener('click', function () {
                var arr = b.dataset.dk === 'treat' ? d.treatments : d.materials;
                arr.splice(+b.dataset.di, 1); draw();
              });
            });
            return box;
          }
          wrap.appendChild(table('治疗处置', d.treatments, H.dict.treatments, 'code', 'treat'));
          wrap.appendChild(table('卫生材料', d.materials, H.dict.materials, 'code', 'material'));
          return wrap;
        }

        function applyTab(p, d) {
          var wrap = H.el('div');
          var labsBox = H.el('div', { style: { marginBottom: '16px' } });
          labsBox.innerHTML = '<div class="flex-b" style="margin-bottom:8px"><div class="small muted">检验申请（检体：全血）</div></div>';
          var chips = H.el('div', { class: 'flex gap6', style: { flexWrap: 'wrap' } });
          H.dict.labItems.forEach(function (l) {
            var on = d.labs.indexOf(l.code) > -1;
            chips.appendChild(H.btn(l.name + (on ? ' ✓' : ''), {
              cls: 'btn-xs ' + (on ? 'btn-ok' : ''),
              onclick: function () {
                var i = d.labs.indexOf(l.code);
                if (i > -1) d.labs.splice(i, 1); else d.labs.push(l.code);
                draw();
              }
            }));
          });
          labsBox.appendChild(chips);

          var examBox = H.el('div');
          examBox.innerHTML = '<div class="flex-b" style="margin-bottom:8px"><div class="small muted">检查申请（需注明检查部位）</div></div>';
          var addExam = H.el('div', { class: 'flex gap6', style: { flexWrap: 'wrap' } });
          var itemSel = H.el('select', { class: 'select', style: { maxWidth: '220px' } });
          H.dict.examItems.forEach(function (i) { itemSel.appendChild(H.el('option', { value: i, text: i })); });
          var part = H.el('input', { class: 'input', placeholder: '检查部位', style: { maxWidth: '160px' } });
          addExam.appendChild(itemSel); addExam.appendChild(part);
          addExam.appendChild(H.btn('添加检查', { icon: 'plus', cls: 'btn-sm', onclick: function () {
            if (!part.value.trim()) return H.toast('请填写检查部位', 'warn');
            d.exams.push({ item: itemSel.value, part: part.value.trim() }); draw();
          } }));
          examBox.appendChild(addExam);

          if (d.exams.length) {
            var box = H.el('div', { style: { marginTop: '10px' } });
            d.exams.forEach(function (e, i) {
              var row = H.el('div', { class: 'flex-b', style: { padding: '7px 10px', border: '1px solid var(--line)', borderRadius: '8px', marginBottom: '6px' } });
              row.innerHTML = '<span class="small"><b>' + H.esc(e.item) + '</b> · 部位 ' + H.esc(e.part) + '</span>';
              var del = H.btn('移除', { cls: 'btn-xs btn-ghost', onclick: function () { d.exams.splice(i, 1); draw(); } });
              row.appendChild(del); box.appendChild(row);
            });
            examBox.appendChild(box);
          }

          wrap.appendChild(labsBox);
          wrap.appendChild(examBox);
          wrap.appendChild(H.el('div', { class: 'tiny muted', style: { marginTop: '10px' }, text: '提交后申请单自动传送至检验科 / 影像科队列（第三章条款 11）。' }));
          return wrap;
        }

        function historyTab(p, d) {
          var h = H.api.history(p.id);
          var wrap = H.el('div');
          wrap.appendChild(H.el('div', { class: 'small muted', style: { marginBottom: '8px' } }));
          var list = h.visits.filter(function (v) { return !d.visitId || v.id !== d.visitId; });
          if (!list.length) {
            wrap.appendChild(H.el('div', { html: H.empty('暂无历史就诊记录', '本次提交后会出现在这里') }));
          } else {
            var tb = H.el('div');
            tb.appendChild(H.table({
              columns: [
                { key: 'date', label: '就诊日期', width: '110px', render: function (r) { return '<span class="mono small">' + H.esc(r.date) + '</span>'; } },
                { key: 'dept', label: '科室', width: '100px' },
                { key: 'diagnosis', label: '诊断' },
                { key: 'total', label: '费用', width: '90px', render: function (r) { return '<span class="mono">' + H.money(r.total) + '</span>'; } },
                { key: 'op', label: '', width: '80px', align: 'right', render: function (r) { return '<div class="ops"><button class="btn btn-xs" data-v="' + r.id + '">查看</button></div>'; } }
              ],
              rows: list
            }));
            tb.querySelectorAll('[data-v]').forEach(function (b) {
              b.addEventListener('click', function () {
                var v = S.get('visits', b.dataset.v);
                H.modal({
                  title: '历史就诊 · ' + v.date, width: '620px',
                  body: '<dl class="dl"><dt>科室</dt><dd>' + H.esc(v.dept) + '</dd><dt>医生</dt><dd>' + H.esc(v.doctor) + '</dd>' +
                    '<dt>主诉</dt><dd>' + H.esc(v.complaint) + '</dd><dt>诊断</dt><dd>' + H.esc(v.diagnosis) + '</dd>' +
                    '<dt>处方</dt><dd>' + (v.items && v.items.length ? v.items.map(function (i) { return H.esc(i.name) + '×' + i.qty; }).join('、') : '—') + '</dd>' +
                    '<dt>费用</dt><dd class="mono">' + H.money(v.total) + '</dd></dl>'
                });
              });
            });
            wrap.appendChild(tb);
          }

          /* 检验结果比较 */
          var trendBox = H.el('div', { style: { marginTop: '16px' } });
          trendBox.innerHTML = '<div class="small muted" style="margin-bottom:8px">检验结果比较（历次同一项目）</div>';
          var selItem = H.el('select', { class: 'select', style: { maxWidth: '240px' } });
          H.dict.labItems.forEach(function (l) { selItem.appendChild(H.el('option', { value: l.code, text: l.name + '（' + l.short + '）' })); });
          var tbl = H.el('div', { style: { marginTop: '10px' } });
          function paintTrend() {
            var code = selItem.value;
            var pts = H.api.trend(p.id, code);
            var li = H.dict.labItems.filter(function (x) { return x.code === code; })[0];
            if (!pts.length) { tbl.innerHTML = '<div class="muted small">该患者暂无此项目结果</div>'; return; }
            var max = Math.max.apply(null, pts.map(function (x) { return Number(x.v); }).concat([li.hi]));
            tbl.innerHTML = '<div class="hbars">' + pts.map(function (x) {
              var over = Number(x.v) > li.hi, low = Number(x.v) < li.lo;
              var pct = Math.max(10, Math.min(100, Number(x.v) / (max * 1.2) * 100));
              return '<div class="flex-b small" style="margin-bottom:6px;gap:10px"><span class="mono tiny muted" style="width:86px">' + x.date + '</span>' +
                '<span class="bar ' + (over ? 'danger' : low ? 'warn' : 'ok') + '" style="flex:1"><i style="width:' + pct + '%"></i></span>' +
                '<span class="mono" style="width:78px;text-align:right">' + x.v + ' ' + li.unit + '</span></div>';
            }).join('') + '</div>' +
              '<div class="tiny muted">参考范围 ' + li.lo + ' - ' + li.hi + ' ' + li.unit + '（' + pts.length + ' 次记录）</div>';
          }
          selItem.addEventListener('change', paintTrend);
          trendBox.appendChild(selItem); trendBox.appendChild(tbl);
          paintTrend();
          wrap.appendChild(trendBox);
          return wrap;
        }

        function lockedCard(p, d) {
          var h = H.api.history(p.id);
          var visit = d.visitId ? S.get('visits', d.visitId) : h.visits[0];
          var rx = visit ? S.where('prescriptions', function (r) { return r.visitId === visit.id; })[0] : null;
          var trans = visit ? H.api.transmissions(visit.id) : { labs: [], exams: [] };
          var card = H.el('div', { class: 'card' });
          card.innerHTML = '<div class="card-hd"><h3>本次就诊记录（已锁定）</h3>' +
            '<span class="tag tag-ok no-dot">确认后不可更改</span></div>';
          var body = H.el('div', { class: 'card-bd' });
          body.innerHTML =
            '<div class="alert alert-ok">' + H.icon('check', 16, 'ai') + '<div>病历与处方已提交并锁定，' +
            '已传送至<b>门诊收费</b>、<b>门诊药房</b>' + (trans.labs.length ? '、<b>检验科</b>' : '') + (trans.exams.length ? '、<b>影像科</b>' : '') + '。</div></div>' +
            '<dl class="dl" style="margin-top:12px">' +
            '<dt>就诊号</dt><dd class="mono">' + H.esc(visit ? visit.id : '—') + '</dd>' +
            '<dt>诊断</dt><dd>' + H.esc(visit ? visit.diagnosis : p.diagnosis || '—') + '</dd>' +
            '<dt>处方号</dt><dd class="mono">' + (rx ? H.esc(rx.id) + '（' + H.esc(rx.status) + '）' : '无药品处方') + '</dd>' +
            '<dt>费用合计</dt><dd class="mono">' + H.money(visit ? visit.total : 0) + '</dd>' +
            '<dt>检验 / 检查</dt><dd>' + trans.labs.length + ' 份 / ' + trans.exams.length + ' 份</dd>' +
            '</dl>';
          var acts = H.el('div', { class: 'flex gap8', style: { marginTop: '14px', flexWrap: 'wrap' } });
          acts.appendChild(H.btn('打印处方', { icon: 'print', cls: 'btn-sm', onclick: function () { printRx(p, Object.assign({}, d, { diags: visit ? visit.diags : d.diags, items: visit ? visit.items : d.items })); } }));
          acts.appendChild(H.btn('打印病历', { icon: 'print', cls: 'btn-sm', onclick: function () { printRecord(p, Object.assign({}, d, { diags: visit ? visit.diags : d.diags })); } }));
          if (rx && rx.status === '待收费') {
            acts.appendChild(H.btn('作废处方', { icon: 'x', cls: 'btn-sm btn-danger', onclick: function () {
              H.formModal({ title: '作废处方 · ' + rx.id, width: '460px', fields: [{ key: 'reason', label: '作废原因', required: true, type: 'textarea' }] }).then(function (v) {
                if (!v) return;
                var res = H.api.voidPrescription(rx.id, v.reason);
                H.toast(res.ok ? '处方已作废，可重新开立' : res.message + '（' + res.status + '）', res.ok ? 'ok' : 'err');
                if (res.ok) { delete drafts[p.id]; draw(); }
              });
            } }));
          }
          acts.appendChild(H.btn('查看历次就诊', { icon: 'clock', onclick: function () { tab = 'history'; delete drafts[p.id]; sel = p.id; draw(); } }));
          body.appendChild(acts);
          card.appendChild(body);
          return card;
        }

        /* 提交 */
        function submit() {
          if (!d.complaint.trim()) { tab = 'emr'; draw(); return H.toast('请填写主诉', 'warn'); }
          if (!d.diags.length) { tab = 'emr'; draw(); return H.toast('请至少录入一条诊断', 'warn'); }
          if (!d.items.length && !d.treatments.length && !d.materials.length) { tab = 'rx'; draw(); return H.toast('处方与处置均为空，无法提交', 'warn'); }
          var pat = { allergy: p.allergy, age: p.age, diagnosis: icd(d.diags[0]).name };
          var issues = H.rxCheck(pat, d.items.map(function (i) { return { code: i.code, dosePer: i.dosePer, freqPerDay: freqN(i.freq) }; }));
          var danger = issues.filter(function (i) { return i.level === 'danger'; });
          H.confirm('确认提交门诊病历与处方？提交后锁定，不可修改，只能作废重开。' +
            (danger.length ? '（存在 ' + danger.length + ' 条严重用药警告）' : ''), false).then(function (ok) {
              if (!ok) return;
              var res = H.api.submitVisit(p.id, {
                complaint: d.complaint, present: d.present, past: d.past, exam: d.exam, note: d.note,
                diagnoses: d.diags, items: d.items, treatments: d.treatments, materials: d.materials,
                labs: d.labs, exams: d.exams
              });
              if (!res.ok) {
                H.modal({
                  title: '提交失败 · ' + res.status, width: '460px',
                  body: '<div class="alert alert-danger">' + H.icon('alert', 16, 'ai') + '<div>' + H.esc(res.message) + '</div></div>' +
                    '<div class="small muted" style="margin-top:10px">事务已回滚：未生成就诊记录与处方。</div>'
                });
                return;
              }
              d.locked = true;
              d.visitId = res.body.visit.id;
              d.rxId = res.body.prescription ? res.body.prescription.id : null;
              H.toast('提交成功：' + res.body.visit.id + '，金额 ' + H.money(res.body.visit.total), 'ok');
              H.refreshCounters();
              draw();
            });
        }
      }

      /* 草稿 → 划价条目 */
      function entriesOf(d) {
        var out = [];
        d.items.forEach(function (i) { out.push({ kind: 'drug', code: i.code, qty: i.qty, usage: i.usage }); });
        d.treatments.forEach(function (i) { out.push({ kind: 'treat', code: i.code, qty: i.qty }); });
        d.materials.forEach(function (i) { out.push({ kind: 'material', code: i.code, qty: i.qty }); });
        return out;
      }

      /* 转住院 / 手术申请 */
      function applyAdmission(p, d) {
        H.formModal({
          title: '开具住院证 · ' + p.name, width: '560px',
          fields: [
            { key: 'dept', label: '拟收治科室', type: 'select', required: true, options: H.dict.depts.map(function (x) { return x.name; }), value: p.dept },
            { key: 'reason', label: '住院理由', required: true, type: 'textarea', value: (d.diags.length ? icd(d.diags[0]).name : '') + '，需住院进一步诊治' }
          ]
        }).then(function (v) {
          if (!v) return;
          var rec = S.insert('admissions', { id: H.uid('AD'), patientId: p.id, patient: p.name, dept: v.dept, reason: v.reason, doctor: H.session.name, time: H.now(), status: '待入院' });
          H.audit('开具住院证', rec.id, v.dept + '：' + v.reason);
          H.toast('住院证已开立并传送至住院处', 'ok');
        });
      }
      function applySurgery(p, d) {
        H.formModal({
          title: '手术申请 · ' + p.name, width: '560px',
          fields: [
            { key: 'procedure', label: '手术名称', required: true },
            { key: 'anesth', label: '拟麻醉方式', type: 'select', required: true, options: ['局部浸润麻醉', '椎管内麻醉', '全身麻醉'] },
            { key: 'note', label: '术前准备与备注', span: 2, type: 'textarea' }
          ]
        }).then(function (v) {
          if (!v) return;
          var rec = S.insert('surgeryReqs', { id: H.uid('OP'), patientId: p.id, patient: p.name, procedure: v.procedure, anesth: v.anesth, note: v.note, doctor: H.session.name, time: H.now(), status: '待审批' });
          H.audit('提交手术申请', rec.id, v.procedure);
          H.toast('手术申请已提交至手术麻醉科', 'ok');
        });
      }

      /* 打印 */
      function printRx(p, d) {
        var rows = (d.items || []).map(function (it) {
          var drug = H.drug(it.code) || {};
          return '<tr><td>' + H.esc(drug.name || it.name) + '</td><td>' + H.esc(drug.spec || it.spec) + '</td><td>' + it.qty + '</td>' +
            '<td>' + H.money(drug.price || it.price) + '</td><td>' + H.money((drug.price || it.price) * it.qty) + '</td><td>' + H.esc(it.usage || drug.usage) + '</td></tr>';
        }).join('');
        var total = H.api.price(entriesOf(d)).total;
        H.print('门诊处方笺', '<h2>门 诊 处 方 笺</h2><div class="sub">' + H.esc(p.dept) + ' · ' + H.today() + '</div>' +
          '<p>姓名：' + H.esc(p.name) + '　性别：' + p.sex + '　年龄：' + p.age + '　就诊卡号：' + H.esc(p.card) + '　医保：' + H.esc(p.ins) + '</p>' +
          '<p>诊断：' + H.esc((d.diags || []).map(function (c) { return icd(c).name; }).join('、') || p.diagnosis || '—') + '</p>' +
          '<table><thead><tr><th>药品</th><th>规格</th><th>数量</th><th>单价</th><th>金额</th><th>用法</th></tr></thead><tbody>' + (rows || '<tr><td colspan="6">无药品</td></tr>') + '</tbody></table>' +
          '<p style="text-align:right">合计：' + H.money(total) + '</p>' +
          '<div class="sign"><span>医师签名：' + H.esc(H.session.name) + '</span><span>' + H.now() + '</span></div>');
      }
      function printRecord(p, d) {
        var diag = (d.diags || []).map(function (c) { return icd(c).name + '（' + c + '）'; }).join('、');
        H.print('门诊病历', '<h2>门 诊 病 历</h2><div class="sub">' + H.esc(p.dept) + ' · ' + H.today() + '</div>' +
          '<p>姓名：' + H.esc(p.name) + '　性别：' + p.sex + '　年龄：' + p.age + '　病案号：' + H.esc(p.mrn) + '</p>' +
          '<p><b>主诉：</b>' + H.esc(d.complaint || p.complaint) + '</p>' +
          '<p><b>现病史：</b>' + H.esc(d.present || p.present || '—') + '</p>' +
          '<p><b>既往史：</b>' + H.esc(d.past || p.past || '—') + '</p>' +
          '<p><b>体格检查：</b>' + H.esc(d.exam || p.exam || '—') + '</p>' +
          '<p><b>诊断：</b>' + H.esc(diag || p.diagnosis || '—') + '</p>' +
          '<p><b>处理：</b>' + H.esc(d.note || '—') + '</p>' +
          '<div class="sign"><span>医师签名：' + H.esc(H.session.name) + '</span><span>' + H.now() + '</span></div>');
      }
      function printApply(p, d) {
        var labs = (d.labs || []).map(function (c) { return H.dict.labItems.filter(function (x) { return x.code === c; })[0]; }).filter(Boolean);
        H.print('检验检查申请单', '<h2>检 验 / 检 查 申 请 单</h2><div class="sub">' + H.esc(p.dept) + ' · ' + H.today() + '</div>' +
          '<p>姓名：' + H.esc(p.name) + '　性别：' + p.sex + '　年龄：' + p.age + '　就诊卡号：' + H.esc(p.card) + '</p>' +
          '<p><b>临床诊断：</b>' + H.esc((d.diags || []).map(function (c) { return icd(c).name; }).join('、') || p.diagnosis || '—') + '</p>' +
          '<table><thead><tr><th>类别</th><th>项目</th><th>检体 / 部位</th></tr></thead><tbody>' +
          (labs.map(function (l) { return '<tr><td>检验</td><td>' + l.name + '</td><td>' + l.specimen + '</td></tr>'; }).join('') +
            (d.exams || []).map(function (e) { return '<tr><td>检查</td><td>' + H.esc(e.item) + '</td><td>' + H.esc(e.part) + '</td></tr>'; }).join('') ||
            '<tr><td colspan="3">未开具</td></tr>') +
          '</tbody></table><div class="sign"><span>申请医师：' + H.esc(H.session.name) + '</span><span>' + H.now() + '</span></div>');
      }

      draw();
    }
  });
})();
