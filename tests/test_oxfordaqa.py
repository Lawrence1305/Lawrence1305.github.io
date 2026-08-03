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


def test_oxfordaqa_gcse_split_title_rows():
    rows = oxfordaqa.parse_rows(str(FIXTURES / "oxfordaqa_timetable.pdf"))
    by_code = _index(rows)
    biz = by_code["9225/1"]
    assert biz["subject"] == "Business"
    assert biz["componentTitle"] == (
        "Paper 1: Influences of Operations and Human Resource on Business Activity"
    )
    assert biz["date"] == "2026-04-29"
    assert biz["startTime"] == "15:00"


def test_oxfordaqa_gcse_option_variants():
    rows = oxfordaqa.parse_rows(str(FIXTURES / "oxfordaqa_timetable.pdf"))
    by_code = _index(rows)
    combi = by_code["9204/CC"]
    assert combi["optionCode"] == "9204C"
    assert combi["subject"] == "Combined Science Double Award"
    geo = by_code["9230/2"]
    assert geo["optionCode"] == "9230"
    esl = by_code["9280/W"]
    assert esl["subject"] == "English as a Second Language"


def test_oxfordaqa_gcse_core_rows():
    rows = oxfordaqa.parse_rows(str(FIXTURES / "oxfordaqa_timetable.pdf"))
    by_code = _index(rows)
    core = by_code["9221"]
    assert core["subject"] == "CORE Biology (short course)"
    assert core["componentTitle"] == "Written Paper"
    assert core["date"] == "2026-04-27"


def test_oxfordaqa_option_code_not_leaked():
    rows = oxfordaqa.parse_rows(str(FIXTURES / "oxfordaqa_timetable.pdf"))
    by_code = _index(rows)
    assert by_code["9214/1"]["optionCode"] != "9225"
