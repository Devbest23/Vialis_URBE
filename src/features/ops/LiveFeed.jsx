import { useState } from 'react'
import { trafficStore } from '../../store/trafficStore.js'
import { uiStore, flyTo } from '../../store/uiStore.js'
import { Icon } from '../../components/Icon.jsx'
import { timeAgo } from '../../lib/format.js'
import { cx, EmptyState } from '../../components/ui.jsx'
import { Drawer } from '../../components/Drawer.jsx'

const TONE_COLOR = {
  rose: 'text-rose-300 bg-rose-500/10',
  amber: 'text-amber-300 bg-amber-500/10',
  emerald: 'text-emerald-300 bg-emerald-500/10',
  sky: 'text-sky-300 bg-sky-500/10',
  violet: 'text-violet-300 bg-violet-500/10',
  slate: 'text-slate-400 bg-slate-700/40',
}

const KIND_ICON = { new: 'alert', status: 'check', camera: 'camera', violation: 'currency', telemetry: 'flow' }

export function LiveFeed() {
  const feed = trafficStore((s) => s.feed)
  const lastPacketAt = trafficStore((s) => s.stats.lastPacketAt)
  const connected = trafficStore((s) => s.telemetryStatus.connected)
  const [expanded, setExpanded] = useState(false)
  const [fullScreen, setFullScreen] = useState(false)

  const jumpTo = (id) => {
    const inc = trafficStore.getState().incidents.find((i) => i.id === id)
    if (!inc) return
    uiStore.getState().selectIncident(id)
    flyTo.fn?.([inc.lat, inc.lng], 15)
    setExpanded(false)
  }

  const connectionLabel = connected ? 'En directo' : lastPacketAt ? 'Reconectando' : 'En espera'

  return (
    <section aria-label="Actividad en vivo" className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60">
      <header className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <h2 className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-300">
          <Icon name="flow" size={13} />
          Actividad en vivo
        </h2>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className={cx('h-1.5 w-1.5 rounded-full', connected ? 'bg-emerald-400 live-dot' : lastPacketAt ? 'bg-amber-400' : 'bg-slate-600')} />
            {connectionLabel}
          </span>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label="Ampliar actividad en vivo"
            title="Ampliar actividad"
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <Icon name="maximize" size={13} />
          </button>
        </div>
      </header>
      <FeedList feed={feed} jumpTo={jumpTo} compact />
      <Drawer
        open={expanded}
        onClose={() => setExpanded(false)}
        title={
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Actividad en vivo</h2>
            <p className="text-[11px] text-slate-500">{feed.length} eventos recientes · {connectionLabel}</p>
          </div>
        }
        ariaLabel="Actividad en vivo"
        wide
        fullScreen={fullScreen}
        onToggleFullscreen={() => setFullScreen((value) => !value)}
      >
        <FeedList feed={feed} jumpTo={jumpTo} />
      </Drawer>
    </section>
  )
}

function FeedList({ feed, jumpTo, compact = false }) {
  if (!feed.length) {
    return <EmptyState icon="radio" title="Sintonizando…" hint="El canal de telemetría enviará eventos en breve." />
  }
  return (
    <ul className={cx('min-h-0 flex-1 overflow-y-auto', compact ? 'space-y-1 p-2' : 'space-y-2 p-4')}>
      {feed.map((event, index) => (
        <li
          key={`${event.t}-${event.kind}-${event.id || event.text}-${index}`}
          className={cx(
            'flex items-start gap-2 rounded-lg',
            compact ? 'px-2 py-1.5 text-[11.5px]' : 'px-3 py-2.5 text-sm',
            TONE_COLOR[event.tone] || 'bg-slate-800/40 text-slate-300',
          )}
        >
          <span className="mt-0.5 shrink-0">
            <Icon name={KIND_ICON[event.kind] || 'radio'} size={compact ? 12 : 15} />
          </span>
          <span className="min-w-0 flex-1 leading-snug">
            {event.id ? (
              <button type="button" className="text-left hover:underline" onClick={() => jumpTo(event.id)}>
                {event.text}
              </button>
            ) : (
              <span>{event.text}</span>
            )}
            <span className="ml-2 whitespace-nowrap text-slate-500">{timeAgo(event.t)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
