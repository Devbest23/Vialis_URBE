import { useMemo } from 'react'
import L from 'leaflet'
import { Marker } from 'react-leaflet'
import { trafficStore } from '../../store/trafficStore.js'
import { uiStore } from '../../store/uiStore.js'
import { boundsWithMargin, roadsWithinBounds, snapToNearestRoad } from '../../lib/geo.js'
import { CITY } from '../../lib/domain.js'

const CAM_MIN_ZOOM = 13

const STATUS_STYLE = { activa: '#22d3ee', mantenimiento: '#f59e0b', offline: '#64748b' }
const KIND_GLYPH = { radar: 'R', flujo: 'F', reconocimiento: 'M' }

const iconCache = new Map()

function cameraIcon(kind, status) {
  const key = `${kind}|${status}`
  let icon = iconCache.get(key)
  if (!icon) {
    const color = STATUS_STYLE[status] || '#64748b'
    const pulse = status === 'activa'
    const glyph = KIND_GLYPH[kind] || 'C'
    const html = `<span class="relative inline-flex h-4 w-4 items-center justify-center">${pulse ? `<span class="absolute inline-flex h-3 w-3 animate-ping rounded-full" style="background:${color}"></span>` : ''}<span class="relative inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] text-[9px] font-bold text-slate-950 ring-2 ring-slate-950/80" style="background:${color}">${glyph}</span></span>`
    icon = L.divIcon({ className: 'cam-ico', iconSize: [16, 16], iconAnchor: [8, 8], html })
    iconCache.set(key, icon)
  }
  return icon
}

export function CameraLayer() {
  const cameras = trafficStore((s) => s.cameras)
  const roads = trafficStore((s) => s.roads)
  const enabled = uiStore((s) => s.layers.cameras)
  const boundsKey = uiStore((s) => s.boundsKey)
  const zoom = uiStore((s) => s.zoom)
  const selectedCamId = uiStore((s) => s.selectedCameraId)

  const visible = useMemo(() => {
    if (!enabled || zoom < CAM_MIN_ZOOM) return []
    const mb = boundsWithMargin(uiStore.getState().bounds, 0.2, 0.2)
    if (!mb) return []
    return cameras.filter((c) => c.lat >= mb.s && c.lat <= mb.n && c.lng >= mb.w && c.lng <= mb.e)
  }, [cameras, boundsKey, zoom, enabled])

  const cityRoads = useMemo(
    () => roadsWithinBounds(roads, CITY.bounds),
    [roads],
  )

  if (!visible.length) return null

  return visible.map((c) => (
    <Marker
      key={c.id}
      position={snapToNearestRoad([c.lat, c.lng], cityRoads, c.roadId) || [c.lat, c.lng]}
      icon={cameraIcon(c.kind, c.status)}
      zIndexOffset={selectedCamId === c.id ? 700 : 200}
      eventHandlers={{ click: () => uiStore.getState().selectCamera(c.id) }}
    />
  ))
}

export { STATUS_STYLE as CAMERA_STATUS_STYLE, CAM_MIN_ZOOM }
