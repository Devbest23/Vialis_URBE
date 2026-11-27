import { useEffect } from 'react'
import { TopBar } from './features/shell/TopBar.jsx'
import { StatusBar } from './features/shell/StatusBar.jsx'
import { HelpModal, Toasts } from './features/shell/HelpModal.jsx'
import { ControlCenter } from './features/ops/ControlCenter.jsx'
import { ViolationsView } from './features/violations/ViolationsView.jsx'
import { ReportsView } from './features/reports/ReportsView.jsx'
import { ReportModal } from './features/reports/ReportModal.jsx'
import { AuthScreen } from './features/auth/AuthScreen.jsx'
import { authStore } from './store/authStore.js'
import { trafficStore } from './store/trafficStore.js'
import { uiStore } from './store/uiStore.js'
import { useHotkeys } from './hooks/useHotkeys.js'
import { createTelemetryChannel } from './telemetry/channel.js'
import { Icon } from './components/Icon.jsx'

export default function App() {
  const status = authStore((s) => s.status)
  if (status === 'checking') return <Splash />
  if (status !== 'authenticated') return <AuthScreen />
  return <AppShell />
}

function AppShell() {
  const tab = uiStore((s) => s.tab)
  const token = authStore((s) => s.token)
  

  useEffect(() => {
    if (!token) return undefined
    const stop = createTelemetryChannel({
      token,
      onPacket: (packet) => trafficStore.getState().applyPacket(packet),
      onStatus: (status) => trafficStore.getState().setTelemetryStatus(status),
      onOpen: () => {
        trafficStore.getState().refreshIncidents().catch((err) => {
          uiStore.getState().pushToast({
            tone: 'danger',
            icon: 'alert',
            title: 'No se pudieron actualizar las incidencias',
            message: err.message,
          })
        })
      },
    })
    return () => {
      stop()
      trafficStore.getState().setTelemetryStatus({ connected: false, mode: 'ws', attempts: 0 })
    }
  }, [token])

  useHotkeys(
    (event) => {
      const activeTab = uiStore.getState().tab
      if (event.key === '1') uiStore.getState().setTab('control')
      else if (event.key === '2') uiStore.getState().setTab('violations')
      else if (event.key === '3') uiStore.getState().setTab('reports')
      else if (event.key === '?' || (event.key === 'h' && event.shiftKey)) uiStore.getState().setHelpOpen(true)
      else if (event.key === '/') {
        event.preventDefault()
        const id = activeTab === 'violations' ? 'viol-search' : activeTab === 'reports' ? 'report-search' : 'ops-search'
        document.getElementById(id)?.focus()
      } else if (event.key === 'Escape') {
        const { helpOpen, reportOpen, selectedCameraId } = uiStore.getState()
        if (helpOpen) uiStore.getState().setHelpOpen(false)
        if (selectedCameraId) uiStore.getState().selectCamera(null)
        if (reportOpen) uiStore.getState().setReportOpen(false)
      }
    },
    [tab],
  )

  return (
    <div className="flex h-full flex-col bg-[#0a0f1c]">
      <a
        href="#main-content"
        className="sr-only bg-sky-600 text-white focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[2000] focus:rounded focus:px-3 focus:py-1.5"
      >
        Saltar al contenido principal
      </a>
      <TopBar />
      <main id="main-content" className="min-h-0 flex-1">
        <ControlCenter visible={tab === 'control'} />
        <ViolationsView visible={tab === 'violations'} />
        <ReportsView visible={tab === 'reports'} />
      </main>
      <StatusBar />
      <HelpModal />
      <ReportModal />
      <Toasts />
    </div>
  )
}

function Splash() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#0a0f1c]">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30">
        <Icon name="road" size={26} />
      </span>
      <div className="text-center">
        <p className="text-[15px] font-bold tracking-[0.2em] text-slate-100">VIALIS</p>
        <p className="mt-1 text-[12px] text-slate-500">Validando sesión segura…</p>
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-sky-500" />
      </div>
    </div>
  )
}
