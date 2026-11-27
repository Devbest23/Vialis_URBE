import asyncio
import random

from fastapi import WebSocket

from . import repository
from .security import now_iso


INCIDENT_TITLES = {
    "atasco": "Retención detectada por sensores de flujo",
    "accidente": "Accidente confirmado por conexión de cámara",
    "obra": "Corte por obras detectado en la vía",
    "inundacion": "Acumulación de agua en calzada",
    "derrame": "Derrame detectado en toma de cámara",
    "manifestacion": "Corte por manifestación en marcha",
    "apagon": "Semáforo fuera de servicio",
    "fuego": "Conato de fuego en vía urbana",
}
INCIDENT_TYPES = list(INCIDENT_TITLES)
SEVERITY_BY_TYPE = {
    "atasco": ["baja", "media", "alta"],
    "accidente": ["media", "alta", "critica"],
    "obra": ["baja", "media"],
    "inundacion": ["media", "alta"],
    "derrame": ["media", "alta"],
    "manifestacion": ["media", "alta"],
    "apagon": ["media", "alta"],
    "fuego": ["alta", "critica"],
}
LIMIT_BY_CLASS = {"anillo": 80, "gran_via": 70, "avenida": 60, "calle": 40, "local": 30}
PLATE_LETTERS = "BCDFGHJKLMNPRSTVWXYZ"
clients = set()
sequence = 0


def _chance(probability):
    return random.random() < probability


def _pick(items):
    return random.choice(items) if items else None


def _random_road_position(roads):
    eligible_roads = [road for road in roads if len(road.get("points") or []) >= 2]
    road = _pick(eligible_roads)
    if not road:
        return None
    points = road["points"]
    index = random.randrange(max(1, len(points) - 1))
    a = points[index]
    b = points[min(len(points) - 1, index + 1)]
    amount = random.uniform(0.2, 0.8)
    return {
        "road": road,
        "lat": a[0] + (b[0] - a[0]) * amount,
        "lng": a[1] + (b[1] - a[1]) * amount,
    }


def _run_tick():
    events = []
    roads = repository.list_roads()
    road_info = _random_road_position(roads)

    if roads:
        updates = []
        for _ in range(random.randint(2, 6)):
            road = _pick(roads)
            speed = max(5, min(90, round(road["avgSpeedKph"] + (random.random() - 0.5) * 14)))
            congestion = max(2, min(97, round(((78 - speed) / 78) * 100 + (random.random() - 0.5) * 8)))
            updates.append({"id": road["id"], "avgSpeedKph": speed, "congestion": congestion})
        repository.update_road_flow(updates)
        events.append({"type": "roads.flow", "payload": {"updates": updates}})

    if _chance(0.3):
        pool = repository.incident_pool(statuses=["nuevo", "verificado"])
        incident = _pick(pool)
        if incident:
            result = repository.add_confirmations(incident["id"], 1 if _chance(0.7) else 2)
            if result:
                payload = {"id": result["incident"]["id"], "confirmedBy": result["incident"]["confirmedBy"]}
                if result["statusChanged"]:
                    payload["status"] = result["incident"]["status"]
                events.append({"type": "incident.update", "payload": payload})

    if _chance(0.055):
        pool = [item for item in repository.incident_pool(statuses=["en_atencion"]) if item["source"] != "ciudadano"]
        if pool and _chance(0.65):
            incident = repository.resolve_telemetry_incident(_pick(pool)["id"])
            if incident:
                events.append({"type": "incident.status", "payload": {"id": incident["id"], "status": "resuelto", "updatedAt": incident["updatedAt"]}})

    if road_info and _chance(0.045):
        incident_type = _pick(INCIDENT_TYPES)
        source = "sensor" if _chance(0.55) else "camara" if _chance(0.7) else "operador"
        incident = repository.create_telemetry_incident({
            "type": incident_type,
            "severity": _pick(SEVERITY_BY_TYPE[incident_type]),
            "source": source,
            "title": INCIDENT_TITLES[incident_type],
            "detail": "Detección automática del canal de telemetría.",
            "lat": road_info["lat"],
            "lng": road_info["lng"],
        })
        events.append({"type": "incident.new", "payload": incident})

    if _chance(0.09):
        cameras = repository.camera_stats()
        camera = _pick(cameras)
        if camera and (_chance(0.09) if camera["status"] == "activa" else _chance(0.6)):
            status = "mantenimiento" if camera["status"] == "activa" else "activa"
            updated = repository.set_camera_runtime_status(camera["id"], status)
            if updated:
                events.append({"type": "camera.status", "payload": updated})

    if _chance(0.05):
        radars = [camera for camera in repository.camera_stats() if camera["kind"] == "radar" and camera["status"] == "activa"]
        camera = _pick(radars)
        if camera:
            limit = LIMIT_BY_CLASS.get(camera["roadKlass"], 60)
            margin = int(random.random() ** 1.5 * 70) + 8
            violation = repository.create_plate_scan_violation({
                "plate": f"{random.randint(1000, 9999)}{''.join(random.choices(PLATE_LETTERS, k=3))}",
                "cameraId": camera["id"],
                "cameraName": camera["name"],
                "roadName": camera["roadName"],
                "roadKlass": camera["roadKlass"],
                "lat": camera["lat"],
                "lng": camera["lng"],
                "speedRecorded": limit + margin,
                "speedLimit": limit,
                "amount": 100 if margin <= 10 else 200 if margin <= 20 else 300 if margin <= 30 else 400 if margin <= 40 else 500 if margin <= 50 else 600,
                "points": 0 if margin <= 20 else 2 if margin <= 30 else 4 if margin <= 50 else 6,
            })
            events.append({"type": "violation.created", "payload": violation})

    return events


async def broadcast_loop():
    global sequence
    while True:
        await asyncio.sleep(random.uniform(1.1, 2.0))
        if not clients:
            continue
        try:
            events = await asyncio.to_thread(_run_tick)
        except Exception:
            import logging

            logging.exception("Fallo al generar telemetría")
            continue
        if not events:
            continue
        sequence += 1
        packet = {"seq": sequence, "t": now_iso(), "events": events}
        targets = tuple(clients)
        results = await asyncio.gather(*(client.send_json(packet) for client in targets), return_exceptions=True)
        for client, result in zip(targets, results):
            if isinstance(result, Exception):
                clients.discard(client)


async def connect_client(websocket: WebSocket, user):
    await websocket.accept()
    clients.add(websocket)
    await websocket.send_json({
        "seq": sequence + 1,
        "t": now_iso(),
        "events": [],
        "welcome": {"user": user["name"]},
    })


def disconnect_client(websocket: WebSocket):
    clients.discard(websocket)
