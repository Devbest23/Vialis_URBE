import { trafficStore } from '../../store/trafficStore.js'
import { Sparkline } from '../../components/Sparkline.jsx'
import { Icon } from '../../components/Icon.jsx'
import { cx } from '../../components/ui.jsx'
import { fmtNumber } from '../../lib/format.js'

export function KpiRow() {
  const incidents = trafficStore((s) => s.incidents)
  const roads = trafficStore((s) => s.roads)
  const cameras = trafficStore((s) => s.cameras)
  const rateSeries = trafficStore((s) => s.rateSeries)

  const stats = computeKpis(incidents, roads, cameras)

  return (
    <section aria-label="Métricas operativas en tiempo real" className="grid grid-cols-2 gap-2">
      <Kpi icon="alert" tone="rose" label="Incidencias activas" value={fmtNumber.format(stats.activeCount)} note={`${stats.activePct}% del total histórico`} />
      <Kpi icon="flame" tone="amber" label="Graves o críticas" value={stats.criticalCount} note="requieren coordinación" />
      <Kpi icon="flow" tone="sky" label="Flujo medio urbano" value={`${Math.round(stats.avgSpeed)} km/h`} note="media de sensores en vías" />
      <Kpi icon="camera" tone="slate" label="Cámaras sin señal" value={stats.offlineCams} note={`de ${fmtNumber.format(cameras.length)} recientes`} />
      <div className="col-span-2 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
        <div>
          <p className="text-[11px] font-medium text-slate-400">Eventos de telemetría por minuto</p>
          <p className="font-mono text-xl leading-6 text-sky-300 tabular-nums">{fmtNumber.format(stats.eventsRate)}</p>
        </div>
        <TimeSpark values={rateSeries} />
      </div>
    </section>
  )
}

function computeKpis(incidents, roads, cameras) {
  let activeCount = 0
  let criticalCount = 0
  let enAtencion = 0
  for (const i of incidents) {
    if (i.status !== 'resuelto' && i.status !== 'descartado') activeCount++
    if (i.severity === 'critica' || i.severity === 'alta') criticalCount++
    if (i.status === 'en_atencion') enAtencion++
  }
  const speedSum = roads.reduce((a, r) => a + r.avgSpeedKph, 0)
  const avgSpeed = roads.length ? speedSum / roads.length : 0
  const offlineCams = cameras.reduce((a, c) => a + (c.status !== 'activa' ? 1 : 0), 0)
  return {
    activeCount,
    criticalCount,
    avgSpeed: avgSpeed || 0,
    offlineCams,
    eventsRate: trafficStore.getState().stats.eventsRate,
    enAtencion,
    activePct: incidents.length ? Math.round((activeCount * 100) / incidents.length) : 0,
  }
}

function Kpi({ icon, tone, label, value, note }) {
  const tones = {
    rose: 'text-rose-300',
    amber: 'text-amber-300',
    sky: 'text-sky-300',
    slate: 'text-slate-300',
  }
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
        <Icon name={icon} size={13} className={tones[tone]} />
        {label}
      </p>
      <p className={cx('mt-1 font-mono text-xl leading-6 tabular-nums', tones[tone])}>{value}</p>
      <p className="text-[10px] text-slate-500">{note}</p>
    </div>
  )
}

const sparkColor = '#38bdf8'

export function TimeSpark({ values }) {
  if (!values.length) return <div className="h-10 w-32" />
  return <Sparkline values={values.slice(-24)} color={sparkColor} w={150} h={40} className="shrink-0" />
}
