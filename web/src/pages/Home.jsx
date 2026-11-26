import { useEffect, useRef, useState } from 'react'
import './home.css'

const FEATURES = [
  ['自动获取信息', '患者、诊疗、医生、费用、用药五类信息自动带入，减少重复录入。'],
  ['九类诊疗动作', '病历、检查、检验、诊断、处方、处置、材料、手术、收入院。'],
  ['处方自动监测', '过敏、相互作用、剂量、禁忌、重复用药五维实时提示。'],
  ['字典与模板', '药品字典检索；科室模板套用、保存与删除。'],
  ['完整性与锁定', '缺主诉/诊断/明细不可提交；提交后锁定，只能作废重开。'],
  ['医嘱备注', '病历备注与处方用法，随打印文书一并输出。'],
  ['历次就诊比较', '历史诊断、处方、费用；检验结果趋势与参考范围着色。'],
  ['费用自动核算', '服务端按字典单价计算，前端改价无效；标注医保类别。'],
  ['处方与申请单打印', '处方笺、门诊病历、检验检查申请单，含医师签名栏。'],
  ['医生权限管理', '医生可开方，管理员只读；越权返回 403 并写审计。'],
  ['信息自动传送', '提交后生成待收费处方、待采样检验、待检查影像。'],
]

const FLOW = [
  ['01', '接诊', '候诊队列选患者，基本信息自动带出'],
  ['02', '病历', '主诉、现病史、既往史、体格检查'],
  ['03', '诊断', 'ICD-10 编码，多诊断可增删'],
  ['04', '处方', '药品/处置/材料，实时划价'],
  ['05', '审查', '五维用药检查，分级提示'],
  ['06', '提交', '事务写入、锁定、传送、可打印'],
]

