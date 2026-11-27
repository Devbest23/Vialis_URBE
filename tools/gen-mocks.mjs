import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '../server/seed/data')
const roads = JSON.parse(fs.readFileSync(path.join(OUT, 'roads.json'), 'utf8'))
if (!roads.length) throw new Error('No se encontró la red vial real de OpenStreetMap.')
for (const road of roads) {
  road.name = road.name
    .replace(/\u00c3([\u0080-\u00bf])/g, (_, continuation) =>
      String.fromCharCode(((0xc3 & 0x1f) << 6) | (continuation.charCodeAt(0) & 0x3f)),
    )
    .replace(/V\?a sin nombre/g, 'V\u00eda sin nombre')
}

const SEED = 20261108
let s = SEED
function rand() {
  s |= 0
  s = (s + 0x6d2b79f5) | 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const ri = (a, b) => Math.floor(rand() * (b - a + 1)) + a
const rf = (a, b) => rand() * (b - a) + a
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const chance = (p) => rand() < p
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const iso = (ms) => new Date(ms).toISOString()

const NOW = Date.UTC(2026, 10, 8, 9, 15, 0)
const HOUR = 3600e3
const DAY = 24 * HOUR

const LAT_MIN = 10.676
const LAT_MAX = 10.712
const LNG_MIN = -71.667
const LNG_MAX = -71.605

const cameraNames = ['Centro Histórico', 'Ensanche Norte', 'Distrito Financiero', 'Riberas del Pesio', 'Estación Central', 'Las Acacias']
const districts = cameraNames.map((name, idx) => {
  const col = idx % 3
  const row = Math.floor(idx / 3)
  const lat = LAT_MIN + 0.0092 + row * 0.0183
  const lng = LNG_MIN + 0.0098 + col * 0.0206
  const ring = []
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 - Math.PI / 2
    ring.push([
      clamp(lat + 0.0092 * Math.sin(a), LAT_MIN, LAT_MAX),
      clamp(lng + 0.0102 * Math.cos(a), LNG_MIN, LNG_MAX),
    ])
  }
  return { id: 'D-' + (idx + 1), name, center: [lat, lng], ring }
})

const cameras = []
let camCounter = 101
for (const road of roads) {
  const nCam = road.klass === 'local' ? (chance(0.015) ? 1 : 0) : chance(0.12) ? 0 : chance(0.24) ? 2 : 1
  for (let k = 0; k < nCam; k++) {
    const [lat, lng] = pointOnRoad(road)
    const kind =
      road.klass === 'anillo' || road.klass === 'gran_via' ? pick(['radar', 'radar', 'flujo']) : pick(['flujo', 'reconocimiento', 'radar'])
    const status = chance(0.07) ? 'offline' : chance(0.1) ? 'mantenimiento' : 'activa'
    cameras.push({
      id: 'CAM-' + camCounter,
      name: 'C-' + String(camCounter - 101).padStart(3, '0'),
      kind,
      roadId: road.id,
      roadName: road.name,
      roadKlass: road.klass,
      lat,
      lng,
      status,
      lastSdkSyncAt: iso(NOW - ri(2, 400) * 1000),
    })
    camCounter++
  }
}

const TYPE_DESC = {
  atasco: ['retención', 'congestión', 'flujo caótico', 'cola'],
  accidente: ['colisión múltiple', 'alcance', 'vuelco', 'colisión lateral'],
  obra: ['obras', 'reparación de firme', 'poda y desbroce', 'sustitución de saneamiento'],
  evento: ['cabalgata', 'partido en el estadio', 'concierto', 'carrera popular'],
  inundacion: ['acumulación de agua', 'anegamiento parcial'],
  derrame: ['derrame de hidrocarburo', 'derrame de mercancía', 'pintura sobre el asfalto'],
  manifestacion: ['manifestación', 'corte vecinal', 'concentración sindical'],
  apagon: ['semáforo fuera de servicio', 'calle sin balizamiento', 'fallo de luminaria'],
  fuego: ['fuego en vehículo', 'contenedor ardiendo', 'fuego en talud'],
}
const TYPE_SEV = {
  atasco: ['baja', 'baja', 'media', 'media', 'alta'],
  accidente: ['media', 'alta', 'alta', 'critica'],
  obra: ['baja', 'media', 'alta'],
  evento: ['baja', 'media'],
  inundacion: ['media', 'alta'],
  derrame: ['media', 'alta'],
  manifestacion: ['media', 'alta'],
  apagon: ['media', 'alta'],
  fuego: ['alta', 'critica'],
}
const TYPE_WEIGHTS = [
  ['atasco', 0.42],
  ['accidente', 0.15],
  ['obra', 0.07],
  ['evento', 0.06],
  ['inundacion', 0.05],
  ['derrame', 0.05],
  ['manifestacion', 0.05],
  ['apagon', 0.05],
  ['fuego', 0.05],
]
const TW_SUM = TYPE_WEIGHTS.reduce((a, [, w]) => a + w, 0)
const TYPE_DIST = TYPE_WEIGHTS.map(([k, w]) => [k, w / TW_SUM])
function wPick(dist) {
  let x = rand()
  for (const [k, w] of dist) {
    x -= w
    if (x <= 0) return k
  }
  return dist[0][0]
}
function pickType() {
  return wPick(TYPE_DIST)
}

