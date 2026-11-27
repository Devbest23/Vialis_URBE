import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dbPath = process.env.VIALIS_DB_PATH
  ? path.resolve(process.env.VIALIS_DB_PATH)
  : path.join(root, 'server', 'data', 'vialis.db')

let removed = 0
for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
  if (!fs.existsSync(file)) continue
  fs.rmSync(file, { force: true })
  removed += 1
  console.log(`[vialis] eliminado ${file}`)
}

if (removed === 0) console.log(`[vialis] no había base de datos en ${dbPath}`)
else console.log('[vialis] la base se recreará y sembrará en el próximo arranque de la API.')
