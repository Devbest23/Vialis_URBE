import { useState } from 'react'
import { buildFrameSvg } from './PhotoStamp.jsx'
import { VideoSimulator } from './VideoSimulator.jsx'
import { Icon } from '../../components/Icon.jsx'
import { Badge, Button, cx } from '../../components/ui.jsx'
import { fmtDateLong, fmtClock } from '../../lib/format.js'

export function EvidenceGallery({ violation }) {
  const frames = violation.evidence?.frames || []
  const [zoomed, setZoomed] = useState(null)

  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-[12px] font-semibold text-slate-300">Fotos capturadas ({frames.length})</h3>
        <div className="grid grid-cols-3 gap-2">
          {frames.map((fr, i) => {
            const url = buildFrameSvg(violation, fr)
            return (
              <button
                key={fr.t + fr.seed}
                type="button"
                onClick={() => setZoomed({ url, frame: fr })}
                className="group relative overflow-hidden rounded-lg border border-slate-700/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400"
                aria-label={`Ampliar foto marco ${i + 1} de la captura`}
              >
                <img src={url} alt={`Marco ${i + 1}: ${violation.vehicle} ${violation.plate} ante cámara ${violation.cameraName}`} className="block w-full transition-transform duration-200 group-hover:scale-[1.03]" loading="lazy" />
                <span className="absolute bottom-1 right-1 rounded bg-slate-950/80 px-1 font-mono text-[10px] text-slate-300">
                  {fmtVideoTs(violation.captureAt, fr.t)}
                </span>
                <span className="absolute left-1 top-1 flex items-center gap-1 rounded bg-slate-950/80 px-1.5 py-0.5 text-[10px] text-slate-300">
                  <Icon name="camera" size={10} />
                  {i === 0 ? 'aprox.' : i === frames.length - 1 ? 'post.' : 'detec.'}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[12px] font-semibold text-slate-300">Secuencia de vídeo (simulada)</h3>
        <VideoSimulator violation={violation} />
      </section>

      {zoomed ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto de evidencia ampliada"
          className="anim-in fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/85 p-6"
          onClick={() => setZoomed(null)}
        >
          <figure className="max-w-4xl" role="figure">
            <img src={zoomed.url} alt={`Vista ampliada: ${violation.plate}`} className="max-h-[70vh] w-full rounded-lg border border-slate-700" />
            <figcaption className="mt-2 flex items-center justify-between gap-4 text-[12px] text-slate-400">
              <span>
                {violation.cameraName} · {fmtDateLong(violation.captureAt)} {fmtClock(new Date(new Date(violation.captureAt).getTime() + zoomed.frame.t))}
              </span>
              <Button size="sm" variant="subtle" icon="x" onClick={() => setZoomed(null)}>
                Cerrar
              </Button>
            </figcaption>
          </figure>
        </div>
      ) : null}
    </div>
  )
}

function fmtVideoTs(captureAt, t) {
  const d = new Date(new Date(captureAt).getTime() + (t || 0))
  return d.toLocaleTimeString('es-GB', { hour12: false })
}
