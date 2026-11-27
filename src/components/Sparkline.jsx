export const Sparkline = ({ values, color = '#38bdf8', w = 120, h = 34, min, max, className }) => {
  if (!values || values.length < 2) return <div style={{ width: w, height: h }} className={className} />
  const lo = min ?? Math.min(...values)
  const hi = max ?? Math.max(...values)
  const span = hi - lo || 1
  const stepX = w / (values.length - 1)
  let d = ''
  values.forEach((v, i) => {
    const x = i * stepX
    const y = h - 2 - ((v - lo) / span) * (h - 4)
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `
  })
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className={className}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
