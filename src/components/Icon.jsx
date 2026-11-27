const paths = {
  radar: 'M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0m5 0a4 4 0 1 0 8 0 4 4 0 0 0-8 0m4 1 .01-.01',
  camera: 'M3 7h4l2-2h6l2 2h4v12H3zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  flow: 'M4 17h6M4 12h10M4 7h16M17 14l3 3-3 3',
  siren: 'M6 19V11a6 6 0 0 1 12 0v8M6 19h12M9 7h6M4 19h16M19 5l2-2M5 5L3 3',
  alert: 'M12 3 2 20h20zM12 10v4m0 3h.01',
  wrench: 'M14.7 6.3a4 4 0 1 0 5 5L21 21l-3 0-4.3-3.7M6 10h2M7 13H5',
  water: 'M12 3c3 4 6 6.6 6 10a6 6 0 1 1-12 0c0-3.4 3-6 6-10z',
  flame: 'M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-2-1-2-1-4 3 2 5 4 5 7a7 7 0 1 1-14 0c0-5 5-7 7-12z',
  users: 'M9 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-6 8c0-3 3-4 6-4s6 1 6 4M16 6a3 3 0 0 1 0 6m0 0c3 0 6 1 6 4',
  zap: 'M13 2 3 14h7l-1 8 10-12h-7z',
  drop: 'M12 3c3 4 6 6.6 6 10a6 6 0 1 1-12 0c0-3.4 3-6 6-10z',
  car: 'M5 16 6 9h12l1 7M5 16h14M7 16v3m10-3v3M9 9l1-3h4l1 3',
  road: 'M12 3v3m0 4v3m0 4v4M7 3H5l1 18h2zM17 3h2l-1 18h-2z',
  layers: 'M12 3 3 8l9 5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  city: 'M3 21V9h6M9 21V5h6v16M15 21V11h6v10M3 21h18M7 12h1M7 15h1M12 8h1M12 11h1M12 14h1M18 14h1M18 17h1',
  filter: 'M3 5h18l-7 8v6l-4-2v-4z',
  search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm10 2-5.5-5.5',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 13l4 4L19 7',
  clock: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zm0-13v5l3 2',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronLeft: 'M15 6l-6 6 6 6',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  printer: 'M7 8V3h10v5M5 8h14v8h-3M7 13h10v8H7zM5 16h2',
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M5 21h14',
  message: 'M4 5h16v11H9l-5 4z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  crosshair: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9-9v4m0 10v4m-9-9h4m10 0h4',
  play: 'M8 5l11 7-11 7z',
  pause: 'M7 5h3v14H7zM14 5h3v14h-3z',
  info: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zm0-13v.01M12 11v6',
  help: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zm-2.5-9.7c.3-1.2 1.4-1.8 2.5-1.8s2.4.8 2.4 2.2c0 1.5-2.4 1.6-2.4 3.1m0 2.2v.01',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  upload: 'M12 15V3m0 0 4 4m-4-4L8 7M5 21h14',
  external: 'M14 5h5v5m0-5L11 13M19 14v6H5V6h6',
  refresh: 'M20 11A8 8 0 1 0 20 13M20 4v7h-7',
  gavel: 'M14 13l-8 8M3.5 13.5l7-7M9 11l4 4M13 3l8 8M13 7l4 4M2 21h12',
  currency: 'M12 19V5m-4 4 4-4 4 4M6 10h.01M18 10h.01',
  key: 'M10 19a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm4-4h7m-3-3v6',
  pin: 'M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10zm0-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  zoomIn: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-12v8m4-4H7m10 10-5.5-5.5',
  zoomOut: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM7 11h8m2 10-5.5-5.5',
  home: 'M4 11l8-7 8 7M6 10v10h4v-6h4v6h4V10',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h13M20 18h0m0-12v0m-4 12v0m-6-12v0m6 12v0',
  doc: 'M6 3h9l5 5v13H6zM15 3v5h5M9 12h6M9 16h6',
  quote: 'M7 7h4v6a4 4 0 0 1-4 4M15 7h4v6a4 4 0 0 1-4 4',
  maximize: 'M8 3H3v5M3 3l7 7m6-7h5v5m0-5-7 7M3 16v5h5m-5 0 7-7m9 2v5h-5m5 0-7-7',
  minimize: 'M4 10h6V4m0 6L3 3m17 7h-6V4m0 6 7-7M4 14h6v6m0-6-7 7m17-7h-6v6m0-6 7 7',
}

export const Icon = ({ name, size = 16, className, strokeWidth = 1.8, filled = false }) => {
  const d = paths[name] || paths.info
  return filled && name === 'play' ? (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" className={className}>
      <path d={d} stroke="none" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={d} />
    </svg>
  )
}

export const IncidentIcon = { iconFor: (t) => iconByIncidentType[t] || 'pin' }

export const iconByIncidentType = {
  atasco: 'car',
  accidente: 'alert',
  obra: 'wrench',
  evento: 'users',
  inundacion: 'water',
  derrame: 'drop',
  manifestacion: 'users',
  apagon: 'zap',
  fuego: 'flame',
}
