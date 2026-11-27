import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/ui.jsx'
import { fmtStampClock } from '../../lib/format.js'

const CW = 640
const CH = 300

export function VideoSimulator({ violation }) {
  const canvasRef = useRef(null)
  const posRef = useRef(-1200)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  const plan = useMemo(() => {
    const seed = violation.evidence?.videoSeed || 7
    const base = new Date(violation.captureAt).getTime()
    const crossing = 0.62
    const isRedLight = violation.type === 'paso_rojo'
    const speed = violation.speedRecorded || 46
    return {
      seed,
      base,
      crossing,
      isRedLight,
      speed,
      plate: violation.plate,
      camera: violation.cameraName,
      duration: 9000,
      startOffset: -1200,
    }
  }, [violation])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf = 0
    let lastT = null

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = CW * dpr
    canvas.height = CH * dpr
    ctx.scale(dpr, dpr)

    const frame = (t) => {
      if (lastT === null) lastT = t
      const dt = Math.min(100, t - lastT)
      lastT = t
      if (playing) {
        posRef.current += dt
        if (posRef.current > plan.duration) posRef.current = plan.startOffset
        setProgress(Math.max(0, Math.min(1, posRef.current / plan.duration)))
      }
      drawScene(ctx, plan, posRef.current / plan.duration)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [playing, plan])

  useEffect(() => {
    setPlaying(false)
    setProgress(0)
    posRef.current = plan.startOffset
  }, [violation?.code])

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        style={{ aspectRatio: `${CW}/${CH}` }}
        className="w-full rounded-lg border border-slate-800 bg-[#0b1220]"
        aria-label="Vídeo simulado de la captura de la infracción"
        role="img"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant={playing ? 'subtle' : 'primary'} icon={playing ? 'pause' : 'play'} onClick={() => setPlaying((p) => !p)}>
          {playing ? 'Pausa' : 'Reproducir'}
        </Button>
        <input
          type="range"
          min={0}
          max={1000}
          step={5}
          value={Math.round(progress * 1000)}
          onChange={(e) => {
            const p = Number(e.target.value) / 1000
            posRef.current = p * plan.duration
            setProgress(p)
          }}
          aria-label="Línea de tiempo del vídeo simulado"
          className="h-1 flex-1 accent-sky-500"
        />
        <span className="w-14 text-right font-mono text-[11px] text-slate-400 tabular-nums">
          {fmtStampClock(new Date(plan.base + progress * 3000))}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Secuencia de 9 s generada proceduralmente a partir de la semilla{' '}
        <span className="font-mono text-slate-400">{plan.seed}</span>. La previsualización de evidencias nunca contiene datos reales.
      </p>
    </div>
  )
}

function drawScene(ctx, plan, seg) {
  const g = ctx.createLinearGradient(0, 0, 0, CH)
  g.addColorStop(0, '#0d1830')
  g.addColorStop(0.62, '#14203a')
  g.addColorStop(1, '#0a1220')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, CW, CH)

  ctx.fillStyle = 'rgba(148,163,184,0.10)'
  for (let i = 0; i < 9; i++) ctx.fillRect(30 + i * 70, 30, 26, 38)

  const roadTop = 168
  const roadH = CH - roadTop
  ctx.fillStyle = '#151e30'
  ctx.fillRect(0, roadTop, CW, roadH)
  ctx.strokeStyle = 'rgba(250,204,21,0.55)'
  ctx.setLineDash([24, 16])
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, roadTop + roadH / 2)
  ctx.lineTo(CW, roadTop + roadH / 2)
  ctx.stroke()
  ctx.setLineDash([])

  const crossingX = plan.crossing * CW
  ctx.fillStyle = plan.isRedLight ? 'rgba(239,68,68,0.55)' : 'rgba(16,185,129,0.55)'
  ctx.fillRect(crossingX - 2, roadTop, 4, roadH)

  const t = seg * plan.duration
  const carPhase = ((plan.seed % 217) + t) % plan.duration
  const x = CW * (0.06 + 0.86 * (carPhase / plan.duration))
  const y = roadTop + roadH * 0.24
  const carW = 108
  const carH = 58

  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = '#243652'
  ctx.strokeStyle = '#3b537a'
  ctx.lineWidth = 2
  roundRect(ctx, 0, 0, carW, carH, 14)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#0f1830'
  roundRect(ctx, 18, 9, 70, 24, 8)
  ctx.fill()
  ctx.fillStyle = '#fbbf24'
  ctx.fillRect(4, 18, 22, 9)
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(carW - 24, 18, 20, 9)
  ctx.fillStyle = '#e5e7eb'
  roundRect(ctx, 26, carH - 10, 56, 20, 4)
  ctx.fill()
  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 1
  ctx.strokeRect(26, carH - 10, 56, 20)
  ctx.fillStyle = '#0f172a'
  ctx.font = '700 12px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.fillText(plateText(plan.plate), 54, carH + 4)
  ctx.restore()

  drawHud(ctx, plan, x / CW)

  ctx.font = '11px ui-sans-serif, system-ui'
  ctx.fillStyle = 'rgba(148,163,184,0.8)'
  ctx.textAlign = 'center'
  ctx.fillText('SIMULACIÓN DE EVIDENCIA · DATOS FICTICIOS', CW / 2, 24)

  const now = new Date(plan.base + t).toLocaleTimeString('es-GB', { hour12: false })
  ctx.fillStyle = 'rgba(125,211,252,0.95)'
  ctx.font = '12px ui-monospace, monospace'
  ctx.textAlign = 'right'
  ctx.fillText(now, CW - 12, 18)

  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth = 18
  ctx.beginPath()
  ctx.arc(CW / 2, CH / 2, CW / 2.1, 0, Math.PI * 2)
  ctx.stroke()
}

function plateText(p) {
  return (p || 'SIM-000').toString()
}

function drawHud(ctx, plan, posFrac) {
  ctx.fillStyle = 'rgba(2,6,17,0.72)'
  ctx.fillRect(10, 10, 190, 24)
  ctx.fillStyle = '#e2e8f0'
  ctx.font = '12px ui-monospace, monospace'
  ctx.textAlign = 'left'
  ctx.fillText(`CAM ${plan.camera} · VIALIS`, 20, 26)

  const speed = plan.speed
  ctx.fillStyle = 'rgba(2,6,17,0.72)'
  ctx.fillRect(CW - 176, 10, 166, 24)
  ctx.fillStyle = '#fbbf24'
  ctx.fillText(`${Math.round(speed + 4 * Math.sin(posFrac * 17))} km/h  ·  ${plan.isRedLight ? 'ROJO' : 'FLUJO'}`, CW - 166, 26)
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
