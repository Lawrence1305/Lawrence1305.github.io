"""Parse the Pearson Edexcel IAL exam information sheet."""
from __future__ import annotations

import re

import pdfplumber

from .common import DURATION_PATTERN, parse_date, parse_duration, parse_time

UNIT_LINE_RE = re.compile(
    r"^(?P<code>[A-Z]{3}\d{2}[A-Z]?)\s+"
    r"(?P<title>.+?)\s+"
    rf"(?P<duration>{DURATION_PATTERN})\s+"
    r"(?P<date>\d{1,2} [A-Z][a-z]+ \d{4})\s+"
    r"(?P<time>\d{1,2}:\d{2})\s+"
    r"[\d,]+\.\d{2}\s+"
    r"[\d,]+\.\d{2}$"
)
CODE_START_RE = re.compile(r"^[A-Z]{3}\d{2}[A-Z]?")
CASHIN_RE = re.compile(r"^[XY][A-Z]{2,3}\d{2}\b.*\(Cash-in", re.IGNORECASE)
SUBJECT_RE = re.compile(r"^[A-Za-z][A-Za-z &()'-]{2,}$")
NON_SUBJECT_HINTS = (
    "exam information", "pearson edexcel", "exam", "registration",
    "standard", "late stage", "access", "other", "rmb", "fee", "unit",
    "candidate", "information sheet", "考试", "报名", "人民币", "含税",
    "table",
)


def _is_subject_header(line: str) -> bool:
    if not SUBJECT_RE.match(line):
        return False
    low = line.lower()
    return not any(hint in low for hint in NON_SUBJECT_HINTS)


def parse_rows(pdf_path: str) -> list[dict]:
    rows: list[dict] = []
    subject = ""
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
                if not line:
                    continue
                if CASHIN_RE.match(line) or line.startswith("*"):
                    continue
                if _is_subject_header(line):
                    subject = line
                    continue
                match = UNIT_LINE_RE.match(line)
                if not match and CODE_START_RE.match(line) and i < len(lines):
                    # 单元标题可能换行,拼下一行重试一次
                    match = UNIT_LINE_RE.match(line + " " + lines[i])
                    if match:
                        i += 1
                if not match:
                    continue
                g = match.groupdict()
                rows.append(
                    {
                        "board": "pearson",
                        "level": None,
                        "syllabusCode": "",
                        "subject": subject,
                        "optionCode": "",
                        "componentCode": g["code"],
                        "componentTitle": g["title"],
                        "duration": parse_duration(g["duration"]),
                        "date": parse_date(g["date"], "%d %B %Y"),
                        "startTime": parse_time(g["time"]),
                        "sourcePdf": "",
                    }
                )
    return rows
