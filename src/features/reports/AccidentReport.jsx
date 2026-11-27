import { useEffect, useMemo, useState } from 'react'
import {
  ACCIDENT_CATEGORY_LABEL,
  ACCIDENT_CATEGORY_ORDER,
  INCIDENT_STATUS_LABEL,
  REPORT_RANGE_LABEL,
  REPORT_RANGE_ORDER,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  SOURCE_LABEL,
} from '../../lib/domain.js'
import { api } from '../../api/client.js'
import { trafficStore } from '../../store/trafficStore.js'
import { flyToIncident, uiStore } from '../../store/uiStore.js'
import { fmtClockShort, fmtDateLong, fmtDateShort, fmtNumber, timeAgo } from '../../lib/format.js'
import { Badge, Button, Chip, EmptyState, Panel, cx } from '../../components/ui.jsx'
import { Icon } from '../../components/Icon.jsx'

const STATUS_TONE = { nuevo: 'danger', verificado: 'warn', en_atencion: 'info', resuelto: 'ok', descartado: 'plain' }

export function AccidentReport() {
  const incidents = trafficStore((s) => s.incidents)
  const [range, setRange] = useState('week')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [expandedId, setExpandedId] = useState(null)

  const signature = useMemo(() => {
    let count = 0
    let latest = ''
    for (const incident of incidents) {
      if (incident.type !== 'accidente') continue
      count += 1
      if (incident.updatedAt > latest) latest = incident.updatedAt
    }
    return `${count}:${latest}`
  }, [incidents])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const report = await api.getAccidentReport(range)
        if (!cancelled) setData(report)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, data ? 350 : 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, signature, reloadKey])

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mb-3 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-slate-100">
            <Icon name="file" size={16} className="text-sky-300" /> Informe de accidentes de tránsito
          </h2>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Agregación por categoría, gravedad y día. {data ? `${data.total} accidentes en el periodo · generado ${timeAgo(data.generatedAt)}` : 'Cargando datos…'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {REPORT_RANGE_ORDER.map((option) => (
            <Chip key={option} active={range === option} onClick={() => setRange(option)}>
              {REPORT_RANGE_LABEL[option]}
            </Chip>
          ))}
          <div className="mx-1 hidden h-5 w-px bg-slate-700 sm:block" />
          <Button size="sm" variant="outline" icon="download" disabled={!data || data.total === 0} onClick={() => data && exportCsv(data)}>
            CSV
          </Button>
          <Button size="sm" variant="outline" icon="printer" disabled={!data || data.total === 0} onClick={() => data && printReport(data)}>
            Imprimir
          </Button>
          <Button size="sm" variant="ghost" icon="refresh" loading={loading} onClick={() => setReloadKey((key) => key + 1)} aria-label="Actualizar informe" />
        </div>
      </div>

      {error ? (
        <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-300">
          <Icon name="alert" size={14} /> {error}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setReloadKey((key) => key + 1)}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {!data && loading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skeleton h-16 rounded-lg border border-slate-800 bg-slate-900/60" />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          {loading ? (
            <div className="mb-2 flex items-center gap-1.5 text-[11px] text-sky-300">
              <Icon name="refresh" size={11} className="animate-spin" /> Actualizando informe…
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Accidentes" value={data.total} tone="sky" icon="accidente" />
            <Kpi label="Alta gravedad" value={data.totals.critical} tone="rose" icon="siren" />
            <Kpi label="Heridos" value={data.totals.injuries} tone="amber" icon="users" />
            <Kpi label="Vehículos" value={data.totals.vehicles} tone="slate" icon="car" />
            <Kpi label="Resueltos" value={data.totals.resolved} tone="emerald" icon="check" />
            <Kpi label="Pendientes" value={data.totals.pending} tone="violet" icon="clock" />
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            <Panel className="p-3 xl:col-span-1">
              <PanelTitle icon="filter" title="Por categoría" hint="Distribución del periodo" />
              {data.byCategory.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-slate-500">Sin accidentes registrados.</p>
              ) : (
                <div className="space-y-2">
                  {orderedCategories(data.byCategory).map((row) => (
                    <div key={row.value}>
                      <div className="mb-0.5 flex items-center justify-between gap-2 text-[11.5px]">
                        <span className="text-slate-300">{ACCIDENT_CATEGORY_LABEL[row.value] || 'Sin categoría'}</span>
                        <span className="font-mono text-slate-400">
                          {row.count} · {Math.round((row.count / Math.max(1, data.total)) * 100)}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-sky-500"
                          style={{ width: `${Math.max(4, (row.count / data.total) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel className="p-3">
              <PanelTitle icon="siren" title="Por gravedad" hint="Impacto operativo" />
              <div className="space-y-2">
                {data.bySeverity.length === 0 ? (
                  <p className="py-6 text-center text-[12px] text-slate-500">Sin datos.</p>
                ) : (
                  data.bySeverity.map((row) => (
                    <div key={row.value} className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[row.value] || '#64748b' }} />
                      <span className="flex-1 text-[11.5px] text-slate-300">{SEVERITY_LABEL[row.value] || row.value}</span>
                      <span className="font-mono text-[11.5px] text-slate-400">{row.count}</span>
                      <span className="w-10 text-right text-[10.5px] text-slate-500">
                        {Math.round((row.count / Math.max(1, data.total)) * 100)}%
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 border-t border-slate-800 pt-2">
                <p className="mb-1.5 text-[11px] font-medium text-slate-400">Estado de atención</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.byStatus.map((row) => (
                    <Badge key={row.value} tone={STATUS_TONE[row.value] || 'plain'}>
                      {INCIDENT_STATUS_LABEL[row.value] || row.value}: {row.count}
                    </Badge>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel className="p-3">
              <PanelTitle icon="clock" title="Evolución diaria" hint={`${REPORT_RANGE_LABEL[data.range]}`} />
              {data.byDay.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-slate-500">Sin datos diarios.</p>
              ) : (
                <DailyChart days={data.byDay} />
              )}
              <div className="mt-3 border-t border-slate-800 pt-2 text-[11px] text-slate-500">
                {data.from ? `Periodo desde ${fmtDateLong(data.from)}` : 'Histórico completo sin filtro temporal'}
              </div>
            </Panel>
          </div>

          <Panel className="mt-3 overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
              <PanelTitle icon="file" title="Detalle de accidentes" hint={`${data.items.length} registros`} className="mb-0" />
              <span className="text-[11px] text-slate-500">Haz clic en una fila para ver el detalle</span>
            </div>
            {data.items.length === 0 ? (
              <EmptyState icon="accidente" title="Sin accidentes en el periodo" hint="Cambia el rango a semana, mes o todos para ampliar la consulta." />
            ) : (
              <div className="divide-y divide-slate-800/70">
                {data.items.map((item) => (
                  <AccidentRow
                    key={item.id}
                    item={item}
                    expanded={expandedId === item.id}
                    onToggle={() => setExpandedId((current) => (current === item.id ? null : item.id))}
                  />
                ))}
              </div>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  )
}

function Kpi({ label, value, tone, icon }) {
  const tones = {
    sky: 'text-sky-300',
    rose: 'text-rose-300',
    amber: 'text-amber-300',
    slate: 'text-slate-200',
    emerald: 'text-emerald-300',
    violet: 'text-violet-300',
  }
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <Icon name={icon} size={12} /> {label}
      </p>
      <p className={cx('mt-0.5 font-mono text-xl tabular-nums', tones[tone] || tones.slate)}>{fmtNumber.format(value)}</p>
    </div>
  )
}

function PanelTitle({ icon, title, hint, className }) {
  return (
    <div className={cx('mb-2', className)}>
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-200">
        <Icon name={icon} size={13} className="text-sky-300" /> {title}
      </p>
      {hint ? <p className="mt-0.5 text-[10.5px] text-slate-500">{hint}</p> : null}
    </div>
  )
}

function DailyChart({ days }) {
  const max = Math.max(1, ...days.map((day) => day.count))
  return (
    <div>
      <div className="flex h-28 items-end gap-1">
        {days.map((day) => (
          <div key={day.date} className="group relative flex h-full flex-1 items-end" title={`${fmtDateLong(day.date)}: ${day.count}`}>
            <div
              className="w-full rounded-t-sm bg-sky-500/75 transition-colors group-hover:bg-sky-400"
              style={{ height: `${Math.max(4, (day.count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{fmtDateShort(days[0].date)}</span>
        {days.length > 2 ? <span>{fmtDateShort(days[Math.floor(days.length / 2)].date)}</span> : null}
        <span>{fmtDateShort(days[days.length - 1].date)}</span>
      </div>
    </div>
  )
}

function AccidentRow({ item, expanded, onToggle }) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cx('grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2.5 text-left transition-colors sm:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)_repeat(3,auto)_auto]', expanded ? 'bg-sky-500/[0.06]' : 'hover:bg-slate-800/30')}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: `${SEVERITY_COLOR[item.severity]}22`, color: SEVERITY_COLOR[item.severity] }}>
          <Icon name="accidente" size={14} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-medium text-slate-200">{ACCIDENT_CATEGORY_LABEL[item.category] || 'Sin categoría'} · {item.title}</span>
          <span className="block truncate text-[10.5px] text-slate-500">
            {item.id} · {fmtDateLong(item.reportedAt)} {fmtClockShort(item.reportedAt)} · {item.roadName || 'Vía sin identificar'}
          </span>
        </span>
        <span className="hidden text-right text-[11px] text-slate-400 sm:block">
          <span className="block">{item.vehicles ?? '—'} vehículos</span>
          <span className="block text-slate-500">{item.injuries ?? '—'} heridos</span>
        </span>
        <Badge tone={STATUS_TONE[item.status]} className="hidden sm:inline-flex">{INCIDENT_STATUS_LABEL[item.status]}</Badge>
        <Badge tone={item.severity === 'critica' || item.severity === 'alta' ? 'danger' : item.severity === 'media' ? 'warn' : 'plain'} className="hidden md:inline-flex">
          {SEVERITY_LABEL[item.severity]}
        </Badge>
        <Badge tone="plain" className="hidden lg:inline-flex">{SOURCE_LABEL[item.source] || item.source}</Badge>
        <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={14} className="text-slate-500" />
      </button>
      {expanded ? (
        <div className="grid gap-3 border-t border-slate-800/70 bg-slate-950/40 px-3 py-3 text-[11.5px] md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-2">
            <p className="leading-relaxed text-slate-300">{item.detail}</p>
            {item.resolution ? (
              <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-2.5 py-1.5 text-emerald-200/90">
                <span className="font-medium">Resolución:</span> {item.resolution}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button
                size="sm"
                variant="outline"
                icon="crosshair"
                onClick={() => {
                  flyToIncident(item)
                  uiStore.getState().setTab('control')
                }}
              >
                Ver en el mapa
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon="wrench"
                onClick={() => {
                  uiStore.getState().selectIncident(item.id)
                  uiStore.getState().setReportsTab('solve')
                }}
              >
                Abrir en bandeja
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
            <DetailMeta label="Categoría" value={ACCIDENT_CATEGORY_LABEL[item.category] || 'Sin categoría'} />
            <DetailMeta label="Gravedad" value={SEVERITY_LABEL[item.severity]} />
            <DetailMeta label="Vehículos" value={item.vehicles ?? '—'} />
            <DetailMeta label="Heridos" value={item.injuries ?? '—'} />
            <DetailMeta label="Confirmaciones" value={item.confirmedBy} />
            <DetailMeta label="Fuente" value={SOURCE_LABEL[item.source] || item.source} />
            <DetailMeta label="Coordenadas" value={`${Number(item.lat).toFixed(4)}, ${Number(item.lng).toFixed(4)}`} />
            <DetailMeta label="Actualizado" value={timeAgo(item.updatedAt)} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DetailMeta({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="truncate text-[11px] font-medium text-slate-300" title={String(value)}>{value}</p>
    </div>
  )
}

function orderedCategories(rows) {
  const weights = new Map(ACCIDENT_CATEGORY_ORDER.map((key, index) => [key, index]))
  return rows.slice().sort((a, b) => (weights.get(a.value) ?? 99) - (weights.get(b.value) ?? 99) || b.count - a.count)
}

function csvCell(value) {
  if (value == null) return ''
  let text = String(value)
  if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`
  if (/[";\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function exportCsv(data) {
  const header = ['ID', 'Fecha', 'Categoría', 'Gravedad', 'Estado', 'Vía', 'Vehículos', 'Heridos', 'Confirmaciones', 'Fuente', 'Latitud', 'Longitud', 'Descripción', 'Resolución']
  const lines = [header.join(';')]
  for (const item of data.items) {
    lines.push(
      [
        item.id,
        item.reportedAt,
        ACCIDENT_CATEGORY_LABEL[item.category] || 'Sin categoría',
        SEVERITY_LABEL[item.severity] || item.severity,
        INCIDENT_STATUS_LABEL[item.status] || item.status,
        item.roadName || '',
        item.vehicles ?? '',
        item.injuries ?? '',
        item.confirmedBy,
        SOURCE_LABEL[item.source] || item.source,
        item.lat,
        item.lng,
        item.detail,
        item.resolution || '',
      ]
        .map(csvCell)
        .join(';'),
    )
  }
  const blob = new Blob([`\ufeff${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `informe-accidentes-${data.range}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  uiStore.getState().pushToast({ tone: 'ok', icon: 'download', title: 'CSV exportado', message: `${data.items.length} accidentes incluidos.` })
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

function printReport(data) {
  const win = window.open('', '_blank', 'width=980,height=720')
  if (!win) {
    uiStore.getState().pushToast({ tone: 'danger', icon: 'alert', title: 'No se pudo abrir la impresión', message: 'Permite las ventanas emergentes para imprimir el informe.' })
    return
  }
  const categories = data.byCategory
    .map((row) => `${escapeHtml(ACCIDENT_CATEGORY_LABEL[row.value] || 'Sin categoría')}: ${row.count}`)
    .join(' · ')
  const rows = data.items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.id)}</td>
        <td>${escapeHtml(fmtDateLong(item.reportedAt))}</td>
        <td>${escapeHtml(ACCIDENT_CATEGORY_LABEL[item.category] || 'Sin categoría')}</td>
        <td>${escapeHtml(SEVERITY_LABEL[item.severity])}</td>
        <td>${escapeHtml(INCIDENT_STATUS_LABEL[item.status])}</td>
        <td>${escapeHtml(item.roadName || '—')}</td>
        <td class="num">${item.vehicles ?? '—'}</td>
        <td class="num">${item.injuries ?? '—'}</td>
      </tr>`,
    )
    .join('')
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe de accidentes · VIALIS</title>
  <style>
    body{font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#111827;margin:28px;font-size:12px}
    h1{font-size:18px;letter-spacing:.12em;margin:0}
    .brand{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:14px}
    .muted{color:#64748b;font-size:11px}
    .kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:14px 0}
    .kpi{border:1px solid #cbd5e1;border-radius:6px;padding:8px}
    .kpi b{display:block;font-size:16px}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{border-bottom:1px solid #e2e8f0;padding:5px 4px;text-align:left;vertical-align:top}
    th{background:#f1f5f9;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}
    .num{text-align:right}
    @page{size:A4 landscape;margin:12mm}
  </style></head><body>
  <div class="brand"><div><h1>VIALIS</h1><p class="muted">Informe de accidentes de tránsito · ${escapeHtml(REPORT_RANGE_LABEL[data.range])}</p></div>
  <p class="muted">Generado ${escapeHtml(fmtDateLong(data.generatedAt))} ${escapeHtml(fmtClockShort(data.generatedAt))}</p></div>
  <div class="kpis">
    <div class="kpi"><span class="muted">Accidentes</span><b>${data.total}</b></div>
    <div class="kpi"><span class="muted">Alta gravedad</span><b>${data.totals.critical}</b></div>
    <div class="kpi"><span class="muted">Heridos</span><b>${data.totals.injuries}</b></div>
    <div class="kpi"><span class="muted">Vehículos</span><b>${data.totals.vehicles}</b></div>
    <div class="kpi"><span class="muted">Resueltos</span><b>${data.totals.resolved}</b></div>
    <div class="kpi"><span class="muted">Pendientes</span><b>${data.totals.pending}</b></div>
  </div>
  <p class="muted"><b>Por categoría:</b> ${categories || 'Sin datos'}</p>
  <table><thead><tr><th>ID</th><th>Fecha</th><th>Categoría</th><th>Gravedad</th><th>Estado</th><th>Vía</th><th class="num">Veh.</th><th class="num">Heridos</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="muted" style="margin-top:16px">Documento generado automáticamente por VIALIS. Datos simulados para demostración.</p>
  </body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 350)
}
