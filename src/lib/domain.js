export const SEVERITY_ORDER = ['critica', 'alta', 'media', 'baja']

export const SEVERITY_LABEL = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

export const SEVERITY_COLOR = {
  critica: '#fb7185',
  alta: '#f59e0b',
  media: '#38bdf8',
  baja: '#94a3b8',
}

export const INCIDENT_STATUS_ORDER = ['nuevo', 'verificado', 'en_atencion', 'resuelto', 'descartado']

export const INCIDENT_STATUS_LABEL = {
  nuevo: 'Nuevo',
  verificado: 'Verificado',
  en_atencion: 'En atención',
  resuelto: 'Resuelto',
  descartado: 'Descartado',
}

export const INCIDENT_TRANSITIONS = {
  nuevo: ['verificado', 'descartado'],
  verificado: ['en_atencion', 'descartado'],
  en_atencion: ['resuelto'],
  resuelto: [],
  descartado: [],
}

export const INCIDENT_TYPE_LABEL = {
  atasco: 'Atasco',
  accidente: 'Accidente',
  obra: 'Obra',
  evento: 'Evento',
  inundacion: 'Inundación',
  derrame: 'Derrame',
  manifestacion: 'Manifestación',
  apagon: 'Avería eléctrica',
  fuego: 'Incendio',
}

export const ACCIDENT_CATEGORY_LABEL = {
  colision: 'Colisión',
  lateral: 'Colisión lateral',
  multiple: 'Colisión múltiple',
  alcance: 'Alcance',
  vuelco: 'Vuelco',
  atropello: 'Atropello',
  otro: 'Otro',
}

export const ACCIDENT_CATEGORY_ORDER = ['multiple', 'lateral', 'alcance', 'vuelco', 'atropello', 'colision', 'otro']

export const REPORT_RANGE_LABEL = {
  day: 'Último día',
  week: 'Última semana',
  month: 'Último mes',
  all: 'Todos',
}

export const REPORT_RANGE_ORDER = ['day', 'week', 'month', 'all']

export const SOURCE_LABEL = {
  sensor: 'Sensor de flujo',
  camara: 'Cámara',
  ciudadano: 'Ciudadano',
  operador: 'Operador',
}

export const FLOW_COLOR = [
  [18, '#f43f5e'],
  [36, '#f59e0b'],
  [55, '#84cc16'],
  [999, '#10b981'],
]

export function flowColor(speedKph) {
  for (const [max, color] of FLOW_COLOR) if (speedKph <= max) return color
  return '#10b981'
}

export const VIOLATION_STATUS_ORDER = ['emitida', 'notificada', 'apelada', 'resuelta', 'pagada']

export const VIOLATION_STATUS_LABEL = {
  emitida: 'Emitida',
  notificada: 'Notificada',
  apelada: 'En apelación',
  resuelta: 'Resolución tramitada',
  pagada: 'Pagada',
}

export const VIOLATION_TRANSITIONS = {
  emitida: ['notificada', 'pagada'],
  notificada: ['pagada'],
  apelada: [],
  resuelta: [],
  pagada: [],
}

export const VIOLATION_TYPE_LABEL = {
  exceso: 'Exceso de velocidad',
  paso_rojo: 'Pase en rojo',
  uso_movil: 'Manejo con móvil',
  pico_placa: 'Pico y placa',
  carril_bus: 'Carril bici/bus',
}

export const VIOLATION_TYPE_ORDER = Object.keys(VIOLATION_TYPE_LABEL)

export const VIOLATION_TYPE_COLOR = {
  exceso: '#fb7185',
  paso_rojo: '#f59e0b',
  uso_movil: '#a78bfa',
  pico_placa: '#38bdf8',
  carril_bus: '#34d399',
}

export const APPEAL_STAGE_ORDER = ['radicada', 'en_revision', 'resuelta']
export const APPEAL_STAGE_LABEL = { radicada: 'Radicada', en_revision: 'En revisión', resuelta: 'Resuelta' }
export const APPEAL_OUTCOME_LABEL = { estimada: 'Estimada · sanción anulada', desestimada: 'Desestimada · sanción firme' }

export const APPEAL_GROUNDS = [
  {
    code: 'GM-01',
    label: 'Error de captura o datos incorrectos',
    hint: 'La velocidad registrada o la identificación del vehículo no coinciden con el expediente.',
  },
  {
    code: 'GM-02',
    label: 'Señalización defectuosa o inexistente',
    hint: 'La señal no era visible, estaba deteriorada o inexistente en el tramo indicado.',
  },
  {
    code: 'GM-03',
    label: 'Vehiculo vendido, robado o transferido',
    hint: 'El vehículo no estaba bajo su titularidad en la fecha de la captura.',
  },
  {
    code: 'GM-04',
    label: 'Fuerza mayor o emergencia acreditada',
    hint: 'Concurren circunstancias de urgencia o emergencia documentadas.',
  },
  {
    code: 'GM-05',
    label: 'Prescripción o vencimiento de plazos',
    hint: 'La notificación se produjo fuera de los plazos legales.',
  },
  {
    code: 'GM-06',
    label: 'Defecto de procedimiento o notificación',
    hint: 'Errores de forma en el expediente sancionador o su trámite.',
  },
]

export const CAMERA_KIND_LABEL = {
  radar: 'Radar',
  flujo: 'Flujo',
  reconocimiento: 'Reconocimiento',
}

export const CAMERA_STATUS_LABEL = {
  activa: 'Activa',
  mantenimiento: 'En mantenimiento',
  offline: 'Sin conexión',
}

export const ROAD_CLASS_LABEL = {
  gran_via: 'Gran vía',
  anillo: 'Anillo',
  avenida: 'Avenida',
  calle: 'Calle',
  local: 'Vecinal',
}

export const CITY = {
  id: 'ciudad-sim',
  name: 'Maracaibo',
  note: 'Vías OpenStreetMap · tráfico e incidencias simulados',
  bounds: { latMin: 10.676, latMax: 10.712, lngMin: -71.667, lngMax: -71.605 },
  center: [10.69389208944989, -71.63633512519627],
  zoomHome: 12,
}
