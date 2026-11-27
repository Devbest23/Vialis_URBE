import { useState } from 'react'
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../../lib/domain.js'
import { flowColor } from '../../lib/domain.js'
import { uiStore } from '../../store/uiStore.js'
import { trafficStore } from '../../store/trafficStore.js'
import { Icon } from '../../components/Icon.jsx'
import { Button, cx } from '../../components/ui.jsx'

const FLOW_STOPS = [10, 25, 45, 65, 80]

export function MapLegend() {
  const zoom = uiStore((s) => s.zoom)
  const [open, setOpen] = useState(true)

  return (
    <div className="absolute bottom-3 left-3 z-[900] max-w-[300px]">
      <div className="overflow-hidden rounded-lg border border-slate-700/70 bg-slate-950/85 shadow-xl backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-[12px] font-semibold text-slate-200 hover:bg-slate-900"
        >
          <span className="flex items-center gap-2">
            <Icon name="layers" size={14} />
            Leyenda · z{zoom.toFixed(zoom % 1 ? 1 : 0)}
          </span>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} className="text-slate-500 transition-transform" />
        </button>
        {open ? (
          <div className="space-y-3 border-t border-slate-800 px-3 py-2.5 text-[11px] text-slate-400">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {['critica', 'alta', 'media', 'baja'].map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[s] }} />
                  {SEVERITY_LABEL[s]}
                </span>
              ))}
            </div>
            <div>
              <p className="mb-1 font-medium text-slate-300">Flujo por vía</p>
              <div className="h-2 w-full rounded-full" style={{ background: `linear-gradient(90deg, ${FLOW_STOPS.map((s) => flowColor(s)).join(',')})` }} />
              <div className="mt-0.5 flex justify-between text-[10px]">
                <span>parado</span>
                <span>fluida</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-2.5 shrink-0 rounded-sm" style={{ background: '#22d3ee' }} />
                Cámara activa · <span className="text-slate-500">F flujo · R radar · M matrículas</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="city" size={13} className="text-slate-500" />
                Nodos distrito a nivel z≤11 · detalle de incidencias a partir de z12
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
