import { useEffect, useMemo } from 'react'
import { trafficStore } from '../../store/trafficStore.js'
import { uiStore } from '../../store/uiStore.js'
import { filterIncidents } from './filters.js'
import { KpiRow } from './KpiBar.jsx'
import { FiltersPanel } from './FiltersPanel.jsx'
import { IncidentList } from './IncidentList.jsx'
import { IncidentDetail } from './IncidentDetail.jsx'
import { LiveFeed } from './LiveFeed.jsx'
import { TrafficMap } from '../map/TrafficMap.jsx'
import { EmptyState } from '../../components/ui.jsx'

export function ControlCenter({ visible }) {
  if (!visible) return null
  return <ControlCenterInner />
}

function ControlCenterInner() {
  const status = trafficStore((s) => s.status)
  const incidents = trafficStore((s) => s.incidents)
  const error = trafficStore((s) => s.error)
  const opsFilters = uiStore((s) => s.opsFilters)

  useEffect(() => {
    if (status === 'idle') trafficStore.getState().loadBase()
  }, [])

  const filtered = useMemo(() => filterIncidents(incidents, opsFilters), [incidents, opsFilters])

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)_330px]">
      <div className="order-2 flex min-h-0 flex-col gap-2 overflow-auto border-slate-800 p-2 lg:order-1 lg:border-r">
        <KpiRow />
        <FiltersPanel />
        <LiveFeed />
      </div>
      <div className="order-1 min-h-0 lg:order-2">
        {status === 'ready' || status === 'loading' ? (
          <TrafficMap />
        ) : (
          <EmptyState
            icon="city"
            title={status === 'error' ? 'No se pudo conectar con la API' : 'Conectando con el centro de operaciones…'}
            hint={status === 'error' ? error || 'Verifica que el servidor esté en ejecución (npm run dev) y recarga la página.' : null}
          />
        )}
      </div>
      <div className="order-3 flex min-h-0 flex-col gap-2 border-t border-slate-800 p-1.5 lg:border-l lg:border-t-0">
        <IncidentList incidents={filtered} />
        <IncidentDetail />
      </div>
    </div>
  )
}
