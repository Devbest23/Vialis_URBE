import { useMemo, useState } from 'react'
import { authStore } from '../../store/authStore.js'
import { Button, Field, Input } from '../../components/ui.jsx'
import { Icon } from '../../components/Icon.jsx'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const NAME_RE = /^[\p{L}\p{M}' .-]+$/u

const DEMO = { email: 'demo@vialis.app', password: 'Vialis2026' }

export function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const serverError = authStore((s) => s.error)
  const clearError = authStore((s) => s.clearError)

  const errors = useMemo(() => validate(mode, { name, email, password }), [mode, name, email, password])
  const invalid = Object.keys(errors).length > 0

  const switchMode = (next) => {
    setMode(next)
    setTouched({})
    clearError()
  }

  const useDemo = () => {
    setMode('login')
    setEmail(DEMO.email)
    setPassword(DEMO.password)
    setTouched({})
    clearError()
  }

  const submit = async (event) => {
    event.preventDefault()
    setTouched({ name: true, email: true, password: true })
    clearError()
    if (invalid) return
    setSubmitting(true)
    try {
      if (mode === 'login') await authStore.getState().login({ email: email.trim(), password })
      else await authStore.getState().register({ name: name.trim(), email: email.trim(), password })
    } catch {
      void 0
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell flex min-h-full items-center justify-center overflow-y-auto p-4 sm:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 shadow-2xl shadow-black/60 backdrop-blur lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden flex-col justify-between gap-10 border-r border-slate-800 bg-[radial-gradient(900px_500px_at_20%_0%,rgba(14,165,233,0.16),transparent_60%)] p-8 lg:flex">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30">
              <Icon name="road" size={22} />
            </span>
            <div>
              <p className="text-lg font-bold tracking-[0.2em] text-slate-100">VIALIS</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Control vial urbano</p>
            </div>
          </div>
          <div className="space-y-5">
            <h1 className="text-2xl font-semibold leading-snug text-slate-100">
              Centro de operaciones para una ciudad que no se detiene.
            </h1>
            <p className="max-w-md text-[13px] leading-relaxed text-slate-400">
              Monitorea incidencias en vivo, atiende reportes ciudadanos y genera informes de accidentalidad con
              persistencia real en SQLite.
            </p>
            <ul className="space-y-2.5 text-[12.5px] text-slate-300">
              <Feature icon="shield" text="Sesiones autenticadas con contraseñas cifradas (scrypt)." />
              <Feature icon="alert" text="Reportes de accidentes por día, semana, mes o histórico completo." />
              <Feature icon="check" text="Flujo de verificación, atención y resolución con trazabilidad." />
              <Feature icon="city" text="Datos urbanos, cámaras, infracciones y telemetría en una sola base." />
            </ul>
          </div>
          <p className="text-[11px] text-slate-500">
            Entorno de demostración · Maracaibo · Datos simulados
          </p>
        </section>

        <section className="flex flex-col justify-center p-6 sm:p-9">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30">
              <Icon name="road" size={18} />
            </span>
            <div>
              <p className="text-[15px] font-bold tracking-[0.18em] text-slate-100">VIALIS</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Control vial urbano</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-100">
              {mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}
            </h2>
            <p className="mt-1 text-[12.5px] text-slate-500">
              {mode === 'login'
                ? 'Accede con tu correo y contraseña para operar el centro de control.'
                : 'Registro con nombre, correo y contraseña. Sin campos adicionales.'}
            </p>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded-lg border border-slate-800 bg-slate-900/60 p-1" role="tablist" aria-label="Modo de acceso">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
              className={
                'h-8 rounded-md text-[12.5px] font-medium transition-colors ' +
                (mode === 'login' ? 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/30' : 'text-slate-400 hover:text-slate-200')
              }
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => switchMode('register')}
              className={
                'h-8 rounded-md text-[12.5px] font-medium transition-colors ' +
                (mode === 'register' ? 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/30' : 'text-slate-400 hover:text-slate-200')
              }
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            {mode === 'register' ? (
              <Field label="Nombre completo" error={touched.name ? errors.name : undefined}>
                {(id) => (
                  <Input
                    id={id}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                    placeholder="Tu nombre"
                    autoComplete="name"
                    maxLength={60}
                    aria-invalid={touched.name && Boolean(errors.name)}
                    data-autofocus
                  />
                )}
              </Field>
            ) : null}

            <Field label="Correo electrónico" error={touched.email ? errors.email : undefined}>
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="operador@vialis.app"
                  autoComplete="email"
                  maxLength={160}
                  aria-invalid={touched.email && Boolean(errors.email)}
                  data-autofocus={mode === 'login' ? true : undefined}
                />
              )}
            </Field>

            <Field label="Contraseña" hint={mode === 'register' ? 'mínimo 8 caracteres, una letra y un número' : undefined} error={touched.password ? errors.password : undefined}>
              {(id) => (
                <div className="relative">
                  <Input
                    id={id}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    placeholder={mode === 'login' ? 'Tu contraseña' : 'Crea una contraseña segura'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    maxLength={128}
                    aria-invalid={touched.password && Boolean(errors.password)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-200"
                  >
                    <Icon name={showPassword ? 'x' : 'key'} size={14} />
                  </button>
                </div>
              )}
            </Field>

            {serverError ? (
              <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-300">
                {serverError}
              </p>
            ) : null}

            <Button type="submit" variant="primary" size="lg" icon={mode === 'login' ? 'shield' : 'check'} loading={submitting} className="w-full">
              {mode === 'login' ? 'Entrar al centro de control' : 'Crear cuenta y entrar'}
            </Button>
          </form>

          <div className="mt-5 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5">
            <p className="text-[11px] font-medium text-slate-400">Cuenta de demostración</p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[11px] text-slate-500">{DEMO.email} · {DEMO.password}</p>
              <Button size="sm" variant="ghost" onClick={useDemo}>
                Usar cuenta demo
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function Feature({ icon, text }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800/80 text-sky-300">
        <Icon name={icon} size={13} />
      </span>
      <span className="leading-snug">{text}</span>
    </li>
  )
}

function validate(mode, values) {
  const errors = {}
  const name = values.name.trim()
  const email = values.email.trim()
  const password = values.password
  if (mode === 'register') {
    if (name.length < 3) errors.name = 'El nombre debe tener al menos 3 caracteres.'
    else if (name.length > 60) errors.name = 'El nombre no puede superar los 60 caracteres.'
    else if (!NAME_RE.test(name)) errors.name = 'El nombre solo admite letras, espacios, apóstrofos, puntos y guiones.'
  }
  if (!email) errors.email = 'El correo electrónico es obligatorio.'
  else if (email.length > 160) errors.email = 'El correo electrónico no puede superar los 160 caracteres.'
  else if (!EMAIL_RE.test(email)) errors.email = 'Ingresa un correo electrónico válido.'
  if (!password) errors.password = 'La contraseña es obligatoria.'
  else if (mode === 'register') {
    if (password.length < 8) errors.password = 'La contraseña debe tener al menos 8 caracteres.'
    else if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(password)) errors.password = 'La contraseña debe incluir al menos una letra.'
    else if (!/\d/.test(password)) errors.password = 'La contraseña debe incluir al menos un número.'
  }
  return errors
}
