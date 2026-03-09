# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : configs/logging_config.py
# DESCRIPTION  : Loguru logging setup with rotation, retention, and format
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from datetime import datetime
import sys
from zoneinfo import ZoneInfo

from loguru import logger

# Paris timezone for display
_PARIS_TZ = ZoneInfo("Europe/Paris")


def _format_record(record: dict) -> str:  # type: ignore[type-arg]
    """
    Custom Loguru format function.

    Outputs dual-timezone log lines:
        [BRANDSCALE] YYYY-MM-DD HH:MM:SS UTC (HH:MM Paris) | LEVEL | module | message
    """
    utc_time: datetime = record["time"]
    paris_time = utc_time.astimezone(_PARIS_TZ)
    utc_str = utc_time.strftime("%Y-%m-%d %H:%M:%S UTC")
    paris_str = paris_time.strftime("%H:%M Paris")
    level = record["level"].name
    module = record["name"]
    message = record["message"]
    extra = record["extra"]

    formatted = (
        f"[BRANDSCALE] {utc_str} ({paris_str}) | {level:<8} | {module} | {message}"
    )

    # Append structured extra fields if present
    if extra:
        extra_str = " | ".join(f"{k}={v}" for k, v in extra.items())
        formatted += f" | {extra_str}"

    return formatted + "\n"


def setup_logging(
    log_level: str = "INFO",
    log_dir: str = "logs",
    max_size_mb: int = 10,
    retention_days: int = 90,
    enable_json: bool = False,
) -> None:
    """
    Configure Loguru handlers for BRANDSCALE.

    Sets up:
    - Console (stderr) handler with colourised output
    - File handler with rotation (size-based) and retention (time-based)
    - Optional JSON sink for log aggregation pipelines

    Args:
        log_level:      Minimum log level (DEBUG/INFO/WARNING/ERROR).
        log_dir:        Directory for log files.
        max_size_mb:    Log file rotation size in megabytes.
        retention_days: Days to keep log files (RGPD: default 90).
        enable_json:    Also write JSON-formatted logs to a separate file.
    """
    # Remove default Loguru handler
    logger.remove()

    # Console handler — colourised, human-readable
    logger.add(
        sys.stderr,
        level=log_level,
        format=(
            "<green>[BRANDSCALE]</green> "
            "<cyan>{time:YYYY-MM-DD HH:mm:ss UTC}</cyan> | "
            "<level>{level: <8}</level> | "
            "<magenta>{name}</magenta> | "
            "{message}"
        ),
        colorize=True,
        backtrace=True,
        diagnose=True,
        enqueue=True,  # thread-safe
    )

    # File handler — rotating by size, retained by time
    rotation_size = f"{max_size_mb} MB"
    retention_period = f"{retention_days} days"

    logger.add(
        f"{log_dir}/brandscale_{{time:YYYY-MM-DD}}.log",
        level=log_level,
        format=_format_record,  # type: ignore[arg-type]
        rotation=rotation_size,
        retention=retention_period,
        compression="gz",
        enqueue=True,
        backtrace=True,
        diagnose=False,  # no sensitive local var dump in files
    )

    # Error-only file handler
    logger.add(
        f"{log_dir}/brandscale_errors.log",
        level="ERROR",
        format=_format_record,  # type: ignore[arg-type]
        rotation=rotation_size,
        retention=retention_period,
        compression="gz",
        enqueue=True,
    )

    if enable_json:
        # JSON sink for log aggregation (Datadog, ELK, etc.)
        logger.add(
            f"{log_dir}/brandscale_structured.jsonl",
            level=log_level,
            serialize=True,
            rotation=rotation_size,
            retention=retention_period,
            compression="gz",
            enqueue=True,
        )

    logger.info(
        "[BRANDSCALE] Logging configured | level={} | retention={}d | rotation={}MB",
        log_level,
        retention_days,
        max_size_mb,
    )


def get_logger(name: str) -> logger:  # type: ignore[valid-type]
    """
    Return a contextual logger bound to the given module name.

    Args:
        name: Typically __name__ from the calling module.

    Returns:
        A Loguru logger with the module name bound.
    """
    return logger.bind(module=name)


if __name__ == "__main__":
    setup_logging(log_level="DEBUG", log_dir="logs", retention_days=90)
    log = get_logger(__name__)
    log.debug("Debug message from BRANDSCALE logging system")
    log.info("Info message — everything nominal")
    log.warning("Warning — non-critical issue detected")
    log.error("Error — action required")
    logger.success("[BRANDSCALE] Logging smoke test complete.")
