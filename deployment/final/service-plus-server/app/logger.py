"""
Logging configuration for the application.
"""
import logging
import sys
from typing import Optional


def setup_logger(
    name: str = "service_plus",
    level: int = logging.INFO,
    log_format: Optional[str] = None
) -> logging.Logger:
    """
    Configure and return a logger instance.

    Args:
        name: Logger name
        level: Logging level
        log_format: Custom log format string

    Returns:
        Configured logger instance
    """
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Avoid adding handlers multiple times
    if logger.handlers:
        return logger

    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)

    # Create formatter
    if log_format is None:
        log_format = (
            "%(asctime)s - %(name)s - %(levelname)s - "
            "%(filename)s:%(lineno)d - %(funcName)s() - %(message)s"
        )

    formatter = logging.Formatter(
        log_format,
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # Add formatter to handler
    console_handler.setFormatter(formatter)

    # Add handler to logger
    logger.addHandler(console_handler)

    return logger


# Create and export the default logger instance
logger = setup_logger()
