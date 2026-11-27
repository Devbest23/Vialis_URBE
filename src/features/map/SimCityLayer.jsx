import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { useMap, SVGOverlay } from 'react-leaflet'
import { CITY } from '../../lib/domain.js'
import { roadsWithinBounds } from '../../lib/geo.js'
import { uiStore } from '../../store/uiStore.js'
import { trafficStore } from '../../store/trafficStore.js'

function mulberry(seed) {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildBlocks(rng, cols, rows, w, h) {
  const blocks = []
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = i * w
      for (let k = 0; k < 2; k++) {
        const y = j * h
        for (let m = 0; m < 2; m++) {
          const r = rng()
          const kind = r < 0.08 ? 'park' : r < 0.13 ? 'plaza' : 'block'
          const bw = w * 3
          const bh = h * 3
          blocks.push({
            x: x + (w / 2) * m + 5,
            y: y + (h / 2) * k + 5,
            w: bw - 10,
            h: bh - 10,
            kind,
            shade: 0.85 + rng() * 0.3,
          })
        }
      }
    }
  }
  return blocks
}

const PANE = 'simcity'
const SEED = 8001

export function SimCityLayer() {
  const active = uiStore((s) => s.simulatedTiles)
  const zoom = uiStore((s) => s.zoom)
  const districts = trafficStore((s) => s.districts)
  const roads = trafficStore((s) => s.roads)
  const map = useMap()

  useEffect(() => {
    let pane = map.getPane(PANE)
    if (!pane) {
      pane = map.createPane(PANE)
      pane.style.zIndex = '250'
      pane.style.pointerEvents = 'none'
    }
  }, [map])

  const bounds = useMemo(
    () => L.latLngBounds([CITY.bounds.latMin, CITY.bounds.lngMin], [CITY.bounds.latMax, CITY.bounds.lngMax]),
    [],
  )

  const drawing = useMemo(() => {
    const rng = mulberry(SEED)
    const W = 1600
    const H = 1200
    const cols = 9
    const rows = 7
    const cellW = W / cols
    const cellH = H / rows
    const blocks = buildBlocks(rng, cols, rows, cellW / 2, cellH / 2)
    return { W, H, blocks }
  }, [])

  const projectedDistricts = useMemo(() => {
    const lngPerX = CITY.bounds.lngMax - CITY.bounds.lngMin
    const mercatorY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
    const northingMin = mercatorY(CITY.bounds.latMin)
    const northingMax = mercatorY(CITY.bounds.latMax)
    return districts.map((d) => ({
      id: d.id,
      name: d.name,
      x: ((d.center[1] - CITY.bounds.lngMin) / lngPerX) * drawing.W,
      y: ((northingMax - mercatorY(d.center[0])) / (northingMax - northingMin)) * drawing.H,
    }))
  }, [districts, drawing.W, drawing.H])

  const projectedRoads = useMemo(() => {
    const mercatorY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
    const northingMin = mercatorY(CITY.bounds.latMin)
    const northingMax = mercatorY(CITY.bounds.latMax)
    const northingSpan = northingMax - northingMin
    const lngPerX = CITY.bounds.lngMax - CITY.bounds.lngMin

    return roadsWithinBounds(roads, CITY.bounds)
      .filter((road) => zoom >= 13 || road.klass !== 'local')
      .map((road) => ({
        id: road.id,
        klass: road.klass,
        path: (road.points || [])
          .map(([lat, lng]) => {
            const x = ((lng - CITY.bounds.lngMin) / lngPerX) * drawing.W
            const y = ((northingMax - mercatorY(lat)) / northingSpan) * drawing.H
            return `${x.toFixed(2)},${y.toFixed(2)}`
          })
          .join(' '),
      }))
      .filter((road) => road.path)
  }, [roads, zoom, drawing.W, drawing.H])

  if (!active) return null

  return (
    <SVGOverlay
      bounds={bounds}
      pane={PANE}
      interactive={false}
      attributes={{ preserveAspectRatio: 'none', viewBox: `0 0 ${drawing.W} ${drawing.H}`, class: 'simcity anim-in' }}
    >
      <rect x="0" y="0" width={drawing.W} height={drawing.H} fill="#0b1322" />
      <g>
        {drawing.blocks.map((b, i) => (
          <rect
            key={i}
            x={b.x + b.w / 2 - 2}
            y={b.y + b.h / 2 - 2}
            width={Math.max(6, b.w / 2)}
            height={Math.max(6, b.h / 2)}
            rx="2"
            fill={b.kind === 'park' ? '#14361f' : b.kind === 'plaza' ? '#25344d' : '#111c31'}
            opacity={b.kind === 'park' ? 0.9 : b.shade}
          />
        ))}
      </g>
      <g>
        {projectedRoads.map((road) => (
          <polyline
            key={road.id}
            points={road.path}
            fill="none"
            stroke="#1c2942"
            strokeWidth={road.klass === 'anillo' ? 8 : road.klass === 'gran_via' ? 7 : road.klass === 'avenida' ? 6 : road.klass === 'calle' ? 5 : 3}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      <g>
        {projectedDistricts.map((d) => (
          <text key={d.id} x={d.x} y={d.y} fill="#5b6b85" fontSize="26" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" letterSpacing="2">
            {d.name.toUpperCase()}
          </text>
        ))}
      </g>
      <defs>
        <radialGradient id="simvignette" cx="50%" cy="40%" r="75%">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width={drawing.W} height={drawing.H} fill="url(#simvignette)" opacity="0.35" />
    </SVGOverlay>
  )
}
