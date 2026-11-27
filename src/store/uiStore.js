import { create } from 'zustand'
import { CITY } from '../lib/domain.js'

export const TABS = [
  { id: 'control', label: 'Centro de control', hint: '1' },
  { id: 'violations', label: 'Infracciones', hint: '2' },
  { id: 'reports', label: 'Reportes e informes', hint: '3' },
]

export const OPS_FILTER_RESET = { query: '', severity: [], types: [], statuses: [], sources: [] }

export const uiStore = create((set, get) => ({
  tab: 'control',
  zoom: CITY.zoomHome,
  bounds: null,
  boundsKey: '',
  mapReady: false,
  simulatedTiles: false,
  autoSimulated: false,
  layers: { roads: true, incidents: true, cameras: true, districts: true },
  selectedIncidentId: null,
  selectedCameraId: null,
  toasts: [],
  nextToastId: 1,
  helpOpen: false,
  reportOpen: false,
  reportsTab: 'solve',
  opsFilters: OPS_FILTER_RESET,

  setTab(tab) {
    set({ tab })
  },

  setReportsTab(reportsTab) {
    set({ reportsTab })
  },

  resetSession() {
    set({
      tab: 'control',
      zoom: CITY.zoomHome,
      bounds: null,
      boundsKey: '',
      mapReady: false,
      simulatedTiles: false,
      autoSimulated: false,
      layers: { roads: true, incidents: true, cameras: true, districts: true },
      selectedIncidentId: null,
      selectedCameraId: null,
      toasts: [],
      helpOpen: false,
      reportOpen: false,
      reportsTab: 'solve',
      opsFilters: OPS_FILTER_RESET,
    })
  },

  setFilter(patch) {
    set((s) => ({ opsFilters: { ...s.opsFilters, ...patch } }))
  },

  resetFilters() {
    set({ opsFilters: OPS_FILTER_RESET })
  },

  setMapView({ zoom, bounds, boundsKey }) {
    set({ zoom, bounds, boundsKey })
  },

  setMapReady(v) {
    set({ mapReady: v })
  },

  toggleLayer(name) {
    set((s) => ({ layers: { ...s.layers, [name]: !s.layers[name] } }))
  },

  setSimulatedTiles(v, { auto = false } = {}) {
    set((s) => ({ simulatedTiles: v, autoSimulated: v ? auto || s.autoSimulated : false }))
  },

  selectIncident(id) {
    set({ selectedIncidentId: id })
  },

  selectCamera(id) {
    set({ selectedCameraId: id })
  },

  pushToast(toast) {
    const id = get().nextToastId
    const item = { id, ...toast }
    set((s) => ({ toasts: [...s.toasts.slice(-2), item], nextToastId: id + 1 }))
    if (item.timeout !== 0) {
      setTimeout(() => {
        uiStore.getState().dismissToast(id)
      }, item.timeout ?? 5200)
    }
    return id
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  setHelpOpen(open) {
    set({ helpOpen: open })
  },

  setReportOpen(open) {
    set({ reportOpen: open })
  },
}))

export const flyTo = { fn: null }

export function flyToIncident(incident) {
  if (flyTo.fn && incident) flyTo.fn([incident.lat, incident.lng])
  uiStore.getState().selectIncident(incident?.id)
}
