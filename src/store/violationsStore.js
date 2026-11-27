import { create } from 'zustand'
import { api } from '../api/client.js'

let latestLoadId = 0

export const INITIAL_VIOLATION_FILTERS = {
  search: '',
  type: [],
  status: [],
  appealPending: false,
  sort: 'recent',
  pageSize: 100,
}

export const violationsStore = create((set, get) => ({
  status: 'idle',
  error: null,
  page: 1,
  total: 0,
  items: [],
  recordingCount: null,
  filters: INITIAL_VIOLATION_FILTERS,
  selectedCode: null,
  violationsTickBadge: 0,

  reset() {
    latestLoadId += 1
    set({
      status: 'idle',
      error: null,
      page: 1,
      total: 0,
      items: [],
      recordingCount: null,
      filters: INITIAL_VIOLATION_FILTERS,
      selectedCode: null,
      violationsTickBadge: 0,
    })
  },

  async load({ silent = false } = {}) {
    const { filters, page } = get()
    const loadId = ++latestLoadId
    if (!silent) set({ status: 'loading', error: null })
    try {
      const data = await api.getViolations({
        search: filters.search,
        type: filters.type,
        status: filters.status,
        appeal: filters.appealPending ? ['pendiente'] : [],
        sort: filters.sort,
        page,
        pageSize: filters.pageSize,
      })
      if (loadId !== latestLoadId) return
      set({
        items: data.items,
        total: data.total,
        page: data.page,
        status: 'ready',
        error: null,
        recordingCount: data.total,
      })
    } catch (err) {
      if (loadId === latestLoadId) set({ status: 'error', error: err.message })
    }
  },

  setFilters(patch, { resetPage = true } = {}) {
    const { filters } = get()
    const next = { ...filters, ...patch }
    const searchChanged = patch.search !== undefined && patch.search !== filters.search
    set({ filters: next, page: resetPage || searchChanged ? 1 : get().page })
    get().load()
  },

  setSearchTerm(search) {
    get().setFilters({ search })
  },

  setPage(page) {
    set({ page })
    get().load({ silent: true })
  },

  select(code) {
    set({ selectedCode: code })
  },

  replaceViolation(updated) {
    const { items } = get()
    const idx = items.findIndex((v) => v.code === updated.code)
    if (idx === -1) return
    const next = items.slice()
    next[idx] = { ...items[idx], ...updated }
    set({ items: next })
  },

  async markNotified(code) {
    const updated = await api.patchViolationStatus(code, 'notificada')
    get().replaceViolation(updated)
    return updated
  },

  async markPaid(code) {
    const updated = await api.patchViolationStatus(code, 'pagada')
    get().replaceViolation(updated)
    return updated
  },

  async submitAppeal(code, payload) {
    const data = await api.postAppeal(code, payload)
    get().replaceViolation(data.violation)
    return data
  },

  bumpNewBadge() {
    set((s) => ({ violationsTickBadge: s.violationsTickBadge + 1 }))
  },

  resetNewBadge() {
    set({ violationsTickBadge: 0 })
  },
}))
