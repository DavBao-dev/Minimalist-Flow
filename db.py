"""Database layer for Minimalist Flow.

The app can run in two modes without changing app.py:

- Local/VPS/Docker: SQLite file (default).
- Streamlit Community Cloud: Turso/libSQL when TURSO_DATABASE_URL and
  TURSO_AUTH_TOKEN (or [database] url/auth_token in secrets) are configured.

The application state is stored per username in `user_state`, so tasks,
free blocks, materials and fixed-calendar events survive browser changes and
Streamlit restarts/redeploys when using a remote DB.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets as pysecrets
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

import streamlit as st

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt          TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS user_state (
    username      TEXT PRIMARY KEY,
    state_json    TEXT NOT NULL,
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def _secret(path: tuple[str, ...], default: Any = None) -> Any:
    try:
        value: Any = st.secrets
        for key in path:
            value = value[key]
        return value
    except Exception:
        return default


def _turso_config() -> tuple[str | None, str | None]:
    url = (
        _secret(("database", "url"))
        or os.environ.get("TURSO_DATABASE_URL")
        or os.environ.get("LIBSQL_URL")
    )
    token = (
        _secret(("database", "auth_token"))
        or os.environ.get("TURSO_AUTH_TOKEN")
        or os.environ.get("LIBSQL_AUTH_TOKEN")
    )
    return (str(url) if url else None, str(token) if token else None)


def using_turso() -> bool:
    url, token = _turso_config()
    return bool(url and token)


def get_db_path() -> Path:
    configured = _secret(("database", "path"))
    if configured:
        return Path(str(configured)).expanduser()

    env_path = os.environ.get("MINIMALIST_FLOW_DB_PATH")
    if env_path:
        return Path(env_path).expanduser()

    return Path(__file__).parent / "minimalist_flow.db"


DB_PATH = get_db_path()


@contextmanager
def get_connection() -> Iterator[Any]:
    """Yield a DB-API-ish connection for either SQLite or remote libSQL."""
    if using_turso():
        try:
            import libsql
        except ImportError as exc:
            raise RuntimeError(
                "Turso is configured but the 'libsql' package is missing. "
                "Add libsql to requirements.txt."
            ) from exc

        url, token = _turso_config()
        assert url and token
        conn = libsql.connect(database=url, auth_token=token)
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()
        return

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    # Keep initialization compatible with both sqlite3 and remote libSQL.
    statements = [stmt.strip() for stmt in SCHEMA.split(";") if stmt.strip()]
    with get_connection() as conn:
        for statement in statements:
            conn.execute(statement)


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or pysecrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000
    )
    return digest.hex(), salt


def user_exists(username: str) -> bool:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT 1 FROM users WHERE username = ? LIMIT 1", (username,)
        ).fetchone()
        return row is not None


def create_user(username: str, password: str) -> None:
    password_hash, salt = hash_password(password)
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)",
            (username, password_hash, salt),
        )


def verify_user(username: str, password: str) -> bool:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT password_hash, salt FROM users WHERE username = ?",
            (username,),
        ).fetchone()

    if row is None:
        return False

    # Both sqlite3.Row and libsql rows support positional access.
    stored_hash, salt = row[0], row[1]
    computed_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(computed_hash, stored_hash)


def load_user_state(username: str) -> dict[str, Any] | None:
    """Return persisted application state for a user, or None for first login."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT state_json FROM user_state WHERE username = ?", (username,)
        ).fetchone()

    if row is None:
        return None

    try:
        value = json.loads(row[0])
        return value if isinstance(value, dict) else None
    except (TypeError, json.JSONDecodeError):
        return None


def save_user_state(username: str, state: dict[str, Any]) -> None:
    """Upsert the complete UI state atomically for one user."""
    payload = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO user_state (username, state_json, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(username) DO UPDATE SET
                state_json = excluded.state_json,
                updated_at = datetime('now')
            """,
            (username, payload),
        )
