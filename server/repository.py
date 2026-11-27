import json
import math
import random
import re
from datetime import datetime, timedelta, timezone

from .geo import nearest_road_point
from .security import now_iso
from .storage import connection


INCIDENT_TRANSITIONS = {
    "nuevo": ("verificado", "descartado"),
    "verificado": ("en_atencion", "descartado"),
    "en_atencion": ("resuelto",),
    "resuelto": (),
    "descartado": (),
}
INCIDENT_TYPE_LABEL = {
    "atasco": "Atasco",
    "accidente": "Accidente",
    "obra": "Obra",
    "evento": "Evento",
    "inundacion": "Inundación",
    "derrame": "Derrame",
    "manifestacion": "Manifestación",
    "apagon": "Avería eléctrica",
    "fuego": "Incendio",
}
TYPE_TITLES = {
    "atasco": "Atasco reportado por ciudadanía",
    "accidente": "Accidente reportado por ciudadanía",
    "obra": "Obra reportada por ciudadanía",
    "evento": "Evento reportado por ciudadanía",
    "inundacion": "Inundación reportada por ciudadanía",
    "derrame": "Derrame reportado por ciudadanía",
    "manifestacion": "Manifestación reportada por ciudadanía",
    "apagon": "Avería eléctrica reportada por ciudadanía",
    "fuego": "Incendio reportado por ciudadanía",
}
STATUS_NOTE = {
    "verificado": "Verificación completada por la central de operaciones.",
    "en_atencion": "Unidad asignada y en camino al punto del incidente.",
    "resuelto": "Incidencia resuelta y vía habilitada.",
    "descartado": "Reporte descartado tras verificación.",
}
APPEAL_GROUNDS = {"GM-01", "GM-02", "GM-03", "GM-04", "GM-05", "GM-06"}
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")


class HttpError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def fail(status, message):
    raise HttpError(status, message)


def _json(value, fallback):
    try:
        return json.loads(value) if value else fallback
    except (TypeError, json.JSONDecodeError):
        return fallback


def _map_history(row):
    return {
        "id": row["id"],
        "status": row["status"],
        "note": row["note"],
        "actorId": row["actor_id"],
        "actorName": row["actor_name"],
        "createdAt": row["created_at"],
    }


def _map_incident(row, history=None):
    return {
        "id": row["id"],
        "type": row["type"],
        "category": row["category"],
        "severity": row["severity"],
        "status": row["status"],
        "source": row["source"],
        "title": row["title"],
        "detail": row["detail"],
        "roadId": row["road_id"],
        "roadName": row["road_name"],
        "lat": row["lat"],
        "lng": row["lng"],
        "radiusM": row["radius_m"],
        "reportedAt": row["reported_at"],
        "updatedAt": row["updated_at"],
        "confirmedBy": row["confirmed_by"],
        "mediaCount": row["media_count"],
        "clearEtaMin": row["clear_eta_min"],
        "vehicles": row["vehicles"],
        "injuries": row["injuries"],
        "resolution": row["resolution"],
        "solvedAt": row["solved_at"],
        "createdBy": row["created_by"],
        "history": history or [],
    }


def _get_incident(conn, incident_id):
    row = conn.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
    if not row:
        return None
    history = conn.execute(
        "SELECT * FROM incident_history WHERE incident_id = ? ORDER BY created_at ASC",
        (incident_id,),
    ).fetchall()
    return _map_incident(row, [_map_history(item) for item in history])


def _insert_history(conn, incident_id, status, note, actor_id, actor_name, created_at=None):
    conn.execute(
        """INSERT INTO incident_history
           (incident_id, status, note, actor_id, actor_name, created_at) VALUES (?, ?, ?, ?, ?, ?)""",
        (incident_id, status, note, actor_id, actor_name or "Sistema", created_at or now_iso()),
    )


