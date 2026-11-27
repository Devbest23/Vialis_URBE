import hashlib
import json
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from .geo import nearest_road_point

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("VIALIS_DATA_DIR") or ROOT / "data").resolve()
DB_PATH = Path(os.environ.get("VIALIS_DB_PATH") or DATA_DIR / "vialis.db").resolve()
SEED_DIR = ROOT / "seed" / "data"
ROAD_NETWORK_VERSION = "maracaibo-osm-2026-11-24-v2"
ROAD_SNAP_MAX_DISTANCE_M = 800
CITY_BOUNDS = {"latMin": 10.676, "latMax": 10.712, "lngMin": -71.667, "lngMax": -71.605}

SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS roads (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, klass TEXT NOT NULL,
  lanes INTEGER NOT NULL DEFAULT 2, length_m REAL NOT NULL DEFAULT 0,
  avg_speed_kph REAL NOT NULL DEFAULT 0, congestion REAL NOT NULL DEFAULT 0,
  points_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cameras (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, road_id TEXT,
  road_name TEXT, road_klass TEXT, lat REAL NOT NULL, lng REAL NOT NULL,
  status TEXT NOT NULL, last_sdk_sync_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_cameras_status ON cameras(status);
CREATE TABLE IF NOT EXISTS districts (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, center_json TEXT NOT NULL, ring_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_metadata (
  key TEXT PRIMARY KEY, value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, category TEXT, severity TEXT NOT NULL,
  status TEXT NOT NULL, source TEXT NOT NULL, title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '', road_id TEXT, road_name TEXT,
  lat REAL NOT NULL, lng REAL NOT NULL, radius_m REAL NOT NULL DEFAULT 60,
  reported_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  confirmed_by INTEGER NOT NULL DEFAULT 0, media_count INTEGER NOT NULL DEFAULT 0,
  clear_eta_min INTEGER, vehicles INTEGER, injuries INTEGER, resolution TEXT,
  solved_at TEXT, solved_by INTEGER, created_by INTEGER,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (solved_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_incidents_reported ON incidents(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(type);
CREATE INDEX IF NOT EXISTS idx_incidents_source ON incidents(source);
CREATE TABLE IF NOT EXISTS incident_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, incident_id TEXT NOT NULL, status TEXT,
  note TEXT, actor_id INTEGER, actor_name TEXT NOT NULL DEFAULT 'Sistema',
  created_at TEXT NOT NULL,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_history_incident ON incident_history(incident_id, created_at);
CREATE TABLE IF NOT EXISTS incident_confirmations (
  incident_id TEXT NOT NULL, user_id INTEGER NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY (incident_id, user_id),
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS violations (
  code TEXT PRIMARY KEY, type TEXT NOT NULL, plate TEXT NOT NULL,
  owner_name TEXT NOT NULL, owner_doc TEXT NOT NULL, camera_id TEXT,
  camera_name TEXT, road_name TEXT, road_klass TEXT, lat REAL, lng REAL,
  capture_at TEXT NOT NULL, created_at TEXT NOT NULL, notified_at TEXT,
  paid_at TEXT, status TEXT NOT NULL, speed_recorded INTEGER, speed_limit INTEGER,
  amount INTEGER NOT NULL DEFAULT 0, points INTEGER NOT NULL DEFAULT 0,
  vehicle TEXT NOT NULL DEFAULT 'coche', evidence_json TEXT NOT NULL DEFAULT '{}',
  created_by INTEGER, FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_violations_created ON violations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status);
CREATE INDEX IF NOT EXISTS idx_violations_type ON violations(type);
CREATE TABLE IF NOT EXISTS appeals (
  id TEXT PRIMARY KEY, violation_code TEXT NOT NULL UNIQUE, filed_at TEXT NOT NULL,
  motivos_json TEXT NOT NULL, declaracion TEXT NOT NULL,
  adjuntos_json TEXT NOT NULL DEFAULT '[]', contact_email TEXT NOT NULL,
  status TEXT NOT NULL, outcome TEXT, resolved_at TEXT, reasoning TEXT,
  created_by INTEGER,
  FOREIGN KEY (violation_code) REFERENCES violations(code) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
"""

DEMO_EMAIL = "demo@vialis.app"
DEMO_PASSWORD = os.environ.get("VIALIS_DEMO_PASSWORD", "Vialis2026")
HOUR = 3600_000


@contextmanager
def connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 15000")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _read_json(name, fallback):
    try:
        with (SEED_DIR / name).open(encoding="utf-8") as file:
            return json.load(file)
    except (OSError, json.JSONDecodeError):
        return fallback


def _iso(milliseconds):
    return datetime.fromtimestamp(milliseconds / 1000, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _shift_iso(value, shift_ms):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return _iso(parsed.timestamp() * 1000 + shift_ms)
    except (ValueError, TypeError):
        return None


def _history_for(incident, reported_at, updated_at):
    from_time = datetime.fromisoformat(reported_at.replace("Z", "+00:00")).timestamp() * 1000
    to_time = max(from_time + 60_000, datetime.fromisoformat(updated_at.replace("Z", "+00:00")).timestamp() * 1000)
    span = to_time - from_time
    steps = [{"status": "nuevo", "at": from_time, "note": "Reporte ciudadano radicado en la central de operaciones." if incident["source"] == "ciudadano" else "Incidencia detectada automáticamente por el canal de telemetría."}]
    status = incident["status"]
    if status == "verificado":
        steps.append({"status": status, "at": from_time + span * 0.8, "note": "Verificación completada por la central de operaciones."})
    elif status == "en_atencion":
        steps.extend([
            {"status": "verificado", "at": from_time + span * 0.35, "note": "Verificación completada por la central de operaciones."},
            {"status": status, "at": from_time + span * 0.75, "note": "Unidad asignada y en camino al punto del incidente."},
        ])
    elif status == "resuelto":
        steps.extend([
            {"status": "verificado", "at": from_time + span * 0.25, "note": "Verificación completada por la central de operaciones."},
            {"status": "en_atencion", "at": from_time + span * 0.55, "note": "Unidad asignada y en camino al punto del incidente."},
            {"status": status, "at": to_time, "note": incident.get("resolution") or "Incidencia resuelta y vía habilitada."},
        ])
    elif status == "descartado":
        steps.append({"status": status, "at": to_time, "note": incident.get("resolution") or "Reporte descartado tras verificación."})
    for step in steps:
        step["actorName"] = "Ciudadano" if step["status"] == "nuevo" and incident["source"] == "ciudadano" else "Operador de central"
        step["createdAt"] = _iso(step.pop("at"))
    return steps


def _seed_database(conn):
    roads = _read_json("roads.json", [])
    cameras = _read_json("cameras.json", [])
    districts = _read_json("districts.json", [])
    incidents = _read_json("incidents.json", [])
    violations = _read_json("violations.json", [])
    meta = _read_json("meta.json", {})
    now_ms = datetime.now(timezone.utc).timestamp() * 1000
    try:
        generated_at = datetime.fromisoformat(meta.get("generatedAt", "").replace("Z", "+00:00")).timestamp() * 1000
        shift_ms = now_ms - generated_at
    except (ValueError, TypeError):
        shift_ms = 0

    demo_user_id = None
    if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        salt = secrets.token_bytes(16).hex()
        password_hash = hashlib.scrypt(
            DEMO_PASSWORD.encode(),
            salt=salt.encode(),
            n=16384,
            r=8,
            p=1,
            dklen=64,
            maxmem=64 * 1024 * 1024,
        ).hex()
        cursor = conn.execute(
            "INSERT INTO users (name, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)",
            ("Operador Demo", DEMO_EMAIL, password_hash, salt, _iso(now_ms)),
        )
        demo_user_id = cursor.lastrowid
    else:
        row = conn.execute("SELECT id FROM users WHERE email = ?", (DEMO_EMAIL,)).fetchone()
        demo_user_id = row["id"] if row else None

    if conn.execute("SELECT COUNT(*) FROM roads").fetchone()[0] == 0:
        conn.executemany(
            """INSERT INTO roads (id, name, klass, lanes, length_m, avg_speed_kph, congestion, points_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            [(r["id"], r["name"], r["klass"], r.get("lanes", 2), r.get("lengthM", 0), r.get("avgSpeedKph", 0), r.get("congestion", 0), json.dumps(r.get("points", []))) for r in roads],
        )
    if conn.execute("SELECT COUNT(*) FROM cameras").fetchone()[0] == 0:
        conn.executemany(
            """INSERT INTO cameras (id, name, kind, road_id, road_name, road_klass, lat, lng, status, last_sdk_sync_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [(c["id"], c["name"], c["kind"], c.get("roadId"), c.get("roadName"), c.get("roadKlass"), c["lat"], c["lng"], c["status"], _iso(now_ms - secrets.randbelow(30) * 60_000)) for c in cameras],
        )
    if conn.execute("SELECT COUNT(*) FROM districts").fetchone()[0] == 0:
        conn.executemany(
            "INSERT INTO districts (id, name, center_json, ring_json) VALUES (?, ?, ?, ?)",
            [(d["id"], d["name"], json.dumps(d.get("center", [])), json.dumps(d.get("ring", []))) for d in districts],
        )

    if conn.execute("SELECT COUNT(*) FROM incidents").fetchone()[0] == 0:
        for incident in incidents:
            age_hours = incident.get("_seedAgeHours")
            reported_ms = now_ms - float(age_hours) * HOUR if isinstance(age_hours, (int, float)) else datetime.fromisoformat(incident["reportedAt"].replace("Z", "+00:00")).timestamp() * 1000 + shift_ms
            delay_hours = incident.get("_seedUpdateDelayHours")
            if not isinstance(delay_hours, (int, float)):
                old_reported = datetime.fromisoformat(incident["reportedAt"].replace("Z", "+00:00")).timestamp()
                old_updated = datetime.fromisoformat(incident["updatedAt"].replace("Z", "+00:00")).timestamp()
                delay_hours = max(0.1, (old_updated - old_reported) / 3600)
            updated_ms = min(now_ms - 60_000, reported_ms + float(delay_hours) * HOUR)
            reported_at, updated_at = _iso(reported_ms), _iso(updated_ms)
            solved_at = updated_at if incident["status"] in ("resuelto", "descartado") else None
            conn.execute(
                """INSERT INTO incidents (
                   id, type, category, severity, status, source, title, detail, road_id, road_name,
                   lat, lng, radius_m, reported_at, updated_at, confirmed_by, media_count,
                   clear_eta_min, vehicles, injuries, resolution, solved_at, created_by
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (incident["id"], incident["type"], incident.get("category"), incident["severity"], incident["status"], incident["source"], incident["title"], incident.get("detail", ""), incident.get("roadId"), incident.get("roadName"), incident["lat"], incident["lng"], incident.get("radiusM", 60), reported_at, updated_at, incident.get("confirmedBy", 0), incident.get("mediaCount", 0), incident.get("clearEtaMin") if (incident.get("clearEtaMin") or 0) > 0 else None, incident.get("vehicles"), incident.get("injuries"), incident.get("resolution"), solved_at, demo_user_id if incident["source"] == "ciudadano" else None),
            )
            for event in _history_for(incident, reported_at, updated_at):
                conn.execute(
                    "INSERT INTO incident_history (incident_id, status, note, actor_id, actor_name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (incident["id"], event["status"], event["note"], None, event["actorName"], event["createdAt"]),
                )

    if conn.execute("SELECT COUNT(*) FROM violations").fetchone()[0] == 0:
        for violation in violations:
            capture_at = _shift_iso(violation.get("captureAt"), shift_ms)
            created_at = _shift_iso(violation.get("createdAt"), shift_ms)
            conn.execute(
                """INSERT INTO violations (
                   code, type, plate, owner_name, owner_doc, camera_id, camera_name, road_name, road_klass,
                   lat, lng, capture_at, created_at, notified_at, paid_at, status, speed_recorded,
                   speed_limit, amount, points, vehicle, evidence_json
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (violation["code"], violation["type"], violation["plate"], violation.get("owner", {}).get("name") or "Titular sin identificar", violation.get("owner", {}).get("doc") or "-----", violation.get("cameraId"), violation.get("cameraName"), violation.get("roadName"), violation.get("roadKlass"), violation.get("lat"), violation.get("lng"), capture_at, created_at, _shift_iso(violation.get("notifiedAt"), shift_ms), _shift_iso(violation.get("paidAt"), shift_ms), violation["status"], violation.get("speedRecorded"), violation.get("speedLimit"), violation.get("amount", 0), violation.get("points", 0), violation.get("vehicle", "coche"), json.dumps(violation.get("evidence") or {})),
            )
            appeal = violation.get("appeal")
            if appeal:
                conn.execute(
                    """INSERT INTO appeals (
                       id, violation_code, filed_at, motivos_json, declaracion, adjuntos_json,
                       contact_email, status, outcome, resolved_at, reasoning
                       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (appeal["id"], violation["code"], _shift_iso(appeal.get("filedAt"), shift_ms) or created_at, json.dumps(appeal.get("motivos", [])), appeal.get("declaracion") or appeal.get("statement", ""), json.dumps(appeal.get("adjuntos", [])), appeal.get("contacto", {}).get("email") or "ciudadano@vialis.app", appeal.get("status", "radicada"), appeal.get("outcome"), _shift_iso(appeal.get("resolvedAt"), shift_ms), appeal.get("reasoning")),
                )


def _migrate_road_network(conn):
    row = conn.execute("SELECT value FROM app_metadata WHERE key = 'road_network_version'").fetchone()
    if row and row["value"] == ROAD_NETWORK_VERSION:
        return

    roads = _read_json("roads.json", [])
    if not roads:
        raise RuntimeError("No se pudo cargar la red vial de OpenStreetMap para completar la migración.")

    conn.execute("DELETE FROM roads")
    conn.executemany(
        """INSERT INTO roads (id, name, klass, lanes, length_m, avg_speed_kph, congestion, points_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            (
                road["id"], road["name"], road["klass"], road.get("lanes", 2), road.get("lengthM", 0),
                road.get("avgSpeedKph", 0), road.get("congestion", 0), json.dumps(road["points"]),
            )
            for road in roads
        ],
    )

    road_network = roads
    for camera in conn.execute("SELECT id, lat, lng FROM cameras").fetchall():
        road, point, distance = nearest_road_point(camera["lat"], camera["lng"], road_network)
        if road and distance <= ROAD_SNAP_MAX_DISTANCE_M:
            conn.execute(
                """UPDATE cameras SET road_id = ?, road_name = ?, road_klass = ?, lat = ?, lng = ?
                   WHERE id = ?""",
                (road["id"], road["name"], road["klass"], point[0], point[1], camera["id"]),
            )

    incidents = conn.execute(
        "SELECT id, source, lat, lng, road_name, title FROM incidents"
    ).fetchall()
    for incident in incidents:
        if not (CITY_BOUNDS["latMin"] <= incident["lat"] <= CITY_BOUNDS["latMax"] and CITY_BOUNDS["lngMin"] <= incident["lng"] <= CITY_BOUNDS["lngMax"]):
            continue
        road, point, distance = nearest_road_point(incident["lat"], incident["lng"], road_network)
        if not road:
            continue
        if incident["source"] == "ciudadano":
            if distance <= 140:
                conn.execute(
                    "UPDATE incidents SET road_id = ?, road_name = ? WHERE id = ?",
                    (road["id"], road["name"], incident["id"]),
                )
            continue
        if distance > ROAD_SNAP_MAX_DISTANCE_M:
            continue
        title = incident["title"]
        if incident["road_name"] and incident["road_name"] in title:
            title = title.replace(incident["road_name"], road["name"])
        conn.execute(
            """UPDATE incidents SET lat = ?, lng = ?, road_id = ?, road_name = ?, title = ?
               WHERE id = ?""",
            (point[0], point[1], road["id"], road["name"], title, incident["id"]),
        )

    conn.execute(
        """INSERT INTO app_metadata (key, value) VALUES ('road_network_version', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value""",
        (ROAD_NETWORK_VERSION,),
    )


def initialize_database():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connection() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript(SCHEMA)
        _seed_database(conn)
        _migrate_road_network(conn)
