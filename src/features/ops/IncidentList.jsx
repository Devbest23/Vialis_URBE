import { useCallback, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { INCIDENT_STATUS_LABEL, INCIDENT_TYPE_LABEL, SEVERITY_COLOR, SEVERITY_LABEL, SOURCE_LABEL } from '../../lib/domain.js'
import { uiStore, flyTo } from '../../store/uiStore.js'
import { timeAgo, fmtNumber } from '../../lib/format.js'
import { Icon, iconByIncidentType } from '../../components/Icon.jsx'
import { cx, EmptyState, Chip } from '../../components/ui.jsx'

const ROW_H = 56
const STATUS_DOT = {
  nuevo: 'bg-rose-400',
  verificado: 'bg-amber-400',
  en_atencion: 'bg-sky-400',
  resuelto: 'bg-emerald-400',
  descartado: 'bg-slate-500',
}

export function IncidentList({ incidents }) {
  const selectedId = uiStore((s) => s.selectedIncidentId)
  const select = uiStore((s) => s.selectIncident)
  const containerRef = useRef(null)
  const [sortNewest, setSortNewest] = useState(true)

  const list = useMemo(() => {
    const arr = incidents.slice()
    arr.sort((a, b) => {
      const delta = Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
      return (sortNewest ? delta : -delta) || (a.id < b.id ? 1 : -1)
    })
    return arr
  }, [incidents, sortNewest])

  const virtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_H,
    overscan: 6,
  })

  const onKeyDown = useCallback(
    (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return
      e.preventDefault()
      const currentIdx = list.findIndex((i) => i.id === selectedId)
      let nextIdx = currentIdx
      if (e.key === 'ArrowDown') nextIdx = Math.min(list.length - 1, currentIdx < 0 ? 0 : currentIdx + 1)
      else if (e.key === 'ArrowUp') nextIdx = Math.max(0, currentIdx < 0 ? 0 : currentIdx - 1)
      const target = list[nextIdx]
      if (!target) return
      select(target.id)
      if (e.key === 'Enter') {
        if (flyTo.fn) flyTo.fn([target.lat, target.lng])
      } else {
        virtualizer.scrollToIndex(nextIdx, { align: 'auto' })
      }
    },
    [list, selectedId, select, virtualizer],
  )

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between px-1 pb-1.5">
        <h2 className="text-[12px] font-semibold text-slate-300">
          Incidencias <span className="font-mono text-slate-500">{fmtNumber.format(list.length)}</span>
        </h2>
        <Chip active={sortNewest} onClick={() => setSortNewest((v) => !v)} title="Orden de actualización">
          <Icon name="clock" size={12} />
          {sortNewest ? 'Recientes' : 'Reversa'}
        </Chip>
      </header>
      <div
        ref={containerRef}
        tabIndex={0}
        role="listbox"
        aria-label="Incidencias filtradas"
        aria-activedescendant={selectedId ? `inc-row-${selectedId}` : undefined}
        onKeyDown={onKeyDown}
        className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
      >
        {list.length === 0 ? (
          <EmptyState icon="check" title="Sin coincidencias" hint="Prueba a limpiar los filtros o cambia el zoom del mapa." />
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vItem) => {
              const i = list[vItem.index]
              return (
                <div
                  key={i.id}
                  id={`inc-row-${i.id}`}
                  role="option"
                  aria-selected={i.id === selectedId}
                  tabIndex={-1}
                  onClick={() => {
                    select(i.id)
                    if (flyTo.fn) flyTo.fn([i.lat, i.lng])
                  }}
                  className={cx(
                    'absolute inset-x-1 flex cursor-pointer items-center gap-2.5 rounded-lg border-l-2 px-2.5 py-2 transition-colors',
                    i.id === selectedId ? 'border-l-sky-400 bg-sky-500/10' : 'border-l-transparent hover:bg-slate-800/60',
                  )}
                  style={{ top: vItem.start, height: vItem.size, width: '-webkit-fill-available' }}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                    style={{ background: `${SEVERITY_COLOR[i.severity]}22`, color: SEVERITY_COLOR[i.severity] }}
                    title={`${SEVERITY_LABEL[i.severity]} · ${INCIDENT_TYPE_LABEL[i.type]}`}
                  >
                    <Icon name={iconByIncidentType[i.type] || 'pin'} size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium leading-4 text-slate-200">{i.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10.5px] text-slate-500">
                      <span className={cx('h-1.5 w-1.5 rounded-full', STATUS_DOT[i.status])} />
                      {INCIDENT_STATUS_LABEL[i.status]} · {SOURCE_LABEL[i.source]} · {timeAgo(i.updatedAt)}
                    </p>
                  </div>
                  {i.confirmedBy > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-slate-400" title={`${i.confirmedBy} confirmaciones ciudadanas`}>
                      <Icon name="check" size={11} />
                      {i.confirmedBy}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
