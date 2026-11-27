# VIALIS — Control Vial Urbano

Centro de operaciones para tráfico urbano, infracciones y reportes ciudadanos. La interfaz está
construida con **React 19 + Vite + TailwindCSS**, y los datos se persisten en **SQLite** a través de
una API **Python + FastAPI** con telemetría **WebSocket** en vivo.

## Requisitos

- **Python 3.10 o superior**.
- **Node.js 20.19 o superior** y npm 10+.

## Arranque

```bash
python -m pip install -r requirements.txt
npm install
npm run dev          # API Python en http://localhost:4000 + Vite en http://localhost:5173
```

Abre `http://localhost:5173`. La API expone `/api` y `/ws` mediante el proxy de Vite.

| Comando | Descripción |
|---|---|
| `npm run dev` | Arranca API Python y frontend juntos (`tools/dev.mjs`). |
| `npm run dev:api` | Solo API FastAPI + SQLite en el puerto 4000. |
| `npm run dev:web` | Solo Vite en el puerto 5173. |
| `npm run build` | Compila el frontend en `dist/`. |
| `npm run server` | Sirve la API Python y, si existe, `dist/` desde el puerto 4000. |
| `npm run preview` | Vista previa de `dist/` con proxy a la API. |
| `npm run db:reset` | Elimina la base; se recrea y siembra al arrancar la API. |
| `node tools/gen-mocks.mjs` | Regenera vías OSM y datos simulados ubicados sobre ellas; después ejecuta `npm run seed:curate`. |
| `npm run seed:curate` | Selecciona 40 incidencias demo y 320 infracciones de los datos generados. |
| `python -m unittest discover -s tests -p "test_*.py"` | Prueba la red vial y las validaciones de la API. |

**Cuenta demo:** `demo@vialis.app` · `Vialis2026`

## Autenticación

- Registro con **solo nombre, correo y contraseña** (validación en cliente y servidor).
- Contraseñas con **scrypt + salt**; sesiones de 7 días con token aleatorio hasheado en SHA-256.
- El token se guarda en `localStorage` y se envía como `Authorization: Bearer <token>`.
- El WebSocket FastAPI se autentica con `?token=` y rechaza conexiones sin sesión válida.
- Si la sesión expira, la interfaz vuelve al login y limpia el estado de la aplicación.

## Módulos (pestañas 1 / 2 / 3)

| Pestaña | Contenido |
|---|---|
| 1 · Centro de control | Mapa Leaflet oscuro, vías coloreadas por flujo, incidencias, cámaras, distritos, KPIs, feed en vivo ampliable a pantalla completa y detalle con máquina de estados, historial y confirmaciones únicas por cuenta. |
| 2 · Infracciones | Expedientes paginados con búsqueda en servidor, filtros, detalle, evidencias, apelaciones, boletín imprimible y export CSV. Los adjuntos de apelación se registran como referencias en esta demo, no se almacena el contenido de los archivos. |
| 3 · Reportes e informes | **Solucionar reportes:** bandeja ciudadana con filtros, búsqueda, estadísticas, detección de duplicados cercanos y flujo verificar → atender → resolver con nota obligatoria. **Generar reporte:** formulario con mapa y campos de accidente (categoría, vehículos, heridos). **Informe de accidentes:** agregados y detalle por **último día, semana, mes o histórico**, con CSV e impresión. |

## Persistencia y datos

- Base SQLite en `server/data/vialis.db` (WAL), ignorada por git y compartida directamente con la API Python.
- Tablas: `users`, `sessions`, `roads`, `cameras`, `districts`, `incidents`, `incident_history`,
  `incident_confirmations`, `violations`, `appeals`, `app_metadata`.
