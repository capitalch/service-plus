"""Loads Postgres connection parameters from .env.

Deliberately holds only host/port/user/password — the control database name
is a UI field in app.py, not a config value. See DESIGN.md §5 for why.
"""

from dataclasses import dataclass

from dotenv import dotenv_values


class ConfigError(Exception):
    """Raised when required .env values are missing, so app.py can show one clear message
    instead of a raw exception."""


@dataclass(frozen=True)
class DbConnectionSettings:
    host: str
    port: int
    user: str
    password: str


def load_settings(env_path: str = ".env") -> DbConnectionSettings:
    values = dotenv_values(env_path)

    missing = [key for key in ("DB_HOST", "DB_USER", "DB_PASSWORD") if not values.get(key)]
    if missing:
        raise ConfigError(
            f"Missing required value(s) in {env_path}: {', '.join(missing)}. "
            f"Copy .env.example to {env_path} and fill them in."
        )

    port_raw = values.get("DB_PORT") or "5432"
    try:
        port = int(port_raw)
    except ValueError as e:
        raise ConfigError(f"DB_PORT in {env_path} must be a number, got: {port_raw!r}") from e

    return DbConnectionSettings(
        host=values["DB_HOST"],
        port=port,
        user=values["DB_USER"],
        password=values["DB_PASSWORD"],
    )
