import { useEffect, useState } from 'react'
import Login from './pages/Login'
import Workstation from './pages/Workstation'
import { api, getToken, setToken } from './api'

export default function App() {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(!!getToken())

  useEffect(() => {
    if (!getToken()) return
    api.me()
      .then(setUser)
      .catch(() => setToken(''))
      .finally(() => setBooting(false))
  }, [])

  if (booting) {
    return <div className="boot">正在验证登录状态…</div>
  }

  if (!user) {
    return <Login onLogin={(data) => { setToken(data.token); setUser(data.user) }} />
  }

  return (
    <Workstation
      user={user}
      onLogout={() => { setToken(''); setUser(null) }}
    />
  )
}
