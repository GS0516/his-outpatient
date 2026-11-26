import { useEffect, useState } from 'react'
import Home from './pages/Home'
import Login from './pages/Login'
import Workstation from './pages/Workstation'
import { api, getToken, setToken } from './api'

const current = () => (location.hash.replace(/^#\/?/, '') || '')

export default function App() {
  const [user, setUser] = useState(null)
  const [route, setRoute] = useState(current())
  const [booting, setBooting] = useState(!!getToken())

  useEffect(() => {
    const onHash = () => setRoute(current())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (!getToken()) { setBooting(false); return }
    api.me()
      .then(setUser)
      .catch(() => { setToken(''); setUser(null) })
      .finally(() => setBooting(false))
  }, [])

  /* 已登录访问登录页 → 工作台 */
  useEffect(() => {
    if (route === 'login' && user) location.hash = '#/app'
  }, [route, user])

  /* 未登录访问工作台 → 登录页 */
  useEffect(() => {
    if (route === 'app' && !user && !booting) location.hash = '#/login'
  }, [route, user, booting])

  if (booting) return <div className="boot">正在验证登录状态…</div>

  if (route === 'login') {
    return (
      <Login
        onLogin={(data) => {
          setToken(data.token)
          setUser(data.user)
          location.hash = '#/app'
        }}
        onHome={() => { location.hash = '#/' }}
      />
    )
  }

  if (route === 'app') {
    if (!user) return <div className="boot">正在跳转登录…</div>
    return (
      <Workstation
        user={user}
        onLogout={() => { setToken(''); setUser(null); location.hash = '#/' }}
      />
    )
  }

  return <Home user={user} onStart={() => { location.hash = user ? '#/app' : '#/login' }} />
}
