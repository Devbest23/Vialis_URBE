import { spawn } from 'node:child_process'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')

const children = []
let shuttingDown = false

function start(name, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  })
  child.on('exit', (code) => {
    if (shuttingDown) return
    console.log(`[vialis] ${name} terminó con código ${code ?? 0}. Cerrando el resto…`)
    shutdown(code ?? 0)
  })
  children.push(child)
  return child
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) {
      try {
        child.kill()
      } catch {
        void 0
      }
    }
  }
  setTimeout(() => process.exit(code), 200)
}

start('api', process.env.VIALIS_PYTHON || 'python', ['-m', 'server.app'])
start('web', process.execPath, [viteBin, '--host', '127.0.0.1'])

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
