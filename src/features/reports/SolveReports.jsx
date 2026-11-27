import { useEffect, useMemo, useState } from 'react'
import {
  INCIDENT_STATUS_LABEL,
  INCIDENT_TYPE_LABEL,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
} from '../../lib/domain.js'
import { trafficStore } from '../../store/trafficStore.js'
import { flyToIncident, uiStore } from '../../store/uiStore.js'
import { fmtNumber, timeAgo } from '../../lib/format.js'
import { Badge, Button, Chip, EmptyState, Input, Panel, Select, cx } from '../../components/ui.jsx'
import { Icon, iconByIncidentType } from '../../components/Icon.jsx'
import { IncidentDetail } from '../ops/IncidentDetail.jsx'

const STATUS_TONE = { nuevo: 'danger', verificado: 'warn', en_atencion: 'info', resuelto: 'ok', descartado: 'plain' }
const SEVERITY_WEIGHT = { critica: 4, alta: 3, media: 2, baja: 1 }

const FILTERS = [
  { id: 'abiertos', label: 'Abiertos' },
  { id: 'nuevo', label: 'Nuevos' },
  { id: 'verificado', label: 'Verificados' },
  { id: 'en_atencion', label: 'En atención' },
  { id: 'resuelto', label: 'Resueltos' },
  { id: 'descartado', label: 'Descartados' },
  { id: 'todos', label: 'Todos' },
]

export function SolveReports() {
  const incidents = trafficStore((s) => s.incidents)
  const selectedId = uiStore((s) => s.selectedIncidentId)
  const [statusFilter, setStatusFilter] = useState('abiertos')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('recent')

  const citizen = useMemo(
    () => incidents.filter((incident) => incident.source === 'ciudadano'),
    [incidents],
  )

  const statusCounts = useMemo(() => {
    const counts = { total: citizen.length, nuevo: 0, verificado: 0, en_atencion: 0, resuelto: 0, descartado: 0 }
    for (const incident of citizen) counts[incident.status] += 1
    counts.abiertos = counts.nuevo + counts.verificado + counts.en_atencion
    return counts
  }, [citizen])

  const duplicates = useMemo(() => findNearbyDuplicates(citizen), [citizen])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    const matchesStatus = (incident) => {
      if (statusFilter === 'todos') return true
      if (statusFilter === 'abiertos') return !['resuelto', 'descartado'].includes(incident.status)
      return incident.status === statusFilter
    }
    const list = citizen.filter((incident) => {
      if (!matchesStatus(incident)) return false
      if (!term) return true
      return [incident.id, incident.title, incident.detail, incident.roadName, INCIDENT_TYPE_LABEL[incident.type]]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
    const sorted = list.slice()
    if (sort === 'priority') {
      sorted.sort(
        (a, b) =>
          (SEVERITY_WEIGHT[b.severity] || 0) - (SEVERITY_WEIGHT[a.severity] || 0) ||
          (b.confirmedBy || 0) - (a.confirmedBy || 0) ||
          Date.parse(b.reportedAt) - Date.parse(a.reportedAt),
      )
    } else if (sort === 'confirmations') {
      sorted.sort((a, b) => (b.confirmedBy || 0) - (a.confirmedBy || 0) || Date.parse(b.reportedAt) - Date.parse(a.reportedAt))
    } else {
      sorted.sort((a, b) => Date.parse(b.reportedAt) - Date.parse(a.reportedAt))
    }
    return sorted
  }, [citizen, statusFilter, query, sort])

  useEffect(() => {
    if (filtered.length === 0) return
    if (!filtered.some((incident) => incident.id === selectedId)) {
      uiStore.getState().selectIncident(filtered[0].id)
    }
  }, [filtered, selectedId])

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] overflow-hidden">
      <div className="border-b border-slate-800 p-3">
        <div>
          <h2 className="text-[14px] font-semibold text-slate-100">Solucionar reportes ciudadanos</h2>
          <p className="text-[12px] text-slate-500">
            Verifica, atiende y documenta la resolución de cada reporte. Las notas quedan en el historial.
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatBox tone="primary" label="Abiertos" value={statusCounts.abiertos} />
          <StatBox tone="rose" label="Nuevos" value={statusCounts.nuevo} />
          <StatBox tone="amber" label="Verificados" value={statusCounts.verificado} />
          <StatBox tone="sky" label="En atención" value={statusCounts.en_atencion} />
          <StatBox tone="emerald" label="Resueltos" value={statusCounts.resuelto} />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
            {FILTERS.map((filter) => (
              <Chip
                key={filter.id}
                active={statusFilter === filter.id}
                tone={filter.id === 'nuevo' ? 'rose' : filter.id === 'verificado' ? 'amber' : filter.id === 'en_atencion' ? 'sky' : filter.id === 'resuelto' ? 'emerald' : 'slate'}
                onClick={() => setStatusFilter(filter.id)}
              >
                {filter.label}
                <span className="font-mono text-[10px] opacity-70">{statusCounts[filter.id] ?? statusCounts.total}</span>
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-[240px] max-w-[calc(100vw-2rem)]">
              <Icon name="search" size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                id="report-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por ID, vía o texto…"
                aria-label="Buscar reportes"
                className="h-8 pl-7 text-[12px]"
              />
            </div>
            <div className="w-[155px]">
              <Select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar reportes" className="h-8 w-full text-[12px]">
                <option value="recent">Más recientes</option>
                <option value="priority">Mayor prioridad</option>
                <option value="confirmations">Más confirmados</option>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto p-3 xl:grid-cols-[minmax(0,1fr)_390px] xl:overflow-hidden">
        <Panel className="min-h-0 divide-y divide-slate-800/70 xl:overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState
              icon="message"
              title={query ? 'Sin coincidencias' : 'No hay reportes en este estado'}
              hint={query ? 'Prueba con otro texto o limpia la búsqueda.' : 'Cambia el filtro o radica un nuevo reporte ciudadano.'}
            />
          ) : (
            filtered.map((incident) => (
              <ReportRow
                key={incident.id}
                incident={incident}
                selected={selectedId === incident.id}
                duplicate={duplicates.get(incident.id)}
                onSelect={() => uiStore.getState().selectIncident(incident.id)}
                onLocate={() => {
                  flyToIncident(incident)
                  uiStore.getState().setTab('control')
                }}
              />
            ))
          )}
        </Panel>
        <div className="min-h-0 xl:overflow-y-auto">
          <IncidentDetail />
        </div>
      </div>
    </div>
  )
}