const SOURCE_DIST = [
  ['sensor', 0.68],
  ['ciudadano', 0.17],
  ['camara', 0.12],
  ['operador', 0.03],
]
const STATUS_DIST = [
  ['nuevo', 0.18],
  ['verificado', 0.34],
  ['en_atencion', 0.23],
  ['resuelto', 0.18],
  ['descartado', 0.07],
]

const roadWeights = roads.map((r) => r.lengthM)
const roadWeightSum = roadWeights.reduce((a, b) => a + b, 0)
function pickRoad() {
  let x = rand() * roadWeightSum
  for (let i = 0; i < roads.length; i++) {
    x -= roadWeights[i]
    if (x <= 0) return roads[i]
  }
  return roads[roads.length - 1]
}
function pointOnRoad(road) {
  const segments = []
  for (let index = 1; index < road.points.length; index++) {
    const start = road.points[index - 1]
    const end = road.points[index]
    const latitude = ((start[0] + end[0]) / 2) * (Math.PI / 180)
    const length = Math.hypot((end[0] - start[0]) * 111_320, (end[1] - start[1]) * 111_320 * Math.cos(latitude))
    if (length > 0) segments.push({ start, end, length })
  }
  const totalLength = segments.reduce((total, segment) => total + segment.length, 0)
  let distance = rand() * totalLength
  const segment = segments.find((item) => (distance -= item.length) <= 0) || segments[segments.length - 1]
  if (!segment) throw new Error(`La vía ${road.id} no tiene segmentos válidos.`)
  const fraction = rand()
  return [
    segment.start[0] + (segment.end[0] - segment.start[0]) * fraction,
    segment.start[1] + (segment.end[1] - segment.start[1]) * fraction,
  ]
}

const incidents = []
let incSeq = 1
for (let i = 0; i < 1150; i++) {
  const type = pickType()
  const road = pickRoad()
  const pos = pointOnRoad(road)
  const severity = pick(TYPE_SEV[type] || ['media'])
  const status = wPick(STATUS_DIST)
  const source = wPick(SOURCE_DIST)
  const resolvedLike = status === 'resuelto' || status === 'descartado'
  const reportedAt = NOW - (resolvedLike ? rf(8, 96) : rf(0.3, 34)) * HOUR
  const updatedAfter = resolvedLike ? rf(1, 10) : rf(0.05, 2.4)
  const updatedAt = Math.min(reportedAt + updatedAfter * HOUR, NOW - ri(20, 900) * 1000)
  const nounPool = TYPE_DESC[type]
  const noun = nounPool[Math.floor(rand() * nounPool.length)]
  const roadName = road ? road.name : 'vía urbana sin identificar'
  const title =
    type === 'atasco'
      ? `${noun.charAt(0).toUpperCase()}${noun.slice(1)} de ${rf(0.6, 3.4).toFixed(1)} km en ${roadName}`
      : `${noun.charAt(0).toUpperCase()}${noun.slice(1)} — ${roadName}`
  const detail =
    type === 'accidente'
      ? `se solicitaron: ${pick(['sanitario', 'sanitario y bomberos', 'grúa', 'sanitario y grúa'])}`
      : type === 'atasco'
        ? `velocidad media estimada ${ri(9, 42)} km/h`
        : pick(['área acotada', 'acceso restringido', 'se recomienda itinerario alternativo'])
  incidents.push({
    id: 'INC-' + String(incSeq++).padStart(5, '0'),
    type,
    severity,
    status,
    source,
    title,
    detail,
    roadId: road ? road.id : null,
    roadName: road ? road.name : null,
    lat: pos[0],
    lng: pos[1],
    radiusM: type === 'obra' ? ri(60, 220) : type === 'atasco' ? ri(50, 180) : ri(30, 120),
    reportedAt: iso(reportedAt),
    updatedAt: iso(updatedAt),
    confirmedBy: source === 'ciudadano' ? ri(0, 14) : ri(0, 5),
    mediaCount: ['accidente', 'fuego', 'inundacion', 'derrame', 'obra'].includes(type) ? ri(0, 3) : 0,
    clearEtaMin: ['atasco', 'accidente'].includes(type) ? ri(15, 240) : null,
  })
}

