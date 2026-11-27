import { useEffect, useState } from 'react'
import {
  VIOLATION_STATUS_LABEL,
  VIOLATION_TYPE_LABEL,
  VIOLATION_TRANSITIONS,
  APPEAL_STAGE_LABEL,
  APPEAL_OUTCOME_LABEL,
  ROAD_CLASS_LABEL,
} from '../../lib/domain.js'
import { violationsStore } from '../../store/violationsStore.js'
import { uiStore } from '../../store/uiStore.js'
import { Drawer } from '../../components/Drawer.jsx'
import { Badge, Button, EmptyState, cx } from '../../components/ui.jsx'
import { Icon } from '../../components/Icon.jsx'
import { fmtMoney, fmtDateLong, fmtClock, fmtStampClock, timeAgo } from '../../lib/format.js'
import { EvidenceGallery } from './EvidenceGallery.jsx'
import { AppealWizard, AppealTimeline } from './AppealWizard.jsx'
import { BoletinPortal } from './BoletinPrint.jsx'

const STATUS_TONE = { emitida: 'info', notificada: 'sky', apelada: 'warn', resuelta: 'violet', pagada: 'ok' }

const SEQUENCE = ['Resumen', 'Evidencias', 'Datos captura', 'Apelación']

export function ViolationDetail({ open }) {
  const code = violationsStore((s) => s.selectedCode)
  const violation = violationsStore((s) => s.items.find((v) => v.code === s.selectedCode) || null)
  const [tab, setTab] = useState(0)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (!open) {
      setTab(0)
      setWizardOpen(false)
      setError(null)
      setPrinting(false)
    }
  }, [open])

  const startPrint = () => setPrinting(true)

  const close = () => violationsStore.getState().select(null)

  if (!code) return null

  if (!violation) {
    return (
      <Drawer open={open} onClose={close} title={<span className="text-sm font-semibold text-slate-200">Expediente {code}</span>}>
        <EmptyState icon="search" title="No está en la página actual" hint="El registro puede haberse movido de página tras la actualización del filtro o el canal en vivo." />
      </Drawer>
    )
  }

  const allowedNext = VIOLATION_TRANSITIONS[violation.status] || []
  const appealStatus = violation.appeal?.status

  const runTransition = async (next) => {
    setBusy(next)
    setError(null)
    try {
      if (next === 'notificada') await violationsStore.getState().markNotified(violation.code)
      else if (next === 'pagada') await violationsStore.getState().markPaid(violation.code)
      uiStore.getState().pushToast({ tone: 'ok', icon: 'check', title: `Expediente ${violation.code} → ${VIOLATION_STATUS_LABEL[next]}` })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      wide
      title={
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Expediente municipal</p>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-[15px] font-semibold text-slate-100">{violation.code}</h2>
            <Badge tone={STATUS_TONE[violation.status]}>{VIOLATION_STATUS_LABEL[violation.status]}</Badge>
            {appealStatus ? <Badge tone={appealStatus === 'resuelta' ? 'ok' : 'warn'}>recurso {APPEAL_STAGE_LABEL[appealStatus]}</Badge> : null}
          </div>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {allowedNext.map((n) => (
            <Button key={n} size="sm" variant={n === 'pagada' ? 'primary' : 'outline'} icon={n === 'pagada' ? 'currency' : 'send'} loading={busy === n} onClick={() => runTransition(n)}>
              {n === 'notificada' ? 'Marcar notificada' : 'Registrar pago'}
            </Button>
          ))}
          {!violation.appeal && allowedNext.length && violation.status !== 'pagada' ? (
            <Button size="sm" variant="subtle" icon="gavel" onClick={() => setWizardOpen(true)}>
              Formular apelación
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" icon="printer" onClick={startPrint} className="hidden sm:inline-flex">
            Boletín (imprimir)
          </Button>
        </div>
      }
    >
      <nav className="sticky top-0 z-10 flex gap-1 border-b border-slate-800 bg-[#0d1526]/95 px-3 pt-2 backdrop-blur" aria-label="Secciones del expediente">
        {SEQUENCE.map((label, ix) => (
          <button
            key={label}
            type="button"
            aria-selected={tab === ix}
            role="tab"
            onClick={() => setTab(ix)}
            className={cx(
              'rounded-t-md px-3 py-2 text-[12px] font-medium transition-colors',
              tab === ix ? 'border-b-2 border-sky-400 bg-slate-800/60 text-sky-200' : 'text-slate-400 hover:text-slate-200',
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="space-y-4 p-4">
        {error ? (
          <p role="alert" className="rounded-md bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-300">
            {error}
          </p>
        ) : null}

        {tab === 0 ? <SummaryTab violation={violation} /> : null}
        {tab === 1 ? <EvidenceGallery violation={violation} /> : null}
        {tab === 2 ? <DataTab violation={violation} /> : null}
        {tab === 3 ? <AppealTab violation={violation} onWizard={() => setWizardOpen(true)} /> : null}
      </div>

      <AppealWizard open={wizardOpen} violation={violation} onClose={() => setWizardOpen(false)} />
      <BoletinPortal active={printing} violation={violation} onDone={() => setPrinting(false)} />
    </Drawer>
  )
}

function SummaryTab({ violation }) {
  return (
    <>
      <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
        <Meta label="Tipo de infracción" value={VIOLATION_TYPE_LABEL[violation.type]} />
        <Meta label="Capturada" value={`${fmtDateLong(violation.captureAt)} · ${fmtClock(violation.captureAt)}`} />
        <Meta label="Cámara" value={`${violation.cameraName} (${violation.cameraId})`} />
        <Meta label="Vía" value={violation.roadName ? `${violation.roadName} · ${ROAD_CLASS_LABEL[violation.roadKlass] || ''}` : '—'} />
        <Meta
          label="Velocidad"
          value={violation.speedRecorded ? `${violation.speedRecorded} km/h (lím. ${violation.speedLimit})` : '—'}
        />
        <Meta label="Vehículo" value={violation.vehicle} />
        <Meta label="Matrícula" value={violation.plate} mono />
        <Meta label="Titular" value={`${violation.owner?.name} · ${violation.owner?.doc}`} />
        <Meta label="Importe" value={fmtMoney(violation.amount)} mono />
        <Meta label="Puntos" value={violation.points ? `−${violation.points}` : '0'} mono />
        <Meta label="Notificada" value={violation.notifiedAt ? fmtDateLong(violation.notifiedAt) : 'Pendiente'} />
        <Meta label="Pagada" value={violation.paidAt ? fmtDateLong(violation.paidAt) : '—'} />
      </div>
      <p className="rounded-lg bg-slate-800/60 px-3 py-2 text-[11.5px] text-slate-400">
        Coordenadas de captura: <span className="font-mono text-slate-300">{violation.lat?.toFixed(5)}, {violation.lng?.toFixed(5)}</span> · expediente abierto{' '}
        {timeAgo(violation.createdAt)}
      </p>
    </>
  )
}

function DataTab({ violation }) {
  const seq = violation.evidence?.seq || []
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full text-[12px]">
          <caption className="sr-only">Medidas crudas del expediente</caption>
          <thead className="bg-slate-800/60 text-[10.5px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-1.5 text-left">Muestra</th>
              <th className="px-3 py-1.5 text-left">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 font-mono">
            <Row label="Expediente" value={violation.code} />
            <Row label="Cámara" value={violation.cameraId} />
            <Row label="Matrícula leída" value={violation.plate} />
            <Row label="Vehículo" value={violation.vehicle} />
            <Row label="Velocidad registrada" value={violation.speedRecorded ? `${violation.speedRecorded} km/h` : 'n/a'} />
            <Row label="Límite en vía" value={violation.speedLimit ? `${violation.speedLimit} km/h` : 'n/a'} />
            <Row label="Margen" value={violation.speedRecorded && violation.speedLimit ? `${violation.speedRecorded - violation.speedLimit} km/h` : 'n/a'} />
            <Row label="Marcos fotográficos" value={String(violation.evidence?.frames?.length ?? 0)} />
            <Row label="Semilla de vídeo" value={String(violation.evidence?.videoSeed ?? '—')} />
          </tbody>
        </table>
      </div>
      {seq.length ? (
        <div>
          <h3 className="mb-1.5 text-[12px] font-semibold text-slate-300">Serie de radar (10 muestras)</h3>
          <div className="flex h-24 items-end gap-1.5 rounded-lg border border-slate-800 bg-slate-900/50 p-2">
            {seq.map((s, i) => (
              <div key={i} className="flex-1 rounded-sm bg-sky-500/60" style={{ height: `${Math.min(100, (s / Math.max(...seq)) * 88)}%` }} title={`Muestra ${i + 1}: ${s} km/h`}>
                <span className="sr-only">{s} km/h</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function AppealTab({ violation, onWizard }) {
  const appeal = violation.appeal
  if (!appeal) {
    return (
      <div className="space-y-3">
        <EmptyState
          icon="gavel"
          title="Sin recurso registrado"
          hint={violation.status === 'pagada' ? 'El expediente está pagado; no admite apelación.' : 'Como parte afectada puedes interponer apelación en un solo paso con este formulario.'}
        />
        {violation.status !== 'pagada' ? (
          <div className="flex justify-center">
            <Button variant="primary" icon="gavel" onClick={onWizard}>
              Iniciar apelación
            </Button>
          </div>
        ) : null}
      </div>
    )
  }
  return (
    <div className="space-y-3.5">
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[13px] text-slate-200">{appeal.id}</p>
          <p className="text-[11.5px] text-slate-500">Radicada {timeAgo(appeal.filedAt)} · {fmtStampClock(appeal.filedAt)}</p>
        </div>
        <div className="mt-3">
          <AppealTimeline appeal={appeal} />
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="text-[12px] font-semibold text-slate-300">Motivos invocados</h3>
        <ul className="flex flex-wrap gap-1.5">
          {appeal.motivos.map((m) => (
            <li key={m} className="rounded-md bg-slate-800/70 px-2 py-1 text-[11.5px] text-slate-300">
              {m}
            </li>
          ))}
        </ul>
        <h3 className="pt-1 text-[12px] font-semibold text-slate-300">Hechos alegados</h3>
        <p className="rounded-lg bg-slate-800/60 px-3 py-2.5 text-[12.5px] leading-relaxed text-slate-300">{appeal.statement}</p>
        {appeal.adjuntos?.length ? (
          <>
            <h3 className="pt-1 text-[12px] font-semibold text-slate-300">Adjuntos ({appeal.adjuntos.length})</h3>
            <ul className="space-y-1.5">
              {appeal.adjuntos.map((a, i) => (
                <li key={a.name + i} className="flex items-center gap-2 rounded-md bg-slate-800/50 px-2.5 py-1.5 text-[12px] text-slate-300">
                  <Icon name="file" size={12} />
                  <span className="truncate">{a.name}</span>
                  <span className="text-slate-500">{Math.round(a.size / 1000)} kB</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
      {appeal.status === 'resuelta' ? (
        <section className={cx('rounded-xl border p-3.5', appeal.outcome === 'estimada' ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10')}>
          <p className="flex items-center gap-2 text-[12.5px] font-semibold">
            <Icon name={appeal.outcome === 'estimada' ? 'check' : 'x'} size={14} className={appeal.outcome === 'estimada' ? 'text-emerald-300' : 'text-rose-300'} />
            {APPEAL_OUTCOME_LABEL[appeal.outcome]}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-300">{appeal.reasoning}</p>
          {appeal.outcome === 'desestimada' && violation.status !== 'pagada' ? (
            <p className="mt-2 text-[11.5px] text-slate-400">Faltará {violation.paidAt ? '' : 'pronunciar el pago en el pie del expediente con el beneficio de reducción del 30% dentro de 15 días naturales.'}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <tr>
      <th className="w-40 px-3 py-1.5 text-left font-normal text-slate-500">{label}</th>
      <td className="px-3 py-1.5 text-slate-300">{value}</td>
    </tr>
  )
}

function Meta({ label, value, mono }) {
  return (
    <div className="border-b border-slate-800/60 pb-1.5">
      <dt className="text-[10.5px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={cx('mt-0.5 text-[12.5px] text-slate-200', mono && 'font-mono')} title={String(value)}>
        {value}
      </dd>
    </div>
  )
}