- Los datos de demo viven en `server/seed/data/*.json` y se cargan cuando las tablas correspondientes están vacías.
- La red vial sigue calles reales de Maracaibo obtenidas de OpenStreetMap; sus datos están bajo ODbL y se atribuyen en el mapa. La migración versionada actualiza las vías y recoloca cámaras/incidencias simuladas sin borrar cuentas, historial ni coordenadas de reportes ciudadanos.
- Los registros incluyen historial, resoluciones, coordenadas, vehículos, heridos y estado.
- Telemetría: el servidor genera eventos y los persiste antes de emitirlos (`roads.flow`,
  `incident.new`, `incident.update`, `incident.status`, `camera.status`, `violation.created`).

### Antifraude en reportes

- Máximo **8 reportes por hora** por cuenta.
- Se rechazan duplicados del mismo tipo a menos de **200 m** y **2 h** de otro reporte abierto,
  indicando el ID existente para confirmarlo en su lugar.
- Cada cuenta puede confirmar un reporte **una sola vez**.
- Los reportes nuevos no alteran la operación hasta ser verificados; 4 confirmaciones distintas
  los pasan a **Verificado**.

## Estructura

```
server/app.py          ← entrada FastAPI (API + estáticos + WebSocket)
server/security.py     ← validación, registro, login, sesiones y hashing
server/storage.py      ← SQLite, esquema y seed de demostración
server/repository.py   ← consultas, incidencias, infracciones e informes
server/telemetry.py    ← telemetría WebSocket autenticada
server/seed/data/      ← datos curados de demo

src/api/client.js      ← cliente fetch con Bearer token y manejo de 401
src/store/authStore.js ← sesión y bootstrap
src/store/*.js         ← zustand: tráfico, infracciones, UI
src/telemetry/channel.js ← WebSocket con reconexión exponencial
src/features/auth      ← login y registro
src/features/ops       ← centro de control, lista, detalle
src/features/map       ← mapa y capas
src/features/violations← expedientes y apelaciones
src/features/reports   ← solucionar, generar, informe de accidentes
src/features/shell     ← TopBar, StatusBar, ayuda, toasts
tools/dev.mjs          ← launcher Python API + Vite
tools/reset-db.mjs     ← reinicio de base
tools/curate-seed.mjs  ← curación de datos de demo
tools/gen-mocks.mjs    ← generador determinista del seed
```

## API

Todas las rutas salvo registro e inicio de sesión requieren Bearer token.

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password }` → `{ user, token, expiresAt }` |
| POST | `/api/auth/login` | `{ email, password }` → `{ user, token, expiresAt }` |
| GET | `/api/auth/me` | Valida la sesión |
| POST | `/api/auth/logout` | Revoca la sesión |
| GET | `/api/roads` · `/api/cameras` · `/api/districts` | Datos urbanos |
| GET | `/api/incidents?since=ISO` | `{ items, serverTime }` |
| PATCH | `/api/incidents/:id/status` | `{ status, note? }`; la nota es necesaria para resolver/descartar |
| POST | `/api/incidents/:id/confirm` | Confirmación única por cuenta |
| POST | `/api/reports` | `{ type, severity, description, lat, lng, category?, vehicles?, injuries? }` |
| GET | `/api/reports/accidents?range=day\|week\|month\|all` | Totales, categorías, gravedad, días e ítems |
| GET | `/api/violations?...` | `search, type, status, appeal, sort, page, pageSize` |
| GET | `/api/violations/:code` | Expediente completo |
| POST | `/api/violations/:code/appeal` | Apelación ciudadana |
| PATCH | `/api/violations/:code/status` | `notificada` / `pagada` |
| WS | `/ws/telemetry?token=…` | Paquetes `{ seq, t, events[] }` |

## Accesibilidad

Navegación completa por teclado: `1/2/3` cambian de módulo, `/` enfoca el buscador del módulo,
`?` abre la ayuda, `↑ ↓ + Enter` recorren incidencias, `Esc` cierra paneles y modales. Las listas
usan roles ARIA, hay foco visible, contraste AA y `aria-live` para avisos. Se respeta
`prefers-reduced-motion`.
