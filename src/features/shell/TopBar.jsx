import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon.jsx'
import { TABS, uiStore } from '../../store/uiStore.js'
import { violationsStore } from '../../store/violationsStore.js'
import { authStore } from '../../store/authStore.js'
import { cx, Badge, Button } from '../../components/ui.jsx'
import { fmtDigital } from '../../lib/format.js'

export function TopBar() {
  const tab = uiStore((s) => s.tab)
  const setTab = uiStore((s) => s.setTab)
  const setHelpOpen = uiStore((s) => s.setHelpOpen)
  const user = authStore((s) => s.user)
  const logout = authStore((s) => s.logout)
  const violationsBadge = violationsStore((s) => s.violationsTickBadge)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-800 bg-[#0c1424]/90 px-3">
      <div className="flex items-center gap-2 pr-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30">
          <Icon name="road" size={16} />
        </span>
        <div className="leading-none">
          <p className="text-[14px] font-bold tracking-[0.18em] text-slate-100">VIALIS</p>
          <p className="mt-0.5 text-[10px] text-slate-500">CONTROL VIAL URBANO</p>
        </div>
      </div>
      <nav aria-label="Módulos de la aplicación" className="ml-2 flex min-w-0 gap-1 overflow-x-auto">
        {TABS.map((item) => {
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-[12.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400',
                active
                  ? 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/30'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
              )}
            >
              <span className="hidden rounded bg-slate-800 px-1 font-mono text-[10px] text-slate-500 sm:inline">{item.hint}</span>
              {item.label}
              {item.id === 'violations' && violationsBadge > 0 ? (
                <span className="h-2 w-2 rounded-full bg-violet-400 live-dot" aria-label="Capturas nuevas" />
              ) : null}
            </button>
          )
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <Badge tone="warn" dot="bg-amber-400">
          DATOS SIMULADOS
        </Badge>
        <span className="hidden font-mono text-[13px] text-slate-300 tabular-nums md:inline" title="Reloj del centro de control">
          {fmtDigital(now)}
        </span>
        <div className="h-8 w-px bg-slate-700/70" aria-hidden="true" />
        <div className="hidden items-center gap-2 sm:flex">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-[10.5px] font-semibold uppercase text-sky-200 ring-1 ring-slate-700">
            {initials(user?.name)}
          </span>
          <div className="max-w-[140px] leading-tight">
            <p className="truncate text-[11.5px] font-medium text-slate-200">{user?.name}</p>
            <p className="truncate text-[10px] text-slate-500">{user?.email}</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon="shield"
          onClick={() => logout()}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <span className="hidden lg:inline">Salir</span>
        </Button>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="Ver atajos de teclado y contratos de la API"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800/70 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400"
        >
          <Icon name="help" size={16} />
        </button>
      </div>
    </header>
  )
}

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('') || 'V'
}