function ReportRow({ incident, selected, duplicate, onSelect, onLocate }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cx(
        'flex cursor-pointer flex-col gap-2 px-3 py-2.5 outline-none transition-colors focus-visible:bg-slate-800/50 sm:flex-row sm:items-center',
        selected ? 'bg-sky-500/[0.08]' : 'hover:bg-slate-800/30',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{ background: `${SEVERITY_COLOR[incident.severity]}22`, color: SEVERITY_COLOR[incident.severity] }}
        >
          <Icon name={iconByIncidentType[incident.type] || 'pin'} size={14} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium text-slate-200">{incident.title}</p>
          <p className="truncate text-[11px] text-slate-500">
            {incident.id} · {timeAgo(incident.reportedAt)} · {SEVERITY_LABEL[incident.severity]} · {incident.confirmedBy} confirmaciones
          </p>
          {duplicate ? (
            <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-amber-300/90">
              <Icon name="alert" size={10} /> Cerca de otro reporte abierto ({duplicate.id}) · posible duplicado
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-9 sm:pl-0">
        <Badge tone={STATUS_TONE[incident.status]}>{INCIDENT_STATUS_LABEL[incident.status]}</Badge>
        <Button
          size="sm"
          variant="ghost"
          icon="crosshair"
          aria-label={`Localizar ${incident.title} en el mapa`}
          title="Ver en el mapa"
          onClick={(event) => {
            event.stopPropagation()
            onLocate()
          }}
        />
      </div>
    </div>
  )
}

function StatBox({ tone, label, value }) {
  const tones = {
    primary: 'text-sky-300',
    rose: 'text-rose-300',
    amber: 'text-amber-300',
    sky: 'text-sky-300',
    emerald: 'text-emerald-300',
  }
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={tones[tone] + ' font-mono text-lg tabular-nums'}>{fmtNumber.format(value)}</p>
    </div>
  )
}

function findNearbyDuplicates(incidents) {
  const open = incidents.filter((incident) => !['resuelto', 'descartado'].includes(incident.status))
  const result = new Map()
  for (let i = 0; i < open.length; i += 1) {
    for (let j = i + 1; j < open.length; j += 1) {
      const a = open[i]
      const b = open[j]
      if (a.type !== b.type) continue
      const dLat = a.lat - b.lat
      const dLng = a.lng - b.lng
      if (dLat * dLat + dLng * dLng > 0.0000036) continue
      const older = Date.parse(a.reportedAt) <= Date.parse(b.reportedAt) ? a : b
      const newer = older === a ? b : a
      if (!result.has(newer.id)) result.set(newer.id, older)
    }
  }
  return result
}
