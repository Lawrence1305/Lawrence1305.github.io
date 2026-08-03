# tests/test_pearson.py
from conftest import FIXTURES

from parsers import pearson


def test_pearson_parses_unit_rows():
    rows = pearson.parse_rows(str(FIXTURES / "pearson_timetable.pdf"))
    by_code = {r["componentCode"]: r for r in rows}
    wbi = by_code["WBI11A"]
    assert wbi["subject"] == "Biology"
    assert wbi["level"] is None
    assert wbi["date"] == "2026-10-12"
    assert wbi["startTime"] == "16:00"
    assert wbi["duration"] == "1h30m"
    assert wbi["componentTitle"] == "Unit 1: Molecules, Diet, Transport and Health"


def test_pearson_excludes_cash_in_rows():
    rows = pearson.parse_rows(str(FIXTURES / "pearson_timetable.pdf"))
    assert not any(r["componentCode"].startswith(("X", "Y")) for r in rows)
