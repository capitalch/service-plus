"""
File-based JSON audit logger.
Appends one JSON line per event to logs/audit/audit_YYYY-MM-DD.jsonl
"""
import asyncio
import json
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import aiofiles

from app.config import settings
from app.logger import logger


class AuditAction:
    """String constants for every auditable action."""
    ACTIVATE_ADMIN_USER    = "ACTIVATE_ADMIN_USER"
    ACTIVATE_CLIENT        = "ACTIVATE_CLIENT"
    CREATE_ADMIN_USER      = "CREATE_ADMIN_USER"
    CREATE_BU_SCHEMA       = "CREATE_BU_SCHEMA"
    FEED_BU_SEED_DATA      = "FEED_BU_SEED_DATA"
    CREATE_CLIENT          = "CREATE_CLIENT"
    CREATE_SERVICE_DB      = "CREATE_SERVICE_DB"
    DEACTIVATE_ADMIN_USER  = "DEACTIVATE_ADMIN_USER"
    DEACTIVATE_CLIENT      = "DEACTIVATE_CLIENT"
    DELETE_CLIENT          = "DELETE_CLIENT"
    DROP_DATABASE          = "DROP_DATABASE"
    LOGIN                  = "LOGIN"
    LOGIN_FAILED           = "LOGIN_FAILED"
    LOGOUT                 = "LOGOUT"
    MAIL_ADMIN_CREDENTIALS = "MAIL_ADMIN_CREDENTIALS"
    PASSWORD_RESET         = "PASSWORD_RESET"
    UPDATE_ADMIN_USER      = "UPDATE_ADMIN_USER"


