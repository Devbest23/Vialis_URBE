import { useEffect, useState } from 'react'
import { APPEAL_GROUNDS, APPEAL_STAGE_LABEL, APPEAL_STAGE_ORDER } from '../../lib/domain.js'
import { violationsStore } from '../../store/violationsStore.js'
import { uiStore } from '../../store/uiStore.js'
import { Modal, Button, Field, Textarea, cx } from '../../components/ui.jsx'
import { Icon } from '../../components/Icon.jsx'
import { fmtMoney } from '../../lib/format.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const initialDraft = () => ({
  motivos: [],
  declaracion: '',
  adjuntos: [],
  email: '',
})

export function AppealWizard({ open, violation, onClose, onSubmitted }) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(initialDraft)
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (open) {
      setStep(0)
      setDraft(initialDraft())
      setTouched({})
      setError(null)
      setDragging(false)
    }
  }, [open, violation?.code])

  const steps = ['Motivos', 'Declaración', 'Adjuntos', 'Revisión']

  const errors = validate(draft, step)

  const change = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const addFiles = (files) => {
    const attachments = [...draft.adjuntos]
    let rejected = false
    for (const file of files) {
      const supported =
        file.type === 'application/pdf' ||
        file.type.startsWith('image/') ||
        /\.(pdf|png|jpe?g|gif|webp|bmp)$/i.test(file.name)
      if (!supported || file.size > 10_000_000) {
        rejected = true
        continue
      }
      if (attachments.length >= 5) {
        rejected = true
        break
      }
      attachments.push({ name: file.name, size: file.size, type: file.type })
    }
    change({ adjuntos: attachments })
    setError(rejected ? 'Solo se admiten hasta 5 archivos PDF o imágenes de máximo 10 MB cada uno.' : null)
  }

  const toggleGround = (code) =>
    setDraft((d) => {
      if (d.motivos.includes(code)) return { ...d, motivos: d.motivos.filter((m) => m !== code) }
      if (d.motivos.length >= 3) return d
      return { ...d, motivos: [...d.motivos, code] }
    })

  const next = () => {
    setTouched({ [`step${step}`]: true })
    if (Object.keys(errors).length) return
    setStep((s) => Math.min(steps.length - 1, s + 1))
  }

  const submit = async () => {
    setTouched({ step0: true, step1: true })
    if (Object.keys(errors).length) return
    setSubmitting(true)
    setError(null)
    try {
      const data = await violationsStore.getState().submitAppeal(violation.code, {
        motivos: draft.motivos,
        declaracion: draft.declaracion.trim(),
        adjuntos: draft.adjuntos,
        contacto: { email: draft.email },
      })
      uiStore.getState().pushToast({
        tone: 'ok',
        icon: 'gavel',
        title: `Recurso ${data.appeal.id} radicado`,
        message: `La infracción ${violation.code} queda en estado "En apelación".`,
      })
      onSubmitted?.(data)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Formular apelación · ${violation?.code ?? ''}`} wide>
      <div className="flex flex-col gap-4 p-4">
        <ol className="flex items-center gap-1.5" aria-label="Pasos del formulario">
          {steps.map((label, ix) => (
            <li key={label} className={cx('flex flex-1 items-center gap-1.5')}>
              <span
                className={cx(
                  'flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold',
                  ix === step ? 'border-sky-400 bg-sky-500/20 text-sky-200' : ix < step ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300' : 'border-slate-700 text-slate-500',
                )}
                aria-current={ix === step ? 'step' : undefined}
              >
                {ix < step ? <Icon name="check" size={12} /> : ix + 1}
              </span>
              <span className={cx('text-[11.5px]', ix === step ? 'text-slate-200' : 'text-slate-500')}>{label}</span>
              {ix < steps.length - 1 && <span className="h-px flex-1 bg-slate-700" aria-hidden="true" />}
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <div className="space-y-2.5">
            <p className="text-[12.5px] text-slate-400">
              Selecciona entre <strong className="text-slate-200">1 y 3</strong> motivos. Cada motivo queda registrado en el expediente municipal.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {APPEAL_GROUNDS.map((g) => {
                const active = draft.motivos.includes(g.code)
                return (
                  <label
                    key={g.code}
                    className={cx(
                      'cursor-pointer rounded-lg border p-2.5 transition-colors',
                      active ? 'border-sky-500/80 bg-sky-500/10' : 'border-slate-700/70 bg-slate-900/40 hover:border-slate-600',
                    )}
                  >
                    <span className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleGround(g.code)}
                        disabled={!active && draft.motivos.length >= 3}
                        className="mt-0.5 h-4 w-4 accent-sky-500"
                      />
                      <span>
                        <span className="block text-[12.5px] font-medium text-slate-200">{g.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{g.hint}</span>
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
            {touched.step0 && draft.motivos.length < 1 ? <p className="text-[12px] text-rose-400">Selecciona al menos un motivo.</p> : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <Field label="Correo electrónico de contacto" hint="para notificaciones del expediente">
              {(id) => <input id={id} type="email" required className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-[13px] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25" value={draft.email} onChange={(e) => change({ email: e.target.value })} placeholder="titular@correo.es" aria-invalid={touched.step1 && !EMAIL_RE.test(draft.email)} />}
            </Field>
            <Field label="Expón los hechos con tus palabras" hint={`${draft.declaracion.trim().length}/60 mínimos · 4000 máx.`}>
              {(id) => (
                <Textarea
                  id={id}
                  maxLen={4000}
                  rows={6}
                  value={draft.declaracion}
                  onChange={(e) => change({ declaracion: e.target.value })}
                  placeholder="Lo ocurrido fue lo siguiente…"
                />
              )}
            </Field>
            {touched.step1 && (draft.declaracion.trim().length < 60 || !EMAIL_RE.test(draft.email)) ? (
              <p className="text-[12px] text-rose-400">Revisa el correo y la longitud mínima de 60 carácteres en la declaración.</p>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div
            className={cx(
              'rounded-xl border-2 border-dashed p-5 text-center transition-colors',
              dragging ? 'border-sky-500 bg-sky-500/5' : 'border-slate-700 bg-slate-900/40',
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => {
              setDragging(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              addFiles(Array.from(e.dataTransfer?.files || []))
            }}
          >
            <Icon name="upload" size={22} className="mx-auto text-slate-500" />
            <p className="mt-1 text-[12.5px] text-slate-300">Arrastra pruebas aquí o</p>
            <label className="mt-1 inline-block cursor-pointer rounded-md border border-slate-700 px-3 py-1.5 text-[12px] text-sky-300 hover:border-sky-500">
              selecciona archivos
              <input
                type="file"
                className="sr-only"
                multiple
                accept="application/pdf,image/*"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files || []))
                  e.target.value = ''
                }}
              />
            </label>
            <p className="mt-1 text-[11px] text-slate-500">Máximo 5 adjuntos · 10 MB c/u · PDF o imagen</p>
            <p className="text-[10px] text-slate-600">En esta demo se registra la referencia del archivo, no se almacena su contenido.</p>
            {draft.adjuntos.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-left">
                {draft.adjuntos.map((a, ix) => (
                  <li key={`${a.name}-${ix}`} className="flex items-center justify-between rounded-md bg-slate-800/70 px-2.5 py-1.5 text-[11.5px]">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <Icon name="file" size={12} />
                      {a.name}
                      <span className="text-slate-500">({Math.round(a.size / 1000)} kB)</span>
                    </span>
                    <button type="button" className="text-slate-500 hover:text-rose-400" aria-label={`Quitar adjunto ${a.name}`} onClick={() => change({ adjuntos: draft.adjuntos.filter((_, i) => i !== ix) })}>
                      <Icon name="x" size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <ReviewRow label="Infracción" value={violation?.code} />
            <ReviewRow label="Tipo" value={violationTypeLabel(violation?.type)} />
            <ReviewRow label="Importe sanción" value={fmtMoney(violation?.amount ?? 0)} />
            <ReviewRow label="Motivos" value={draft.motivos.map((m) => APPEAL_GROUNDS.find((g) => g.code === m)?.label).join(' · ')} />
            <ReviewRow label="Contacto" value={draft.email} />
            <ReviewRow label="Adjuntos" value={draft.adjuntos.length ? draft.adjuntos.map((a) => a.name).join(', ') : 'Ninguno'} />
            <ReviewRow label="Declaración" value={draft.declaracion.trim()} long />
            <p className="rounded-lg bg-slate-800/60 px-3 py-2 text-[11.5px] leading-relaxed text-slate-400">
              Al enviar, el expediente pasará a estado <strong className="text-amber-300">&ldquo;apelada&rdquo;</strong> con el recurso{' '}
              <strong className="text-slate-200">radicado</strong>. La resolución simulada llegará por el flujo del canal posterior.
            </p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-300">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between border-t border-slate-800 pt-3">
          <Button variant="ghost" onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}>
            {step === 0 ? 'Cancelar' : 'Atrás'}
          </Button>
          {step < steps.length - 1 ? (
            <Button variant="primary" icon="chevronRight" onClick={next}>
              Continuar
            </Button>
          ) : (
            <Button variant="primary" icon="send" loading={submitting} onClick={submit}>
              Enviar apelación
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function ReviewRow({ label, value, long }) {
  return (
    <div className={cx('flex gap-3 border-b border-slate-800/70 pb-2 text-[12.5px]', long && 'flex-col')}>
      <span className={cx('shrink-0 text-slate-500', long ? '' : 'w-32')}>{label}</span>
      <span className={cx('text-slate-200', long && 'leading-relaxed')}>{value}</span>
    </div>
  )
}

function validate(draft, step) {
  const errs = {}
  if (step === 0 && draft.motivos.length < 1) errs.motivos = 'Selecciona al menos un motivo'
  if (step === 1) {
    if (draft.declaracion.trim().length < 60) errs.declaracion = 'Mínimo 60 caracteres'
    if (!EMAIL_RE.test(draft.email)) errs.email = 'Correo no válido'
  }
  return errs
}

function violationTypeLabel(type) {
  return type === 'exceso' ? 'Exceso de velocidad' : 'Otra infracción'
}

export function appealStageTone(stage) {
  return stage === 'resuelta' ? 'emerald' : stage === 'en_revision' ? 'sky' : 'amber'
}

export function AppealTimeline({ appeal, violationStatus }) {
  if (!appeal) return null
  const idx = APPEAL_STAGE_ORDER.indexOf(appeal.status)
  return (
    <ol className="flex items-center gap-2" aria-label="Estado del recurso">
      {APPEAL_STAGE_ORDER.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={cx(
              'flex h-6 w-6 items-center justify-center rounded-full border text-[11px]',
              i <= idx ? (appeal.outcome && s === 'resuelta' ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-300' : 'border-sky-400/70 bg-sky-500/15 text-sky-200') : 'border-slate-700 text-slate-600',
            )}
          >
            {i <= idx ? <Icon name={i < idx ? 'check' : s === 'resuelta' ? 'gavel' : 'clock'} size={11} /> : i + 1}
          </span>
          <span className={cx('text-[11.5px]', i <= idx ? 'text-slate-200' : 'text-slate-500')}>{APPEAL_STAGE_LABEL[s]}</span>
          {i < APPEAL_STAGE_ORDER.length - 1 ? <span className="h-px w-4 bg-slate-700" aria-hidden="true" /> : null}
        </li>
      ))}
    </ol>
  )
}