const firstNames = [
  'Gloria', 'Ismael', 'Rocío', 'Álvaro', 'Lucía', 'Héctor', 'Nieves', 'Ramiro',
  'Pilar', 'Óscar', 'Aitana', 'Gonzalo', 'Inés', 'Teo', 'Vera', 'Félix',
  'Clara', 'Bruno', 'Silvia', 'Jonás', 'Amparo', 'Damián', 'Uxía', 'Cristóbal',
]
const lastNames = [
  'Boix', 'Nistal', 'Ferré', 'Sanchís', 'Vilar', 'Bastida', 'Camps', 'Roldán',
  'Gilabert', 'Puigcerver', 'Llamas', 'Fombellida', 'Blancafort', 'Ustrell',
  'Sabaté', 'Iturrios', 'Queipo', 'Valcarce', 'Trujillo', 'Mendizábal',
]
const letrasDni = 'TRWAGMYFPDXBNJZSQVHLCKE'
function person() {
  const n = ri(10000000, 99999999)
  return {
    name: `${pick(firstNames)} ${pick(lastNames)} ${pick(lastNames)}`,
    doc: String(n) + letrasDni[n % 23],
  }
}
const plateChars = 'BCDFGHJKLMNPRSTVWXYZ'.split('')
const plates = new Set()
function plate() {
  for (;;) {
    const p = String(ri(1000, 9999)) + pick(plateChars) + pick(plateChars) + pick(plateChars)
    if (!plates.has(p)) {
      plates.add(p)
      return p
    }
  }
}

const HOUR_WEIGHTS = [1, 0.5, 0.3, 0.3, 0.5, 1.5, 4, 7, 9, 5, 4, 4, 4.5, 5, 6, 7, 7.5, 6, 4, 2.5, 2, 1.5, 1, 0.7]
const hourCum = []
let hacc = 0
for (const w of HOUR_WEIGHTS) hourCum.push((hacc += w))
function captureTime() {
  const dayOffset = rf(0, 100)
  const x = rand() * hacc
  let hour = 0
  while (hour < 23 && x > hourCum[hour]) hour++
  const d = new Date(NOW - dayOffset * DAY)
  d.setUTCHours(hour, ri(0, 59), ri(0, 59), 0)
  return d.getTime()
}

const limitByKlass = { anillo: 80, gran_via: 70, avenida: 60, calle: 40, local: 30 }
const fineTier = (e) => (e <= 10 ? [100, 0] : e <= 20 ? [200, 2] : e <= 30 ? [300, 2] : e <= 40 ? [400, 4] : e <= 50 ? [500, 4] : [600, 6])
const MOTIVOS = ['GM-01', 'GM-02', 'GM-03', 'GM-04', 'GM-05', 'GM-06']

