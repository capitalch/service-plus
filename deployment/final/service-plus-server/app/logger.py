"""
Logging configuration for the application.

Design notes
------------
* A single named logger ``service_plus`` (and its children) is used throughout
  the codebase.  ``propagate = False`` prevents records from bubbling up to the
  root logger and being printed a *second* time by Uvicorn's own handler.
* ``configure_for_uvicorn()`` is called once from ``main.py`` after the FastAPI
  app is created.  It merges the application logger into Uvicorn's logging
  infrastructure so that all output uses a consistent format and level.
"""
import logging
import sys
from typing import Optional


def setup_logger(
    name: str = "service_plus",
    level: int = logging.INFO,
    log_format: Optional[str] = None,
) -> logging.Logger:
    """
    Configure and return a logger instance.

    Args:
        name:       Logger name (default: ``"service_plus"``).
        level:      Logging level (default: ``logging.INFO``).
        log_format: Custom log format string.

    Returns:
        Configured logger instance.
    """
    _logger = logging.getLogger(name)
    _logger.setLevel(level)

    # Stop records propagating to the root logger (avoids duplicate output
    # when Uvicorn also attaches a handler to the root logger).
    _logger.propagate = False

    # Avoid adding duplicate handlers when the module is reloaded.
    if _logger.handlers:
        return _logger

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)

    if log_format is None:
        log_format = (
            "%(asctime)s - %(name)s - %(levelname)s - "
            "%(filename)s:%(lineno)d - %(funcName)s() - %(message)s"
        )

    formatter = logging.Formatter(log_format, datefmt="%Y-%m-%d %H:%M:%S")
    console_handler.setFormatter(formatter)
    _logger.addHandler(console_handler)

    return _logger


def configure_for_uvicorn(suppress_access_log: bool = True) -> None:
    """
    Align the application logger with Uvicorn's logging setup.

    Call this *once* from the FastAPI lifespan after Uvicorn has already
    configured the root logger.

    Args:
        suppress_access_log: When ``True`` (default), Uvicorn's per-request
            access lines are raised to WARNING level so they don't flood the
            console in development.  Set to ``False`` to keep them at INFO.
    """
    # Uvicorn's access log is very noisy at INFO; promote it to WARNING unless
    # the caller explicitly wants it.
    if suppress_access_log:
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

    # Propagate the app logger's effective level to its children so that
    # module-level child loggers (e.g. ``logging.getLogger("service_plus.db")``)
    # inherit the level automatically.
    app_logger = logging.getLogger("service_plus")
    for child_name in logging.Logger.manager.loggerDict:
        if child_name.startswith("service_plus."):
            child = logging.getLogger(child_name)
            child.setLevel(app_logger.level)
            child.propagate = True   # let children propagate *to service_plus*, not to root


# ---------------------------------------------------------------------------
# Module-level singleton — imported everywhere as ``from app.logger import logger``
# ---------------------------------------------------------------------------
logger = setup_logger()
