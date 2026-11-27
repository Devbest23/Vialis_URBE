const TOKEN_KEY = 'vialis.token'
let authToken = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null

export function setAuthToken(token) {
  authToken = token || null
  if (typeof localStorage === 'undefined') return
  if (authToken) localStorage.setItem(TOKEN_KEY, authToken)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getAuthToken() {
  return authToken
}

export class ApiError extends Error {
  constructor(status, message, payload) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

async function request(path, { method = 'GET', body, query, auth = true } = {}) {
  const qs = query ? '?' + new URLSearchParams(cleanQuery(query)).toString() : ''
  let res
  try {
    res = await fetch(`/api${path}${qs}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(auth && authToken ? { authorization: `Bearer ${authToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Verifica que la API esté en ejecución.', null)
  }
  if (!res.ok) {
    let payload = null
    try {
      payload = await res.json()
    } catch {
      payload = null
    }
    if (res.status === 401 && auth && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vialis:unauthorized'))
    }
    throw new ApiError(res.status, payload?.message || `Error HTTP ${res.status}`, payload)
  }
  if (res.status === 204) return null
  return res.json()
}

function cleanQuery(q) {
  return Object.fromEntries(
    Object.entries(q).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== '' &&
        (Array.isArray(value) ? value.length > 0 : true),
    ),
  )
}

export const api = {
  login: (body) => request('/auth/login', { method: 'POST', body, auth: false }),
  register: (body) => request('/auth/register', { method: 'POST', body, auth: false }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getRoads: () => request('/roads'),
  getCameras: () => request('/cameras'),
  getDistricts: () => request('/districts'),
  getIncidents: () => request('/incidents'),
  getIncident: (id) => request(`/incidents/${id}`),
  patchIncidentStatus: (id, status, note) =>
    request(`/incidents/${id}/status`, { method: 'PATCH', body: { status, ...(note ? { note } : {}) } }),
  confirmIncident: (id) => request(`/incidents/${id}/confirm`, { method: 'POST' }),
  getViolations: (params) => request('/violations', { query: params }),
  getViolation: (code) => request(`/violations/${code}`),
  postAppeal: (code, body) => request(`/violations/${code}/appeal`, { method: 'POST', body }),
  patchViolationStatus: (code, status) => request(`/violations/${code}/status`, { method: 'PATCH', body: { status } }),
  postReport: (body) => request('/reports', { method: 'POST', body }),
  getAccidentReport: (range) => request('/reports/accidents', { query: { range } }),
}