export default function Home({ user, onStart }) {
  const [hits, setHits] = useState(0)
  const ref = useRef(null)
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  useEffect(() => {
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in') })
    }, { threshold: 0.12 })
    ref.current?.querySelectorAll('.hp-reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const t = setInterval(() => setHits((n) => (n < 24 ? n + 1 : n)), 40)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="hp" ref={ref}>
      <div className="hp-aurora"><i /><i /><i /></div>

      <header className="hp-nav">
        <a className="hp-logo" href="#/">
          <span className="mark">＋</span>
          <span>门诊医生工作站<small>OUTPATIENT · HIS</small></span>
        </a>
        <nav className="hp-links">
          <button onClick={() => scrollTo('features')}>功能</button>
          <button onClick={() => scrollTo('flow')}>就诊闭环</button>
          <button onClick={() => scrollTo('stack')}>技术</button>
        </nav>
        <div className="hp-nav-cta">
          {user ? (
            <button className="btn btn-primary btn-sm" onClick={onStart}>进入工作台</button>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={onStart}>登录</button>
              <button className="btn btn-primary btn-sm" onClick={onStart}>进入系统</button>
            </>
          )}
        </div>
      </header>

      <section className="hp-hero">
        <div className="hp-hero-l">
          <div className="hp-badge"><i /> 依据《医院信息系统基本功能规范》第三章</div>
          <h1>
            一次门诊，<span className="grad">从接诊到处方</span><br />
            <span className="thin">在同一张病历上完成</span>
          </h1>
          <p className="hp-lead">
            病历、ICD-10 诊断、处方、处置、卫生材料、检验检查申请、合理用药审查、历次结果比较与打印传送——
            按规范第三条第 1～11 款逐条落地，提交即锁定并留痕。
          </p>
          <div className="hp-actions">
            <button className="btn btn-primary btn-lg" onClick={onStart}>
              {user ? '进入工作台' : '登录并接诊'}
              <span aria-hidden>→</span>
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => scrollTo('features')}>看看能做什么</button>
          </div>
          <div className="hp-meta">
            <div><b>11</b><span>规范功能条目</span></div>
            <div><b>{String(hits).padStart(2, '0')}</b><span>ICD-10 诊断</span></div>
            <div><b>19</b><span>药品字典</span></div>
            <div><b>5</b><span>用药审查维度</span></div>
          </div>
        </div>

        <div className="hp-hero-r">
          <div className="hp-card">
            <div className="hp-card-hd">
              <div className="hp-avatar">张</div>
              <div>
                <b>张建国 · 男 · 63岁</b>
                <span>就诊卡 C88001231 · 职工医保</span>
              </div>
              <em className="hp-tag danger">发热待查</em>
            </div>
            <svg className="hp-ecg" viewBox="0 0 520 84" preserveAspectRatio="none">
              <defs>
                <linearGradient id="hpEcg" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0f9d92" />
                  <stop offset="60%" stopColor="#0b7fd0" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
              </defs>
              <path d="M0,44 L40,44 L48,36 L54,44 L96,44 L104,50 L110,14 L116,58 L122,44 L180,44 L190,34 L204,50 L214,44 L270,44 L280,50 L287,16 L294,60 L301,44 L360,44 L372,34 L384,50 L394,44 L450,44 L460,50 L467,18 L474,58 L481,44 L520,44" />
            </svg>
            <div className="hp-vitals">
              <div><span>TEMP</span><b>38.6<em>℃</em></b></div>
              <div><span>PULSE</span><b>96<em>bpm</em></b></div>
              <div><span>NIBP</span><b>148/92</b></div>
              <div><span>SpO₂</span><b>96<em>%</em></b></div>
            </div>
            <div className="hp-card-ft">
              <span>WBC 13.6 ↑ · CRP 42.8 ↑</span>
              <span>2 分钟前</span>
            </div>
          </div>
          <div className="hp-hint">
            <span className="ok">✓</span>
            <div><b>审查已拦截 1 条</b><small>头孢曲松 × 葡萄糖酸钙 · 配伍禁忌</small></div>
          </div>
        </div>
      </section>

      <section className="hp-stats hp-reveal">
        <div><b>11</b><span>规范功能条目</span></div>
        <div><b>2</b><span>角色（医生 / 管理员）</span></div>
        <div><b>19</b><span>pytest 用例全绿</span></div>
        <div><b>100%</b><span>离线可运行</span></div>
      </section>

      <section className="hp-sec" id="features">
        <div className="hp-sec-hd hp-reveal">
          <p className="eyebrow">Chapter 3</p>
          <h2>11 条功能，逐条落地</h2>
          <p>不是"能点"，而是每条都能在系统里找到动作、数据变化与留痕。</p>
        </div>
        <div className="hp-grid">
          {FEATURES.map(([t, d], i) => (
            <article className="hp-feat hp-reveal" key={t}>
              <span className="num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="hp-sec" id="flow">
        <div className="hp-sec-hd hp-reveal">
          <p className="eyebrow">Workflow</p>
          <h2>一条主线，六步走完</h2>
          <p>每一步都有校验：缺项不让提交、金额服务端算、提交即锁定。</p>
        </div>
        <div className="hp-flow">
          {FLOW.map(([n, t, d]) => (
            <div className="hp-step hp-reveal" key={n}>
              <span className="n">{n}</span>
              <b>{t}</b>
              <small>{d}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="hp-sec" id="stack">
        <div className="hp-stack hp-reveal">
          <div>
            <p className="eyebrow">Engineering</p>
            <h2>按课程要求的技术栈交付</h2>
            <p className="hp-muted">
              React + Vite 前端、FastAPI + SQLite 后端、pytest 测试、Docker Compose 部署、GitHub Actions CI。
              认证、RBAC、事务、审计、批量导入与智能分诊都在里面。
            </p>
          </div>
          <ul className="hp-chips">
            <li>React 18</li><li>Vite 5</li><li>FastAPI</li><li>SQLAlchemy</li>
            <li>SQLite</li><li>JWT + bcrypt</li><li>pytest</li><li>Docker</li>
          </ul>
        </div>
      </section>

      <section className="hp-cta hp-reveal">
        <h2>用真实数据走一遍门诊</h2>
        <p>7 位患者、19 种药品、3 次历史就诊已就绪。写病历、下诊断、开处方，看审查与金额如何实时变化。</p>
        <div className="hp-actions center">
          <button className="btn btn-primary btn-lg" onClick={onStart}>进入系统</button>
          <button className="btn btn-ghost btn-lg" onClick={() => scrollTo('features')}>查看功能</button>
        </div>
      </section>

      <footer className="hp-foot">
        <span>© 2026 门诊医生工作站</span>
        <span className="hp-muted">医生 doctor / Doctor@123 · 管理员 admin / Admin@123</span>
      </footer>
    </div>
  )
}