def _list_roads(conn):
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "klass": row["klass"],
            "lanes": row["lanes"],
            "lengthM": row["length_m"],
            "avgSpeedKph": row["avg_speed_kph"],
            "congestion": row["congestion"],
            "points": _json(row["points_json"], []),
        }
        for row in conn.execute("SELECT * FROM roads ORDER BY id ASC").fetchall()
    ]


def _nearest_road(conn, lat, lng):
    road, _point, distance = nearest_road_point(lat, lng, _list_roads(conn))
    return road if road and distance <= 140 else None


def _next_id(conn, table, column, prefix, width):
    row = conn.execute(
        f"SELECT MAX(CAST(SUBSTR({column}, 5) AS INTEGER)) AS n FROM {table} WHERE {column} LIKE ?",
        (f"{prefix}-%",),
    ).fetchone()
    return f"{prefix}-{int(row['n'] or 0) + 1:0{width}d}"


def list_roads():
    with connection() as conn:
        return _list_roads(conn)


def list_cameras():
    with connection() as conn:
        return [
            {
                "id": row["id"], "name": row["name"], "kind": row["kind"], "roadId": row["road_id"],
                "roadName": row["road_name"], "roadKlass": row["road_klass"], "lat": row["lat"],
                "lng": row["lng"], "status": row["status"], "lastSdkSyncAt": row["last_sdk_sync_at"],
            }
            for row in conn.execute("SELECT * FROM cameras ORDER BY id ASC").fetchall()
        ]


def list_districts():
    with connection() as conn:
        return [
            {"id": row["id"], "name": row["name"], "center": _json(row["center_json"], []), "ring": _json(row["ring_json"], [])}
            for row in conn.execute("SELECT * FROM districts ORDER BY id ASC").fetchall()
        ]


