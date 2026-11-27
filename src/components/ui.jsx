import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon.jsx'

const cx = (...parts) => parts.filter(Boolean).join(' ')

export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', icon, iconEnd, loading, disabled, className, children, ...rest },
  ref,
) {
  const variants = {
    primary: 'bg-sky-600 text-white hover:bg-sky-500 focus-visible:outline-sky-300',
    danger: 'bg-rose-600 text-white hover:bg-rose-500 focus-visible:outline-rose-300',
    subtle: 'bg-slate-800/70 text-slate-200 hover:bg-slate-700/80 focus-visible:outline-slate-400',
    ghost: 'bg-transparent text-slate-300 hover:bg-slate-800/60 focus-visible:outline-slate-500',
    outline: 'border border-slate-700 text-slate-200 hover:border-sky-500 hover:text-sky-200 bg-slate-900/60',
  }
  const sizes = {
    sm: 'h-7 px-2.5 text-[12px] gap-1.5 rounded-md',
    md: 'h-9 px-3.5 text-[13px] gap-2 rounded-lg',
    lg: 'h-11 px-5 text-sm gap-2 rounded-lg font-semibold',
  }
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center font-medium transition-colors select-none',
        'focus-visible:outline-2 focus-visible:outline-offset-1 disabled:opacity-45 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Icon name="refresh" className="animate-spin" size={14} /> : icon ? <Icon name={icon} size={size === 'sm' ? 13 : 15} /> : null}
      {children}
      {iconEnd ? <Icon name={iconEnd} size={size === 'sm' ? 13 : 15} /> : null}
    </button>
  )
})

export const Chip = ({ active, tone = 'sky', className, children, ...rest }) => {
  const tones = {
    sky: 'border-sky-500/70 bg-sky-500/15 text-sky-200',
    rose: 'border-rose-500/70 bg-rose-500/15 text-rose-200',
    amber: 'border-amber-500/70 bg-amber-500/15 text-amber-200',
    emerald: 'border-emerald-500/70 bg-emerald-500/15 text-emerald-200',
    slate: 'border-slate-500/60 bg-slate-500/10 text-slate-300',
  }
  return (
    <button
      type="button"
      aria-pressed={!!active}
      className={cx(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400',
        active ? tones[tone] : 'border-slate-700/80 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:border-slate-600',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

const badgeTones = {
  critica: 'bg-rose-500/15 text-rose-300 ring-rose-500/40',
  alta: 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
  media: 'bg-sky-500/15 text-sky-300 ring-sky-500/40',
  baja: 'bg-slate-500/15 text-slate-300 ring-slate-500/40',
  ok: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40',
  info: 'bg-sky-500/15 text-sky-300 ring-sky-500/40',
  warn: 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
  danger: 'bg-rose-500/15 text-rose-300 ring-rose-500/40',
  violet: 'bg-violet-500/15 text-violet-300 ring-violet-500/40',
  plain: 'bg-slate-700/40 text-slate-300 ring-slate-600/50',
}

export const Badge = ({ tone = 'plain', dot, className, children }) => (
  <span
    className={cx(
      'inline-flex items-center gap-1 rounded-md px-1.5 h-5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap',
      badgeTones[tone] || badgeTones.plain,
      className,
    )}
  >
    {dot !== undefined && <span className={cx('h-1.5 w-1.5 rounded-full', dot)} />}
    {children}
  </span>
)

export const Field = ({ label, hint, error, children, id: idProp, className }) => {
  const auto = useId()
  const id = idProp || auto
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[12px] font-medium text-slate-300">
        {label}
        {hint ? <span className="ml-1 font-normal text-slate-500">· {hint}</span> : null}
      </label>
      {typeof children === 'function' ? children(id) : children}
      {error ? (
        <p className="text-[12px] text-rose-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

const inputCx =
  'h-9 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25'

export const Input = forwardRef(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputCx, className)} {...rest} />
})

export const Textarea = forwardRef(function Textarea({ className, maxLen, ...rest }, ref) {
  return (
    <div className="relative">
      <textarea ref={ref} maxLength={maxLen} className={cx(inputCx, 'h-28 resize-y py-2 leading-relaxed', className)} {...rest} />
      {maxLen ? <span className="absolute bottom-1.5 right-2.5 text-[11px] text-slate-500 tabular-nums">{rest.value?.length || 0}/{maxLen}</span> : null}
    </div>
  )
})

export const Select = forwardRef(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx(inputCx, 'pr-8', className)} {...rest}>
      {children}
    </select>
  )
})

export const Toggle = ({ checked, onChange, label }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2 text-[12px] text-slate-300"
    >
      <span
        className={cx(
          'relative h-4 w-7 rounded-full transition-colors',
          checked ? 'bg-sky-600' : 'bg-slate-700',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform',
            checked ? 'translate-x-3.5' : 'translate-x-0.5',
          )}
        />
      </span>
      {label}
    </button>
  )
}

export const Modal = ({ open, onClose, title, children, wide = false, className }) => {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const bodyPad = window.innerWidth - document.documentElement.clientWidth
    document.documentElement.style.overflow = 'hidden'
    document.body.style.paddingRight = `${bodyPad}px`
    const t = setTimeout(() => {
      const target = ref.current?.querySelector('[data-autofocus]') || ref.current?.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
      target?.focus()
    }, 10)
    return () => {
      clearTimeout(t)
      document.documentElement.style.overflow = ''
      document.body.style.paddingRight = ''
      if (prev instanceof HTMLElement && document.contains(prev)) prev.focus()
    }
  }, [open])

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const root = ref.current
        if (!root) return
        const focusables = [...root.querySelectorAll('a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])')].filter(
          (el) => el.offsetParent !== null || el === document.activeElement,
        )
        if (!focusables.length) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      }
    },
    [onClose],
  )

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-6" role="presentation">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        onKeyDown={onKeyDown}
        className={cx(
          'anim-in relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-slate-700/80 bg-[#0d1526] shadow-2xl shadow-black/60',
          wide ? 'max-w-3xl' : 'max-w-md',
          className,
        )}
      >
        {title ? (
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar" icon="x" />
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export const Panel = ({ className, children, ...rest }) => (
  <section className={cx('rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm', className)} {...rest}>
    {children}
  </section>
)

export const EmptyState = ({ icon = 'info', title, hint, children }) => (
  <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-slate-400">
      <Icon name={icon} size={20} />
    </div>
    <p className="text-sm font-medium text-slate-300">{title}</p>
    {hint ? <p className="max-w-xs text-[12px] text-slate-500">{hint}</p> : null}
    {children}
  </div>
)

export function useScrollToTop(dep, containerRef) {
  useLayoutEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0
  }, [dep, containerRef])
}

export { cx }
