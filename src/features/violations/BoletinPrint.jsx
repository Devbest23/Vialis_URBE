import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  VIOLATION_TYPE_LABEL,
  VIOLATION_STATUS_LABEL,
  ROAD_CLASS_LABEL,
} from '../../lib/domain.js'
import { fmtDateLong, fmtClock, fmtMoney } from '../../lib/format.js'

function BRow({ k, v }) {
  return (
    <div className="b-row">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}

export function BoletinSheet({ violation: v }) {
  const velocidad = v.speedRecorded ? `${v.speedRecorded} km/h (límite ${v.speedLimit} km/h · exceso ${v.speedRecorded - v.speedLimit} km/h)` : 'n/a'
  const marco = v.evidence?.frames?.length || 0
  return (
    <div className="boletin" style={{ padding: '4px 2px' }}>
      <header style={{ borderBottom: '2px solid #111827', paddingBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ margin: 0 }}>ALCADÍA DE VILLA HORIZONTE</h1>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#374151' }}>Dirección General de Tránsito y Seguridad Vial</p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 10.5, color: '#374151' }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#111827' }}>BOLETÍN OFICIAL DE DENUNCIA</p>
          <p style={{ margin: 0 }}>{v.code}</p>
        </div>
      </header>

      <section style={{ marginTop: 12 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#111827' }}>
          1. Identificación de la presunta infracción
        </p>
        <dl className="b-grid" style={{ marginTop: 6 }}>
          <BRow k="Expediente" v={v.code} />
          <BRow k="Tipo" v={VIOLATION_TYPE_LABEL[v.type] || v.type} />
          <BRow k="Fecha de captura" v={`${fmtDateLong(v.captureAt)} · ${fmtClock(v.captureAt)} h`} />
          <BRow k="Estado actual" v={VIOLATION_STATUS_LABEL[v.status] || v.status} />
          <BRow k="Cámara" v={`${v.cameraName} — ${v.cameraId}`} />
          <BRow k="Vía" v={v.roadName ? `${v.roadName} · ${ROAD_CLASS_LABEL[v.roadKlass] || ''}` : 'vía sin clasificar'} />
          <BRow k="Ubicación medida" v={`${v.lat?.toFixed(5)}, ${v.lng?.toFixed(5)} (WGS84)`} />
          <BRow k="Elemento capturado" v={v.vehicle} />
        </dl>
      </section>

      <section style={{ marginTop: 12 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>2. Medición y sanción</p>
        <dl className="b-grid" style={{ marginTop: 6 }}>
          <BRow k="Velocidad registrada" v={velocidad} />
          <BRow k="Matrícula" v={v.plate} />
          <BRow k="Titular" v={`${v.owner?.name || '—'} · ${v.owner?.doc || '—'}`} />
          <BRow k="Importe" v={`${fmtMoney(v.amount)} (reducción del 30 % por pago voluntario: ${fmtMoney(Math.round(v.amount * 0.7))})`} />
          <BRow k="Puntos" v={v.points ? `RETIRO DE ${v.points} PUNTOS` : 'SIN RETIRO DE PUNTOS'} />
          <BRow k="Ciclo de notificación" v={`${v.notifiedAt ? fmtDateLong(v.notifiedAt) : 'pendiente'} / ${v.paidAt ? fmtDateLong(v.paidAt) : '—'}`} />
        </dl>
      </section>

      <section style={{ marginTop: 12 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>3. Evidencia incorporada</p>
        <p style={{ margin: '4px 0 0' }}>
          El expediente digital incorpora {marco} marcos fotográficos sellados (marca temporal en imagen), una secuencia de vídeo
          asociada (semilla de reproducción {v.evidence?.videoSeed}) y la serie cruda del radar. Las imágenes constan en el
          visor municipal y se adjuntan al legajo bajo el mismo número de expediente.
        </p>
      </section>

      <section style={{ marginTop: 12 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>4. Notificación legal</p>
        <p style={{ margin: '4px 0 0', textAlign: 'justify' }}>
          Se notifica la presente denuncia conforme a la normativa vigente de tránsito del municipio. El titular identificado
          dispone de un plazo de quince (15) días naturales para abonar el importe con la reducción indicada, o para interponer
          recurso de apelación ante la Dirección General de Tránsito aportando sus motivos y pruebas. La ausencia de respuesta
          en plazo supone la firmeza del acto y la tramitación de cobro en vía administrativa de apremio.
        </p>
      </section>

      <footer style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, fontSize: 10.5, color: '#374151' }}>
        <div style={{ borderTop: '1px solid #111827', paddingTop: 4, textAlign: 'center' }}>Agente / Organismo de control</div>
        <div style={{ borderTop: '1px solid #111827', paddingTop: 4, textAlign: 'center' }}>Sello y fecha de emisión · {fmtDateLong(v.createdAt)}</div>
      </footer>
      <p style={{ marginTop: 10, fontSize: 9.5, color: '#6b7280' }}>
        Documento generado por el sistema VIALIS · Verificación de integridad: {v.code}-{String(v.evidence?.videoSeed || 0).padStart(8, '0')} · Uso oficial interno.
      </p>
    </div>
  )
}

export function BoletinPortal({ active, violation, onDone }) {
  useEffect(() => {
    if (!active) return
    const finish = () => onDone?.()
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
    window.addEventListener('afterprint', finish)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('afterprint', finish)
    }
  }, [active, onDone])
  if (!active || !violation) return null
  return createPortal(<BoletinSheet violation={violation} />, document.getElementById('print-root') || document.body)
}
