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

GCSE_COMPONENT_RE = re.compile(
    r"^(?P<code>\d{4}/\d+)\s+"
    r"(?P<title>.+?)\s+"
    rf"(?P<duration>{DURATION_PATTERN})\s+"
    r"(?P<date>\d{1,2}-[A-Z][a-z]{2}-\d{4})\s+"
    r"(?P<time>\d{1,2}:\d{2})(?:\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2})?$"
)

CORE_ROW_RE = re.compile(
    r"^(?P<option>\d{4})\s+"
    r"(?P<title>.+?)\s+"
    rf"(?P<duration>{DURATION_PATTERN})\s+"
    r"(?P<date>\d{1,2}-[A-Z][a-z]{2}-\d{4})\s+"
    r"(?P<time>\d{1,2}:\d{2})\s+"
    r"[\d,]+\.\d{2}\s+"
    r"[\d,]+\.\d{2}$"
)

FEE_ROW_RE = re.compile(
    r"^(?P<option>\d{4})\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}$"
)

LEVEL_MAP = {"1": "AS", "2": "A2"}
SKIP_RE = re.compile(r"^\d{4}\s*\(合并|The following combinations|同考季内不能")

SUBJECT_RE = re.compile(r"^[A-Za-z][A-Za-z &()'-]{2,}$")
NON_SUBJECT_HINTS = (
    "exam timetable", "pricing", "registration", "standard", "late stage",
    "access", "other access", "rmb", "fee", "unit", "option", "duration",
    "test date", "starting", "series:", "考试", "报名", "人民币", "含税",
)


def _is_subject_header(line: str) -> bool:
    if not SUBJECT_RE.match(line):
        return False
    low = line.lower()
    return not any(hint in low for hint in NON_SUBJECT_HINTS)


def parse_rows(pdf_path: str) -> list[dict]:
    rows: list[dict] = []
    subject = ""
    option: dict | None = None

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
                if _is_subject_header(line):
                    subject = line
                    continue
                match = ALEVEL_ROW_RE.match(line)
                if match:
                    g = match.groupdict()
                    rows.append(
                        {
                            "board": "oxfordaqa",
                            "level": LEVEL_MAP[g["level"]],
                            "syllabusCode": "",
                            "subject": subject,
                            "optionCode": g["option"],
                            "componentCode": g["option"],
                            "componentTitle": g["title"],
                            "duration": parse_duration(g["duration"]),
                            "date": parse_date(g["date"], "%d-%b-%Y"),
                            "startTime": parse_time(g["time"]),
                            "sourcePdf": "",
                        }
                    )
                    continue
                match = FEE_ROW_RE.match(line)
                if match:
                    option = {"optionCode": match.group("option")}
                    continue
                match = CORE_ROW_RE.match(line)
                if match:
                    g = match.groupdict()
                    rows.append(
                        {
                            "board": "oxfordaqa",
                            "level": "IG",
                            "syllabusCode": "",
                            "subject": subject,
                            "optionCode": g["option"],
                            "componentCode": g["option"],
                            "componentTitle": g["title"],
                            "duration": parse_duration(g["duration"]),
                            "date": parse_date(g["date"], "%d-%b-%Y"),
                            "startTime": parse_time(g["time"]),
                            "sourcePdf": "",
                        }
                    )
                    continue
                match = GCSE_COMPONENT_RE.match(line)
                if match:
                    g = match.groupdict()
                    rows.append(
                        {
                            "board": "oxfordaqa",
                            "level": "IG",
                            "syllabusCode": "",
                            "subject": subject,
                            "optionCode": (option or {}).get("optionCode", ""),
                            "componentCode": g["code"],
                            "componentTitle": g["title"],
                            "duration": parse_duration(g["duration"]),
                            "date": parse_date(g["date"], "%d-%b-%Y"),
                            "startTime": parse_time(g["time"]),
                            "sourcePdf": "",
                        }
                    )
    return rows
