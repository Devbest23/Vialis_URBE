import { useMemo, useState } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ACCIDENT_CATEGORY_LABEL,
  ACCIDENT_CATEGORY_ORDER,
  CITY,
  INCIDENT_TYPE_LABEL,
  SEVERITY_LABEL,
  SEVERITY_ORDER,
} from '../../lib/domain.js'
import { trafficStore } from '../../store/trafficStore.js'
import { uiStore } from '../../store/uiStore.js'
import { Button, Chip, Field, Input, Panel, Select, Textarea } from '../../components/ui.jsx'
import { Icon } from '../../components/Icon.jsx'
import { TILE_URL, TILE_ATTR } from '../map/tiles.js'

function ClickableMap({ onPick }) {
  useMapEvents({ click: (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }) })
  return null
}

const SEVERITY_TONE = { critica: 'rose', alta: 'amber', media: 'sky', baja: 'slate' }

export function ReportForm({ variant = 'page', onCreated, onCancel }) {
  const [type, setType] = useState('atasco')
  const [severity, setSeverity] = useState('media')
  const [description, setDescription] = useState('')
  const [position, setPosition] = useState(null)
  const [category, setCategory] = useState('colision')
  const [vehicles, setVehicles] = useState('2')
  const [injuries, setInjuries] = useState('0')
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const compact = variant === 'modal'
  const errors = useMemo(() => {
    const next = {}
    if (!position) next.position = 'Selecciona el punto del incidente en el mapa.'
    if (description.trim().length < 15) next.description = 'Describe el incidente con al menos 15 caracteres.'
    if (description.trim().length > 1000) next.description = 'La descripción no puede superar los 1000 caracteres.'
    if (type === 'accidente') {
      if (!ACCIDENT_CATEGORY_LABEL[category]) next.category = 'Selecciona una categoría válida.'
      if (vehicles !== '') {
        const value = Number(vehicles)
        if (!Number.isInteger(value) || value < 0 || value > 50) next.vehicles = 'Entre 0 y 50 vehículos.'
      }
      if (injuries !== '') {
        const value = Number(injuries)
        if (!Number.isInteger(value) || value < 0 || value > 200) next.injuries = 'Entre 0 y 200 heridos.'
      }
    }
    return next
  }, [position, description, type, category, vehicles, injuries])

  const pinIcon = useMemo(
    () =>
      L.divIcon({
        className: 'node-ico',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        html: '<span class="flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-sky-400 bg-sky-500/30 shadow-lg shadow-sky-500/40"><span class="h-2 w-2 rounded-full bg-sky-300"></span></span>',
      }),
    [],
  )

  const submit = async (event) => {
    event.preventDefault()
    setTouched({ position: true, description: true, category: true, vehicles: true, injuries: true })
    setError(null)
    if (Object.keys(errors).length > 0) return
    setSubmitting(true)
    try {
      const created = await trafficStore.getState().createReport({
        type,
        severity,
        description: description.trim(),
        lat: position.lat,
        lng: position.lng,
        ...(type === 'accidente'
          ? {
              category,
              vehicles: vehicles === '' ? null : Number(vehicles),
              injuries: injuries === '' ? null : Number(injuries),
            }
          : {}),
      })
      uiStore.getState().pushToast({
        tone: 'ok',
        icon: 'check',
        title: `Reporte ${created.id} radicado`,
        message: 'Quedó en la bandeja como Nuevo y ya es visible en el mapa.',
      })
      setType('atasco')
      setSeverity('media')
      setDescription('')
      setPosition(null)
      setCategory('colision')
      setVehicles('2')
      setInjuries('0')
      setTouched({})
      onCreated?.(created)
    } catch (err) {
      const duplicate = err.payload?.duplicate
      setError(
        duplicate
          ? `${err.message} Puedes abrir ${duplicate.id} en la bandeja para confirmarlo.`
          : err.message,
      )
    } finally {
      setSubmitting(false)
    }
  }

  const fieldError = (name) => (touched[name] ? errors[name] : undefined)

  return (
    <form onSubmit={submit} className={compact ? 'flex min-h-0 flex-col gap-3.5 p-4' : 'grid gap-4'} noValidate>
      <div className={compact ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3 md:grid-cols-2'}>
        <Field label="Tipo de incidencia" hint="obligatorio">
          {(id) => (
            <Select
              id={id}
              value={type}
              onChange={(event) => {
                setType(event.target.value)
                setError(null)
              }}
            >
              {Object.entries(INCIDENT_TYPE_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Gravedad observada">
          {() => (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SEVERITY_ORDER.slice().reverse().map((value) => (
                <Chip key={value} active={severity === value} tone={SEVERITY_TONE[value]} onClick={() => setSeverity(value)}>
                  {SEVERITY_LABEL[value]}
                </Chip>
              ))}
            </div>
          )}
        </Field>
      </div>

      {type === 'accidente' ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-amber-200">
            <Icon name="accidente" size={13} /> Datos del accidente
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Categoría" error={fieldError('category')}>
              {(id) => (
                <Select id={id} value={category} onChange={(event) => setCategory(event.target.value)}>
                  {ACCIDENT_CATEGORY_ORDER.filter((key) => ACCIDENT_CATEGORY_LABEL[key]).map((key) => (
                    <option key={key} value={key}>
                      {ACCIDENT_CATEGORY_LABEL[key]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Vehículos implicados" error={fieldError('vehicles')}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  max={50}
                  inputMode="numeric"
                  value={vehicles}
                  onChange={(event) => setVehicles(event.target.value)}
                />
              )}
            </Field>
            <Field label="Heridos" error={fieldError('injuries')}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  max={200}
                  inputMode="numeric"
                  value={injuries}
                  onChange={(event) => setInjuries(event.target.value)}
                />
              )}
            </Field>
          </div>
        </div>
      ) : null}

      <Field
        label="Descripción del incidente"
        hint={`${description.trim().length}/15 mínimos`}
        error={fieldError('description')}
      >
        {(id) => (
          <Textarea
            id={id}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLen={1000}
            rows={compact ? 3 : 4}
            placeholder="Describe qué ocurre, accesos afectados, señales presentes y cualquier dato útil para validar el reporte…"
          />
        )}
      </Field>

      <div className={compact ? 'grid gap-3 sm:grid-cols-[240px_1fr]' : 'grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]'}>
        <div>
          <div className="overflow-hidden rounded-lg border border-slate-700">
            <MapContainer
              center={CITY.center}
              zoom={CITY.zoomHome}
              zoomControl={false}
              dragging
              attributionControl={false}
              className={compact ? 'h-52 w-full' : 'h-64 w-full'}
              minZoom={11}
              maxZoom={16}
            >
              <TileLayer url={TILE_URL} subdomains="abcd" attribution={TILE_ATTR} />
              <ClickableMap onPick={setPosition} />
              {position ? <Marker position={[position.lat, position.lng]} icon={pinIcon} /> : null}
            </MapContainer>
          </div>
          {fieldError('position') ? (
            <p role="alert" className="mt-1 text-[12px] text-rose-400">
              {errors.position}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5 text-[12px] text-slate-400">
          <p className="flex items-center gap-1.5 font-medium text-slate-200">
            <Icon name="pin" size={13} className="text-sky-300" /> Ubicación del reporte
          </p>
          {position ? (
            <p className="font-mono text-slate-200">
              {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
            </p>
          ) : (
            <p>Haz clic sobre el mapa para fijar el punto exacto del incidente.</p>
          )}
          <p className="text-[11.5px] leading-relaxed text-slate-500">
            El reporte entra como <span className="text-slate-300">Nuevo</span> y requiere validación de la central o
            confirmaciones ciudadanas. Se bloquean duplicados cercanos y envíos masivos.
          </p>
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 pt-3">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" variant="primary" icon="send" loading={submitting}>
          {type === 'accidente' ? 'Radicar reporte de accidente' : 'Radicar reporte'}
        </Button>
      </div>
    </form>
  )
}

export function GenerateReport({ onCreated }) {
  const [created, setCreated] = useState(null)
  const [formKey, setFormKey] = useState(0)

  const handleCreated = (incident) => {
    setCreated(incident)
    setFormKey((key) => key + 1)
    onCreated?.(incident)
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          {created ? (
            <div className="flex flex-col gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/[0.07] p-3 sm:flex-row sm:items-center">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                <Icon name="check" size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-emerald-200">Reporte {created.id} radicado correctamente</p>
                <p className="truncate text-[11.5px] text-emerald-100/60">{created.title}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  icon="crosshair"
                  onClick={() => {
                    uiStore.getState().setTab('control')
                    uiStore.getState().selectIncident(created.id)
                    uiStore.getState().pushToast({ tone: 'info', icon: 'pin', title: 'Reporte seleccionado en el mapa', message: created.id })
                  }}
                >
                  Ver en mapa
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon="wrench"
                  onClick={() => {
                    uiStore.getState().selectIncident(created.id)
                    uiStore.getState().setReportsTab('solve')
                  }}
                >
                  Ir a solucionar
                </Button>
              </div>
            </div>
          ) : null}
          <Panel className="p-4">
            <div className="mb-3">
              <h3 className="text-[13px] font-semibold text-slate-100">Nuevo reporte ciudadano</h3>
              <p className="text-[12px] text-slate-500">
                Registra una incidencia con ubicación, gravedad y detalles. Los accidentes admiten categoría, vehículos y heridos.
              </p>
            </div>
            <ReportForm key={formKey} variant="page" onCreated={handleCreated} />
          </Panel>
        </div>

        <aside className="space-y-3">
          <Panel className="p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-slate-200">
              <Icon name="shield" size={13} className="text-sky-300" /> Calidad del reporte
            </p>
            <ul className="space-y-2 text-[11.5px] leading-relaxed text-slate-400">
              <li>Ubica el punto exacto: evita crear reportes a varias cuadras del evento.</li>
              <li>Describe hechos observables, no supuestos. La central verificará la información.</li>
              <li>Si ya existe un reporte similar, confírmalo en la bandeja en lugar de duplicarlo.</li>
              <li>Los reportes nuevos no modifican la operación hasta ser verificados.</li>
            </ul>
          </Panel>
          <Panel className="p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-slate-200">
              <Icon name="flow" size={13} className="text-sky-300" /> Flujo de atención
            </p>
            <ol className="space-y-2 text-[11.5px] text-slate-400">
              <FlowStep n="1" title="Radicación" text="El reporte entra como Nuevo y aparece en el mapa." />
              <FlowStep n="2" title="Verificación" text="La central valida o 4 confirmaciones lo verifican." />
              <FlowStep n="3" title="Atención" text="Se asigna una unidad y se registra la nota operativa." />
              <FlowStep n="4" title="Resolución" text="Se documenta la solución y queda en el historial." />
            </ol>
          </Panel>
          <Panel className="p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-slate-200">
              <Icon name="alert" size={13} className="text-amber-300" /> Antifraude
            </p>
            <p className="text-[11.5px] leading-relaxed text-slate-500">
              Se limita el envío a 8 reportes por hora y se rechazan duplicados dentro de 200 m y 2 h. Cada cuenta puede
              confirmar un reporte una sola vez.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

function FlowStep({ n, title, text }) {
  return (
    <li className="flex gap-2">
      <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-slate-800 font-mono text-[10px] text-sky-300">
        {n}
      </span>
      <span>
        <span className="text-slate-300">{title}. </span>
        {text}
      </span>
    </li>
  )
}
