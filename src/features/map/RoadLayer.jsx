import { useMemo } from 'react'
import { Polyline } from 'react-leaflet'
import { flowColor } from '../../lib/domain.js'
import { trafficStore } from '../../store/trafficStore.js'
import { uiStore } from '../../store/uiStore.js'
import { boundsWithMargin } from '../../lib/geo.js'

const WEIGHT = { anillo: 5, gran_via: 4.5, avenida: 3.6, calle: 3, local: 2 }
export function RoadLayer() {
  const roads = trafficStore((s) => s.roads)
  const enabled = uiStore((s) => s.layers.roads)
  const boundsKey = uiStore((s) => s.boundsKey)
  const zoom = uiStore((s) => s.zoom)

  const visible = useMemo(() => {
    if (!enabled || zoom < 10) return []
    const b = uiStore.getState().bounds
    const mb = boundsWithMargin(b, 0.35, 0.35)
    return roads.filter((r) => {
      if (zoom < 13 && r.klass === 'local') return false
      if (!mb) return true
      for (const [lat, lng] of r.points || []) {
        if (lat >= mb.s && lat <= mb.n && lng >= mb.w && lng <= mb.e) return true
      }
      return false
    })
  }, [roads, boundsKey, enabled, zoom])

  const zoomScale = Math.max(0.8, Math.min(1.5, 1 + (zoom - 12) * 0.08))

  return visible.map((r) => (
    <Polyline
      key={r.id}
      positions={r.points}
      pathOptions={{
        color: flowColor(r.avgSpeedKph),
        weight: (WEIGHT[r.klass] || 3) * zoomScale,
        opacity: 0.72,
        lineCap: 'round',
      }}
      interactive={false}
    />
  ))
}
