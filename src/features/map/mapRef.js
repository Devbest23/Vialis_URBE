import { CITY } from '../../lib/domain.js'

export const mapRef = { current: null }

export function fitCity() {
  const map = mapRef.current
  if (!map) return
  map.flyToBounds(
    [
      [CITY.bounds.latMin, CITY.bounds.lngMin],
      [CITY.bounds.latMax, CITY.bounds.lngMax],
    ],
    { duration: 0.8 },
  )
}
