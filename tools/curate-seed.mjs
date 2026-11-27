import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const DIR = path.resolve(__dirname, '../server/seed/data')

const read = (name) => JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'))
const write = (name, data) => fs.writeFileSync(path.join(DIR, name), JSON.stringify(data))

let seed = 20261119
function rand() {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const ri = (a, b) => Math.floor(rand() * (b - a + 1)) + a
const rf = (a, b) => rand() * (b - a) + a

const shuffle = (arr) => {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const incidents = read('incidents.json')
const violations = read('violations.json')

const CATEGORY_TESTS = [
  ['multiple', /m[uú]ltiple/i],
  ['lateral', /lateral/i],
  ['alcance', /alcance/i],
  ['vuelco', /vuelco/i],
  ['atropello', /atropello|peat[oó]n/i],
  ['colision', /colisi[oó]n/i],
]

function accidentCategory(title = '') {
  for (const [key, re] of CATEGORY_TESTS) if (re.test(title)) return key
  return 'otro'
}

const selected = new Map()
const pick = (item) => {
  if (!item) return false
  if (selected.has(item.id)) return false
  selected.set(item.id, item)
  return true
}

const accidents = incidents.filter((i) => i.type === 'accidente')
const accidentByCategory = new Map()
for (const inc of shuffle(accidents)) {
  const cat = accidentCategory(inc.title)
  const list = accidentByCategory.get(cat) || []
  list.push(inc)
  accidentByCategory.set(cat, list)
}

const accidentPicked = []
for (const cat of ['multiple', 'alcance', 'vuelco', 'lateral']) {
  const pool = accidentByCategory.get(cat) || []
  for (const inc of pool) {
    if (accidentPicked.length >= 12) break
    if (accidentPicked.filter((x) => accidentCategory(x.title) === cat).length >= 3) break
    if (pick(inc)) accidentPicked.push(inc)
  }
}
for (const inc of shuffle(accidents)) {
  if (accidentPicked.length >= 12) break
  if (pick(inc)) accidentPicked.push(inc)
}

const citizen = incidents.filter((i) => i.source === 'ciudadano')
const citizenTargets = { nuevo: 3, verificado: 3, en_atencion: 2, resuelto: 2, descartado: 1 }
const citizenPicked = []
for (const [status, target] of Object.entries(citizenTargets)) {
  let count = 0
  for (const inc of shuffle(citizen.filter((i) => i.status === status))) {
    if (count >= target) break
    if (pick(inc)) {
      citizenPicked.push(inc)
      count += 1
    }
  }
}

const TYPE_MIN = 2
const types = ['atasco', 'obra', 'evento', 'inundacion', 'derrame', 'manifestacion', 'apagon', 'fuego']
for (const type of types) {
  const pool = shuffle(incidents.filter((i) => i.type === type))
  let count = 0
  for (const inc of pool) {
    if (count >= TYPE_MIN) break
    if (pick(inc)) count += 1
  }
}

const TARGET_TOTAL = 40
if (selected.size < TARGET_TOTAL) {
  for (const inc of shuffle(incidents)) {
    if (selected.size >= TARGET_TOTAL) break
    pick(inc)
  }
}

const HOUR = 3600e3
const DAY = 24 * HOUR
const AGE_BUCKETS = [
  [0.5, 22],
  [26, 150],
  [190, 690],
  [800, 1750],
]

function ageHoursFor(inc, idx) {
  if (inc.type === 'accidente') {
    const bucket = idx % AGE_BUCKETS.length
    const [a, b] = AGE_BUCKETS[bucket]
    return rf(a, b)
  }
  if (inc.status === 'nuevo') return rf(0.4, 20)
  if (inc.status === 'en_atencion') return rf(2, 42)
  if (inc.status === 'verificado') {
    const bucket = idx % 3
    const [a, b] = AGE_BUCKETS[bucket === 0 ? 1 : bucket === 1 ? 2 : 3]
    return rf(a, b)
  }
  const bucket = idx % 2 === 0 ? 2 : 3
  const [a, b] = AGE_BUCKETS[bucket]
  return rf(a, b)
}

const now = Date.now()
const curatedIncidents = [...selected.values()].map((inc, idx) => {
  const ageHours = ageHoursFor(inc, idx)
  const resolved = inc.status === 'resuelto' || inc.status === 'descartado'
  const updateDelay = resolved ? Math.min(ageHours * rf(0.18, 0.55), rf(3, 48)) : rf(0.08, Math.min(4, Math.max(0.2, ageHours * 0.7)))
  const reportedAt = new Date(now - ageHours * HOUR).toISOString()
  const updatedAt = new Date(now - Math.max(0.02, ageHours - updateDelay) * HOUR).toISOString()
  const amount = inc.type === 'accidente' ? ri(2, 4) : null
  const victims = inc.type === 'accidente' ? (inc.severity === 'critica' ? ri(1, 4) : inc.severity === 'alta' ? ri(0, 3) : ri(0, 2)) : null
  return {
    ...inc,
    category: inc.type === 'accidente' ? accidentCategory(inc.title) : null,
    vehicles: amount,
    injuries: victims,
    reportedAt,
    updatedAt,
    confirmedBy: inc.source === 'ciudadano' ? Math.max(1, inc.confirmedBy) : inc.confirmedBy,
    _seedAgeHours: Number(ageHours.toFixed(3)),
    _seedUpdateDelayHours: Number(updateDelay.toFixed(3)),
    resolution:
      inc.status === 'resuelto'
        ? inc.type === 'accidente'
          ? 'Unidad de tránsito y servicios sanitarios atendieron la colisión; vía despejada y flujo restablecido.'
          : 'Reporte atendido por la central de operaciones; situación controlada y vía habilitada.'
        : inc.status === 'descartado'
          ? 'Reporte descartado tras verificación: no se encontraron evidencias suficientes para intervenir.'
          : null,
    solvedAt: inc.status === 'resuelto' || inc.status === 'descartado' ? updatedAt : null,
  }
})

curatedIncidents.sort((a, b) => Date.parse(b.reportedAt) - Date.parse(a.reportedAt))

function selectViolations(items, target) {
  const byStatus = new Map()
  for (const item of shuffle(items)) {
    const list = byStatus.get(item.status) || []
    list.push(item)
    byStatus.set(item.status, list)
  }
  const out = []
  for (const list of byStatus.values()) if (list[0] && out.length < target) out.push(list[0])
  const rest = shuffle(items.filter((i) => !out.some((x) => x.code === i.code)))
  for (const item of rest) {
    if (out.length >= target) break
    out.push(item)
  }
  return out
}

const violationTargets = {
  exceso: 150,
  paso_rojo: 55,
  uso_movil: 45,
  pico_placa: 40,
  carril_bus: 30,
}
const curatedViolations = []
for (const [type, target] of Object.entries(violationTargets)) {
  curatedViolations.push(...selectViolations(violations.filter((v) => v.type === type), target))
}
curatedViolations.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

write('incidents.json', curatedIncidents)
write('violations.json', curatedViolations)

const meta = read('meta.json')
const counts = {
  roads: read('roads.json').length,
  cameras: read('cameras.json').length,
  districts: read('districts.json').length,
  incidents: curatedIncidents.length,
  violations: curatedViolations.length,
}
write('meta.json', { ...meta, curatedAt: new Date(now).toISOString(), counts })

const citizenCount = curatedIncidents.filter((i) => i.source === 'ciudadano').length
const accidentCount = curatedIncidents.filter((i) => i.type === 'accidente').length
console.log(`Seed curado: ${curatedIncidents.length} incidencias (${citizenCount} ciudadanas, ${accidentCount} accidentes) y ${curatedViolations.length} infracciones.`)