def list_incidents(since=None):
    with connection() as conn:
        if since:
            rows = conn.execute("SELECT * FROM incidents WHERE updated_at > ? ORDER BY updated_at DESC", (since,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM incidents ORDER BY updated_at DESC").fetchall()
        histories = conn.execute("SELECT * FROM incident_history ORDER BY created_at ASC").fetchall()
        by_incident = {}
        for row in histories:
            by_incident.setdefault(row["incident_id"], []).append(_map_history(row))
        return [_map_incident(row, by_incident.get(row["id"], [])) for row in rows]


def get_incident(incident_id):
    with connection() as conn:
        return _get_incident(conn, incident_id)


def count_recent_reports(user_id, hours=1):
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    with connection() as conn:
        return conn.execute(
            "SELECT COUNT(*) FROM incidents WHERE source = 'ciudadano' AND created_by = ? AND reported_at >= ?",
            (user_id, cutoff),
        ).fetchone()[0]


def find_duplicate_incident(incident_type, lat, lng, hours=2):
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    with connection() as conn:
        row = conn.execute(
            """SELECT * FROM incidents
               WHERE type = ? AND status NOT IN ('resuelto', 'descartado') AND reported_at >= ?
                 AND (lat - ?) * (lat - ?) + (lng - ?) * (lng - ?) < 0.0000036
               ORDER BY reported_at DESC LIMIT 1""",
            (incident_type, cutoff, lat, lat, lng, lng),
        ).fetchone()
        return _map_incident(row) if row else None


def create_incident(input_data, user):
    incident_id, now = None, now_iso()
    with connection() as conn:
        incident_id = _next_id(conn, "incidents", "id", "INC", 5)
        road = _nearest_road(conn, input_data["lat"], input_data["lng"])
        label = TYPE_TITLES.get(input_data["type"], "Incidencia reportada por ciudadanía")
        title = f"{label} en {road['name']}" if road else label
        is_accident = input_data["type"] == "accidente"
        conn.execute(
            """INSERT INTO incidents (
               id, type, category, severity, status, source, title, detail, road_id, road_name,
               lat, lng, radius_m, reported_at, updated_at, confirmed_by, media_count,
               clear_eta_min, vehicles, injuries, created_by
               ) VALUES (?, ?, ?, ?, 'nuevo', 'ciudadano', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, ?, ?, ?)""",
            (
                incident_id, input_data["type"], input_data.get("category") if is_accident else None,
                input_data.get("severity", "media"), title, input_data["description"],
                road["id"] if road else None, road["name"] if road else None, input_data["lat"],
                input_data["lng"], 90 if is_accident else 60, now, now,
                input_data.get("vehicles") if is_accident else None,
                input_data.get("injuries") if is_accident else None, user["id"],
            ),
        )
        _insert_history(
            conn, incident_id, "nuevo",
            f"Reporte ciudadano radicado por {user['name']}.", user["id"], user["name"], now,
        )
        return _get_incident(conn, incident_id)


def update_incident_status(incident_id, next_status, note, user):
    with connection() as conn:
        incident = _get_incident(conn, incident_id)
        if not incident:
            fail(404, f"Incidencia {incident_id} no encontrada.")
        if next_status not in INCIDENT_TRANSITIONS.get(incident["status"], ()):
            fail(409, f'Transición no permitida de "{incident["status"]}" a "{next_status}".')
        now = now_iso()
        final = next_status in ("resuelto", "descartado")
        resolution = (str(note or "").strip() or incident["resolution"] or STATUS_NOTE[next_status]) if final else incident["resolution"]
        conn.execute(
            """UPDATE incidents SET status = ?, updated_at = ?, resolution = COALESCE(?, resolution),
               solved_at = CASE WHEN ? THEN ? ELSE solved_at END,
               solved_by = CASE WHEN ? THEN ? ELSE solved_by END WHERE id = ?""",
            (next_status, now, resolution, int(final), now if final else None, int(final), user["id"] if final else None, incident_id),
        )
        _insert_history(
            conn, incident_id, next_status, str(note or "").strip() or STATUS_NOTE.get(next_status, f"Estado actualizado a {next_status}."),
            user["id"], user["name"], now,
        )
        return _get_incident(conn, incident_id)


def confirm_incident(incident_id, user):
    with connection() as conn:
        incident = _get_incident(conn, incident_id)
        if not incident:
            fail(404, "Incidencia no encontrada.")
        if incident["status"] in ("resuelto", "descartado"):
            fail(409, "El reporte ya está cerrado y no admite más confirmaciones.")
        if conn.execute(
            "SELECT 1 FROM incident_confirmations WHERE incident_id = ? AND user_id = ?",
            (incident_id, user["id"]),
        ).fetchone():
            fail(409, "Ya confirmaste este reporte desde tu cuenta.")
        now = now_iso()
        conn.execute(
            "INSERT INTO incident_confirmations (incident_id, user_id, created_at) VALUES (?, ?, ?)",
            (incident_id, user["id"], now),
        )
        confirmed_by = (incident["confirmedBy"] or 0) + 1
        if incident["status"] == "nuevo" and confirmed_by >= 4:
            conn.execute("UPDATE incidents SET confirmed_by = ?, status = 'verificado', updated_at = ? WHERE id = ?", (confirmed_by, now, incident_id))
            _insert_history(conn, incident_id, "verificado", "Verificación automática alcanzada por confirmaciones ciudadanas.", user["id"], user["name"], now)
        else:
            conn.execute("UPDATE incidents SET confirmed_by = ?, updated_at = ? WHERE id = ?", (confirmed_by, now, incident_id))
        return _get_incident(conn, incident_id)


def create_telemetry_incident(input_data):
    now = now_iso()
    with connection() as conn:
        incident_id = _next_id(conn, "incidents", "id", "INC", 5)
        road, point, distance = nearest_road_point(input_data["lat"], input_data["lng"], _list_roads(conn))
        if not road or distance > 140:
            raise RuntimeError("La incidencia de telemetría debe estar asociada a una vía.")
        conn.execute(
            """INSERT INTO incidents (
               id, type, category, severity, status, source, title, detail, road_id, road_name,
               lat, lng, radius_m, reported_at, updated_at, confirmed_by, media_count, clear_eta_min,
               vehicles, injuries
               ) VALUES (?, ?, NULL, ?, 'nuevo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, NULL, NULL)""",
            (incident_id, input_data["type"], input_data["severity"], input_data["source"], input_data["title"],
             input_data.get("detail") or "Detección automática del canal de telemetría.", road["id"],
             road["name"], point[0], point[1], input_data.get("radiusM", 70), now, now),
        )
        _insert_history(conn, incident_id, "nuevo", "Incidencia detectada automáticamente por el canal de telemetría.", None, "Sistema", now)
        return _get_incident(conn, incident_id)


def incident_pool(source=None, statuses=None):
    where, values = [], []
    if source:
        where.append("source = ?")
        values.append(source)
    if statuses:
        where.append(f"status IN ({','.join('?' for _ in statuses)})")
        values.extend(statuses)
    clause = f"WHERE {' AND '.join(where)}" if where else ""
    with connection() as conn:
        return [_map_incident(row) for row in conn.execute(
            f"SELECT * FROM incidents {clause} ORDER BY updated_at DESC LIMIT 120", values
        ).fetchall()]


def add_confirmations(incident_id, amount):
    now = now_iso()
    with connection() as conn:
        incident = _get_incident(conn, incident_id)
        if not incident:
            return None
        confirmed_by = (incident["confirmedBy"] or 0) + amount
        changed = incident["status"] == "nuevo" and confirmed_by >= 4
        if changed:
            conn.execute("UPDATE incidents SET confirmed_by = ?, status = 'verificado', updated_at = ? WHERE id = ?", (confirmed_by, now, incident_id))
            _insert_history(conn, incident_id, "verificado", "Verificación automática por confirmaciones ciudadanas.", None, "Sistema", now)
        else:
            conn.execute("UPDATE incidents SET confirmed_by = ?, updated_at = ? WHERE id = ?", (confirmed_by, now, incident_id))
        return {"incident": _get_incident(conn, incident_id), "previousStatus": incident["status"], "statusChanged": changed}


def resolve_telemetry_incident(incident_id):
    now = now_iso()
    note = "Cierre automático del canal de telemetría tras verificar la normalización del tráfico."
    with connection() as conn:
        incident = _get_incident(conn, incident_id)
        if not incident or incident["status"] != "en_atencion" or incident["source"] == "ciudadano":
            return None
        conn.execute(
            "UPDATE incidents SET status = 'resuelto', updated_at = ?, solved_at = ?, resolution = COALESCE(resolution, ?) WHERE id = ?",
            (now, now, note, incident_id),
        )
        _insert_history(conn, incident_id, "resuelto", note, None, "Sistema", now)
        return _get_incident(conn, incident_id)


def update_road_flow(updates):
    now = now_iso()
    with connection() as conn:
        conn.executemany("UPDATE roads SET avg_speed_kph = ?, congestion = ? WHERE id = ?", [(u["avgSpeedKph"], u["congestion"], u["id"]) for u in updates])
    return now


def set_camera_runtime_status(camera_id, status):
    now = now_iso()
    with connection() as conn:
        conn.execute("UPDATE cameras SET status = ?, last_sdk_sync_at = ? WHERE id = ?", (status, now, camera_id))
        row = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
        return {"id": row["id"], "name": row["name"], "status": row["status"], "lastSdkSyncAt": row["last_sdk_sync_at"]} if row else None


def create_plate_scan_violation(input_data):
    now = now_iso()
    with connection() as conn:
        code = _next_id(conn, "violations", "code", "INF", 6)
        evidence = {
            "plateBox": [0.42, 0.55, 0.17, 0.08],
            "videoSeed": random.randint(1, 9_000_000),
            "frames": [{"t": offset, "seed": random.randint(1, 9_000_000)} for offset in (-1400, 0, 1400)],
            "seq": [max(20, round(input_data["speedRecorded"] - 8 + math.sin(index) * 4)) for index in range(10)],
        }
        conn.execute(
            """INSERT INTO violations (
               code, type, plate, owner_name, owner_doc, camera_id, camera_name, road_name, road_klass,
               lat, lng, capture_at, created_at, status, speed_recorded, speed_limit, amount, points,
               vehicle, evidence_json
               ) VALUES (?, 'exceso', ?, 'Titular pendiente de identificación', '-----', ?, ?, ?, ?, ?, ?, ?, ?, 'emitida', ?, ?, ?, ?, 'coche', ?)""",
            (code, input_data["plate"], input_data["cameraId"], input_data["cameraName"], input_data["roadName"],
             input_data["roadKlass"], input_data["lat"], input_data["lng"], now, now,
             input_data["speedRecorded"], input_data["speedLimit"], input_data["amount"], input_data["points"], json.dumps(evidence)),
        )
        return {"code": code, "plate": input_data["plate"], "amount": input_data["amount"], "cameraName": input_data["cameraName"], "createdAt": now, "type": "exceso"}


def _map_appeal(row):
    if not row["appeal_id"]:
        return None
    return {
        "id": row["appeal_id"], "filedAt": row["appeal_filed_at"],
        "motivos": _json(row["appeal_motivos_json"], []), "declaracion": row["appeal_declaracion"],
        "statement": row["appeal_declaracion"], "adjuntos": _json(row["appeal_adjuntos_json"], []),
        "contacto": {"email": row["appeal_contact_email"]}, "status": row["appeal_status"],
        "outcome": row["appeal_outcome"], "resolvedAt": row["appeal_resolved_at"],
        "reasoning": row["appeal_reasoning"],
    }


def _map_violation(row):
    return {
        "code": row["code"], "type": row["type"], "plate": row["plate"],
        "owner": {"name": row["owner_name"], "doc": row["owner_doc"]},
        "cameraId": row["camera_id"], "cameraName": row["camera_name"], "roadName": row["road_name"],
        "roadKlass": row["road_klass"], "lat": row["lat"], "lng": row["lng"],
        "captureAt": row["capture_at"], "createdAt": row["created_at"], "notifiedAt": row["notified_at"],
        "paidAt": row["paid_at"], "status": row["status"], "speedRecorded": row["speed_recorded"],
        "speedLimit": row["speed_limit"], "amount": row["amount"], "points": row["points"],
        "vehicle": row["vehicle"], "evidence": _json(row["evidence_json"], {}), "appeal": _map_appeal(row),
    }


VIOLATION_SELECT = """
SELECT v.*, a.id AS appeal_id, a.filed_at AS appeal_filed_at,
       a.motivos_json AS appeal_motivos_json, a.declaracion AS appeal_declaracion,
       a.adjuntos_json AS appeal_adjuntos_json, a.contact_email AS appeal_contact_email,
       a.status AS appeal_status, a.outcome AS appeal_outcome,
       a.resolved_at AS appeal_resolved_at, a.reasoning AS appeal_reasoning
FROM violations v LEFT JOIN appeals a ON a.violation_code = v.code
"""


def query_violations(search="", types=None, statuses=None, appeal=None, sort="recent", page=1, page_size=100):
    types, statuses, appeal = types or [], statuses or [], appeal or []
    page = max(1, int(page or 1))
    page_size = min(500, max(10, int(page_size or 100)))
    where, values = [], []
    search = str(search or "").strip()
    if search:
        term = f"%{search.lower()}%"
        where.append("(LOWER(v.plate) LIKE ? OR LOWER(v.code) LIKE ? OR LOWER(v.camera_name) LIKE ? OR LOWER(v.owner_name) LIKE ?)")
        values.extend([term] * 4)
    if types:
        where.append(f"v.type IN ({','.join('?' for _ in types)})")
        values.extend(types)
    if statuses:
        where.append(f"v.status IN ({','.join('?' for _ in statuses)})")
        values.extend(statuses)
    if "pendiente" in appeal:
        where.append("a.status IS NOT NULL AND a.status <> 'resuelta'")
    clause = f"WHERE {' AND '.join(where)}" if where else ""
    order = {"oldest": "ORDER BY v.created_at ASC", "amount": "ORDER BY v.amount DESC, v.created_at DESC"}.get(sort, "ORDER BY v.created_at DESC")
    with connection() as conn:
        total = conn.execute(f"SELECT COUNT(*) FROM ({VIOLATION_SELECT} {clause})", values).fetchone()[0]
        rows = conn.execute(f"{VIOLATION_SELECT} {clause} {order} LIMIT ? OFFSET ?", [*values, page_size, (page - 1) * page_size]).fetchall()
        return {"total": total, "page": page, "pageSize": page_size, "items": [_map_violation(row) for row in rows]}


def find_violation(code):
    with connection() as conn:
        row = conn.execute(f"{VIOLATION_SELECT} WHERE v.code = ?", (code,)).fetchone()
        return _map_violation(row) if row else None


def create_appeal(code, body, user):
    with connection() as conn:
        row = conn.execute(f"{VIOLATION_SELECT} WHERE v.code = ?", (code,)).fetchone()
        if not row:
            fail(404, f"Infracción {code} no encontrada.")
        violation = _map_violation(row)
        if violation["status"] not in ("emitida", "notificada"):
            fail(409, f'El expediente no admite apelación en su estado actual ({violation["status"]}).')
        if violation["appeal"]:
            fail(409, "Ya existe un recurso asociado a esta infracción.")
        grounds = list(dict.fromkeys(item for item in body.get("motivos", []) if isinstance(item, str) and item in APPEAL_GROUNDS)) if isinstance(body.get("motivos"), list) else []
        declaration = str(body.get("declaracion") or "").strip()
        contact = body.get("contacto")
        email = str(contact.get("email") or "").strip().lower() if isinstance(contact, dict) else ""
        if not 1 <= len(grounds) <= 3:
            fail(422, "Selecciona entre 1 y 3 motivos válidos.")
        if not 60 <= len(declaration) <= 4000:
            fail(422, "La declaración debe tener entre 60 y 4000 caracteres.")
        if not EMAIL_RE.fullmatch(email):
            fail(422, "Correo de contacto no válido.")
        raw_attachments = body.get("adjuntos", [])
        if not isinstance(raw_attachments, list) or len(raw_attachments) > 5:
            fail(422, "Adjunta como máximo 5 archivos.")
        attachments = []
        for item in raw_attachments:
            if not isinstance(item, dict) or not isinstance(item.get("name"), str) or not item["name"].strip():
                fail(422, "Los datos de un adjunto no son válidos.")
            try:
                if isinstance(item.get("size"), bool):
                    raise ValueError
                size = float(item.get("size"))
            except (TypeError, ValueError):
                fail(422, "El tamaño de un adjunto no es válido.")
            if not math.isfinite(size) or not 0 <= size <= 10_000_000:
                fail(422, "Cada adjunto debe tener un tamaño entre 0 y 10 MB.")
            attachments.append({"name": item["name"].strip(), "size": size, "type": str(item.get("type") or "")})
        now = now_iso()
        appeal_id = _next_id(conn, "appeals", "id", "APE", 4)
        conn.execute(
            """INSERT INTO appeals
               (id, violation_code, filed_at, motivos_json, declaracion, adjuntos_json, contact_email, status, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'radicada', ?)""",
            (appeal_id, code, now, json.dumps(grounds), declaration, json.dumps(attachments), email, user["id"]),
        )
        conn.execute("UPDATE violations SET status = 'apelada' WHERE code = ?", (code,))
        updated_row = conn.execute(f"{VIOLATION_SELECT} WHERE v.code = ?", (code,)).fetchone()
        updated = _map_violation(updated_row)
        return {"violation": updated, "appeal": updated["appeal"]}


def set_violation_status(code, next_status):
    with connection() as conn:
        row = conn.execute(f"{VIOLATION_SELECT} WHERE v.code = ?", (code,)).fetchone()
        if not row:
            fail(404, f"Infracción {code} no encontrada.")
        violation = _map_violation(row)
        allowed = ("emitida",) if next_status == "notificada" else ("emitida", "notificada") if next_status == "pagada" else ()
        if violation["status"] not in allowed:
            fail(409, f'Transición no permitida desde "{violation["status"]}" hacia "{next_status}".')
        now = now_iso()
        if next_status == "notificada":
            conn.execute("UPDATE violations SET status = 'notificada', notified_at = COALESCE(notified_at, ?) WHERE code = ?", (now, code))
        else:
            conn.execute("UPDATE violations SET status = 'pagada', paid_at = ? WHERE code = ?", (now, code))
        return _map_violation(conn.execute(f"{VIOLATION_SELECT} WHERE v.code = ?", (code,)).fetchone())


def accident_report(report_range="week"):
    hours_by_range = {"day": 24, "week": 168, "month": 720, "all": None}
    if report_range not in hours_by_range:
        fail(422, "Rango no válido.")
    hours = hours_by_range[report_range]
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat(timespec="milliseconds").replace("+00:00", "Z") if hours is not None else None
    with connection() as conn:
        rows = conn.execute(
            "SELECT * FROM incidents WHERE type = 'accidente' " + ("AND reported_at >= ? " if cutoff else "") + "ORDER BY reported_at DESC",
            (cutoff,) if cutoff else (),
        ).fetchall()
        items = [_map_incident(row) for row in rows]

    def group(key):
        counts = {}
        for item in items:
            value = item.get(key) or "sin_dato"
            counts[value] = counts.get(value, 0) + 1
        return [{"value": value, "count": count} for value, count in sorted(counts.items(), key=lambda entry: -entry[1])]

    by_day = {}
    for item in items:
        day = item["reportedAt"][:10]
        by_day[day] = by_day.get(day, 0) + 1
    return {
        "range": report_range, "from": cutoff, "generatedAt": now_iso(), "total": len(items),
        "totals": {
            "critical": sum(item["severity"] in ("critica", "alta") for item in items),
            "injuries": sum(item["injuries"] or 0 for item in items),
            "vehicles": sum(item["vehicles"] or 0 for item in items),
            "resolved": sum(item["status"] == "resuelto" for item in items),
            "pending": sum(item["status"] not in ("resuelto", "descartado") for item in items),
        },
        "byCategory": group("category"), "bySeverity": group("severity"),
        "byStatus": group("status"), "bySource": group("source"),
        "byDay": [{"date": date, "count": count} for date, count in sorted(by_day.items())],
        "items": items,
    }


def road_stats():
    with connection() as conn:
        return [{"id": row["id"], "avgSpeedKph": row["avg_speed_kph"], "congestion": row["congestion"]} for row in conn.execute("SELECT id, avg_speed_kph, congestion FROM roads").fetchall()]


def camera_stats():
    with connection() as conn:
        return [
            {"id": row["id"], "name": row["name"], "kind": row["kind"], "roadName": row["road_name"],
             "roadKlass": row["road_klass"], "lat": row["lat"], "lng": row["lng"], "status": row["status"],
             "lastSdkSyncAt": row["last_sdk_sync_at"]}
            for row in conn.execute("SELECT * FROM cameras").fetchall()
        ]
