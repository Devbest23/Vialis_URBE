import asyncio
import logging
import math
import os
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import APIRouter, Body, Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.cors import CORSMiddleware

from . import repository, telemetry
from .security import authenticate_token, current_user, login, logout, now_iso, register
from .storage import DB_PATH, initialize_database


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
login_attempts = {}
login_window_ms = 10 * 60_000


@asynccontextmanager
async def lifespan(_app):
    initialize_database()
    task = asyncio.create_task(telemetry.broadcast_loop())
    logging.info("[VIALIS] SQLite: %s", DB_PATH)
    logging.info("[VIALIS] Cuenta demo disponible: demo@vialis.app")
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="VIALIS API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(repository.HttpError)
async def handle_http_error(_request, error):
    return JSONResponse(status_code=error.status, content={"message": str(error)})


@app.exception_handler(StarletteHTTPException)
async def handle_http_exception(_request, error):
    message = error.detail if isinstance(error.detail, str) else "Solicitud no válida."
    return JSONResponse(status_code=error.status_code, content={"message": message}, headers=error.headers)


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_request, _error):
    return JSONResponse(status_code=422, content={"message": "El cuerpo de la solicitud no es válido."})


async def require_user(authorization: str | None = Header(default=None)):
    token = authorization[7:].strip() if authorization and authorization.startswith("Bearer ") else ""
    user = await asyncio.to_thread(authenticate_token, token)
    if not user:
        raise HTTPException(status_code=401, detail="Sesión expirada o no válida. Inicia sesión de nuevo.")
    return user


def parse_csv(value):
    return [item.strip() for item in str(value or "").split(",") if item.strip()]


api = APIRouter(prefix="/api")


@api.get("/health")
async def health():
    return {"ok": True, "service": "vialis-api", "time": now_iso()}


@api.post("/auth/register")
async def register_route(body: dict = Body(default={})):
    status, result = await asyncio.to_thread(register, body or {})
    return JSONResponse(status_code=status, content=result)


def _login_key(request, email):
    host = request.client.host if request.client else "local"
    return f"{host}:{str(email or '').lower()}"


@api.post("/auth/login")
async def login_route(request: Request, body: dict = Body(default={})):
    body = body or {}
    key = _login_key(request, body.get("email"))
    entry = login_attempts.get(key)
    now = asyncio.get_running_loop().time() * 1000
    if entry and entry["count"] >= 8 and now - entry["first"] < login_window_ms:
        return JSONResponse(status_code=429, content={"message": "Demasiados intentos fallidos. Espera unos minutos antes de reintentar."})
    status, result = await asyncio.to_thread(login, body)
    if status == 401:
        if not entry or now - entry["first"] > login_window_ms:
            login_attempts[key] = {"count": 1, "first": now}
        else:
            entry["count"] += 1
    elif status == 200:
        login_attempts.pop(key, None)
    return JSONResponse(status_code=status, content=result)


@api.get("/auth/me")
async def me_route(user=Depends(require_user)):
    current = await asyncio.to_thread(current_user, user["id"])
    if not current:
        raise HTTPException(status_code=401, detail="Sesión no válida.")
    return {"user": current}


@api.post("/auth/logout", status_code=204)
async def logout_route(authorization: str | None = Header(default=None), _user=Depends(require_user)):
    token = authorization[7:].strip() if authorization and authorization.startswith("Bearer ") else ""
    await asyncio.to_thread(logout, token)
    return None


@api.get("/roads")
async def roads_route(_user=Depends(require_user)):
    return await asyncio.to_thread(repository.list_roads)


@api.get("/cameras")
async def cameras_route(_user=Depends(require_user)):
    return await asyncio.to_thread(repository.list_cameras)


@api.get("/districts")
async def districts_route(_user=Depends(require_user)):
    return await asyncio.to_thread(repository.list_districts)


@api.get("/incidents")
async def incidents_route(since: str | None = None, _user=Depends(require_user)):
    return {"items": await asyncio.to_thread(repository.list_incidents, since), "serverTime": now_iso()}