class AuditLogger:
    """
    Appends one JSON line per audit event to a daily rotating JSONL file.
    All public methods are fire-and-forget — exceptions are logged but never re-raised.
    """

    def __init__(self) -> None:
        self._locks: dict[str, asyncio.Lock] = {}

    # ── Private helpers ───────────────────────────────────────────────────────

    def _file_path(self, dt: datetime) -> Path:
        return Path(settings.audit_log_dir) / f"audit_{dt.strftime('%Y-%m-%d')}.jsonl"

    def _lock_for(self, path: str) -> asyncio.Lock:
        if path not in self._locks:
            self._locks[path] = asyncio.Lock()
        return self._locks[path]

    # ── Public API ────────────────────────────────────────────────────────────

    async def log(
        self,
        action: str,
        actor_type: str = "super_admin",
        actor_username: str = "super_admin",
        detail: Optional[str] = None,
        outcome: str = "success",
        resource_id: Optional[str] = None,
        resource_name: Optional[str] = None,
        resource_type: str = "",
    ) -> None:
        """Append one audit entry to today's log file (fire-and-forget)."""
        try:
            now = datetime.now(timezone.utc)
            entry = {
                "action":    action,
                "actor":     {"type": actor_type, "username": actor_username},
                "detail":    detail,
                "id":        str(uuid.uuid4()),
                "outcome":   outcome,
                "resource":  {"id": resource_id, "name": resource_name, "type": resource_type},
                "timestamp": now.isoformat(),
            }
            file_path = self._file_path(now)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            lock = self._lock_for(str(file_path))
            async with lock:
                async with aiofiles.open(str(file_path), "a", encoding="utf-8") as fh:
                    await fh.write(json.dumps(entry) + "\n")
        except Exception as exc:
            logger.error("AuditLogger.log failed: %s", exc)

    async def purge_old_files(self) -> int:
        """Delete JSONL files older than audit_log_retention_days. Returns count deleted."""
        cutoff = date.today() - timedelta(days=settings.audit_log_retention_days)
        base   = Path(settings.audit_log_dir)
        if not base.exists():
            return 0
        count = 0
        for f in base.glob("audit_*.jsonl"):
            try:
                file_date = date.fromisoformat(f.stem[len("audit_"):])
                if file_date < cutoff:
                    f.unlink()
                    logger.info("Purged audit log: %s", f.name)
                    count += 1
            except (ValueError, OSError):
                continue
        return count

    async def query(
        self,
        from_date: date,
        to_date: date,
        action: Optional[str] = None,
        actor: Optional[str] = None,
        outcome: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
    ) -> dict:
        """Read, filter, sort, and paginate entries across daily files."""
        entries: list[dict] = []
        current = from_date

        while current <= to_date:
            file_path = Path(settings.audit_log_dir) / f"audit_{current.strftime('%Y-%m-%d')}.jsonl"
            if file_path.exists():
                try:
                    async with aiofiles.open(str(file_path), "r", encoding="utf-8") as fh:
                        async for raw_line in fh:
                            line = raw_line.strip()
                            if not line:
                                continue
                            try:
                                entry = json.loads(line)
                            except json.JSONDecodeError:
                                continue

                            if action and entry.get("action") != action:
                                continue
                            if actor and entry.get("actor", {}).get("username") != actor:
                                continue
                            if outcome and entry.get("outcome") != outcome:
                                continue
                            if search:
                                needle = search.lower()
                                haystack = " ".join([
                                    entry.get("action") or "",
                                    entry.get("detail") or "",
                                    entry.get("actor", {}).get("username") or "",
                                    entry.get("resource", {}).get("name") or "",
                                    entry.get("resource", {}).get("type") or "",
                                ]).lower()
                                if needle not in haystack:
                                    continue

                            entries.append(entry)
                except Exception as exc:
                    logger.error("AuditLogger.query: error reading %s: %s", file_path, exc)

            current += timedelta(days=1)

        entries.sort(key=lambda e: e.get("timestamp", ""), reverse=True)

        total_items = len(entries)
        total_pages = max(1, (total_items + page_size - 1) // page_size)
        start       = (page - 1) * page_size

        return {
            "items":      entries[start : start + page_size],
            "page":       page,
            "pageSize":   page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        }

    async def stats(self, from_date: date, to_date: date) -> dict:
        """Aggregate counts for the stats dashboard."""
        action_counts: dict[str, int] = {}
        actor_counts:  dict[str, int] = {}
        outcome_counts = {"failure": 0, "success": 0}
        time_series:   dict[str, int] = {}
        total_events   = 0

        current = from_date
        while current <= to_date:
            date_key  = current.strftime("%Y-%m-%d")
            file_path = Path(settings.audit_log_dir) / f"audit_{date_key}.jsonl"
            time_series[date_key] = 0

            if file_path.exists():
                try:
                    async with aiofiles.open(str(file_path), "r", encoding="utf-8") as fh:
                        async for raw_line in fh:
                            line = raw_line.strip()
                            if not line:
                                continue
                            try:
                                entry = json.loads(line)
                            except json.JSONDecodeError:
                                continue

                            total_events += 1
                            time_series[date_key] += 1

                            act = entry.get("action", "UNKNOWN")
                            action_counts[act] = action_counts.get(act, 0) + 1

                            actr = entry.get("actor", {}).get("username", "unknown")
                            actor_counts[actr] = actor_counts.get(actr, 0) + 1

                            oc = entry.get("outcome", "success")
                            if oc in outcome_counts:
                                outcome_counts[oc] += 1
                except Exception as exc:
                    logger.error("AuditLogger.stats: error reading %s: %s", file_path, exc)

            current += timedelta(days=1)

        return {
            "actionCounts":  sorted(
                [{"action": k, "count": v} for k, v in action_counts.items()],
                key=lambda x: x["count"], reverse=True,
            ),
            "actorCounts":   sorted(
                [{"actor": k, "count": v} for k, v in actor_counts.items()],
                key=lambda x: x["count"], reverse=True,
            ),
            "outcomeCounts": outcome_counts,
            "timeSeries":    [{"count": v, "date": k} for k, v in sorted(time_series.items())],
            "totalEvents":   total_events,
        }


audit_logger = AuditLogger()
