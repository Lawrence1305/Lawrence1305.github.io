# tests/test_oxfordaqa.py
from conftest import FIXTURES

from parsers import oxfordaqa


def _index(rows):
    return {r["componentCode"]: r for r in rows}


def test_oxfordaqa_alevel_rows():
    rows = oxfordaqa.parse_rows(str(FIXTURES / "oxfordaqa_timetable.pdf"))
    by_code = _index(rows)
    bl01 = by_code["BL01"]
    assert bl01["level"] == "AS"
    assert bl01["subject"] == "Biology"
    assert bl01["date"] == "2026-05-06"
    assert bl01["startTime"] == "15:00"


def test_oxfordaqa_gcse_rows():
    rows = oxfordaqa.parse_rows(str(FIXTURES / "oxfordaqa_timetable.pdf"))
    by_code = _index(rows)
    chemistry = by_code["9202/1"]
    assert chemistry["level"] == "IG"
    assert chemistry["subject"] == "Chemistry"
    assert chemistry["date"] == "2026-05-07"
