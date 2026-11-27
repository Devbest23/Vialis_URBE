import { useEffect, useState } from 'react'
import { trafficStore } from '../../store/trafficStore.js'
import { uiStore } from '../../store/uiStore.js'
import { Icon } from '../../components/Icon.jsx'
import { cx, Badge } from '../../components/ui.jsx'
import { fmtNumber } from '../../lib/format.js'

export function StatusBar() {
  const zoom = uiStore((s) => s.zoom)
  const simulated = uiStore((s) => s.simulatedTiles)
  const autoSimulated = uiStore((s) => s.autoSimulated)
  const roadCount = trafficStore((s) => s.roads.length)
  const camCount = trafficStore((s) => s.cameras.length)
  const incCount = trafficStore((s) => s.incidents.length)
  const rate = trafficStore((s) => s.stats.eventsRate)
  const packets = trafficStore((s) => s.stats.packets)
  const telemetry = trafficStore((s) => s.telemetryStatus)
  const [fps, setFps] = useState(60)

  useEffect(() => {
    const timer = setInterval(() => trafficStore.getState().refreshRate(), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let frames = 0
    let mounted = true
    const tick = (t) => {
      frames++
      if (t - last >= 1000) {
        if (mounted) setFps(frames)
        frames = 0
        last = t
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      mounted = false
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-slate-800 bg-[#0b1220]/95 px-3 text-[10.5px] text-slate-500">
      <span className={cx('flex items-center gap-1.5', telemetry.connected ? 'text-emerald-300' : rate > 0 ? 'text-amber-300' : 'text-slate-500')} title={telemetry.connected ? 'Canal WebSocket conectado' : 'Reconectando el canal WebSocket'}>
        <span className={cx('h-1.5 w-1.5 rounded-full', telemetry.connected ? 'bg-emerald-400 live-dot' : rate > 0 ? 'bg-amber-400' : 'bg-slate-600')} />
        {telemetry.connected ? 'telemetría en vivo' : telemetry.attempts > 0 ? 'telemetría reconectando' : 'telemetría en espera'}
        {rate > 0 ? ` · ${fmtNumber.format(rate)} ev/min` : ''}
      </span>
      <span className="h-4 w-px bg-slate-700/70" aria-hidden="true" />
      <span className="flex items-center gap-1">
        <Icon name="city" size={11} />
        {fmtNumber.format(incCount)} · <Icon name="road" size={11} /> {fmtNumber.format(roadCount)} · <Icon name="camera" size={11} />{' '}
        {fmtNumber.format(camCount)}
      </span>
      <span className="h-4 w-px bg-slate-700/70" aria-hidden="true" />
      <span className="font-mono">zoom {zoom.toFixed(zoom % 1 ? 1 : 0)}</span>
      <span className="h-4 w-px bg-slate-700/70" aria-hidden="true" />
      <span className={cx('font-mono', fps >= 50 ? 'text-emerald-400/90' : fps >= 30 ? 'text-amber-300/90' : 'text-rose-300/90')} title="Fotogramas por segundo del bucle de render">
        {fps} fps
      </span>
      <span className="ml-auto flex items-center gap-2">
        {simulated ? (
          <Badge tone={autoSimulated ? 'warn' : 'info'}>mapa simulado{autoSimulated ? ' (auto)' : ''}</Badge>
        ) : (
          <Badge tone="plain">tiles Esri/OSM</Badge>
        )}
        <span className="font-mono" title="Paquetes de telemetría recibidos desde el arranque">
          {fmtNumber.format(packets)} paquetes
        </span>
        <span className="hidden sm:inline">WCAG 2.1 AA · keyboard-first</span>
      </span>
    </footer>
  )
}
