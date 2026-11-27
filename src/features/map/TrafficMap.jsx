import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CITY } from '../../lib/domain.js'
import { uiStore, flyTo } from '../../store/uiStore.js'
import { trafficStore } from '../../store/trafficStore.js'
import { RoadLayer } from './RoadLayer.jsx'
import { IncidentLayer } from './IncidentLayer.jsx'
import { CameraLayer } from './CameraLayer.jsx'
import { DistrictLayer } from './DistrictLayer.jsx'
import { SelectedRing, CameraRing } from './SelectedRing.jsx'
import { SimCityLayer } from './SimCityLayer.jsx'
import { MapLegend } from './MapLegend.jsx'
import { MapToolbar } from './MapToolbar.jsx'
import { CameraPopover } from './CameraPopover.jsx'
import { mapRef } from './mapRef.js'
import { TILE_URL, TILE_ATTR, TILE_MAX_NATIVE_ZOOM } from './tiles.js'
import { roadsWithinBounds, snapToNearestRoad } from '../../lib/geo.js'

let tileErrors = 0
let autoNoticeShown = false

function ViewBridge() {
  const map = useMap()
  const selectedId = uiStore((s) => s.selectedIncidentId)
  const roads = trafficStore((s) => s.roads)

  const cityRoads = useMemo(
    () => roadsWithinBounds(roads, CITY.bounds),
    [roads],
  )

  useEffect(() => {
    uiStore.getState().setMapReady(true)
    return () => uiStore.getState().setMapReady(false)
  }, [])

  useEffect(() => {
    mapRef.current = map
    return () => {
      if (mapRef.current === map) mapRef.current = null
    }
  }, [map])

  useEffect(() => {
    if (!selectedId) return
    const incident = trafficStore.getState().incidents.find((item) => item.id === selectedId)
    if (!incident) return
    if (
      incident.lat < CITY.bounds.latMin ||
      incident.lat > CITY.bounds.latMax ||
      incident.lng < CITY.bounds.lngMin ||
      incident.lng > CITY.bounds.lngMax
    ) return
    const position =
      incident.source !== 'ciudadano'
        ? snapToNearestRoad([incident.lat, incident.lng], cityRoads, incident.roadId) || [incident.lat, incident.lng]
        : [incident.lat, incident.lng]
    map.flyTo(position, Math.max(map.getZoom(), 15), { duration: 0.9 })
  }, [map, selectedId, cityRoads])

  useEffect(() => {
    flyTo.fn = (latlng) => map.flyTo(latlng, Math.max(map.getZoom(), 15), { duration: 0.9 })
    return () => {
      flyTo.fn = null
    }
  }, [map])

  const sync = () => {
    const z = map.getZoom()
    const b = map.getBounds()
    uiStore.getState().setMapView({
      zoom: z,
      bounds: { s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() },
      boundsKey: `${z}|${b.getSouth().toFixed(3)}|${b.getWest().toFixed(3)}`,
    })
  }

  useMapEvents({ moveend: sync, zoomend: sync })

  useEffect(() => {
    sync()
  }, [map])

  return null
}

function MapResizeObserver() {
  const map = useMap()

  useEffect(() => {
    let frame = 0
    const observer = new ResizeObserver(() => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = 0
        map.invalidateSize({ pan: false, debounceMoveend: true })
      })
    })
    observer.observe(map.getContainer())
    map.invalidateSize({ pan: false })

    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [map])

  return null
}

export function TrafficMap() {
  const simulated = useRef(false)

  const maxBounds = useMemo(
    () =>
      L.latLngBounds([CITY.bounds.latMin - 0.02, CITY.bounds.lngMin - 0.03], [CITY.bounds.latMax + 0.02, CITY.bounds.lngMax + 0.03]),
    [],
  )

  const onTileError = () => {
    tileErrors += 1
    if (tileErrors > 10 && !simulated.current) {
      simulated.current = true
      if (!autoNoticeShown) {
        autoNoticeShown = true
        uiStore.getState().setSimulatedTiles(true, { auto: true })
        uiStore.getState().pushToast({
          tone: 'warn',
          icon: 'grid',
          title: 'Sin conexión con tiles externos',
          message: 'Se activó automáticamente el mapa urbano simulado.',
        })
      }
    }
  }

  const resetTileErrors = () => {
    if (tileErrors > 0) tileErrors = 0
  }

  return (
    <div className="relative h-full w-full overflow-hidden" aria-label={`Mapa urbano interactivo de ${CITY.name}`}>
      <MapContainer
        center={CITY.center}
        zoom={CITY.zoomHome}
        minZoom={10}
        maxZoom={18}
        zoomControl={false}
        preferCanvas
        maxBounds={maxBounds}
        maxBoundsViscosity={0.8}
        className="h-full w-full bg-[#0a0f1c]"
      >
        <TileLayer
          key="base-tiles"
          url={TILE_URL}
          attribution={TILE_ATTR}
          maxNativeZoom={TILE_MAX_NATIVE_ZOOM}
          eventHandlers={{ tileerror: onTileError, tileload: resetTileErrors }}
          updateWhenIdle={false}
          keepBuffer={3}
        />
        <SimCityLayer />
        <RoadLayer />
        <DistrictLayer />
        <IncidentLayer />
        <CameraLayer />
        <SelectedRing />
        <CameraRing />
        <MapResizeObserver />
        <ViewBridge />
      </MapContainer>
      <CameraPopover />
      <MapToolbar />
      <MapLegend />
      <p className="sr-only">
        Mapa accesible por teclado: tabula hasta el lienzo y usa los cursores para desplazarte, + y − para el zoom. La lista de
        incidencias del panel derecho ofrece la misma información con navegación completa por teclado.
      </p>
    </div>
  )
}
