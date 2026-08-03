"""Parse the OxfordAQA exam information sheets (AS/A-Level + IGCSE)."""
from __future__ import annotations

import re

import pdfplumber

from .common import DURATION_PATTERN, parse_date, parse_duration, parse_time

ALEVEL_ROW_RE = re.compile(
    r"^(?P<option>[A-Z]{2}\d{2})\s+"
    r"(?P<title>.+?)\s+"
    r"(?P<level>[12])\s+"
    rf"(?P<duration>{DURATION_PATTERN})\s+"
    r"(?P<date>\d{1,2}-[A-Z][a-z]{2}-\d{4})\s+"
    r"(?P<time>\d{1,2}:\d{2})\s+"
    r"[\d,]+\.\d{2}\s+"
    r"[\d,]+\.\d{2}$"
)

# IGCSE: 组合编码 + 试卷编码 + 名称 在同一行(如 9204C 9204/CC Paper 2: ...)
IG_INLINE_RE = re.compile(
    r"^(?P<option>\d{4}[A-Z]?)\s+"
    r"(?P<code>\d{4}/[A-Z0-9]+)\s+"
    r"(?P<title>.+?)\s+"
    rf"(?P<duration>{DURATION_PATTERN})\s+"
    r"(?P<date>\d{1,2}-[A-Z][a-z]{2}-\d{4})\s+"
    r"(?P<time>\d{1,2}:\d{2})(?:\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2})?$"
)

# IGCSE CORE: 组合编码 + 单元编码 + 名称 + 内联费用(如 9221 9221 Written Paper ...)
CORE_ROW_RE = re.compile(
    r"^(?P<option>\d{4})\s+"
    r"(?P<unit>\d{4})\s+"
    r"(?P<title>.+?)\s+"
    rf"(?P<duration>{DURATION_PATTERN})\s+"
    r"(?P<date>\d{1,2}-[A-Z][a-z]{2}-\d{4})\s+"
    r"(?P<time>\d{1,2}:\d{2})\s+"
    r"[\d,]+\.\d{2}\s+"
    r"[\d,]+\.\d{2}$"
)

# IGCSE 标准行: 试卷编码 + 名称(如 9201/1 Paper 1: Biology ...)
IG_COMPONENT_RE = re.compile(
    r"^(?P<code>\d{4}/[A-Z0-9]+)\s+"
    r"(?P<title>.+?)\s+"
    rf"(?P<duration>{DURATION_PATTERN})\s+"
    r"(?P<date>\d{1,2}-[A-Z][a-z]{2}-\d{4})\s+"
    r"(?P<time>\d{1,2}:\d{2})(?:\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2})?$"
)

# IGCSE 标题拆分行: 试卷编码 + 时长/日期/时间,名称在相邻行(如 9225/1 2h ...)
IG_NO_TITLE_RE = re.compile(
    r"^(?P<code>\d{4}/[A-Z0-9]+)\s+"
    rf"(?P<duration>{DURATION_PATTERN})\s+"
    r"(?P<date>\d{1,2}-[A-Z][a-z]{2}-\d{4})\s+"
    r"(?P<time>\d{1,2}:\d{2})$"
)

# IGCSE 费用行: 组合编码 + 两个价格(组合编码可带字母后缀,如 9260C)
IG_FEE_RE = re.compile(
    r"^(?P<option>\d{4}[A-Z]?)\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}$"
)

TITLE_FRAGMENT_RE = re.compile(r"^Paper \d:")
LEVEL_MAP = {"1": "AS", "2": "A2"}
SKIP_RE = re.compile(
    r"^\d{4}\s*\(合并|The following combinations|同考季内不能|Candidates may"
)

SUBJECT_RE = re.compile(r"^[A-Za-z][A-Za-z &()'-]{2,}$")
NON_SUBJECT_HINTS = (
    "exam timetable", "pricing", "registration", "standard", "late stage",
    "access", "other access", "rmb", "fee", "unit", "option", "duration",
    "test date", "starting", "series:", "candidates", "考试", "报名",
    "人民币", "含税",
)


def _is_subject_header(line: str) -> bool:
    if not SUBJECT_RE.match(line):
        return False
    low = line.lower()
    return not any(hint in low for hint in NON_SUBJECT_HINTS)


def _is_title_fragment(line: str) -> bool:
    return _is_subject_header(line)


def _append_row(rows: list[dict], subject: str, option: str, level: str,
                code: str, title: str, duration: str, date: str, time: str) -> None:
    rows.append(
        {
            "board": "oxfordaqa",
            "level": level,
            "syllabusCode": "",
            "subject": subject,
            "optionCode": option,
            "componentCode": code,
            "componentTitle": title,
            "duration": duration,
            "date": date,
            "startTime": time,
            "sourcePdf": "",
        }
    )


def parse_rows(pdf_path: str) -> list[dict]:
    rows: list[dict] = []
    subject = ""
    option: dict | None = None
    pending_title = ""

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            lines = [
                " ".join(line.split())
                for line in (page.extract_text() or "").splitlines()
            ]
            i = 0
            while i < len(lines):
                line = lines[i]
                i += 1
                if not line or SKIP_RE.match(line):
                    continue

                match = ALEVEL_ROW_RE.match(line)
                if match:
                    g = match.groupdict()
                    _append_row(
                        rows, subject, g["option"], LEVEL_MAP[g["level"]],
                        g["option"], g["title"], parse_duration(g["duration"]),
                        parse_date(g["date"], "%d-%b-%Y"), parse_time(g["time"]),
                    )
                    continue

                match = IG_INLINE_RE.match(line)
                if match:
                    g = match.groupdict()
                    _append_row(
                        rows, subject, g["option"], "IG", g["code"], g["title"],
                        parse_duration(g["duration"]),
                        parse_date(g["date"], "%d-%b-%Y"), parse_time(g["time"]),
                    )
                    continue

                match = CORE_ROW_RE.match(line)
                if match:
                    g = match.groupdict()
                    _append_row(
                        rows, subject, g["option"], "IG", g["unit"], g["title"],
                        parse_duration(g["duration"]),
                        parse_date(g["date"], "%d-%b-%Y"), parse_time(g["time"]),
                    )
                    continue

                match = IG_COMPONENT_RE.match(line)
                if match:
                    g = match.groupdict()
                    _append_row(
                        rows, subject, (option or {}).get("optionCode", ""),
                        "IG", g["code"], g["title"], parse_duration(g["duration"]),
                        parse_date(g["date"], "%d-%b-%Y"), parse_time(g["time"]),
                    )
                    continue

                match = IG_NO_TITLE_RE.match(line)
                if match:
                    g = match.groupdict()
                    title = pending_title
                    if i < len(lines) and _is_title_fragment(lines[i]):
                        title = f"{title} {lines[i]}".strip()
                        i += 1
                    _append_row(
                        rows, subject, (option or {}).get("optionCode", ""),
                        "IG", g["code"], title or g["code"],
                        parse_duration(g["duration"]),
                        parse_date(g["date"], "%d-%b-%Y"), parse_time(g["time"]),
                    )
                    pending_title = ""
                    continue

                match = IG_FEE_RE.match(line)
                if match:
                    option = {"optionCode": match.group("option")}
                    pending_title = ""
                    continue

                if TITLE_FRAGMENT_RE.match(line):
                    pending_title = line
                    continue

                if _is_subject_header(line):
                    subject = line
                    option = None
                    pending_title = ""
                    continue
    return rows
