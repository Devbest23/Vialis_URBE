export function filterIncidents(items, f) {
  const q = (f.query || '').trim().toLowerCase()
  return items.filter((i) => {
    if (q && !(`${i.title} ${i.roadName || ''} ${i.id}`.toLowerCase().includes(q))) return false
    if (f.severity.length && !f.severity.includes(i.severity)) return false
    if (f.types.length && !f.types.includes(i.type)) return false
    if (f.statuses.length && !f.statuses.includes(i.status)) return false
    if (f.sources.length && !f.sources.includes(i.source)) return false
    return true
  })
}
