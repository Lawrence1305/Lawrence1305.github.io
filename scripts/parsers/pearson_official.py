"""Parse Pearson official timetable XLSX files (the 'All papers' sheet)."""
from __future__ import annotations

from datetime import datetime

import openpyxl

from .common import parse_duration


def parse_rows(xlsx_path: str, level: str | None) -> list[dict]:
    """Parse an official Pearson timetable workbook.

    ``level`` is "IG" for the International GCSE timetable and None for the
    International Advanced Level timetable. Official files only carry session
    labels (Morning/Afternoon/Evening/Window), so ``startTime`` stays empty
    and ``session`` holds the label.
    """
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb["All papers"]
    rows: list[dict] = []
    for values in ws.iter_rows(min_row=2, values_only=True):
        if values[0] is None:
            continue
        date = values[0]
        if isinstance(date, datetime):
            date = date.strftime("%Y-%m-%d")
        code = str(values[4]).strip() if values[4] else ""
        subject = str(values[5]).strip() if values[5] else ""
        title = str(values[6]).strip() if values[6] else ""
        session = str(values[7]).strip() if values[7] else ""
        duration = str(values[8]).strip() if values[8] else ""
        if not code or not subject:
            continue
        rows.append(
            {
                "board": "pearson",
                "level": level,
                "syllabusCode": "",
                "subject": subject,
                "optionCode": "",
                "componentCode": code,
                "componentTitle": title,
                "duration": parse_duration(duration),
                "date": date,
                "startTime": "",
                "session": session,
                "sourcePdf": "",
            }
        )
    return rows
