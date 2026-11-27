import { create } from 'zustand'
import { api, getAuthToken, setAuthToken } from '../api/client.js'
import { trafficStore } from './trafficStore.js'
import { violationsStore } from './violationsStore.js'
import { uiStore } from './uiStore.js'

function resetApplicationState() {
  trafficStore.getState().reset()
  violationsStore.getState().reset()
  uiStore.getState().resetSession()
}

const initialToken = getAuthToken()

export const authStore = create((set, get) => ({
  status: initialToken ? 'checking' : 'anonymous',
  token: initialToken,
  user: null,
  error: null,

  async bootstrap() {
    const token = getAuthToken()
    if (!token) {
      set({ status: 'anonymous', token: null, user: null })
      return
    }
    set({ status: 'checking', token, error: null })
    try {
      const data = await api.me()
      set({ status: 'authenticated', token, user: data.user, error: null })
    } catch (err) {
      setAuthToken(null)
      resetApplicationState()
      set({
        status: 'anonymous',
        token: null,
        user: null,
        error: err.status === 401 ? 'Tu sesión expiró. Inicia sesión de nuevo.' : err.message,
      })
    }
  },

  async login({ email, password }) {
    set({ error: null })
    try {
      const data = await api.login({ email, password })
      setAuthToken(data.token)
      set({ status: 'authenticated', token: data.token, user: data.user, error: null })
      return data
    } catch (err) {
      set({ error: err.message })
      throw err
    }
  },

  async register({ name, email, password }) {
    set({ error: null })
    try {
      const data = await api.register({ name, email, password })
      setAuthToken(data.token)
      set({ status: 'authenticated', token: data.token, user: data.user, error: null })
      return data
    } catch (err) {
      set({ error: err.message })
      throw err
    }
  },

  async logout() {
    try {
      await api.logout()
    } catch {
      void 0
    }
    setAuthToken(null)
    resetApplicationState()
    set({ status: 'anonymous', token: null, user: null, error: null })
  },

  handleUnauthorized() {
    if (get().status === 'anonymous') return
    setAuthToken(null)
    resetApplicationState()
    set({
      status: 'anonymous',
      token: null,
      user: null,
      error: 'Tu sesión expiró. Inicia sesión de nuevo.',
    })
  },

  clearError() {
    set({ error: null })
  },
}))

if (typeof window !== 'undefined') {
  window.addEventListener('vialis:unauthorized', () => authStore.getState().handleUnauthorized())
}
