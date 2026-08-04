"""
Minimal in-memory per-IP rate limiting for the public website API.

No rate-limiting library (slowapi or similar) is installed in this codebase.
This hand-rolled sliding-window counter is enough for a POC's two low-traffic
public endpoints on a single instance — revisit with a shared store (Redis)
if this needs to scale across multiple processes/instances.
"""
import time
from collections import defaultdict
from typing import Callable

from fastapi import HTTPException, Request, status

_windows: dict[str, list[float]] = defaultdict(list)


def rate_limit(bucket: str, limit: int, window_seconds: int) -> Callable:
    """Build a FastAPI dependency allowing `limit` requests per `window_seconds` per client IP."""

    async def _check(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        key = f"{bucket}:{client_ip}"
        now = time.monotonic()
        window_start = now - window_seconds

        timestamps = _windows[key]
        while timestamps and timestamps[0] < window_start:
            timestamps.pop(0)

        if len(timestamps) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests — please try again shortly",
            )
        timestamps.append(now)

    return _check
