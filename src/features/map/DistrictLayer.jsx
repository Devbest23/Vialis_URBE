import { useMemo } from 'react'
import { CircleMarker, Tooltip } from 'react-leaflet'
import { trafficStore } from '../../store/trafficStore.js'
import { uiStore } from '../../store/uiStore.js'
import { boundsWithMargin } from '../../lib/geo.js'
import { mapRef } from './mapRef.js'

const LABEL_ZOOM = 11

export function DistrictLayer() {
  const districts = trafficStore((s) => s.districts)
  const incidents = trafficStore((s) => s.incidents)
  const enabled = uiStore((s) => s.layers.districts)
  const boundsKey = uiStore((s) => s.boundsKey)
  const zoom = uiStore((s) => s.zoom)

  const counts = useMemo(() => {
    const mb = boundsWithMargin(uiStore.getState().bounds, 0.5, 0.5)
    const acc = new Map()
    for (const d of districts) {
      let n = 0
      for (const i of incidents) {
        if (i.status === 'resuelto' || i.status === 'descartado') continue
        if (mb && (i.lat < mb.s || i.lat > mb.n || i.lng < mb.w || i.lng > mb.e)) continue
        const dx = (d.center[0] - i.lat) * 111
        const dy = (d.center[1] - i.lng) * 85
        if (dx * dx + dy * dy < 1.35) n++
      }
      acc.set(d.id, n)
    }
    return acc
  }, [districts, incidents, boundsKey])

  if (!enabled || zoom > LABEL_ZOOM + 2) return null

  return districts.map((d) => (
    <CircleMarker
      key={d.id}
      center={d.center}
      radius={0.001}
      eventHandlers={{ click: () => mapRef.current?.flyTo(d.center, 13, { duration: 0.7 }) }}
    >
      <Tooltip direction="top" offset={[0, -12]} permanent={zoom <= LABEL_ZOOM}>
        <strong>{d.name}</strong>
        {counts.has(d.id) ? <span className="ml-1 text-slate-400">· {counts.get(d.id)} activas</span> : null}
      </Tooltip>
    </CircleMarker>
  ))
}
