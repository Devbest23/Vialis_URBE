import { useMemo } from 'react'
import { CAMERA_KIND_LABEL, CAMERA_STATUS_LABEL, CITY, ROAD_CLASS_LABEL } from '../../lib/domain.js'
import { roadsWithinBounds, snapToNearestRoad } from '../../lib/geo.js'
import { uiStore } from '../../store/uiStore.js'
import { trafficStore } from '../../store/trafficStore.js'
import { Badge, Button } from '../../components/ui.jsx'
import { Icon } from '../../components/Icon.jsx'
import { timeAgo } from '../../lib/format.js'
import { mapRef } from './mapRef.js'

export function CameraPopover() {
  const cameraId = uiStore((s) => s.selectedCameraId)
  const cameras = trafficStore((s) => s.cameras)
  const roads = trafficStore((s) => s.roads)
  const cityRoads = useMemo(
    () => roadsWithinBounds(roads, CITY.bounds),
    [roads],
  )

  const cam = cameras.find((c) => c.id === cameraId)
  const road = cam && roads.find((r) => r.id === cam.roadId)
  const position = cam ? snapToNearestRoad([cam.lat, cam.lng], cityRoads, cam.roadId) || [cam.lat, cam.lng] : null

  if (!cam) return null

  const close = () => uiStore.getState().selectCamera(null)

  return (
    <div
      role="dialog"
      aria-label={`Detalles de la cámara ${cam.name}`}
      className="anim-in absolute bottom-3 right-3 z-[950] w-[280px] rounded-xl border border-slate-700/80 bg-slate-950/95 p-3 shadow-2xl"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Cámara {cam.id}</p>
          <p className="text-sm font-semibold text-slate-100">
            {CAMERA_KIND_LABEL[cam.kind]} <span className="text-slate-500">·</span> {cam.name}
          </p>
        </div>
        <Button variant="ghost" size="sm" icon="x" onClick={close} aria-label="Cerrar detalles de cámara" />
      </div>
      <CamShot seed={cam.lat * 1e6 + cam.lng * 1e7} status={cam.status} />
      <dl className="mt-2 space-y-1 text-[12px] text-slate-300">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Estado</dt>
          <dd>
            <Badge tone={cam.status === 'activa' ? 'ok' : cam.status === 'mantenimiento' ? 'warn' : 'plain'}>
              {CAMERA_STATUS_LABEL[cam.status]}
            </Badge>
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Vía</dt>
          <dd className="truncate text-right">{road ? `${road.name}` : '—'}{road ? ` · ${ROAD_CLASS_LABEL[road.klass]}` : ''}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Última sincronía</dt>
          <dd>{timeAgo(cam.lastSdkSyncAt)}</dd>
        </div>
      </dl>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" icon="crosshair" onClick={() => mapRef.current?.flyTo(position, 16, { duration: 0.8 })}>
          Aproximar
        </Button>
      </div>
    </div>
  )
}

function CamShot({ seed, status }) {
  const clamped = Math.abs(Math.round(seed)) % 360
  const tone = `hsl(${clamped}, 24%, 27%)`
  return (
    <div
      className="relative mt-2 h-36 overflow-hidden rounded-lg border border-slate-800"
      style={{ background: `linear-gradient(160deg, ${tone}, #0b1220 80%)` }}
      role="img"
      aria-label={`Previsualización simulada de la cámara (estado: ${status})`}
    >
      <div className="absolute inset-x-0 bottom-0 top-1/2 bg-slate-800/60" />
      <div className="absolute left-1/2 top-1/2 h-16 w-9 -translate-x-1/2 -translate-y-3/4 rounded-t-md bg-slate-300/25" />
      <span className="absolute left-[56%] top-[62%] rounded bg-slate-200 px-1 py-0.5 text-[8px] font-bold text-slate-900">12-345XYZ</span>
      <div className="absolute left-2 top-2 flex items-center gap-1.5 text-[10px] font-medium text-slate-300">
        <Icon name="camera" size={12} />
        VIALIS · SIM
      </div>
      <div className="absolute right-2 top-2 rounded bg-slate-950/70 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
        {new Date().toLocaleTimeString('es', { hour12: false })}
      </div>
      <div className="absolute bottom-2 left-2 rounded bg-slate-950/70 px-1.5 py-0.5 text-[10px] text-slate-400">Corte simulado, sin datos reales</div>
    </div>
  )
}
