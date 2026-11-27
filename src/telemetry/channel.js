const MAX_DELAY = 15_000

function wsUrl(token) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  return `${protocol}//${host}/ws/telemetry?token=${encodeURIComponent(token)}`
}

export function createTelemetryChannel({ token, onPacket, onStatus, onOpen }) {
  let socket = null
  let disposed = false
  let attempts = 0
  let retryTimer = null

  const emitStatus = (patch) => {
    onStatus?.({ connected: false, mode: 'ws', attempts, ...patch })
  }

  const scheduleRetry = () => {
    if (disposed) return
    attempts += 1
    const delay = Math.min(MAX_DELAY, 800 * Math.pow(1.8, attempts))
    emitStatus({ retryingInMs: delay })
    retryTimer = setTimeout(connect, delay)
  }

  function connect() {
    if (disposed) return
    retryTimer = null
    let ws
    try {
      ws = new WebSocket(wsUrl(token))
    } catch {
      scheduleRetry()
      return
    }
    socket = ws
    ws.onopen = () => {
      attempts = 0
      emitStatus({ connected: true })
      onOpen?.()
    }
    ws.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data)
        if (packet) onPacket(packet)
      } catch {
        void 0
      }
    }
    ws.onclose = () => {
      socket = null
      if (!disposed) scheduleRetry()
    }
    ws.onerror = () => {
      try {
        ws.close()
      } catch {
        void 0
      }
    }
  }

  connect()

  return () => {
    disposed = true
    if (retryTimer) clearTimeout(retryTimer)
    if (socket) {
      socket.onclose = null
      try {
        socket.close()
      } catch {
        void 0
      }
      socket = null
    }
    emitStatus({ connected: false })
  }
}
