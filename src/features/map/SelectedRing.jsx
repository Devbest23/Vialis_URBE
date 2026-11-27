import { useMemo } from 'react'
import { Circle } from 'react-leaflet'
import { CITY } from '../../lib/domain.js'
import { roadsWithinBounds, snapToNearestRoad } from '../../lib/geo.js'
import { trafficStore } from '../../store/trafficStore.js'
import { uiStore } from '../../store/uiStore.js'

export function SelectedRing() {
  const selectedId = uiStore((s) => s.selectedIncidentId)
  const focus = trafficStore((s) => s.incidents.find((i) => i.id === selectedId))
  const roads = trafficStore((s) => s.roads)
  const cityRoads = useMemo(() => roadsWithinBounds(roads, CITY.bounds), [roads])
  if (!focus) return null
  const center =
    focus.source !== 'ciudadano'
      ? snapToNearestRoad([focus.lat, focus.lng], cityRoads, focus.roadId) || [focus.lat, focus.lng]
      : [focus.lat, focus.lng]
  return (
    <Circle
      key={`sel-${focus.id}`}
      center={center}
      radius={Math.max(70, focus.radiusM * 1.4)}
      pathOptions={{ color: '#38bdf8', weight: 1.2, fillOpacity: 0.06, dashArray: '5 7' }}
      interactive={false}
    />
  )
}

export function CameraRing() {
  const selectedCamId = uiStore((s) => s.selectedCameraId)
  const cam = trafficStore((s) => s.cameras.find((c) => c.id === selectedCamId))
  const roads = trafficStore((s) => s.roads)
  const cityRoads = useMemo(() => roadsWithinBounds(roads, CITY.bounds), [roads])
  if (!cam) return null
  const center = snapToNearestRoad([cam.lat, cam.lng], cityRoads, cam.roadId) || [cam.lat, cam.lng]
  return (
    <Circle
      key={`cam-${cam.id}`}
      center={center}
      radius={90}
      pathOptions={{ color: '#22d3ee', weight: 1.2, fillOpacity: 0.05 }}
      interactive={false}
    />
  )
}
