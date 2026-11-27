import { useEffect, useState } from 'react'
import {
  ACCIDENT_CATEGORY_LABEL,
  INCIDENT_STATUS_LABEL,
  INCIDENT_TRANSITIONS,
  INCIDENT_TYPE_LABEL,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  SOURCE_LABEL,
} from '../../lib/domain.js'
import { trafficStore } from '../../store/trafficStore.js'
import { flyToIncident, uiStore } from '../../store/uiStore.js'
import { Badge, Button, EmptyState, Textarea, cx } from '../../components/ui.jsx'
import { Icon, iconByIncidentType } from '../../components/Icon.jsx'
import { fmtClock, fmtDateLong, timeAgo } from '../../lib/format.js'

const STATUS_TONE = { nuevo: 'danger', verificado: 'warn', en_atencion: 'info', resuelto: 'ok', descartado: 'plain' }
const ACTION_ICON = { verificado: 'check', en_atencion: 'shield', resuelto: 'check', descartado: 'x' }
const ACTION_LABEL = { verificado: 'Verificar', en_atencion: 'Atender unidad', resuelto: 'Resolver', descartado: 'Descartar' }
const FINAL = new Set(['resuelto', 'descartado'])

export function IncidentDetail() {
  const selectedId = uiStore((s) => s.selectedIncidentId)
  const incident = trafficStore((s) => s.incidents.find((item) => item.id === selectedId) || null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(null)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    setError(null)
    setBusy(null)
    setNote('')
    setShowNote(null)
    setConfirmed(false)
  }, [selectedId])

  if (!incident) {
    return (
      <PanelShell>
        <EmptyState icon="crosshair" title="Selecciona una incidencia" hint="Desde la lista con teclado (↑ ↓ + Enter) o haciendo clic en el mapa." />
      </PanelShell>
    )
  }

  const transitions = INCIDENT_TRANSITIONS[incident.status] || []
  const isFinal = FINAL.has(incident.status)
  const noteValid = note.trim().length >= 10

  const runAction = async (next, noteText) => {
    if (FINAL.has(next) && !showNote) {
      setShowNote(next)
      setNote(incident.resolution || '')
      return
    }
    setBusy(next)
    setError(null)
    try {
      await trafficStore.getState().changeIncidentStatus(incident.id, next, noteText)
      uiStore.getState().pushToast({
        tone: next === 'descartado' ? 'warn' : 'ok',
        icon: ACTION_ICON[next],
        title: `Estado actualizado a "${INCIDENT_STATUS_LABEL[next]}"`,
        message: incident.title,
      })
      setShowNote(null)
      setNote('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const runConfirm = async () => {
    setBusy('confirm')
    setError(null)
    try {
      await trafficStore.getState().confirmIncident(incident.id)
      setConfirmed(true)
      uiStore.getState().pushToast({
        tone: 'ok',
        icon: 'users',
        title: 'Confirmación registrada',
        message: `${incident.id} suma una confirmación ciudadana.`,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <PanelShell>
      <div className="mb-2 flex items-start gap-2">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${SEVERITY_COLOR[incident.severity]}22`, color: SEVERITY_COLOR[incident.severity] }}
        >
          <Icon name={iconByIncidentType[incident.type] || 'pin'} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold leading-tight text-slate-100">{incident.title}</h2>
          <p className="text-[11px] text-slate-500">
            {incident.id} · {fmtDateLong(incident.reportedAt)} {fmtClock(incident.reportedAt)}
          </p>
        </div>
        <Badge tone={STATUS_TONE[incident.status]}>{INCIDENT_STATUS_LABEL[incident.status]}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11.5px]">
        <Meta label="Tipo" value={INCIDENT_TYPE_LABEL[incident.type]} />
        <Meta label="Gravedad" value={SEVERITY_LABEL[incident.severity]} />
        <Meta label="Fuente" value={SOURCE_LABEL[incident.source]} />
        <Meta label="Confirmaciones" value={String(incident.confirmedBy)} />
        <Meta label="Vía" value={incident.roadName || '—'} />
        <Meta label="Radio de impacto" value={`${incident.radiusM} m`} />
        <Meta label="Últ. actualización" value={timeAgo(incident.updatedAt)} />
        <Meta label="ETA de despeje" value={incident.clearEtaMin ? `~${incident.clearEtaMin} min` : '—'} />
        {incident.type === 'accidente' ? (
          <>
            <Meta label="Categoría" value={ACCIDENT_CATEGORY_LABEL[incident.category] || 'Sin categoría'} />
            <Meta label="Vehículos / heridos" value={`${incident.vehicles ?? '—'} / ${incident.injuries ?? '—'}`} />
          </>
        ) : null}
      </div>

      {incident.status === 'nuevo' ? (
        <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/50 px-2.5 py-2">
          <div className="flex items-center justify-between text-[10.5px] text-slate-500">
            <span>Validación ciudadana</span>
            <span className="font-mono">{Math.min(4, incident.confirmedBy)}/4</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, (incident.confirmedBy / 4) * 100)}%` }} />
          </div>
          <p className="mt-1 text-[10.5px] text-slate-500">Con 4 confirmaciones distintas el reporte pasa a Verificado.</p>
        </div>
      ) : null}

      <p className="mt-2 rounded-lg bg-slate-800/50 px-2.5 py-2 text-[11.5px] leading-relaxed text-slate-300">
        {incident.detail}
      </p>

      {incident.resolution ? (
        <div className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-2.5 py-2 text-[11.5px] leading-relaxed text-emerald-200/90">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300/80">Resolución</p>
          {incident.resolution}
        </div>
      ) : null}

      {showNote ? (
        <div className="mt-2 rounded-lg border border-sky-500/30 bg-sky-500/[0.05] p-2.5">
          <label htmlFor="resolution-note" className="text-[11.5px] font-medium text-slate-200">
            {showNote === 'descartado' ? 'Motivo del descarte' : 'Nota de resolución'} <span className="font-normal text-rose-300">· obligatoria</span>
          </label>
          <Textarea
            id="resolution-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLen={600}
            rows={3}
            className="mt-1 text-[12px]"
            placeholder={showNote === 'descartado' ? 'Explica por qué se descarta el reporte (falso, duplicado, sin evidencia)…' : 'Describe la solución aplicada, unidad interviniente y estado final de la vía…'}
          />
          <div className="mt-1.5 flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowNote(null)
                setNote('')
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              variant={showNote === 'descartado' ? 'danger' : 'primary'}
              icon={ACTION_ICON[showNote]}
              loading={busy === showNote}
              disabled={!noteValid}
              onClick={() => runAction(showNote, note)}
            >
              {showNote === 'descartado' ? 'Confirmar descarte' : 'Guardar resolución'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {transitions.map((next) => (
            <Button
              key={next}
              size="sm"
              variant={next === 'descartado' ? 'subtle' : 'primary'}
              icon={ACTION_ICON[next]}
              loading={busy === next}
              onClick={() => runAction(next)}
            >
              {ACTION_LABEL[next]}
            </Button>
          ))}
          {incident.source === 'ciudadano' && !isFinal ? (
            <Button
              size="sm"
              variant="ghost"
              icon="users"
              loading={busy === 'confirm'}
              disabled={confirmed}
              onClick={runConfirm}
              title="Sumar una confirmación ciudadana"
            >
              {confirmed ? 'Confirmado' : '+1 confirmación'}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            icon="crosshair"
            onClick={() => {
              flyToIncident(incident)
              uiStore.getState().setTab('control')
            }}
            title="Centrar en el mapa"
          />
        </div>
      )}

      {error ? (
        <p className="mt-2 rounded-md bg-rose-500/10 px-2.5 py-1.5 text-[11.5px] text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      {incident.history?.length ? (
        <div className="mt-3 border-t border-slate-800 pt-2">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <Icon name="clock" size={11} /> Historial
          </p>
          <ol className="space-y-1.5">
            {incident.history
              .slice()
              .reverse()
              .slice(0, 8)
              .map((entry) => (
                <li key={entry.id} className="flex gap-2 text-[11px]">
                  <span className={cx('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', historyDot(entry.status))} />
                  <div className="min-w-0">
                    <p className="text-slate-300">{entry.note}</p>
                    <p className="text-[10px] text-slate-500">
                      {entry.actorName || 'Sistema'} · {timeAgo(entry.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
          </ol>
        </div>
      ) : null}
    </PanelShell>
  )
}

function PanelShell({ children }) {
  return <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">{children}</section>
}

function Meta({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-slate-800/60 pb-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className="truncate text-right font-medium text-slate-300" title={value}>
        {value}
      </dd>
    </div>
  )
}

function historyDot(status) {
  if (status === 'verificado') return 'bg-amber-400'
  if (status === 'en_atencion') return 'bg-sky-400'
  if (status === 'resuelto') return 'bg-emerald-400'
  if (status === 'descartado') return 'bg-slate-500'
  return 'bg-rose-400'
}