const violations = []
let apeSeq = 0
for (let i = 0; i < 1500; i++) {
  const r = rand()
  const type = r < 0.6 ? 'exceso' : r < 0.72 ? 'paso_rojo' : r < 0.82 ? 'uso_movil' : r < 0.92 ? 'pico_placa' : 'carril_bus'
  const camPool =
    type === 'exceso'
      ? cameras.filter((c) => c.kind === 'radar')
      : type === 'carril_bus'
        ? cameras.filter((c) => c.kind === 'flujo')
        : cameras.filter((c) => c.kind === 'reconocimiento')
  const cam = camPool.length ? pick(camPool) : pick(cameras)
  const captureAt = captureTime()
  const owner = person()
  let speedRecorded = null
  let speedLimit = null
  let amount = 0
  let points = 0
  if (type === 'exceso') {
    speedLimit = limitByKlass[cam.roadKlass] || 60
    const margin = Math.floor(Math.pow(rand(), 1.6) * 84) + 7
    speedRecorded = speedLimit + margin
    const [a, p] = fineTier(margin)
    amount = a
    points = p
  } else {
    amount = type === 'paso_rojo' ? 300 : type === 'uso_movil' ? 250 : type === 'pico_placa' ? 180 : 140
    points = type === 'paso_rojo' ? 4 : type === 'uso_movil' ? 6 : 0
  }
  const status = wPick([
    ['pagada', 0.54],
    ['emitida', 0.14],
    ['notificada', 0.15],
    ['apelada', 0.09],
    ['resuelta', 0.08],
  ])
  const createdAt = captureAt + ri(3, 40) * 60000
  const notified = status !== 'emitida'
  const notifiedAt = notified ? createdAt + rf(1, 5) * DAY : null
  const paidAt = status === 'pagada' && notifiedAt ? notifiedAt + rf(2, 20) * DAY : null
  let appeal = null
  if (status === 'apelada' || status === 'resuelta') {
    appeal = {
      id: 'APE-' + String(++apeSeq).padStart(4, '0'),
      filedAt: iso((notifiedAt || createdAt) + rf(0.5, 14) * DAY),
      motivos: [pick(MOTIVOS), ...(chance(0.35) ? [pick(MOTIVOS)] : [])].filter((v, ix, arr) => arr.indexOf(v) === ix),
      adjuntos: [
        ...(chance(0.55) ? [{ name: `albaran_${ri(120, 990)}.pdf`, size: ri(90_000, 380_000), type: 'application/pdf' }] : []),
        ...(chance(0.3) ? [{ name: 'factura_taller.pdf', size: ri(120_000, 420_000), type: 'application/pdf' }] : []),
      ],
      status: status === 'apelada' ? (chance(0.45) ? 'radicada' : 'en_revision') : 'resuelta',
      statement:
        'Recurro la sanción porque ' +
        pick([
          'el vehículo estaba inmovilizado por avería acreditada en el momento de la captura.',
          'la señalética del tramo no era visible por obras en la calzada.',
          'el vehículo fue vendido y consta la transferencia en la DGT en la fecha de la captura.',
          'la matrícula recogida no coincide con la del vehículo citado en la notificación.',
          'acudía a una emergencia médica acreditada por el servicio sanitario.',
        ]),
    }
    if (status === 'resuelta') {
      const estimada = chance(0.38)
      appeal.outcome = estimada ? 'estimada' : 'desestimada'
      appeal.resolvedAt = iso(new Date(appeal.filedAt).getTime() + rf(12, 38) * DAY)
      appeal.reasoning = estimada
        ? 'Se anula la sanción al haberse acreditado indicios suficientes de error de captura tras revisar el expediente.'
        : 'Se desestima el recurso: la revisión técnica no evidencia defecto formal ni material en la captura.'
    }
  }
  const seq = []
  if (type === 'exceso') {
    for (let k = 0; k < 10; k++) seq.push(Math.max(20, Math.round(speedRecorded + rf(-9, 5) * (k / 10))))
  }
  violations.push({
    code: 'INF-' + String(i + 1).padStart(6, '0'),
    type,
    plate: plate(),
    owner,
    cameraId: cam.id,
    cameraName: cam.name,
    roadName: cam.roadName,
    roadKlass: cam.roadKlass,
    lat: cam.lat,
    lng: cam.lng,
    captureAt: iso(captureAt),
    createdAt: iso(createdAt),
    notifiedAt: notifiedAt ? iso(notifiedAt) : null,
    paidAt: paidAt ? iso(paidAt) : null,
    status,
    speedRecorded,
    speedLimit,
    amount,
    points,
    vehicle: pick(['coche', 'coche', 'moto', 'furgoneta', 'camión']),
    evidence: {
      plateBox: [rf(0.36, 0.5), rf(0.52, 0.6), 0.17, 0.08],
      videoSeed: ri(1, 9000000),
      frames: [
        { t: -1400, seed: ri(1, 9000000) },
        { t: 0, seed: ri(1, 9000000) },
        { t: 1400, seed: ri(1, 9000000) },
      ],
      seq,
    },
    appeal,
  })
}

fs.mkdirSync(OUT, { recursive: true })
const write = (name, data) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(data))
write('districts.json', districts)
write('roads.json', roads)
write('cameras.json', cameras)
write('incidents.json', incidents)
write('violations.json', violations)
write('meta.json', {
  generatedAt: iso(NOW),
  roadNetworkSource: 'OpenStreetMap contributors (ODbL)',
  counts: {
    roads: roads.length,
    cameras: cameras.length,
    incidents: incidents.length,
    violations: violations.length,
  },
})

console.log(
  `datos de seed generados: ${roads.length} vías, ${cameras.length} cámaras, ${incidents.length} incidencias, ${violations.length} multas`,
)
