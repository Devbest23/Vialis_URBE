import { INCIDENT_STATUS_LABEL, INCIDENT_TYPE_LABEL, SEVERITY_LABEL, SOURCE_LABEL, SEVERITY_ORDER, INCIDENT_STATUS_ORDER } from '../../lib/domain.js'
import { uiStore } from '../../store/uiStore.js'
import { trafficStore } from '../../store/trafficStore.js'
import { Chip, Button, Input } from '../../components/ui.jsx'
import { Icon } from '../../components/Icon.jsx'
import { fmtNumber } from '../../lib/format.js'

const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

export function FiltersPanel() {
  const filters = uiStore((s) => s.opsFilters)
  const setFilter = uiStore((s) => s.setFilter)
  const resetFilters = uiStore((s) => s.resetFilters)
  const total = trafficStore((s) => s.incidents.length)

  const activeCount =
    (filters.severity.length ? 1 : 0) +
    (filters.types.length ? 1 : 0) +
    (filters.statuses.length ? 1 : 0) +
    (filters.sources.length ? 1 : 0) +
    (filters.query.trim() ? 1 : 0)

  return (
    <section aria-label="Filtros de incidencias" className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-300">
          <Icon name="filter" size={13} />
          Filtros
          {activeCount ? <span className="rounded bg-sky-500/20 px-1.5 text-[10px] text-sky-300">{activeCount}</span> : null}
        </h2>
        <Button size="sm" variant="ghost" icon="x" disabled={!activeCount} onClick={resetFilters}>
          Limpiar
        </Button>
      </div>
      <label className="sr-only" htmlFor="ops-search">
        Buscar incidencia por título, vía o identificador
      </label>
      <Input
        id="ops-search"
        data-autofocus={undefined}
        type="search"
        placeholder="Buscar título, vía o ID…"
        value={filters.query}
        onChange={(e) => setFilter({ query: e.target.value })}
        className="mb-2.5"
      />
      <div className="space-y-2.5 text-[11px]">
        <Chips label="Gravedad" options={SEVERITY_ORDER} labels={SEVERITY_LABEL} selected={filters.severity} onToggle={(v) => setFilter({ severity: toggleIn(filters.severity, v) })} tones={SEV_TONE} />
        <Chips label="Tipo" options={Object.keys(INCIDENT_TYPE_LABEL)} labels={INCIDENT_TYPE_LABEL} selected={filters.types} onToggle={(v) => setFilter({ types: toggleIn(filters.types, v) })} />
        <Chips label="Estado" options={INCIDENT_STATUS_ORDER} labels={INCIDENT_STATUS_LABEL} selected={filters.statuses} onToggle={(v) => setFilter({ statuses: toggleIn(filters.statuses, v) })} tones={STATUS_TONE} />
        <Chips label="Fuente" options={Object.keys(SOURCE_LABEL)} labels={SOURCE_LABEL} selected={filters.sources} onToggle={(v) => setFilter({ sources: toggleIn(filters.sources, v) })} />
      </div>
      <p className="mt-2.5 border-t border-slate-800 pt-2 text-[11px] text-slate-500">
        La búsqueda y los filtros aplican al mapa y a la lista en tiempo real sobre
        <span className="font-mono text-slate-300"> {fmtNumber.format(total)} </span>
        incidencias.
      </p>
    </section>
  )
}

const SEV_TONE = { critica: 'rose', alta: 'amber', media: 'sky', baja: 'slate' }
const STATUS_TONE = { nuevo: 'rose', verificado: 'amber', en_atencion: 'sky', resuelto: 'emerald', descartado: 'slate' }

function Chips({ label, options, labels, selected, onToggle, tones }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((v) => (
          <Chip key={v} active={selected.includes(v)} tone={tones?.[v] || 'sky'} onClick={() => onToggle(v)}>
            {labels[v]}
          </Chip>
        ))}
      </div>
    </div>
  )
}
