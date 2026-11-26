import { useState } from 'react'
import { api, setToken } from '../api'

const DEMO = [
  { u: 'doctor', p: 'Doctor@123', name: '医生 · 陈志远' },
  { u: 'admin', p: 'Admin@123', name: '管理员 · 王建国' },
]

export default function Login({ onLogin, onHome }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!username || !password) { setError('请输入用户名与密码'); return }
    setBusy(true)
    try {
      const data = await api.login(username.trim(), password)
      setToken(data.token)
      onLogin(data)
    } catch (err) {
      setError(err.status === 403 ? err.message : '用户名或密码错误（401）')
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <section className="login-brand">
        <div className="lb-logo">
          <span className="mark">＋</span>
          <span>门诊医生工作站<small style={{ display: 'block', fontWeight: 400, fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)' }}>HIS · OUTPATIENT</small></span>
        </div>
        <div className="lb-main">
          <h1>从接诊到处方<br /><span>一张病历走完</span></h1>
          <p>依据《医院信息系统基本功能规范》第三章实现：病历、ICD-10 诊断、处方、处置、材料、检验检查申请、合理用药审查、结果比较与打印传送。</p>
          <ul className="lb-list">
            <li><i>01</i> 医生开方 / 管理员只读，越权返回 403</li>
            <li><i>02</i> 口令 bcrypt 哈希，JWT 带角色与过期时间</li>
            <li><i>03</i> 金额服务端计算，提交事务化并锁定</li>
            <li><i>04</i> 操作审计留痕：人、时间、对象、IP</li>
          </ul>
        </div>
        <div className="lb-foot"><span>2026 秋季 · 医院信息系统实验</span><span className="mono">v3.0.0</span></div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <h2>账号登录</h2>
          <p className="sub">请使用医院统一账号登录，登录行为将被记录</p>
          <div className="field">
            <label htmlFor="u">用户名</label>
            <input id="u" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="doctor" />
          </div>
          <div className="field">
            <label htmlFor="p">密码</label>
            <input id="p" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入密码" />
          </div>
          {error && <div className="alert alert-danger" style={{ marginBottom: 10 }}>{error}</div>}
          <button className="btn btn-primary" style={{ width: '100%', height: 42 }} disabled={busy}>{busy ? '登录中…' : '登 录'}</button>

          <div className="demo">
            <div className="demo-title">演示账号（点击填入）</div>
            <div className="demo-grid">
              {DEMO.map((d) => (
                <button type="button" key={d.u} className="demo-item"
                  onClick={() => { setUsername(d.u); setPassword(d.p); setError('') }}>
                  <b>{d.name}</b><span>{d.u}</span>
                </button>
              ))}
            </div>
            <p className="tiny muted" style={{ marginTop: 10, lineHeight: 1.7 }}>
              口令以 bcrypt 哈希存储，仓库内无明文；医生可接诊开方，管理员只读查阅。
            </p>
          </div>
        </form>
      </section>
    </div>
  )
}