@api.get("/incidents/{incident_id}")
async def incident_route(incident_id: str, _user=Depends(require_user)):
    incident = await asyncio.to_thread(repository.get_incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada.")
    return incident


@api.patch("/incidents/{incident_id}/status")
async def incident_status_route(incident_id: str, body: dict = Body(default={}), user=Depends(require_user)):
    body = body or {}
    return await asyncio.to_thread(repository.update_incident_status, incident_id, str(body.get("status") or ""), body.get("note", ""), user)


@api.post("/incidents/{incident_id}/confirm")
async def confirm_incident_route(incident_id: str, user=Depends(require_user)):
    return await asyncio.to_thread(repository.confirm_incident, incident_id, user)


CITY_BOUNDS = {"latMin": 10.676, "latMax": 10.712, "lngMin": -71.667, "lngMax": -71.605}
SEVERITIES = {"critica", "alta", "media", "baja"}
ACCIDENT_CATEGORIES = {"colision", "lateral", "multiple", "alcance", "vuelco", "atropello", "otro"}


@api.post("/reports", status_code=201)
async def create_report_route(body: dict = Body(default={}), user=Depends(require_user)):
    body = body or {}
    try:
        lat, lng = float(body.get("lat")), float(body.get("lng"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="La ubicación es obligatoria: selecciona un punto en el mapa.")
    if not math.isfinite(lat) or not math.isfinite(lng):
        raise HTTPException(status_code=422, detail="La ubicación debe contener coordenadas válidas.")
    if lat < CITY_BOUNDS["latMin"] or lat > CITY_BOUNDS["latMax"] or lng < CITY_BOUNDS["lngMin"] or lng > CITY_BOUNDS["lngMax"]:
        raise HTTPException(status_code=422, detail="La ubicación seleccionada está fuera del área urbana de la ciudad.")
    incident_type = body.get("type")
    if incident_type not in repository.INCIDENT_TYPE_LABEL:
        raise HTTPException(status_code=422, detail="Tipo de incidencia no válido.")
    severity = str(body.get("severity") or "media")
    if severity not in SEVERITIES:
        raise HTTPException(status_code=422, detail="Gravedad no válida.")
    description = str(body.get("description") or "").strip()
    if not 15 <= len(description) <= 1000:
        raise HTTPException(status_code=422, detail="La descripción debe tener entre 15 y 1000 caracteres.")
    data = {"type": incident_type, "severity": severity, "description": description, "lat": lat, "lng": lng}
    if incident_type == "accidente":
        category = str(body.get("category") or "otro")
        if category not in ACCIDENT_CATEGORIES:
            raise HTTPException(status_code=422, detail="Categoría de accidente no válida.")
        values = {}
        for key, maximum, message in (("vehicles", 50, "El número de vehículos debe estar entre 0 y 50."), ("injuries", 200, "El número de heridos debe estar entre 0 y 200.")):
            value = body.get(key)
            if value is None or value == "":
                values[key] = None
                continue
            try:
                numeric_value = float(value)
                if not math.isfinite(numeric_value) or not numeric_value.is_integer():
                    raise ValueError
            except (TypeError, ValueError):
                raise HTTPException(status_code=422, detail=message)
            number = int(numeric_value)
            if number < 0 or number > maximum:
                raise HTTPException(status_code=422, detail=message)
            values[key] = number
        data.update(category=category, **values)
    if await asyncio.to_thread(repository.count_recent_reports, user["id"], 1) >= 8:
        raise HTTPException(status_code=429, detail="Has radicado demasiados reportes en la última hora. Espera antes de enviar otro.")
    duplicate = await asyncio.to_thread(repository.find_duplicate_incident, incident_type, lat, lng)
    if duplicate:
        return JSONResponse(status_code=409, content={
            "message": f"Ya existe un reporte similar cerca de este punto ({duplicate['id']}: {duplicate['title']}). Confírmalo en lugar de crear un duplicado.",
            "duplicate": {key: duplicate[key] for key in ("id", "title", "reportedAt", "confirmedBy")},
        })
    return await asyncio.to_thread(repository.create_incident, data, user)


@api.get("/reports/accidents")
async def accident_report_route(range: str = "week", _user=Depends(require_user)):
    return await asyncio.to_thread(repository.accident_report, range)


@api.get("/violations")
async def violations_route(
    search: str = "",
    type: str = "",
    status: str = "",
    appeal: str = "",
    sort: str = "recent",
    page: int = 1,
    pageSize: int = 100,
    _user=Depends(require_user),
):
    types = [item for item in parse_csv(type) if item in ("exceso", "paso_rojo", "uso_movil", "pico_placa", "carril_bus")]
    statuses = [item for item in parse_csv(status) if item in ("emitida", "notificada", "apelada", "resuelta", "pagada")]
    return await asyncio.to_thread(repository.query_violations, search, types, statuses, parse_csv(appeal), sort, page, pageSize)


@api.get("/violations/{code}")
async def violation_route(code: str, _user=Depends(require_user)):
    violation = await asyncio.to_thread(repository.find_violation, code)
    if not violation:
        raise HTTPException(status_code=404, detail="Infracción no encontrada.")
    return violation


@api.post("/violations/{code}/appeal", status_code=201)
async def appeal_route(code: str, body: dict = Body(default={}), user=Depends(require_user)):
    return await asyncio.to_thread(repository.create_appeal, code, body or {}, user)


@api.patch("/violations/{code}/status")
async def violation_status_route(code: str, body: dict = Body(default={}), _user=Depends(require_user)):
    return await asyncio.to_thread(repository.set_violation_status, code, str((body or {}).get("status") or ""))


app.include_router(api)


@app.websocket("/ws/telemetry")
async def telemetry_route(websocket: WebSocket):
    user = await asyncio.to_thread(authenticate_token, websocket.query_params.get("token"))
    if not user:
        await websocket.close(code=4401, reason="Sesión no válida.")
        return
    await telemetry.connect_client(websocket, user)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        telemetry.disconnect_client(websocket)
    except Exception:
        telemetry.disconnect_client(websocket)
        raise


DIST = Path(__file__).resolve().parent.parent / "dist"
if (DIST / "index.html").is_file():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")


def main():
    port = int(os.environ.get("PORT") or os.environ.get("VIALIS_PORT") or 4000)
    print(f"[VIALIS] API disponible en http://localhost:{port}/api", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")


if __name__ == "__main__":
    main()
