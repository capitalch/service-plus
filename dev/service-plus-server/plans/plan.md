# Plan: Dev / Production Environment Switching (config.py only)

## Overview
Only `client_db_host`, `client_db_port`, `service_db_host`, and `service_db_port`
differ between environments. All other values remain hardcoded in `config.py`.
`APP_ENV` environment variable (default: `dev`) selects the right host/port pair.
No `.env` files are needed.

---

## Workflow

```
OS / shell
  └─ APP_ENV=dev | production  (default: dev)
        │
        ▼
app/config.py  reads APP_ENV at import time
  └─ selects host/port from _DB_CONFIG dict
        │
        ▼
Settings  built with correct host/port; all other values unchanged
```

---

## Step 1: Rewrite `app/config.py`

**File**: `app/config.py`

Changes:
- Read `APP_ENV` from `os.environ` at import time (default `"dev"`)
- Define `_DB_CONFIG` dict mapping each environment to its host/port values
- Set `client_db_host`, `client_db_port`, `service_db_host`, `service_db_port`
  from the dict — no hardcoded defaults on these four fields
- All other settings remain as hardcoded defaults, unchanged
- Remove `env_file` from `model_config` (no `.env` file required)
- Add `app_env` field to expose the active environment to the app

```python
"""
Application configuration management using Pydantic Settings.
"""
import os
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_APP_ENV = os.getenv("APP_ENV", "dev")

_DB_CONFIG: dict[str, dict] = {
    "dev": {
        "client_db_host": "node150483-trace-link.cloudjiffy.net",
        "client_db_port": 11085,
        "service_db_host": "node150483-trace-link.cloudjiffy.net",
        "service_db_port": 11085,
    },
    "production": {
        "client_db_host": "<prod-host>",
        "client_db_port": 5432,
        "service_db_host": "<prod-host>",
        "service_db_port": 5432,
    },
}

_db = _DB_CONFIG[_APP_ENV]


class Settings(BaseSettings):
    """Application settings. Environment-specific DB host/port selected via APP_ENV."""

    # Environment
    app_env: str = Field(default=_APP_ENV, description="Active environment: dev or production")

    # Application
    app_name: str = Field(default="Service Plus API")
    app_version: str = Field(default="1.0.0")
    debug: bool = Field(default=True)
    host: str = Field(default="127.0.0.1")
    port: int = Field(default=8000)

    # GraphQL
    graphql_path: str = Field(default="/graphql")
    graphql_playground: bool = Field(default=True)

    # Client Database
    client_db_host: str = _db["client_db_host"]
    client_db_port: int = _db["client_db_port"]
    client_db_name: str = "service_plus_client"
    client_db_user: str = "webadmin"
    client_db_password: str = "APmkY2&Z3A"

    # Service Database
    service_db_host: str = _db["service_db_host"]
    service_db_port: int = _db["service_db_port"]
    service_db_user: str = "webadmin"
    service_db_password: str = "APmkY2&Z3A"

    # Security
    secret_key: str = Field(default="dde5a4b11fe2fa0abbdef32ac3d802c0b1e5f8c9a1b2c3d4e5f6a7b8c9d0")
    algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=30)
    refresh_token_expire_days: int = Field(default=7)

    # Logging
    log_level: str = Field(default="INFO")
    log_format: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    model_config = SettingsConfigDict(
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
```

---

## Files Changed

| File | Change |
|------|--------|
| `app/config.py` | Add `APP_ENV` + `_DB_CONFIG` dict; env-specific host/port; all other values unchanged |

## Files NOT Changed

| File | Reason |
|------|--------|
| `app/db/database.py` | Uses `settings.*` — no change needed |
| `app/main.py` | No change needed |
| All routers / helpers | No direct config access |

## Usage

```bash
# Dev (default — APP_ENV not required)
python -m uvicorn app.main:app --reload

# Production
APP_ENV=production python -m uvicorn app.main:app
```
