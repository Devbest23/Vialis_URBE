import { Icon } from '../../components/Icon.jsx'
import { Modal, Badge, cx } from '../../components/ui.jsx'
import { uiStore } from '../../store/uiStore.js'

const HOTKEYS = [
  ['1', 'Centro de control (mapa en vivo)'],
  ['2', 'Registro de infracciones'],
  ['3', 'Reportes e informes'],
  ['/', 'Foco en el buscador del módulo activo'],
  ['?', 'Abre esta ayuda'],
  ['↑ ↓ + Enter', 'Navegan y abren incidencias en la lista'],
  ['+ / −', 'Zoom del mapa (con el lienzo enfocado)'],
  ['Esc', 'Cierra paneles y modales'],
]

const ENDPOINTS = [
  ['POST', '/api/auth/register', 'Registro: nombre, correo y contraseña'],
  ['POST', '/api/auth/login', 'Inicio de sesión; devuelve token Bearer'],
  ['GET', '/api/auth/me', 'Valida la sesión activa'],
  ['GET', '/api/roads', 'Vías con flujo en tiempo real'],
  ['GET', '/api/cameras', 'Cámaras y su estado'],
  ['GET', '/api/incidents', 'Incidencias (opcional ?since=ISO)'],
  ['PATCH', '/api/incidents/:id/status', 'Transición de estado con nota de resolución'],
  ['POST', '/api/incidents/:id/confirm', 'Confirmación ciudadana única por cuenta'],
  ['GET', '/api/violations?...', 'Infracciones paginadas y filtradas'],
  ['POST', '/api/violations/:code/appeal', 'Radicar apelación ciudadana'],
  ['POST', '/api/reports', 'Reporte ciudadano con lat/lng y antifraude'],
  ['GET', '/api/reports/accidents', 'Informe ?range=day|week|month|all'],
  ['WS', '/ws/telemetry?token=…', 'Telemetría en vivo autenticada'],
]

export function HelpModal() {
  const open = uiStore((s) => s.helpOpen)
  return (
    <Modal open={open} onClose={() => uiStore.getState().setHelpOpen(false)} title="Atajos, accesibilidad y contratos de la API" wide>
      <div className="grid gap-5 p-4 sm:grid-cols-2">
        <section>
          <h3 className="mb-2 text-[12px] font-semibold text-slate-300">Atajos de teclado</h3>
          <dl className="space-y-1.5 text-[12px]">
            {HOTKEYS.map(([k, d]) => (
              <div key={k} className="flex items-baseline gap-3">
                <dt className="w-[110px] shrink-0 rounded bg-slate-800/80 px-2 py-0.5 text-center font-mono text-[11px] text-sky-200">{k}</dt>
                <dd className="text-slate-400">{d}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 rounded-lg bg-slate-800/50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            El mapa es una visualización no interactiva por teclado; toda la información está disponible en las listas
            (roles <code className="font-mono">listbox/table</code>) mediante navegación completa por teclado.
          </p>
        </section>
        <section>
          <h3 className="mb-2 text-[12px] font-semibold text-slate-300">API Python + SQLite</h3>
          <ul className="space-y-1 font-mono text-[11px]">
            {ENDPOINTS.map(([m, p]) => (
              <li key={p + m} className="flex items-start gap-2 rounded-md bg-slate-800/50 px-2 py-1.5">
                <Badge tone={m === 'GET' ? 'info' : m === 'POST' ? 'ok' : m === 'WS' ? 'violet' : 'warn'} className="shrink-0">
                  {m}
                </Badge>
                <span className="text-slate-300">{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Todas las rutas salvo registro e inicio de sesión requieren <code className="font-mono text-slate-400">Authorization: Bearer &lt;token&gt;</code>.
            La base SQLite persiste usuarios, sesiones, incidencias, historial, infracciones y apelaciones en{' '}
            <code className="font-mono text-slate-400">server/data/vialis.db</code>.
          </p>
        </section>
      </div>
    </Modal>
  )
}

export function Toasts() {
  const toasts = uiStore((s) => s.toasts)
  if (!toasts.length) return null
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-10 left-1/2 z-[1400] flex w-[min(94vw,430px)] -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}

function ToastItem({ toast }) {
  const tone = {
    ok: 'border-emerald-500/60 bg-emerald-950/80',
    warn: 'border-amber-500/60 bg-amber-950/80',
    danger: 'border-rose-500/60 bg-rose-950/80',
    info: 'border-sky-500/60 bg-sky-950/80',
  }[toast.tone || 'info']
  return (
    <div className={cx('anim-in pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3 py-2.5 shadow-2xl backdrop-blur', tone)} role="status">
      <span className="mt-0.5 text-slate-200">
        <Icon name={toast.icon || 'info'} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium leading-tight text-slate-100">{toast.title}</p>
        {toast.message ? <p className="mt-0.5 text-[11.5px] leading-snug text-slate-400">{toast.message}</p> : null}
      </div>
      <button type="button" aria-label="Descartar aviso" onClick={() => uiStore.getState().dismissToast(toast.id)} className="text-slate-500 hover:text-slate-200">
        <Icon name="x" size={13} />
      </button>
    </div>
  )
}
