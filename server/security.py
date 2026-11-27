import hashlib
import hmac
import re
import secrets
import sqlite3
import unicodedata
from datetime import datetime, timedelta, timezone

from .storage import connection


EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def normalize_email(value):
    return str(value or "").strip().lower()


def validate_name(value):
    name = " ".join(str(value or "").strip().split())
    if len(name) < 3:
        return None, "El nombre debe tener al menos 3 caracteres."
    if len(name) > 60:
        return None, "El nombre no puede superar los 60 caracteres."
    allowed_punctuation = {"'", ".", "-", " "}
    if any(not (unicodedata.category(char).startswith("L") or unicodedata.category(char).startswith("M") or char in allowed_punctuation) for char in name):
        return None, "El nombre solo admite letras, espacios, apóstrofos, puntos y guiones."
    return name, None


def validate_email(value):
    email = normalize_email(value)
    if not email:
        return None, "El correo electrónico es obligatorio."
    if len(email) > 160:
        return None, "El correo electrónico es demasiado largo."
    if not EMAIL_RE.fullmatch(email):
        return None, "Ingresa un correo electrónico válido."
    return email, None


def validate_password(value):
    password = str(value or "")
    if len(password) < 8:
        return None, "La contraseña debe tener al menos 8 caracteres."
    if len(password) > 128:
        return None, "La contraseña no puede superar los 128 caracteres."
    if not re.search(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]", password):
        return None, "La contraseña debe incluir al menos una letra."
    if not re.search(r"\d", password):
        return None, "La contraseña debe incluir al menos un número."
    return password, None


def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16).hex()
    digest = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64, maxmem=64 * 1024 * 1024)
    return digest.hex(), salt


def verify_password(password, salt, expected_hash):
    try:
        actual = hashlib.scrypt(
            password.encode(),
            salt=salt.encode(),
            n=16384,
            r=8,
            p=1,
            dklen=64,
            maxmem=64 * 1024 * 1024,
        )
        return hmac.compare_digest(actual.hex(), expected_hash)
    except (ValueError, TypeError):
        return False


def hash_token(token):
    return hashlib.sha256(str(token).encode()).hexdigest()


def public_user(row):
    return {"id": row["id"], "name": row["name"], "email": row["email"], "createdAt": row["created_at"]}


def _create_session(conn, user_id):
    token = secrets.token_hex(32)
    created_at = now_iso()
    expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (hash_token(token), user_id, created_at, expires_at),
    )
    return {"token": token, "expiresAt": expires_at}


def register(body):
    name, error = validate_name(body.get("name"))
    if error:
        return 422, {"message": error}
    email, error = validate_email(body.get("email"))
    if error:
        return 422, {"message": error}
    password, error = validate_password(body.get("password"))
    if error:
        return 422, {"message": error}

    password_hash, password_salt = hash_password(password)
    created_at = now_iso()
    try:
        with connection() as conn:
            cursor = conn.execute(
                "INSERT INTO users (name, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)",
                (name, email, password_hash, password_salt, created_at),
            )
            user = conn.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
            return 201, {"user": public_user(user), **_create_session(conn, user["id"])}
    except sqlite3.IntegrityError:
        return 409, {"message": "Ya existe una cuenta registrada con este correo."}


def login(body):
    email, error = validate_email(body.get("email"))
    if error:
        return 422, {"message": error}
    password = str(body.get("password") or "")
    if not password:
        return 422, {"message": "La contraseña es obligatoria."}
    with connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not row or not verify_password(password, row["password_salt"], row["password_hash"]):
            return 401, {"message": "Correo o contraseña incorrectos."}
        return 200, {"user": public_user(row), **_create_session(conn, row["id"])}


def authenticate_token(raw_token):
    if not raw_token:
        return None
    with connection() as conn:
        row = conn.execute(
            """SELECT u.*, s.expires_at FROM sessions s
               JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?""",
            (hash_token(raw_token),),
        ).fetchone()
        if not row:
            return None
        if row["expires_at"] <= now_iso():
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_token(raw_token),))
            return None
        return public_user(row)


def logout(raw_token):
    if not raw_token:
        return
    with connection() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_token(raw_token),))


def current_user(user_id):
    with connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return public_user(row) if row else None
