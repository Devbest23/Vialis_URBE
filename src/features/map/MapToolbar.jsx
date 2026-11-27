import { uiStore } from '../../store/uiStore.js'
import { cx } from '../../components/ui.jsx'
import { Icon } from '../../components/Icon.jsx'
import { fitCity } from './mapRef.js'

export function MapToolbar() {
  const simulated = uiStore((s) => s.simulatedTiles)
  const layers = uiStore((s) => s.layers)

  return (
    <div className="absolute right-3 top-3 z-[900] flex flex-col items-end gap-2">
      <div className="rounded-lg border border-slate-700/70 bg-slate-950/85 p-1 shadow-xl backdrop-blur">
        <div className="flex items-center">
          <ToolbarIconBtn icon="home" label="Encuadrar la ciudad" onClick={() => fitCity()} />
          <ToolbarIconBtn icon="alert" label="Reportar incidencia ciudadana" onClick={() => uiStore.getState().setReportOpen(true)} />
          <div className="mx-0.5 h-6 w-px bg-slate-700/70" aria-hidden="true" />
          <ToolbarIconBtn icon="grid" label="Alternar mapa urbano simulado" active={simulated} onClick={() => uiStore.getState().setSimulatedTiles(!simulated)} />
        </div>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border border-slate-700/70 bg-slate-950/85 p-1 shadow-xl backdrop-blur">
        <LayerPill id="roads" icon="road" label="Vías y flujo" enabled={layers.roads} />
        <LayerPill id="incidents" icon="alert" label="Incidencias" enabled={layers.incidents} />
        <LayerPill id="cameras" icon="camera" label="Cámaras" enabled={layers.cameras} />
        <LayerPill id="districts" icon="city" label="Distritos" enabled={layers.districts} />
      </div>
    </div>
  )
}

const LAYER_LABEL = { roads: 'Capa de vías y flujo', incidents: 'Capa de incidencias', cameras: 'Capa de cámaras', districts: 'Capa de distritos' }

function LayerPill({ id, icon, label, enabled }) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      title={LAYER_LABEL[id]}
      onClick={() => uiStore.getState().toggleLayer(id)}
      className={cx(
        'flex h-8 w-8 items-center justify-center rounded-md text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400',
        enabled ? 'bg-sky-500/15 text-sky-300' : 'text-slate-500 hover:text-slate-300',
      )}
    >
      <Icon name={icon} size={15} />
      <span className="sr-only">{label}</span>
    </button>
  )
}

function ToolbarIconBtn({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cx(
        'flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400',
        active ? 'bg-sky-500/15 text-sky-300' : 'text-slate-300 hover:bg-slate-800/80',
      )}
    >
      <Icon name={icon} size={15} />
    </button>
  )
}
