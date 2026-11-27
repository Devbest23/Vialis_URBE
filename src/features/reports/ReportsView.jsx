import { uiStore } from '../../store/uiStore.js'
import { Button, cx } from '../../components/ui.jsx'
import { Icon } from '../../components/Icon.jsx'
import { SolveReports } from './SolveReports.jsx'
import { GenerateReport } from './ReportForm.jsx'
import { AccidentReport } from './AccidentReport.jsx'

const TABS = [
  { id: 'solve', label: 'Solucionar reportes', icon: 'wrench', hint: 'Bandeja y resolución' },
  { id: 'generate', label: 'Generar reporte', icon: 'send', hint: 'Radicar incidencia' },
  { id: 'accidents', label: 'Informe de accidentes', icon: 'file', hint: 'Día · semana · mes · todos' },
]

export function ReportsView({ visible }) {
  const reportsTab = uiStore((s) => s.reportsTab)
  if (!visible) return null

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/30 px-3 py-2">
        <div className="flex min-w-0 gap-1 overflow-x-auto" role="tablist" aria-label="Secciones de reportes">
          {TABS.map((tab) => {
            const active = reportsTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => uiStore.getState().setReportsTab(tab.id)}
                className={cx(
                  'flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400',
                  active ? 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/30' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200',
                )}
              >
                <Icon name={tab.icon} size={14} />
                <span>
                  <span className="block text-[12px] font-medium leading-tight">{tab.label}</span>
                  <span className={cx('block text-[10px] leading-tight', active ? 'text-sky-300/60' : 'text-slate-500')}>{tab.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
        <Button size="sm" variant="primary" icon="send" onClick={() => uiStore.getState().setReportOpen(true)}>
          Radicar reporte
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {reportsTab === 'solve' ? <SolveReports /> : null}
        {reportsTab === 'generate' ? <GenerateReport /> : null}
        {reportsTab === 'accidents' ? <AccidentReport /> : null}
      </div>
    </div>
  )
}
