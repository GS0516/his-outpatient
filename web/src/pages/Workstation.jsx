import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import Modal from '../components/Modal'

const FREQ = [
  { v: 'qd', label: '每日一次', n: 1 }, { v: 'bid', label: '每日两次', n: 2 },
  { v: 'tid', label: '每日三次', n: 3 }, { v: 'q8h', label: '每8小时', n: 3 },
  { v: 'q12h', label: '每12小时', n: 2 }, { v: 'st', label: '立即一次', n: 1 },
  { v: 'prn', label: '必要时', n: 1 },
]
const emptyDraft = (p) => ({
  complaint: p?.complaint || '', present: p?.present || '', past: p?.past || '', exam: p?.exam || '',
  note: '', diags: [], items: [], treatments: [], materials: [], labs: [], exams: [],
})

export default function Workstation({ user, onLogout }) {
  const isDoctor = user.role === 'doctor'
  const [dicts, setDicts] = useState(null)
  const [patients, setPatients] = useState([])
  const [sel, setSel] = useState(null)
  const [queueTab, setQueueTab] = useState('待诊')
  const [tab, setTab] = useState('emr')
  const [draft, setDraft] = useState(emptyDraft(null))
  const [review, setReview] = useState({ total: 0, issues: [], lines: [] })
  const [locked, setLocked] = useState(null)
  const [history, setHistory] = useState(null)
  const [templates, setTemplates] = useState([])
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [clock, setClock] = useState(() => new Date())
  const searchRef = useRef('')

  const notify = (text, tone = 'ok') => {
    setToast({ text, tone })
    setTimeout(() => setToast(''), 2600)
  }

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    Promise.all([api.dicts(), api.templates()])
      .then(([d, t]) => { setDicts(d); setTemplates(t) })
      .catch((e) => notify(e.message, 'danger'))
    loadPatients('待诊')
  }, [])

  const loadPatients = (status) => {
    api.patients(status || undefined)
      .then((rows) => {
        setPatients(rows)
        setSel((cur) => rows.find((p) => p.id === cur?.id) || rows[0] || null)
      })
      .catch((e) => notify(e.message, 'danger'))
  }

  useEffect(() => {
    loadPatients(queueTab)
    setLocked(null)
    setHistory(null)
    setTab('emr')
  }, [queueTab])

  useEffect(() => {
    if (!sel) return
    setDraft(emptyDraft(sel))
    setLocked(null)
    setHistory(null)
    if (sel.status === '已完成') {
      api.history(sel.id).then((h) => {
        setHistory(h)
        const last = h.visits[0]
        if (last) {
          const rx = h.prescriptions.find((r) => r.visitId === last.id) || null
          setLocked({ visit: last, prescription: rx, labs: h.labs.filter((l) => l.visitId === last.id), exams: h.exams.filter((e) => e.visitId === last.id) })
          setDraft({
            complaint: last.complaint || '', present: last.present || '', past: last.past || '',
            exam: last.exam || '', note: last.note || '', diags: last.diags || [],
            items: (rx?.items || []).map((i) => ({ code: i.code, qty: i.qty, usage: i.usage, days: 3, freq: 'bid' })),
            treatments: [], materials: [], labs: [], exams: [],
          })
          setReview((r) => ({ ...r, total: last.total }))
        }
      }).catch(() => {})
    }
  }, [sel?.id])

  /* 服务端划价与审查（防抖） */
  useEffect(() => {
    if (!sel || !dicts || locked) return
    const handle = setTimeout(() => {
      api.review({ patientId: sel.id, ...draft })
        .then((r) => setReview({ total: r.total, issues: r.issues, lines: r.lines }))
        .catch(() => {})
    }, 220)
    return () => clearTimeout(handle)
  }, [draft, sel?.id, dicts, locked])

  const drugByCode = useMemo(() => {
    const map = {}
    ;(dicts?.drugs || []).forEach((d) => { map[d.code] = d })
    return map
  }, [dicts])

  const patch = (p) => setDraft((d) => ({ ...d, ...p }))

  /* ---------------------------------------------------------------- 提交 */
  async function submitVisit() {
    if (!draft.complaint.trim()) { setTab('emr'); return notify('请填写主诉', 'warn') }
    if (!draft.diags.length) { setTab('emr'); return notify('请至少录入一条诊断', 'warn') }
    if (!draft.items.length && !draft.treatments.length && !draft.materials.length) { setTab('rx'); return notify('处方与处置均为空', 'warn') }
    const danger = review.issues.filter((i) => i.level === 'danger')
    setModal({
      type: 'confirm',
      title: '提交门诊病历',
      text: `确认提交门诊病历与处方？提交后锁定，不可修改，只能作废重开。${danger.length ? `（存在 ${danger.length} 条严重用药警告）` : ''}`,
      onOk: doSubmit,
    })
  }

  async function doSubmit() {
    setBusy(true)
    try {
      const res = await api.createVisit({ patientId: sel.id, ...draft })
      setLocked({ visit: res.visit, prescription: res.prescription, labs: [], exams: [] })
      notify(`提交成功：${res.visit.id}，金额 ¥${res.visit.total.toFixed(2)}`)
      loadPatients(queueTab)
      api.history(sel.id).then(setHistory).catch(() => {})
    } catch (e) {
      setModal({ type: 'info', title: `提交失败 · ${e.status || ''}`, text: e.message })
    } finally {
      setBusy(false)
    }
  }

  async function voidRx() {
    const rx = locked?.prescription
    if (!rx) return
    setModal({
      type: 'void', title: `作废处方 · ${rx.id}`,
      onOk: async (reason) => {
        try {
          await api.voidRx(rx.id, reason)
          setLocked({ ...locked, prescription: { ...rx, status: '已作废', voidReason: reason } })
          setModal(null)
          notify('处方已作废，可重新开立')
          api.history(sel.id).then(setHistory).catch(() => {})
        } catch (e) {
          notify(e.message, 'danger')
        }
      },
    })
  }

  /* ---------------------------------------------------------------- 模板 */
  function applyTemplate(t) {
    const items = t.items.map((i) => {
      const d = drugByCode[i.code] || {}
      return { code: i.code, qty: i.qty || 1, days: i.days || 3, freq: i.freq || 'bid', dosePer: i.dosePer ?? (d.maxDose ? d.maxDose / 2 : 1), usage: i.usage || d.usage || '' }
    })
    patch({ items: [...draft.items, ...items] })
    setModal(null)
    notify(`已套用模板：${t.name}`)
  }

  function saveTemplate(name) {
    api.saveTemplate({ name, items: draft.items.map((i) => ({ code: i.code, qty: i.qty, usage: i.usage, freq: i.freq, dosePer: i.dosePer, days: i.days })), note: draft.note })
      .then((t) => { setTemplates((x) => [...x, t]); setModal(null); notify('模板已保存') })
      .catch((e) => notify(e.message, 'danger'))
  }

  /* ---------------------------------------------------------------- 打印 */
  function printDoc(kind) {
    const p = sel
    const diag = draft.diags.map((c) => (dicts?.icd.find((i) => i.code === c)?.name || c) + `（${c}）`).join('、') || p.diagnosis || '—'
    let body = ''
    if (kind === 'rx') {
      body = `<h2>门 诊 处 方 笺</h2><p>姓名：${p.name}　性别：${p.sex}　年龄：${p.age}　就诊卡：${p.card}　医保：${p.ins}</p>
        <p>诊断：${diag}</p><table><thead><tr><th>药品</th><th>规格</th><th>数量</th><th>单价</th><th>金额</th><th>用法</th></tr></thead><tbody>
        ${draft.items.map((i) => { const d = drugByCode[i.code] || {}; return `<tr><td>${d.name || i.code}</td><td>${d.spec || ''}</td><td>${i.qty}</td><td>${(d.price || 0).toFixed(2)}</td><td>${((d.price || 0) * i.qty).toFixed(2)}</td><td>${i.usage || ''}</td></tr>` }).join('') || '<tr><td colspan="6">无药品</td></tr>'}
        </tbody></table><p style="text-align:right">合计：¥${review.total.toFixed(2)}</p>
        <div class="sign"><span>医师签名：${user.name}</span><span>${new Date().toLocaleString()}</span></div>`
    } else if (kind === 'record') {
      body = `<h2>门 诊 病 历</h2><p>姓名：${p.name}　性别：${p.sex}　年龄：${p.age}　病案号：${p.mrn}</p>
        <p><b>主诉：</b>${draft.complaint}</p><p><b>现病史：</b>${draft.present || '—'}</p>
        <p><b>既往史：</b>${draft.past || '—'}</p><p><b>体格检查：</b>${draft.exam || '—'}</p>
        <p><b>诊断：</b>${diag}</p><p><b>处理：</b>${draft.note || '—'}</p>
        <div class="sign"><span>医师签名：${user.name}</span><span>${new Date().toLocaleString()}</span></div>`
    } else {
      body = `<h2>检 验 / 检 查 申 请 单</h2><p>姓名：${p.name}　性别：${p.sex}　年龄：${p.age}</p><p>诊断：${diag}</p>
        <table><thead><tr><th>类别</th><th>项目</th><th>检体/部位</th></tr></thead><tbody>
        ${draft.labs.map((c) => { const l = dicts.labItems.find((x) => x.code === c) || {}; return `<tr><td>检验</td><td>${l.name || c}</td><td>${l.specimen || ''}</td></tr>` }).join('')}
        ${draft.exams.map((e) => `<tr><td>检查</td><td>${e.item}</td><td>${e.part}</td></tr>`).join('') || ''}
        </tbody></table><div class="sign"><span>申请医师：${user.name}</span><span>${new Date().toLocaleString()}</span></div>`
    }
    const w = window.open('', '_blank', 'width=820,height=900')
    if (!w) return notify('浏览器拦截了打印窗口', 'warn')
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>打印</title>
      <style>body{font-family:"Microsoft YaHei",sans-serif;padding:28px;font-size:13px;line-height:1.8;color:#111}
      h2{text-align:center;letter-spacing:.2em;font-size:18px}table{width:100%;border-collapse:collapse;font-size:12px}
      td,th{border:1px solid #bbb;padding:6px 8px;text-align:left}.sign{display:flex;justify-content:flex-end;gap:50px;margin-top:32px}</style>
      </head><body>${body}</body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 300)
  }

  if (!dicts) return <div className="boot">正在加载字典…</div>

  const waitingCount = patients.filter((p) => p.status === '待诊').length
  const lockedView = !!locked

  return (
    <div className="shell">
      {/* ---------------- 侧栏 ---------------- */}
      <aside className="side">
        <div className="side-hd">
          <span className="mark">＋</span>
          <span>门诊工作站<small>OUTPATIENT · HIS</small></span>
        </div>
        <nav className="side-nav">
          <button className="nav-item on"><span>▤</span><span className="label">门诊医生工作站</span></button>
          <button className="nav-item" onClick={() => setModal({ type: 'triage' })}><span>✚</span><span className="label">智能分诊助手</span></button>
          {!isDoctor && <button className="nav-item" onClick={() => openAudit()}><span>▦</span><span className="label">审计日志</span></button>}
          {!isDoctor && <button className="nav-item" onClick={() => setModal({ type: 'import' })}><span>⇪</span><span className="label">药品批量导入</span></button>}
        </nav>
        <div className="side-ft">
          <div className="user-chip">
            <span className="av">{user.name.slice(0, 1)}</span>
            <span className="meta" style={{ minWidth: 0 }}>
              <span className="nm" style={{ display: 'block' }}>{user.name}</span>
              <span className="rl">{user.role === 'doctor' ? '医生' : '管理员'} · {user.dept}</span>
            </span>
            <button className="btn btn-xs btn-ghost" style={{ marginLeft: 'auto' }} onClick={onLogout}>退出</button>
          </div>
        </div>
      </aside>

      {/* ---------------- 主区 ---------------- */}
      <div className="main">
        <header className="top">
          <div className="crumb">工作台 / <b>门诊医生工作站</b></div>
          <div className="top-right">
            <span className="tag tag-brand">第三章</span>
            <span className="clock">{clock.toLocaleString('zh-CN', { hour12: false })}</span>
          </div>
        </header>

        <main className="view">
          <div className="page-hd">
            <div>
              <h1>门诊医生工作站 <span className="ver">第三章</span></h1>
              <p>处理门诊记录、诊断、处方、治疗处置、卫生材料、检查、检验、手术与收入院申请；处方自动监测并提示合理用药，确认后不可更改。</p>
            </div>
            <div className="flex gap8">
              <button className="btn btn-sm" onClick={() => loadPatients(queueTab)}>刷新队列</button>
              <button className="btn btn-sm" onClick={() => setModal({ type: 'triage' })}>智能分诊</button>
            </div>
          </div>

          {!isDoctor && (
            <div className="alert alert-info">当前账号为管理员，仅可查阅门诊病历与处方，<b>不能开方</b>（提交将返回 403）。</div>
          )}

          <div className="split">
            {/* 队列 */}
            <div className="card">
              <div className="card-hd">
                <h3>候诊队列</h3>
                <span className="tag tag-brand">{queueTab === '待诊' ? waitingCount : ''}</span>
              </div>
              <div className="tabs" style={{ padding: '0 8px' }}>
                {['待诊', '已完成'].map((k) => (
                  <button key={k} className={'tab' + (queueTab === k ? ' on' : '')} onClick={() => { setQueueTab(k); searchRef.current = '' }}>
                    {k}<span className="cnt">{k === '待诊' ? waitingCount : patients.filter((p) => p.status === '已完成').length}</span>
                  </button>
                ))}
              </div>
              <div className="queue">
                {patients.length === 0 && <div className="empty">该队列暂无患者</div>}
                {patients.map((p) => (
                  <button key={p.id} className={'q-item' + (sel?.id === p.id ? ' on' : '')} onClick={() => setSel(p)}>
                    <span className="av">{p.name.slice(0, 1)}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="nm" style={{ display: 'block' }}>{p.name} <span className="tiny muted">{p.sex} {p.age}岁</span></span>
                      <span className="sub">{(p.complaint || '').slice(0, 18)}…</span>
                    </span>
                    {p.allergy ? <span className="tag tag-danger">过敏</span> : <span className="tag">{p.dept}</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* 工作区 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!sel && <div className="card"><div className="empty">请从左侧选择患者</div></div>}

              {sel && (
                <>
                  <div className="card pt-card">
                    <div className="pt-top">
                      <div className="pt-av">{sel.name.slice(0, 1)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="pt-name">
                          {sel.name}
                          <span className="tag">{sel.sex} · {sel.age}岁</span>
                          {sel.allergy && <span className="tag tag-danger">过敏：{sel.allergy}</span>}
                          <span className={'tag ' + (sel.status === '待诊' ? 'tag-warn' : 'tag-ok')}>{sel.status}</span>
                        </div>
                        <div className="pt-sub">{sel.card} · 病案号 {sel.mrn} · {sel.ins} · 身份证 {sel.idMasked}</div>
                      </div>
                    </div>
                    <div className="pt-info">
                      <div><div className="k">就诊科室</div>{sel.dept || '—'}</div>
                      <div><div className="k">接诊医生</div>{sel.doctor || '—'}</div>
                      <div><div className="k">体温 / 脉搏</div>{sel.temp ?? '—'} ℃ / {sel.pulse ?? '—'} 次</div>
                      <div><div className="k">血压</div>{sel.bp || '—'} mmHg</div>
                    </div>
                  </div>

                  {lockedView ? (
                    <LockedCard
                      locked={locked} patient={sel} onPrint={printDoc} onVoid={voidRx}
                      isDoctor={isDoctor}
                    />
                  ) : (
                    <div className="card">
                      <div className="tabs">
                        {[['emr', '门诊病历', draft.diags.length], ['rx', '处方', draft.items.length],
                          ['treat', '处置/材料', draft.treatments.length + draft.materials.length],
                          ['apply', '检查检验', draft.labs.length + draft.exams.length],
                          ['history', '历次就诊', '']].map(([k, label, cnt]) => (
                          <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => { setTab(k); if (k === 'history') loadHistory() }}>
                            {label}{cnt !== '' && <span className="cnt">{cnt}</span>}
                          </button>
                        ))}
                      </div>
                      <div className="card-bd">
                        {tab === 'emr' && <EmrTab draft={draft} patch={patch} dicts={dicts} />}
                        {tab === 'rx' && (
                          <RxTab draft={draft} patch={patch} dicts={dicts} review={review} drugByCode={drugByCode}
                            openDrug={() => setModal({ type: 'drug' })}
                            openTemplates={() => setModal({ type: 'template' })}
                            saveTemplate={() => setModal({ type: 'saveTemplate' })} />
                        )}
                        {tab === 'treat' && (
                          <TreatTab draft={draft} patch={patch} dicts={dicts}
                            openTreat={() => setModal({ type: 'treat' })}
                            openMaterial={() => setModal({ type: 'material' })} />
                        )}
                        {tab === 'apply' && <ApplyTab draft={draft} patch={patch} dicts={dicts} />}
                        {tab === 'history' && <HistoryTab history={history} dicts={dicts} patient={sel} />}
                      </div>
                    </div>
                  )}

                  {!lockedView && (
                    <div className="card" style={{ padding: '14px 16px' }}>
                      <div className="between" style={{ gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div className="tiny muted">本次费用（服务端按字典单价核算）</div>
                          <div className="money">¥{review.total.toFixed(2)}</div>
                          <div className="tiny muted">药品 {draft.items.length} · 处置 {draft.treatments.length} · 材料 {draft.materials.length} · 检验 {draft.labs.length} · 检查 {draft.exams.length}</div>
                        </div>
                        <div className="flex gap8" style={{ flexWrap: 'wrap' }}>
                          <button className="btn btn-sm" onClick={() => printDoc('record')}>打印病历</button>
                          <button className="btn btn-sm" onClick={() => printDoc('rx')}>打印处方</button>
                          <button className="btn btn-sm" onClick={() => printDoc('apply')}>打印申请单</button>
                          {isDoctor && <button className="btn btn-primary btn-sm" disabled={busy} onClick={submitVisit}>{busy ? '提交中…' : '提交并锁定'}</button>}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ---------------- 弹层 ---------------- */}
      {modal?.type === 'drug' && (
        <Modal title="选择药品（药品字典）" width={640} onClose={() => setModal(null)}>
          <DrugPicker dicts={dicts} onPick={(d) => {
            patch({ items: [...draft.items, { code: d.code, qty: 1, days: 3, freq: 'bid', dosePer: d.maxDose ? Number((d.maxDose / 2).toFixed(2)) : 1, usage: d.usage }] })
            setModal(null)
          }} />
        </Modal>
      )}
      {modal?.type === 'treat' && (
        <Modal title="选择治疗处置" width={560} onClose={() => setModal(null)}>
          {dicts.treatments.map((t) => (
            <button key={t.code} className="pick" onClick={() => { patch({ treatments: [...draft.treatments, { code: t.code, qty: 1 }] }); setModal(null) }}>
              <span style={{ flex: 1 }}><span className="nm">{t.name}</span><span className="sub" style={{ display: 'block' }}>¥{t.price.toFixed(2)} / {t.unit} · 医保{t.ins}</span></span>
            </button>
          ))}
        </Modal>
      )}
      {modal?.type === 'material' && (
        <Modal title="选择卫生材料" width={560} onClose={() => setModal(null)}>
          {dicts.materials.map((m) => (
            <button key={m.code} className="pick" onClick={() => { patch({ materials: [...draft.materials, { code: m.code, qty: 1 }] }); setModal(null) }}>
              <span style={{ flex: 1 }}><span className="nm">{m.name}</span><span className="sub" style={{ display: 'block' }}>{m.spec} · ¥{m.price.toFixed(2)} / {m.unit}</span></span>
            </button>
          ))}
        </Modal>
      )}
      {modal?.type === 'template' && (
        <Modal title="套用医嘱模板" width={560} onClose={() => setModal(null)}>
          {templates.length === 0 && <div className="empty">暂无模板</div>}
          {templates.map((t) => (
            <button key={t.id} className="pick" onClick={() => applyTemplate(t)}>
              <span style={{ flex: 1 }}><span className="nm">{t.name}</span><span className="sub" style={{ display: 'block' }}>{t.dept} · {t.items.length} 项 · {t.note}</span></span>
            </button>
          ))}
        </Modal>
      )}
      {modal?.type === 'saveTemplate' && <SaveTemplateModal onClose={() => setModal(null)} onSave={saveTemplate} />}
      {modal?.type === 'void' && <VoidModal modal={modal} onClose={() => setModal(null)} />}
      {modal?.type === 'confirm' && (
        <Modal title={modal.title} width={440} onClose={() => setModal(null)}
          footer={<><button className="btn" onClick={() => setModal(null)}>取消</button><button className="btn btn-primary" onClick={() => { setModal(null); modal.onOk() }}>确定</button></>}>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--ink-2)' }}>{modal.text}</div>
        </Modal>
      )}
      {modal?.type === 'info' && (
        <Modal title={modal.title} width={460} onClose={() => setModal(null)}
          footer={<button className="btn btn-primary" onClick={() => setModal(null)}>知道了</button>}>
          <div className="alert alert-danger">{modal.text}</div>
        </Modal>
      )}
      {modal?.type === 'audit' && <AuditModal onClose={() => setModal(null)} />}
      {modal?.type === 'import' && <ImportModal onClose={() => setModal(null)} notify={notify} />}
      {modal?.type === 'triage' && <TriageModal onClose={() => setModal(null)} notify={notify} />}

      {toast && (
        <div style={{ position: 'fixed', right: 18, top: 18, zIndex: 120, background: '#fff', border: '1px solid var(--line-2)', boxShadow: 'var(--shadow)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}
          className={'alert-' + (toast.tone || 'ok')}>
          {toast.text}
        </div>
      )}
    </div>
  )

  function loadHistory() {
    if (!sel) return
    api.history(sel.id).then(setHistory).catch(() => {})
  }

  function openAudit() {
    api.audit().then((rows) => setModal({ type: 'audit', rows })).catch((e) => notify(e.message, 'danger'))
  }
}

/* ================================================================== 子组件 */

function EmrTab({ draft, patch, dicts }) {
  return (
    <div>
      <div className="field">
        <label>主诉 <span style={{ color: 'var(--danger)' }}>*</span></label>
        <textarea className="textarea" style={{ minHeight: 46 }} value={draft.complaint} onChange={(e) => patch({ complaint: e.target.value })} placeholder="主诉" />
      </div>
      <div className="field">
        <label>现病史</label>
        <textarea className="textarea" value={draft.present} onChange={(e) => patch({ present: e.target.value })} placeholder="起病时间、症状演变、伴随症状、诊疗经过…" />
      </div>
      <div className="field">
        <label>既往史 / 过敏史</label>
        <textarea className="textarea" value={draft.past} onChange={(e) => patch({ past: e.target.value })} placeholder="既往史、过敏史、手术史、家族史…" />
      </div>
      <div className="field">
        <label>体格检查</label>
        <input className="input" value={draft.exam} onChange={(e) => patch({ exam: e.target.value })} placeholder="咽部、双肺呼吸音、心律、腹部…" />
      </div>

      <div className="between" style={{ margin: '4px 0 8px' }}>
        <label style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>诊断（ICD-10）<span style={{ color: 'var(--danger)' }}> *</span></label>
        <div className="flex gap8">
          <select className="select" style={{ width: 280 }} value="" onChange={(e) => {
            const code = e.target.value
            if (!code) return
            if (draft.diags.includes(code)) return
            patch({ diags: [...draft.diags, code] })
          }}>
            <option value="">— 选择诊断 —</option>
            {dicts.icd.map((i) => <option key={i.code} value={i.code}>{i.code} {i.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap6" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
        {draft.diags.length === 0 && <span className="tiny muted">尚未下达诊断（提交前至少一条）</span>}
        {draft.diags.map((c) => (
          <span key={c} className="tag tag-brand">
            {dicts.icd.find((i) => i.code === c)?.name || c}（{c}）
            <button style={{ color: 'inherit', marginLeft: 4 }} onClick={() => patch({ diags: draft.diags.filter((x) => x !== c) })}>×</button>
          </span>
        ))}
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label>医嘱备注</label>
        <input className="input" value={draft.note} onChange={(e) => patch({ note: e.target.value })} placeholder="注意事项（所有医嘱均支持备注）" />
      </div>
    </div>
  )
}

function RxTab({ draft, patch, dicts, review, drugByCode, openDrug, openTemplates, saveTemplate }) {
  const setItem = (idx, key, value) => {
    const items = draft.items.slice()
    items[idx] = { ...items[idx], [key]: value }
    patch({ items })
  }
  return (
    <div>
      <div className="between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <span className="small muted">处方明细 · {draft.items.length} 项</span>
        <div className="flex gap6">
          <button className="btn btn-sm btn-primary" onClick={openDrug}>添加药品</button>
          <button className="btn btn-sm" onClick={openTemplates}>套用模板</button>
          <button className="btn btn-sm" onClick={saveTemplate}>存为模板</button>
        </div>
      </div>

      {draft.items.length === 0 ? <div className="empty">尚未开具药品</div> : (
        <div style={{ overflow: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>药品 / 规格</th><th style={{ width: 94 }}>单次剂量</th><th style={{ width: 118 }}>频次</th><th style={{ width: 66 }}>天数</th><th style={{ width: 66 }}>数量</th><th style={{ width: 84 }}>金额</th><th /></tr></thead>
            <tbody>
              {draft.items.map((it, idx) => {
                const d = drugByCode[it.code] || {}
                return (
                  <tr key={it.code + idx}>
                    <td><div className="cell-main">{d.name}</div><div className="cell-sub">{d.spec} · ¥{(d.price || 0).toFixed(2)} · 库存 {d.stock}</div></td>
                    <td>
                      <input className="input" style={{ height: 30 }} value={it.dosePer ?? ''} onChange={(e) => setItem(idx, 'dosePer', Number(e.target.value) || 0)} />
                      <div className="tiny muted">{d.doseUnit}</div>
                    </td>
                    <td>
                      <select className="select" style={{ height: 30 }} value={it.freq} onChange={(e) => setItem(idx, 'freq', e.target.value)}>
                        {FREQ.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
                      </select>
                    </td>
                    <td><input className="input" style={{ height: 30 }} value={it.days} onChange={(e) => setItem(idx, 'days', Number(e.target.value) || 0)} /></td>
                    <td><input className="input" style={{ height: 30 }} value={it.qty} onChange={(e) => setItem(idx, 'qty', Number(e.target.value) || 0)} /></td>
                    <td className="num">¥{((d.price || 0) * it.qty).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-xs btn-ghost" onClick={() => patch({ items: draft.items.filter((_, i) => i !== idx) })}>删</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <div className="small muted" style={{ marginBottom: 7 }}>合理用药审查</div>
        {review.issues.length === 0
          ? <div className="alert alert-ok">审查通过：过敏史、相互作用、剂量、重复用药均未发现异常。</div>
          : review.issues.map((i, k) => <div key={k} className={'alert alert-' + (i.level === 'danger' ? 'danger' : 'warn')}><b>{i.title}</b>　{i.text}</div>)}
        <div className="tiny muted">依据：过敏类别 / 两两相互作用 / 日剂量上限 / 同通用名重复用药。</div>
      </div>
    </div>
  )
}

function TreatTab({ draft, patch, dicts, openTreat, openMaterial }) {
  const rows = (list, dict, key, kind) => (
    <table className="tbl" style={{ marginBottom: 12 }}>
      <tbody>
        {list.length === 0 && <tr><td className="muted small">未添加</td></tr>}
        {list.map((it, idx) => {
          const d = dict.find((x) => x.code === it.code) || {}
          return (
            <tr key={kind + idx}>
              <td><div className="cell-main">{d.name}</div><div className="cell-sub">{d.spec || d.unit} · 医保{d.ins}</div></td>
              <td className="num" style={{ width: 80 }}>¥{(d.price || 0).toFixed(2)}</td>
              <td style={{ width: 90 }}>
                <input className="input" style={{ height: 30 }} value={it.qty} onChange={(e) => {
                  const arr = draft[kind].slice(); arr[idx] = { ...it, qty: Number(e.target.value) || 1 }
                  patch({ [kind]: arr })
                }} />
              </td>
              <td className="num" style={{ width: 90 }}>¥{((d.price || 0) * it.qty).toFixed(2)}</td>
              <td style={{ width: 50, textAlign: 'right' }}>
                <button className="btn btn-xs btn-ghost" onClick={() => patch({ [kind]: draft[kind].filter((_, i) => i !== idx) })}>删</button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
  return (
    <div>
      <div className="between" style={{ marginBottom: 8 }}>
        <span className="small muted">治疗处置</span>
        <button className="btn btn-sm" onClick={openTreat}>添加处置</button>
      </div>
      {rows(draft.treatments, dicts.treatments, 'treatments', 'treatments')}
      <div className="between" style={{ marginBottom: 8 }}>
        <span className="small muted">卫生材料</span>
        <button className="btn btn-sm" onClick={openMaterial}>添加材料</button>
      </div>
      {rows(draft.materials, dicts.materials, 'materials', 'materials')}
      <div className="tiny muted">提交后处置与材料随病历传送至收费与执行科室。</div>
    </div>
  )
}

function ApplyTab({ draft, patch, dicts }) {
  const [item, setItem] = useState(dicts.examItems[0])
  const [part, setPart] = useState('')
  return (
    <div>
      <div className="small muted" style={{ marginBottom: 8 }}>检验申请（检体：全血）</div>
      <div className="flex gap6" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
        {dicts.labItems.map((l) => {
          const on = draft.labs.includes(l.code)
          return (
            <button key={l.code} className={'btn btn-xs' + (on ? ' btn-primary' : '')} onClick={() => {
              patch({ labs: on ? draft.labs.filter((c) => c !== l.code) : [...draft.labs, l.code] })
            }}>{l.name}{on ? ' ✓' : ''}</button>
          )
        })}
      </div>

      <div className="small muted" style={{ marginBottom: 8 }}>检查申请（需注明检查部位）</div>
      <div className="flex gap6" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
        <select className="select" style={{ width: 220 }} value={item} onChange={(e) => setItem(e.target.value)}>
          {dicts.examItems.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <input className="input" style={{ width: 170 }} placeholder="检查部位" value={part} onChange={(e) => setPart(e.target.value)} />
        <button className="btn btn-sm" onClick={() => {
          if (!part.trim()) return
          patch({ exams: [...draft.exams, { item, part: part.trim() }] }); setPart('')
        }}>添加检查</button>
      </div>
      {draft.exams.map((e, i) => (
        <div key={i} className="between" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', marginBottom: 6 }}>
          <span className="small"><b>{e.item}</b> · 部位 {e.part}</span>
          <button className="btn btn-xs btn-ghost" onClick={() => patch({ exams: draft.exams.filter((_, k) => k !== i) })}>移除</button>
        </div>
      ))}
      <div className="tiny muted" style={{ marginTop: 8 }}>提交后申请单自动传送至检验科 / 影像科队列（第三章条款 11）。</div>
    </div>
  )
}

function HistoryTab({ history, dicts, patient }) {
  const [code, setCode] = useState('L01')
  const [trend, setTrend] = useState(null)
  useEffect(() => {
    if (!history) return
    api.trend(patient.id, code).then(setTrend).catch(() => {})
  }, [code, history, patient.id])

  if (!history) return <div className="empty">加载中…</div>
  const visits = history.visits || []
  return (
    <div>
      <div className="small muted" style={{ marginBottom: 8 }}>历次就诊</div>
      {visits.length === 0 ? <div className="empty">暂无历史就诊</div> : (
        <table className="tbl" style={{ marginBottom: 16 }}>
          <thead><tr><th>日期</th><th>科室</th><th>诊断</th><th>费用</th><th>状态</th></tr></thead>
          <tbody>
            {visits.map((v) => (
              <tr key={v.id}>
                <td className="num">{v.date}</td><td>{v.dept}</td>
                <td>{v.diagnosis}</td><td className="num">¥{v.total.toFixed(2)}</td>
                <td><span className="tag tag-ok">{v.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="between" style={{ marginBottom: 8 }}>
        <span className="small muted">检验结果比较</span>
        <select className="select" style={{ width: 220 }} value={code} onChange={(e) => setCode(e.target.value)}>
          {dicts.labItems.map((l) => <option key={l.code} value={l.code}>{l.name}（{l.short}）</option>)}
        </select>
      </div>
      {!trend || trend.points.length === 0 ? <div className="muted small">该患者暂无此项目结果</div> : (
        <div>
          {trend.points.map((p, i) => {
            const over = p.v > trend.item.hi, low = p.v < trend.item.lo
            return (
              <div key={i} className="flex gap8" style={{ marginBottom: 6 }}>
                <span className="mono tiny muted" style={{ width: 84 }}>{p.date}</span>
                <span className={'bar ' + (over ? 'danger' : low ? 'warn' : '')} style={{ flex: 1 }}>
                  <i style={{ width: Math.max(10, Math.min(100, (p.v / (trend.item.hi * 1.6)) * 100)) + '%' }} />
                </span>
                <span className="mono small" style={{ width: 84, textAlign: 'right' }}>{p.v} {trend.item.unit}</span>
              </div>
            )
          })}
          <div className="tiny muted">参考范围 {trend.item.lo} - {trend.item.hi} {trend.item.unit}（{trend.points.length} 次记录）</div>
        </div>
      )}
    </div>
  )
}

function LockedCard({ locked, patient, onPrint, onVoid, isDoctor }) {
  const { visit, prescription, labs = [], exams = [] } = locked
  return (
    <div className="card">
      <div className="card-hd">
        <h3>本次就诊记录（已锁定）</h3>
        <span className="tag tag-ok">确认后不可更改</span>
      </div>
      <div className="card-bd">
        <div className="alert alert-ok">
          病历与处方已提交并锁定，已传送至<b>门诊收费</b>、<b>门诊药房</b>
          {labs.length ? '、检验科' : ''}{exams.length ? '、影像科' : ''}。
        </div>
        <div className="pt-info" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 10 }}>
          <div><div className="k">就诊号</div><span className="mono">{visit.id}</span></div>
          <div><div className="k">诊断</div>{visit.diagnosis}</div>
          <div><div className="k">费用合计</div><span className="mono">¥{visit.total.toFixed(2)}</span></div>
          <div><div className="k">处方号</div>{prescription ? <span className="mono">{prescription.id}</span> : '无药品处方'}</div>
          <div><div className="k">处方状态</div>{prescription ? <span className={'tag ' + (prescription.status === '待收费' ? 'tag-warn' : 'tag-danger')}>{prescription.status}</span> : '—'}</div>
          <div><div className="k">检验 / 检查</div>{labs.length} 份 / {exams.length} 份</div>
        </div>
        <div className="flex gap8" style={{ marginTop: 14, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={() => onPrint('rx')}>打印处方</button>
          <button className="btn btn-sm" onClick={() => onPrint('record')}>打印病历</button>
          {isDoctor && prescription?.status === '待收费' && (
            <button className="btn btn-sm btn-danger" onClick={onVoid}>作废处方</button>
          )}
        </div>
        {prescription?.voidReason && <div className="alert alert-warn" style={{ marginTop: 10 }}>作废原因：{prescription.voidReason}</div>}
      </div>
    </div>
  )
}

function DrugPicker({ dicts, onPick }) {
  const [q, setQ] = useState('')
  const rows = dicts.drugs.filter((d) => !q || (d.name + d.generic + d.code + (d.trade || '')).toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <input className="input" placeholder="输入药品名 / 别名 / 编码…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="pick-list" style={{ marginTop: 10 }}>
        {rows.map((d) => (
          <button key={d.code} className="pick" onClick={() => onPick(d)}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="nm">{d.name} <span className="tag">{d.form}</span>{d.ins === '甲' && <span className="tag tag-ok">甲类</span>}</span>
              <span className="sub" style={{ display: 'block' }}>{d.spec} · ¥{d.price.toFixed(2)} · 库存 {d.stock}</span>
            </span>
          </button>
        ))}
        {rows.length === 0 && <div className="empty">无匹配药品</div>}
      </div>
    </div>
  )
}

function SaveTemplateModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  return (
    <Modal title="保存为医嘱模板" width={460} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>取消</button>
        <button className="btn btn-primary" onClick={() => name.trim() && onSave(name.trim())}>保存</button></>}>
      <div className="field"><label>模板名称</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
    </Modal>
  )
}

function VoidModal({ modal, onClose }) {
  const [reason, setReason] = useState('')
  return (
    <Modal title={modal.title} width={460} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>取消</button>
        <button className="btn btn-danger" onClick={() => reason.trim() && modal.onOk(reason.trim())}>确认作废</button></>}>
      <div className="field"><label>作废原因</label>
        <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：患者要求换药 / 诊断调整" />
      </div>
    </Modal>
  )
}

function AuditModal({ onClose }) {
  const [rows, setRows] = useState([])
  const [who, setWho] = useState('')
  useEffect(() => { api.audit({ username: who }).then(setRows).catch(() => {}) }, [who])
  return (
    <Modal title="操作审计日志" width={880} onClose={onClose} footer={<button className="btn" onClick={onClose}>关闭</button>}>
      <div className="flex gap8" style={{ marginBottom: 10 }}>
        <select className="select" style={{ width: 160 }} value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">全部用户</option><option value="doctor">doctor</option><option value="admin">admin</option>
        </select>
        <span className="tiny muted">共 {rows.length} 条，按时间倒序</span>
      </div>
      <div style={{ maxHeight: 420, overflow: 'auto' }}>
        <table className="tbl">
          <thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>对象</th><th>详情</th><th>IP</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono tiny">{r.time}</td>
                <td><div className="cell-main">{r.name}</div><div className="cell-sub">{r.username} · {r.role}</div></td>
                <td><span className={'tag ' + (/越权|失败/.test(r.action) ? 'tag-danger' : 'tag-brand')}>{r.action}</span></td>
                <td className="mono tiny">{r.objectId || '—'}<div className="cell-sub">{r.objectType}</div></td>
                <td className="small">{r.detail}</td>
                <td className="mono tiny">{r.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

function ImportModal({ onClose, notify }) {
  const [file, setFile] = useState(null)
  const [encoding, setEncoding] = useState('utf-8')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    if (!file) return
    setBusy(true)
    try {
      const res = await api.importCsv(file, encoding)
      setResult(res)
      notify(`导入完成：成功 ${res.success} 条，失败 ${res.failed.length} 条`)
    } catch (e) {
      notify(e.message, 'danger')
    } finally { setBusy(false) }
  }

  return (
    <Modal title="药品批量导入（CSV）" width={720} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>关闭</button><button className="btn btn-primary" disabled={!file || busy} onClick={run}>{busy ? '导入中…' : '开始导入'}</button></>}>
      <div className="alert alert-info">列顺序：通用名,商品名,规格,剂型,单价,医保类别(甲/乙/自费),库存数量。错误行不影响合法行，同通用名同规格自动跳过。</div>
      <div className="flex gap8" style={{ margin: '10px 0' }}>
        <select className="select" style={{ width: 120 }} value={encoding} onChange={(e) => setEncoding(e.target.value)}>
          <option value="utf-8">UTF-8</option><option value="gbk">GBK</option>
        </select>
        <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files[0] || null)} />
      </div>
      {result && (
        <div>
          <div className="kpis" style={{ marginTop: 8 }}>
            <div className="kpi"><div className="l">成功入库</div><div className="v" style={{ color: 'var(--ok)' }}>{result.success}</div></div>
            <div className="kpi"><div className="l">失败行</div><div className="v" style={{ color: 'var(--danger)' }}>{result.failed.length}</div></div>
            <div className="kpi"><div className="l">重复跳过</div><div className="v" style={{ color: 'var(--warn)' }}>{result.duplicates.length}</div></div>
          </div>
          {result.failed.length > 0 && (
            <table className="tbl">
              <thead><tr><th>行号</th><th>原始内容</th><th>失败原因</th></tr></thead>
              <tbody>{result.failed.map((f) => <tr key={f.line}><td className="mono">{f.line}</td><td className="tiny">{f.raw}</td><td style={{ color: 'var(--danger)' }}>{f.reason}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}
    </Modal>
  )
}

function TriageModal({ onClose, notify }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  async function run() {
    if (!text.trim()) return notify('请先描述症状', 'warn')
    setBusy(true)
    try { setResult(await api.triage(text)) } catch (e) { notify(e.message, 'danger') } finally { setBusy(false) }
  }
  return (
    <Modal title="智能分诊助手（AI 辅助）" width={620} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>关闭</button><button className="btn btn-primary" disabled={busy} onClick={run}>{busy ? '分诊中…' : '开始分诊'}</button></>}>
      <div className="alert alert-warn"><b>伦理红线：</b>AI 只能辅助，不能决策。结果仅供参考，需医生确认；本页不做诊断、不开处方。</div>
      <textarea className="textarea" placeholder="例如：肚子疼、发烧 38.5℃，伴恶心呕吐 2 天" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex gap6" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        {['肚子疼、发烧', '胸闷心悸、出冷汗', '咳嗽咳痰一周', '小孩发热 39℃'].map((t) => (
          <button key={t} className="btn btn-xs" onClick={() => setText(t)}>{t}</button>
        ))}
      </div>
      {result && (
        <div style={{ marginTop: 14 }}>
          <div className="between">
            <div><div className="tiny muted">建议科室</div><div style={{ fontSize: 20, fontWeight: 700 }}>{result.dept}</div></div>
            <span className={'tag ' + (result.urgency === '急诊' ? 'tag-danger' : result.urgency === '尽快' ? 'tag-warn' : 'tag-ok')}>紧急程度：{result.urgency}</span>
          </div>
          <p className="small ink2" style={{ marginTop: 10, lineHeight: 1.8 }}>{result.notes}</p>
          <div className="alert alert-warn" style={{ marginTop: 10 }}>{result.disclaimer}</div>
          <div className="tiny muted">结果来源：{result.source}{result.source === 'fallback' ? '（AI 不可用，已降级）' : result.source === 'local-rule' ? '（本地规则库）' : '（大模型）'}</div>
        </div>
      )}
    </Modal>
  )
}

