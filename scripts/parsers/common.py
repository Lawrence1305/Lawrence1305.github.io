"""Shared parsing helpers for exam timetable rows."""
from __future__ import annotations

import re
from datetime import datetime

DURATION_PATTERN = r"(?:(?:\d+h(?:\s*\d{1,2}m)?)|\d{1,2}m)"
DURATION_RE = re.compile(
    r"(?:(?P<h>\d+)h(?:\s*(?P<m>\d{1,2})m)?|(?P<m2>\d{1,2})m)"
)
TIME_RE = re.compile(r"(\d{1,2}):(\d{2})")


def parse_duration(text: str) -> str:
    """Normalize '3h 00m' -> '3h', '1h 30m' -> '1h30m', '45m' -> '45m'."""
    match = DURATION_RE.search(text)
    if not match:
        raise ValueError(f"Cannot parse duration: {text!r}")
    hours = int(match.group("h") or 0)
    minutes = int(match.group("m") or match.group("m2") or 0)
    if hours and minutes:
        return f"{hours}h{minutes:02d}m"
    if hours:
        return f"{hours}h"
    return f"{minutes}m"


def parse_time(text: str) -> str:
    """Normalize '8:45' -> '08:45'."""
    match = TIME_RE.search(text)
    if not match:
        raise ValueError(f"Cannot parse time: {text!r}")
    return f"{int(match.group(1)):02d}:{match.group(2)}"


def parse_date(text: str, fmt: str) -> str:
    """Parse a date string and return ISO yyyy-mm-dd."""
    return datetime.strptime(text.strip(), fmt).strftime("%Y-%m-%d")


def clean_fee(text: str) -> float | None:
    """Strip thousands separators; return None for empty input."""
    return float(text.replace(",", "")) if text else None


def level_group(board: str, level: str | None) -> str:
    """Map a row to one of the two filter groups: IGCSE or A Level.

    Pearson rows from the BC registration guide are International A Level
    (level is None); Pearson IGCSE rows parsed from the official timetable
    carry level "IG".
    """
    if board == "pearson":
        return "IGCSE" if level == "IG" else "A Level"
    if level == "IG":
        return "IGCSE"
    return "A Level"
