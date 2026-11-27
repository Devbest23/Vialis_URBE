export function inBounds(bounds, lat, lng) {
  return bounds && lat >= bounds.s && lat <= bounds.n && lng >= bounds.w && lng <= bounds.e
}

export function boundsWithMargin(b, latFrac, lngFrac) {
  if (!b) return null
  const dLat = (b.n - b.s) * latFrac
  const dLng = (b.e - b.w) * lngFrac
  return { s: b.s - dLat, n: b.n + dLat, w: b.w - dLng, e: b.e + dLng }
}

export function roadsWithinBounds(roads, bounds) {
  return roads.filter((road) =>
    (road.points || []).some(([lat, lng]) => lat >= bounds.latMin && lat <= bounds.latMax && lng >= bounds.lngMin && lng <= bounds.lngMax),
  )
}

export function clampLat(lat) {
  return Math.max(-85, Math.min(85, lat))
}

export function clampLng(lng) {
  return ((lng + 540) % 360) - 180
}

export function snapToNearestRoad(position, roads, preferredRoadId, maxDistanceMeters = 800) {
  const [lat, lng] = position
  const preferred = preferredRoadId ? roads.filter((road) => road.id === preferredRoadId) : []
  const candidates = preferred.length ? preferred : roads
  const metersPerLat = 111_320
  const metersPerLng = metersPerLat * Math.cos((lat * Math.PI) / 180)
  let closest = null
  let closestDistance = Infinity

  for (const road of candidates) {
    const points = road.points || []
    for (let index = 1; index < points.length; index++) {
      const start = points[index - 1]
      const end = points[index]
      if (![start[0], start[1], end[0], end[1]].every(Number.isFinite)) continue
      const ax = (start[1] - lng) * metersPerLng
      const ay = (start[0] - lat) * metersPerLat
      const bx = (end[1] - lng) * metersPerLng
      const by = (end[0] - lat) * metersPerLat
      const dx = bx - ax
      const dy = by - ay
      const lengthSquared = dx * dx + dy * dy
      const ratio = lengthSquared ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0
      const distance = Math.hypot(ax + ratio * dx, ay + ratio * dy)
      if (distance < closestDistance) {
        closestDistance = distance
        closest = [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio]
      }
    }
  }

  return closestDistance <= maxDistanceMeters ? closest : null
}
