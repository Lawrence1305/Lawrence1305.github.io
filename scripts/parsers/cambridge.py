"""Parse the Cambridge International exam information sheets."""
from __future__ import annotations

import re

import pdfplumber

from .common import DURATION_PATTERN, parse_date, parse_duration, parse_time

SYLLABUS_RE = re.compile(
    r"^Syllabus name[& ]+Code:\s*(\d{4})\s+(.+)$", re.IGNORECASE
)

OPTION_RE = re.compile(
    r"^(?P<level>A2|AS|IGCSE|A|O)\s+"
    r"(?P<option>\d{4}[A-Z]{1,2})\s+"
    r"(?P<included>[\d,\s]+(?:\([^)]*\))?)\s+"
    r"(?P<fee_std>[\d,]+\.\d{2})\s+"
    r"(?P<fee_late>[\d,]+\.\d{2})"
)

COMPONENT_RE = re.compile(
    r"(?P<code>\d{4}/\d{2})\s+"
    r"(?P<title>.+?)\s+(?:\d{1,2}\s+)?"
    rf"(?P<duration>{DURATION_PATTERN})\s+"
    r"(?P<date>\d{1,2} [A-Z][a-z]+ \d{4})\s+"
    r"(?P<time>\d{1,2}:\d{2})$",
    re.IGNORECASE,
)

LEVEL_MAP = {"A": "A", "A2": "A2", "AS": "AS", "IGCSE": "IG", "O": "IG"}
CARRIED_FORWARD_RE = re.compile(
    r"^\d{2}\s+\w+ \d{4}\s+AS Mark", re.IGNORECASE
)
SKIP_STARTS = ("*", "/", "同考季", "Candidates may")


def _row(syllabus: dict, option: dict, component: re.Match) -> dict:
    g = component.groupdict()
    return {
        "board": "cambridge",
        "level": option["level"],
        "syllabusCode": syllabus["code"],
        "subject": syllabus["name"],
        "optionCode": option["optionCode"],
        "componentCode": g["code"],
        "componentTitle": g["title"],
        "duration": parse_duration(g["duration"]),
        "date": parse_date(g["date"], "%d %B %Y"),
        "startTime": parse_time(g["time"]),
        "sourcePdf": "",
    }


def parse_rows(pdf_path: str) -> list[dict]:
    rows: list[dict] = []
    syllabus: dict | None = None
    option: dict | None = None

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            for raw_line in (page.extract_text() or "").splitlines():
                line = " ".join(raw_line.split())
                if not line:
                    continue
                match = SYLLABUS_RE.match(line)
                if match:
                    name = re.sub(
                        r"\s*Detailed Component Information.*$",
                        "",
                        match.group(2),
                        flags=re.IGNORECASE,
                    ).strip()
                    syllabus = {"code": match.group(1), "name": name}
                    option = None
                    continue
                match = OPTION_RE.match(line)
                if match:
                    option = {
                        "level": LEVEL_MAP[match.group("level")],
                        "optionCode": match.group("option"),
                    }
                    remainder = line[match.end():].strip()
                    component = COMPONENT_RE.match(remainder)
                    if component and syllabus:
                        rows.append(_row(syllabus, option, component))
                    continue
                component = COMPONENT_RE.match(line)
                if not component and line.startswith(SKIP_STARTS):
                    # 部分试卷行与注释(如同考季限制)在同一行,需在行内查找
                    component = COMPONENT_RE.search(line)
                if component and syllabus and option:
                    rows.append(_row(syllabus, option, component))
    return rows
