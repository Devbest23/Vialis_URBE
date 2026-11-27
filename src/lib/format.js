const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

export function timeAgo(dateLike) {
  const t = new Date(dateLike).getTime()
  if (Number.isNaN(t)) return '—'
  const diff = Math.round((t - Date.now()) / 1000)
  const abs = Math.abs(diff)
  if (abs < 45) return 'hace unos instantes'
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 2592000) return rtf.format(Math.round(diff / 86400), 'day')
  return rtf.format(Math.round(diff / 2592000), 'month')
}

const fmtLong = new Intl.DateTimeFormat('es', { dateStyle: 'long' })
const fmtShort = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short' })
const fmtTime = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const fmtMinute = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })
const fmtStamp = new Intl.DateTimeFormat('es-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})
const fmtStampMs = new Intl.DateTimeFormat('es-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

export const fmtDateLong = (d) => fmtLong.format(new Date(d))
export const fmtDateShort = (d) => fmtShort.format(new Date(d))
export const fmtClock = (d) => fmtTime.format(new Date(d))
export const fmtClockShort = (d) => fmtMinute.format(new Date(d))
export const fmtStampClock = (d) => fmtStampMs.format(new Date(d)).replace(',', ' ·')
export const fmtDigital = (d) => {
  const x = new Date(d)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(x.getHours())}:${p(x.getMinutes())}:${p(x.getSeconds())}`
}

export const fmtMoney = (amount) =>
  new Intl.NumberFormat('es', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)

export const fmtKph = (kph) => (kph == null ? '—' : `${Math.round(kph)} km/h`)

export const fmtNumber = new Intl.NumberFormat('es')
export const fmtPct = (v) => `${Math.round(v)}%`

export function pad(n, len = 2) {
  return String(n).padStart(len, '0')
}
