import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon.jsx'
import { useFocusTrap } from '../hooks/useFocusTrap.js'

const cx = (...p) => p.filter(Boolean).join(' ')

export function Drawer({ open, onClose, title, subtitle, children, footer, wide = false, fullScreen = false, onToggleFullscreen, ariaLabel }) {
  const contentRef = useRef(null)
  const { onKeyDown } = useFocusTrap(contentRef)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const bodyPad = window.innerWidth - document.documentElement.clientWidth
    document.documentElement.style.overflow = 'hidden'
    document.body.style.paddingRight = `${bodyPad}px`
    const t = setTimeout(() => {
      const target =
        contentRef.current?.querySelector('[data-autofocus]') ||
        contentRef.current?.querySelector('button, input, select, textarea, video, [tabindex]:not([tabindex="-1"])')
      target?.focus()
    }, 10)
    return () => {
      clearTimeout(t)
      document.documentElement.style.overflow = ''
      document.body.style.paddingRight = ''
      if (prev instanceof HTMLElement && document.contains(prev)) prev.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[1100]">
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === 'string' ? title : 'Panel de detalle')}
        onKeyDown={onKeyDown}
        className={cx(
          'anim-slide flex w-full flex-col bg-[#0d1526] shadow-2xl shadow-black/70',
          fullScreen ? 'absolute inset-0 max-w-none' : 'absolute inset-y-0 right-0',
          fullScreen ? '' : wide ? 'max-w-4xl' : 'max-w-xl',
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">{title}</div>
          <div className="flex shrink-0 items-center gap-1">
            {onToggleFullscreen ? (
              <button
                type="button"
                onClick={onToggleFullscreen}
                aria-label={fullScreen ? 'Restaurar tamaño del panel' : 'Ver a pantalla completa'}
                title={fullScreen ? 'Restaurar tamaño' : 'Pantalla completa'}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                <Icon name={fullScreen ? 'minimize' : 'maximize'} size={15} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar panel (Escape)"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <footer className="border-t border-slate-800 px-4 py-3">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}
