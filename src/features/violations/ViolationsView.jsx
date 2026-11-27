import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { VIOLATION_STATUS_LABEL, VIOLATION_STATUS_ORDER, VIOLATION_TYPE_LABEL, VIOLATION_TYPE_COLOR } from '../../lib/domain.js'
import { violationsStore } from '../../store/violationsStore.js'
import { trafficStore, markViolationTickSeen } from '../../store/trafficStore.js'
import { uiStore } from '../../store/uiStore.js'
import { fmtMoney, fmtStampClock, timeAgo, fmtNumber } from '../../lib/format.js'
import { Icon } from '../../components/Icon.jsx'
import { Badge, Button, Chip, Input, Select, EmptyState, cx } from '../../components/ui.jsx'
import { ViolationDetail } from './ViolationDetail.jsx'

const PAGE_SIZES = [50, 100, 200]
const TYPE_CHIPS = Object.keys(VIOLATION_TYPE_LABEL)
const STATUS_CHIPS = [...VIOLATION_STATUS_ORDER]

const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

export function ViolationsView({ visible }) {
  const status = violationsStore((s) => s.status)
  const items = violationsStore((s) => s.items)
  const total = violationsStore((s) => s.total)
  const page = violationsStore((s) => s.page)
  const pageSize = violationsStore((s) => s.filters.pageSize)
  const selectedCode = violationsStore((s) => s.selectedCode)

  useEffect(() => {
    if (visible && status === 'idle') violationsStore.getState().load()
  }, [visible, status])

  useEffect(() => {
    if (!visible) return
    let lastTick = trafficStore.getState().violationsTick
    let timer = null
    const unsub = trafficStore.subscribe((state) => {
      if (state.violationsTick && state.violationsTick !== lastTick) {
        lastTick = state.violationsTick
        violationsStore.getState().bumpNewBadge()
        clearTimeout(timer)
        timer = setTimeout(() => {
          violationsStore.getState().load({ silent: true })
          markViolationTickSeen()
        }, 900)
      }
    })
    return () => {
      unsub()
      clearTimeout(timer)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-800 p-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Registro de infracciones urbanas</h2>
          <p className="text-[12px] text-slate-500">
            Expedientes consultados en la API con búsqueda del lado del servidor ·{' '}
            <span className="font-mono">{fmtNumber.format(total)}</span> coinciden con el filtro actual
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvButton items={items} />
          <Button size="md" variant="outline" icon="help" onClick={() => uiStore.getState().setHelpOpen(true)}>
            Atajos y API
          </Button>
        </div>
      </header>
      <ViolationsFilters />
      <ViolationsTable status={status} items={items} />
      <PaginationBar total={total} page={page} pageSize={pageSize} />
      <ViolationDetail open={Boolean(selectedCode)} />
    </div>
  )
}

function ViolationsFilters() {
  const filters = violationsStore((s) => s.filters)
  const setFilters = violationsStore((s) => s.setFilters)
  const newBadge = violationsStore((s) => s.violationsTickBadge)

  return (
    <div className="space-y-2 border-b border-slate-800 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="viol-search">
          Buscar por matrícula, código, cámara o titular
        </label>
        <Input
          id="viol-search"
          type="search"
          placeholder="Matrícula, expediente, cámara, titular…"
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          className="w-[230px]"
        />
        <div className="flex flex-wrap items-center gap-1">
          {TYPE_CHIPS.map((t) => (
            <Chip key={t} active={filters.type.includes(t)} tone="violet" onClick={() => setFilters({ type: toggle(filters.type, t) })}>
              {VIOLATION_TYPE_LABEL[t]}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {STATUS_CHIPS.map((s) => (
            <Chip
              key={s}
              active={filters.status.includes(s)}
              tone={s === 'pagada' ? 'emerald' : s === 'apelada' ? 'amber' : 'sky'}
              onClick={() => setFilters({ status: toggle(filters.status, s) })}
            >
              {VIOLATION_STATUS_LABEL[s]}
            </Chip>
          ))}
          <Chip
            active={filters.appealPending}
            tone="rose"
            onClick={() => setFilters({ appealPending: !filters.appealPending })}
            title="Solo expedientes con recurso pendiente"
          >
            <Icon name="gavel" size={11} /> Apelación pendiente
          </Chip>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {newBadge > 0 ? (
            <Chip
              tone="violet"
              active
              onClick={() => {
                violationsStore.getState().resetNewBadge()
                violationsStore.getState().load({ silent: true })
              }}
            >
              <Icon name="flame" size={11} className="live-dot" />
              {newBadge} capturas nuevas
            </Chip>
          ) : null}
          <Select aria-label="Orden de la tabla" value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value })} className="h-8 w-[130px]">
            <option value="recent">Más recientes</option>
            <option value="oldest">Más antiguas</option>
            <option value="amount">Mayor importe</option>
          </Select>
          <Select
            aria-label="Registros por página"
            value={String(filters.pageSize)}
            onChange={(e) => setFilters({ pageSize: Number(e.target.value) })}
            className="h-8 w-[92px]"
          >
            {PAGE_SIZES.map((ps) => (
              <option key={ps} value={ps}>
                {ps} / pág.
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  )
}

const ROW_H = 44

const TH = ['Exp. · fecha', 'Matrícula', 'Tipo', 'Cámara / vía', 'Velocidad', 'Importe', 'Estado', 'Recurso']
const GRID_COLS =
  'grid-cols-[210px_110px_minmax(120px,1fr)_minmax(150px,1.3fr)_96px_84px_120px_104px]'

function ViolationsTable({ status, items }) {
  const containerRef = useRef(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_H,
    overscan: 10,
  })

  return (
    <div className="min-h-0 flex-1 px-3 pb-1">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
        <div role="row" className={cx('grid gap-2 border-b border-slate-800 bg-slate-800/40 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500', GRID_COLS)}>
          {TH.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        {status === 'loading' && items.length === 0 ? (
          <div className="space-y-1.5 p-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="skeleton h-8 rounded-md" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon="doc" title="Sin resultados" hint="Ajusta los filtros o espera nuevas capturas del canal de telemetría." />
        ) : (
          <div ref={containerRef} role="table" aria-rowcount={items.length} tabIndex={0} className="min-h-0 flex-1 overflow-y-auto focus-visible:outline-none">
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((vItem) => {
                const v = items[vItem.index]
                return <ViolationRow key={v.code} v={v} index={vItem.index} style={{ top: vItem.start, height: vItem.size }} />
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ViolationRow({ v, index, style }) {
  const select = violationsStore((s) => s.select)
  const selectedCode = violationsStore((s) => s.selectedCode)
  return (
    <div
      role="row"
      aria-rowindex={index + 1}
      tabIndex={0}
      onClick={() => select(v.code)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          select(v.code)
        }
      }}
      className={cx(
        'absolute inset-x-1 grid cursor-pointer items-center gap-2 rounded-md border-l-2 px-2 text-[12px] transition-colors hover:bg-slate-800/70 focus-visible:bg-sky-500/10 focus-visible:outline-none',
        GRID_COLS,
        selectedCode === v.code ? 'border-l-sky-400 bg-sky-500/10' : 'border-l-transparent',
      )}
      style={style}
      aria-label={`Infracción ${v.code} de ${v.plate}, ${VIOLATION_TYPE_LABEL[v.type]}, importe ${fmtMoney(v.amount)} €`}
    >
      <span className="flex items-center gap-2 truncate">
        <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: VIOLATION_TYPE_COLOR[v.type] }} aria-hidden="true" />
        <span className="font-mono text-[11.5px] text-slate-400">{v.code}</span>
        <span className="truncate text-slate-500" title={fmtStampClock(v.captureAt)}>
          {timeAgo(v.captureAt)}
        </span>
      </span>
      <span className="font-mono text-amber-200">{v.plate}</span>
      <span className="truncate text-slate-300" title={VIOLATION_TYPE_LABEL[v.type]}>
        {VIOLATION_TYPE_LABEL[v.type]}
      </span>
      <span className="truncate text-slate-400">
        {v.cameraName} <span className="text-slate-600">·</span> <span className="text-slate-500">{v.roadName}</span>
      </span>
      <span className="font-mono tabular-nums">
        {v.speedRecorded ? (
          <>
            <span className={v.speedRecorded - v.speedLimit > 40 ? 'text-rose-300' : 'text-amber-300'}>{v.speedRecorded}</span>
            <span className="text-slate-500">/{v.speedLimit}</span>
          </>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </span>
      <span className="font-mono tabular-nums text-slate-200">{fmtMoney(v.amount)}</span>
      <span>
        <Badge tone={v.status === 'pagada' ? 'ok' : v.status === 'apelada' ? 'warn' : v.status === 'resuelta' ? 'violet' : 'info'}>
          {VIOLATION_STATUS_LABEL[v.status]}
        </Badge>
      </span>
      <span className="flex items-center gap-1 text-[11px]">
        {v.appeal ? (
          <span className={cx('flex items-center gap-1', v.appeal.status === 'resuelta' ? 'text-emerald-300' : 'text-amber-300')}>
            <Icon name="gavel" size={11} />
            {v.appeal.status}
          </span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </span>
    </div>
  )
}

function PaginationBar({ total, page, pageSize }) {
  const setPage = violationsStore((s) => s.setPage)
  const pagesTotal = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-3 py-2 text-[12px] text-slate-400">
      <span>{total === 0 ? 'Sin registros' : `${fmtNumber.format(start)}–${fmtNumber.format(end)} de ${fmtNumber.format(total)} expedientes`}</span>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="subtle" icon="chevronLeft" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Página anterior">
          Anterior
        </Button>
        <span className="font-mono tabular-nums">
          {page} / {pagesTotal}
        </span>
        <Button size="sm" variant="subtle" iconEnd="chevronRight" disabled={page >= pagesTotal} onClick={() => setPage(page + 1)} aria-label="Página siguiente">
          Siguiente
        </Button>
      </div>
    </div>
  )
}

function ExportCsvButton({ items }) {
  const [done, setDone] = useState(false)
  const download = () => {
    const header = ['expediente', 'captura', 'camara', 'via', 'matricula', 'tipo', 'velocidad', 'limite', 'importe_eur', 'puntos', 'estado', 'recurso']
    const rows = items.map((v) =>
      [
        v.code,
        v.captureAt,
        v.cameraName,
        v.roadName,
        v.plate,
        v.type,
        v.speedRecorded ?? '',
        v.speedLimit ?? '',
        v.amount,
        v.points,
        v.status,
        v.appeal ? v.appeal.status : '',
      ].map(csvCell).join(';'),
    )
    const csv = `\ufeff${header.join(';')}\n${rows.join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'infracciones-pagina.csv'
    a.click()
    URL.revokeObjectURL(url)
    setDone(true)
    setTimeout(() => setDone(false), 1500)
  }

  function csvCell(value) {
    if (value == null) return ''
    let text = String(value)
    if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return (
    <Button size="md" variant="subtle" icon={done ? 'check' : 'download'} onClick={download}>
      CSV página
    </Button>
  )
}
