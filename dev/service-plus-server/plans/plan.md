# Plan: Move Email Configuration to config.py

## Current State

### Where email config is used
- **`app/core/email.py`** — imports `settings` from `app.config` and reads:
  - `settings.smtp_host` (line 33, 47)
  - `settings.smtp_port` (line 49, 47)
  - `settings.smtp_user` (line 52, 53)
  - `settings.smtp_password` (line 52, 53)
  - `settings.smtp_from` (line 43, 54)

### Problem
The `Settings` class in `app/config.py` does **not** define any of the five SMTP fields.
`email.py` already imports `settings` from `app.config` and references `settings.smtp_*`,
but because the fields are absent from the `Settings` class, accessing them will raise `AttributeError` at runtime.

### What needs to move
The SMTP field definitions (with defaults and descriptions) must be added to the `Settings`
class in `config.py`. No import change is needed in `email.py` — it already uses `settings`
from `app.config`.

---

## Steps

### Step 1: Add SMTP settings to `Settings` class in `config.py`
Add a new `# Email / SMTP Settings` section (alphabetically between `# GraphQL Settings`
and `# Logging Settings`) with the following five fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `smtp_from` | `str` | `"noreply@localhost"` | Sender address |
| `smtp_host` | `str` | `""` | SMTP server host; empty = skip sending |
| `smtp_password` | `str` | `""` | SMTP login password (optional) |
| `smtp_port` | `int` | `587` | SMTP server port |
| `smtp_user` | `str` | `""` | SMTP login username (optional) |

All fields use `Field(default=..., description=...)` consistent with existing config style.

### Step 2: Remove the inline SMTP documentation comment from `email.py`
The docstring at the top of `email.py` lists SMTP env-var names and defaults.
Once the fields are defined in `config.py`, this inline config documentation is
redundant. Remove lines 1–12 (the module docstring describing SMTP env vars)
and replace with a single-line description of the module's purpose.

### Step 3: Verify `email.py` imports and references need no further changes
`email.py` already does `from app.config import settings` and uses `settings.smtp_*`.
No import changes are required — confirm each reference matches the field names added
in Step 1.

---

## Workflow

```
app/core/email.py
  └─ uses settings.smtp_host / smtp_port / smtp_user / smtp_password / smtp_from
        │
        │  (fields currently MISSING from Settings class)
        ▼
app/config.py  ──  Settings class
        │
Step 1: Add # Email / SMTP Settings block with 5 fields (smtp_from, smtp_host,
        smtp_password, smtp_port, smtp_user) — sorted alphabetically
        │
Step 2: Simplify email.py module docstring (remove redundant env-var docs)
        │
Step 3: Confirm email.py references match new field names — no import changes needed
        │
        ▼
Result: SMTP configuration is centralised in config.py / .env,
        consistent with all other settings in the project.
```

---

## Files Changed
| File | Change |
|------|---------|
| `app/config.py` | Add `# Email / SMTP Settings` section with 5 SMTP fields to `Settings` class |
| `app/core/email.py` | Replace verbose SMTP env-var module docstring with a concise one-liner |
