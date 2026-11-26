const BASE = import.meta.env.VITE_API_BASE || ''
const KEY = 'his.token'

export function getToken() {
  return localStorage.getItem(KEY) || ''
}
export function setToken(t) {
  if (t) localStorage.setItem(KEY, t)
  else localStorage.removeItem(KEY)
}

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) payload = form
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(BASE + path, { method, headers, body: payload })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { detail: text } }
  if (!res.ok) {
    const err = new Error((data && data.detail) || `请求失败（${res.status}）`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export const api = {
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),
  me: () => request('/api/auth/me'),
  dicts: () => request('/api/dicts'),
  patients: (status) => request(`/api/patients${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  patient: (id) => request(`/api/patients/${id}`),
  history: (id) => request(`/api/patients/${id}/history`),
  trend: (id, code) => request(`/api/patients/${id}/trend?code=${encodeURIComponent(code)}`),
  review: (payload) => request('/api/review', { method: 'POST', body: payload }),
  createVisit: (payload) => request('/api/visits', { method: 'POST', body: payload }),
  voidRx: (id, reason) => request(`/api/prescriptions/${id}/void`, { method: 'POST', body: { reason } }),
  templates: () => request('/api/templates'),
  saveTemplate: (payload) => request('/api/templates', { method: 'POST', body: payload }),
  deleteTemplate: (id) => request(`/api/templates/${id}`, { method: 'DELETE' }),
  dashboard: () => request('/api/dashboard'),
  audit: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
    return request(`/api/admin/audit${q ? `?${q}` : ''}`)
  },
  importCsv: (file, encoding) => {
    const fd = new FormData()
    fd.append('file', file)
    return request(`/api/admin/drugs/import?encoding=${encoding}`, { method: 'POST', form: fd })
  },
  triage: (symptoms) => request('/api/triage', { method: 'POST', body: { symptoms } }),
  aiStatus: () => request('/api/ai/status'),
  assistant: (question, patientId) =>
    request('/api/assistant', { method: 'POST', body: { question, patientId: patientId || null } }),
}
