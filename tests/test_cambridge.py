# tests/test_cambridge.py
from conftest import FIXTURES

from parsers import cambridge


def _index(rows):
    return {(r["componentCode"], r["date"]): r for r in rows}


def test_cambridge_as_a2_rows():
    rows = cambridge.parse_rows(str(FIXTURES / "cambridge_timetable.pdf"))
    by_code = _index(rows)
    p35 = by_code[("9709/35", "2026-10-21")]
    assert p35["level"] == "A2"
    assert p35["subject"] == "Mathematics"
    assert p35["syllabusCode"] == "9709"
    assert p35["startTime"] == "08:45"
    assert p35["duration"] == "1h50m"


def test_cambridge_igcse_rows():
    rows = cambridge.parse_rows(str(FIXTURES / "cambridge_timetable.pdf"))
    by_code = _index(rows)
    physics = by_code[("0625/42", "2026-10-07")]
    assert physics["level"] == "IG"
    assert physics["subject"] == "Physics"
    assert physics["syllabusCode"] == "0625"
