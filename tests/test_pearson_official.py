# tests/test_pearson_official.py
from conftest import FIXTURES

from parsers import pearson_official


def _index(rows):
    return {r["componentCode"]: r for r in rows}


def test_pearson_official_igcse():
    rows = pearson_official.parse_rows(
        str(FIXTURES / "pearson_igcse_nov2026.xlsx"), level="IG"
    )
    by_code = _index(rows)
    bio = by_code["4BI1 1B"]
    assert bio["level"] == "IG"
    assert bio["subject"] == "Biology (Linear)"
    assert bio["date"] == "2026-11-02"
    assert bio["session"] == "Morning"
    assert bio["startTime"] == ""
    assert bio["duration"] == "2h"


def test_pearson_official_ial():
    rows = pearson_official.parse_rows(
        str(FIXTURES / "pearson_ial_oct2026.xlsx"), level=None
    )
    by_code = _index(rows)
    acc = by_code["WAC11 01"]
    assert acc["level"] is None
    assert acc["subject"] == "Accounting"
    assert acc["date"] == "2026-10-20"
    assert acc["session"] == "Afternoon"
