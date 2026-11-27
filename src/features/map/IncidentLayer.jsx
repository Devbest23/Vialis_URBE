import { useMemo } from 'react'
import { CircleMarker, Tooltip } from 'react-leaflet'
import { CITY, INCIDENT_STATUS_LABEL, SEVERITY_COLOR, SEVERITY_LABEL } from '../../lib/domain.js'
import { trafficStore } from '../../store/trafficStore.js'
import { uiStore } from '../../store/uiStore.js'
import { boundsWithMargin, roadsWithinBounds, snapToNearestRoad } from '../../lib/geo.js'
import { timeAgo } from '../../lib/format.js'
import { filterIncidents } from '../ops/filters.js'
import { mapRef } from './mapRef.js'

const RADIUS = { critica: 9, alta: 7, media: 5.5, baja: 4.5 }

export function IncidentLayer() {
  const incidents = trafficStore((s) => s.incidents)
  const districts = trafficStore((s) => s.districts)
  const roads = trafficStore((s) => s.roads)
  const enabled = uiStore((s) => s.layers.incidents)
  const layersDistricts = uiStore((s) => s.layers.districts)
  const boundsKey = uiStore((s) => s.boundsKey)
  const zoom = uiStore((s) => s.zoom)
  const selectedId = uiStore((s) => s.selectedIncidentId)
  const opsFilters = uiStore((s) => s.opsFilters)

  const aggregated = zoom < 12

  const filtered = useMemo(() => filterIncidents(incidents, opsFilters), [incidents, opsFilters])

  const visible = useMemo(() => {
    if (!enabled) return []
    const mb = boundsWithMargin(uiStore.getState().bounds, 0.25, 0.25)
    if (!mb) return filtered.slice(0, 40)
    return filtered.filter((i) => i.lat >= mb.s && i.lat <= mb.n && i.lng >= mb.w && i.lng <= mb.e)
  }, [filtered, boundsKey, enabled])

  const cityRoads = useMemo(
    () => roadsWithinBounds(roads, CITY.bounds),
    [roads],
  )

  const positioned = useMemo(
    () =>
      visible.map((incident) => ({
        ...incident,
        position:
          incident.source !== 'ciudadano'
            ? snapToNearestRoad([incident.lat, incident.lng], cityRoads, incident.roadId) || [incident.lat, incident.lng]
            : [incident.lat, incident.lng],
      })),
    [visible, cityRoads],
  )

  const byDistrict = useMemo(() => {
    if (!aggregated) return []
    const counts = new Map()
    for (const i of visible) {
      let best = null
      let bestD = Infinity
      for (const d of districts) {
        const dx = (d.center[0] - i.lat) * 111
        const dy = (d.center[1] - i.lng) * 85
        const dist = dx * dx + dy * dy
        if (dist < bestD) {
          bestD = dist
          best = d
        }
      }
      if (!best) continue
      const entry = counts.get(best.id) || { district: best, count: 0, crit: 0 }
      entry.count++
      if (i.severity === 'critica') entry.crit++
      counts.set(best.id, entry)
    }
    return [...counts.values()]
  }, [visible, districts, aggregated])

  if (!enabled) return null

  if (aggregated) {
    return byDistrict.map(({ district, count, crit }) => (
      <CircleMarker
        key={district.id}
        center={district.center}
        radius={10 + Math.min(34, count * 0.9)}
        pathOptions={{
          color: districtColor(count),
          weight: 1.4,
          fillColor: districtColor(count),
          fillOpacity: 0.22,
        }}
        eventHandlers={{ click: () => mapRef.current?.flyTo(district.center, 13, { duration: 0.7 }) }}
      >
        {layersDistricts ? (
          <Tooltip direction="top" offset={[0, -6]}>
            <strong>{district.name}</strong> · {count} {count === 1 ? 'incidencia' : 'incidencias'}
            {crit ? ` · ${crit} ${crit === 1 ? 'crítica' : 'críticas'}` : ''}
          </Tooltip>
        ) : null}
      </CircleMarker>
    ))
  }

  return positioned.map((i) => (
    <CircleMarker
      key={i.id}
      center={i.position}
      radius={i.id === selectedId ? RADIUS[i.severity] + 5 : RADIUS[i.severity]}
      pathOptions={{
        color: i.id === selectedId ? '#ffffff' : SEVERITY_COLOR[i.severity],
        weight: i.id === selectedId ? 2.4 : 1.6,
        fillColor: SEVERITY_COLOR[i.severity],
        fillOpacity: i.id === selectedId ? 0.85 : i.severity === 'critica' || i.severity === 'alta' ? 0.5 : 0.35,
      }}
      eventHandlers={{
        click: () => uiStore.getState().selectIncident(i.id),
      }}
    >
      <Tooltip direction="top" offset={[0, -8]}>
        <span className="inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: SEVERITY_COLOR[i.severity] }} />
        <strong className="ml-1">{i.title}</strong>
        <span className="mt-0.5 block text-slate-400">
          {SEVERITY_LABEL[i.severity]} · {INCIDENT_STATUS_LABEL[i.status]} · {timeAgo(i.updatedAt)}
        </span>
      </Tooltip>
    </CircleMarker>
  ))
}

export function districtColor(count) {
  if (count > 120) return '#f43f5e'
  if (count > 70) return '#f59e0b'
  if (count > 35) return '#84cc16'
  return '#38bdf8'
}
