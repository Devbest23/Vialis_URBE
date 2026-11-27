import { create } from 'zustand'
import { api } from '../api/client.js'

let rateRing = []

export const trafficStore = create((set, get) => ({
  status: 'idle',
  error: null,
  roads: [],
  cameras: [],
  districts: [],
  incidents: [],
  serverTime: null,
  stats: { eventsRate: 0, lastPacketAt: null, packets: 0 },
  rateSeries: [],
  feed: [],
  violationsTick: 0,
  telemetryStatus: { connected: false, mode: 'ws', attempts: 0 },

  reset() {
    rateRing = []
    set({
      status: 'idle',
      error: null,
      roads: [],
      cameras: [],
      districts: [],
      incidents: [],
      serverTime: null,
      stats: { eventsRate: 0, lastPacketAt: null, packets: 0 },
      rateSeries: [],
      feed: [],
      violationsTick: 0,
      telemetryStatus: { connected: false, mode: 'ws', attempts: 0 },
    })
  },

  setTelemetryStatus(telemetryStatus) {
    set({ telemetryStatus })
  },

  async loadBase() {
    set((s) => ({ status: s.incidents.length ? 'ready' : 'loading', error: null }))
    try {
      const [roads, cameras, districts, incidents] = await Promise.all([
        api.getRoads(),
        api.getCameras(),
        api.getDistricts(),
        api.getIncidents(),
      ])
      set({
        roads,
        cameras,
        districts,
        incidents: incidents.items,
        serverTime: incidents.serverTime,
        status: 'ready',
      })
    } catch (err) {
      set({ status: 'error', error: err.message })
    }
  },

  applyPacket(packet) {
    if (!packet || !Array.isArray(packet.events) || !packet.events.length) return
    const { incidents, roads, cameras, stats, feed, rateSeries } = get()
    const roadPatches = new Map()
    const incIdToPatch = new Map()
    const camPatches = new Map()
    const newIncidents = []
    const feedEntries = []
    const nowIso = packet.t || new Date().toISOString()
    let sawViolation = false

    for (const ev of packet.events) {
      switch (ev.type) {
        case 'roads.flow':
          for (const u of ev.payload.updates) roadPatches.set(u.id, u)
          break
        case 'incident.new':
          newIncidents.push(ev.payload)
          feedEntries.unshift({ t: nowIso, kind: 'new', tone: 'rose', id: ev.payload.id, text: ev.payload.title })
          break
        case 'incident.update':
          incIdToPatch.set(ev.payload.id, { ...(incIdToPatch.get(ev.payload.id) || {}), ...ev.payload })
          if (ev.payload.status === 'verificado') {
            feedEntries.unshift({ t: nowIso, kind: 'status', tone: 'amber', id: ev.payload.id, text: `Verificación ciudadana: ${ev.payload.id}` })
          }
          break
        case 'incident.status':
          incIdToPatch.set(ev.payload.id, {
            ...(incIdToPatch.get(ev.payload.id) || {}),
            status: ev.payload.status,
            updatedAt: ev.payload.updatedAt,
          })
          feedEntries.unshift({ t: nowIso, kind: 'status', tone: 'emerald', id: ev.payload.id, text: `${ev.payload.id} resuelto y cerrado` })
          break
        case 'camera.status':
          camPatches.set(ev.payload.id, { status: ev.payload.status, lastSdkSyncAt: ev.payload.lastSdkSyncAt })
          feedEntries.unshift({
            t: nowIso,
            kind: 'camera',
            tone: ev.payload.status === 'activa' ? 'emerald' : 'slate',
            text: `Cámara ${ev.payload.name}: ${ev.payload.status === 'activa' ? 'reactivada' : ev.payload.status === 'offline' ? 'sin conexión' : 'en mantenimiento'}`,
          })
          break
        case 'violation.created':
          sawViolation = true
          feedEntries.unshift({
            t: nowIso,
            kind: 'violation',
            tone: 'violet',
            text: `Nueva captura ${ev.payload.plate} · ${ev.payload.amount} € · ${ev.payload.cameraName}`,
          })
          break
        default:
          break
      }
    }

    let nextIncidents = incidents
    if (newIncidents.length || incIdToPatch.size) {
      nextIncidents = [...newIncidents, ...incidents.map((i) => (incIdToPatch.has(i.id) ? { ...i, ...incIdToPatch.get(i.id) } : i))]
    }
    const nextRoads = roadPatches.size
      ? roads.map((road) => (roadPatches.has(road.id) ? { ...road, ...roadPatches.get(road.id) } : road))
      : roads
    const nextCameras = camPatches.size
      ? cameras.map((camera) => (camPatches.has(camera.id) ? { ...camera, ...camPatches.get(camera.id) } : camera))
      : cameras

    const now = Date.now()
    for (let index = 0; index < packet.events.length; index++) rateRing.push(now)
    const from = now - 60000
    rateRing = rateRing.filter((t) => t > from)
    const rate = rateRing.length

    set({
      incidents: nextIncidents,
      roads: nextRoads,
      cameras: nextCameras,
      serverTime: nowIso,
      feed: feedEntries.length ? [...feedEntries, ...feed].slice(0, 200) : feed,
      rateSeries: [...rateSeries, rate].slice(-40),
      stats: { eventsRate: rate, lastPacketAt: nowIso, packets: stats.packets + 1 },
      violationsTick: sawViolation ? get().violationsTick + 1 : get().violationsTick,
    })
  },

  refreshRate() {
    const now = Date.now()
    rateRing = rateRing.filter((t) => t > now - 60000)
    const rate = rateRing.length
    set((state) => (state.stats.eventsRate === rate ? state : { stats: { ...state.stats, eventsRate: rate } }))
  },

  async refreshIncidents() {
    const data = await api.getIncidents()
    set({ incidents: data.items, serverTime: data.serverTime })
  },

  async changeIncidentStatus(id, next, note) {
    const updated = await api.patchIncidentStatus(id, next, note)
    const { incidents } = get()
    const idx = incidents.findIndex((i) => i.id === id)
    if (idx === -1) return updated
    const nextArr = incidents.slice()
    nextArr[idx] = updated
    set({ incidents: nextArr })
    return updated
  },

  async confirmIncident(id) {
    const updated = await api.confirmIncident(id)
    const { incidents } = get()
    const idx = incidents.findIndex((i) => i.id === id)
    if (idx === -1) return updated
    const nextArr = incidents.slice()
    nextArr[idx] = updated
    set({ incidents: nextArr })
    return updated
  },

  async createReport(payload) {
    const created = await api.postReport(payload)
    set((s) => ({ incidents: [created, ...s.incidents] }))
    return created
  },
}))

export function markViolationTickSeen() {
  trafficStore.setState({ violationsTick: 0 })
}
