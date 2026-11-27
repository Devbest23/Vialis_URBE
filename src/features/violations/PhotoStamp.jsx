import { useMemo } from 'react'

const W = 640
const H = 360

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function buildFrameSvg(violation, frame) {
  const cap = new Date(violation.captureAt)
  const at = new Date(cap.getTime() + (frame.t || 0))
  const stamp = at.toLocaleString('es-GB', { hour12: false }).replace(',', ' ')
  const seed = frame.seed || 1
  const rows = 9
  const cols = 16
  const bob = (Math.sin(seed % 10) * 4).toFixed(1)
  const box = violation.evidence?.plateBox || [0.42, 0.55, 0.17, 0.08]
  const px = Math.round(box[0] * W)
  const py = Math.round((box[1] + 0.004) * H)
  const pw = Math.round(box[2] * W)
  const ph = Math.round(box[3] * H)
  const speed =
    violation.speedRecorded !== null && violation.speedRecorded !== undefined ? `${violation.speedRecorded} km/h` : '—'
  const limit = violation.speedLimit ? `${violation.speedLimit} km/h` : ''
  const windowStyle = (r, c) => {
    const on = (r * 7 + c * 13 + seed) % 5 !== 0
    return on ? 'rgba(250,204,21,0.28)' : 'rgba(148,163,184,0.12)'
  }

  const windows = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      windows.push(
        `<rect x="${(c + 0.25) * 40}" y="${(r + 0.3) * 40}" width="10" height="14" rx="1" fill="${windowStyle(r, c)}"/>`,
      )
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#0d1830"/><stop offset="0.55" stop-color="#101d38"/><stop offset="1" stop-color="#0a1220"/>
</linearGradient>
<radialGradient id="vig" cx="0.5" cy="0.42" r="0.75">
<stop offset="0.55" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(0,0,0,0.55)"/>
</radialGradient>
<linearGradient id="asphalt" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#1b2537"/><stop offset="1" stop-color="#131b2c"/>
</linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="#0d1830"/>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<g>${windows.join('')}</g>
<rect y="${H - 130}" width="${W}" height="130" fill="url(#asphalt)"/>
<g stroke="rgba(250,204,21,0.5)" stroke-width="4" stroke-dasharray="26 18">
<line x1="320" y1="${H - 124}" x2="320" y2="${H}"/>
</g>
<g transform="translate(0,${bob})">
<rect x="236" y="196" width="170" height="92" rx="18" fill="#243652" stroke="#3b537a" stroke-width="2"/>
<rect x="262" y="206" width="118" height="40" rx="10" fill="#0f1830" stroke="#2c4162"/>
<rect x="352" y="216" width="34" height="14" rx="4" fill="#f8fafc" opacity="0.85"/>
<rect x="248" y="216" width="30" height="14" rx="4" fill="#fbbf24" opacity="0.9"/>
<rect x="352" y="264" width="34" height="14" rx="4" fill="#f8fafc" opacity="0.85"/>
<rect x="248" y="264" width="30" height="14" rx="4" fill="#ef4444" opacity="0.55"/>
<g>
<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="6" fill="#e5e7eb" stroke="#94a3b8"/>
<text x="${px + pw / 2}" y="${py + ph / 2 + 5}" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="700" font-size="20" fill="#0f172a">${esc(violation.plate || 'SIN LECTURA')}</text>
</g>
</g>
<rect width="${W}" height="${H}" fill="url(#vig)"/>
<g font-family="ui-monospace, monospace" font-size="13" fill="#e2e8f0">
<rect x="0" y="0" width="${W}" height="26" fill="rgba(2,6,17,0.72)"/>
<text x="12" y="18">CAM ${esc(violation.cameraName || 'C-000')} · VIALIS</text>
<text x="340" y="18" fill="#7dd3fc">${esc(stamp)}</text>
<text x="524" y="18" fill="#f87171">REC</text>
<circle cx="511" cy="13" r="4" fill="#ef4444"/>
</g>
<g font-family="ui-monospace, monospace" font-size="15" fill="#e2e8f0">
<rect x="10" y="316" width="188" height="34" rx="6" fill="rgba(2,6,17,0.72)"/>
<text x="22" y="338" fill="#fbbf24">${esc(speed)}</text>
${limit ? `<text x="122" y="338" fill="#64748b">lím ${esc(limit)}</text>` : ''}
<rect x="${W - 150}" y="316" width="140" height="34" rx="6" fill="rgba(2,6,17,0.72)"/>
<text x="${W - 138}" y="338" fill="#94a3b8">vía ${esc(violation.roadKlass || 'urbana')}</text>
</g>
<g font-family="ui-sans-serif, system-ui" font-size="11" fill="rgba(148,163,184,0.85)">
<text x="${W / 2 - 118}" y="60">SIMULACIÓN DE EVIDENCIA · DATOS FICTICIOS</text>
</g>
</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg).replace(/%20/g, '%20')}`
}

export function useFrameUrl(violation, frame) {
  return useMemo(
    () =>
      frame
        ? buildFrameSvg(violation, frame)
        : '',
    [violation?.code, violation?.speedRecorded, violation?.speedLimit, frame?.t, frame?.seed, violation?.plate, violation?.cameraName],
  )
}

export { W as FRAME_W, H as FRAME_H }
