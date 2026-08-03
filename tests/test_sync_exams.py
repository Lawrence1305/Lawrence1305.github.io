# tests/test_sync_exams.py
from sync_exams import validate_rows


def _good_row():
    return {
        "board": "cambridge",
        "level": "A2",
        "syllabusCode": "9709",
        "subject": "Mathematics",
        "optionCode": "9709DC",
        "componentCode": "9709/35",
        "componentTitle": "Pure Mathematics 3",
        "duration": "1h50m",
        "date": "2026-10-21",
        "startTime": "08:45",
        "sourcePdf": "https://example.com/guide.pdf",
    }


def test_validate_accepts_good_row():
    assert validate_rows([_good_row()]) == []


def test_validate_rejects_bad_rows():
    bad = dict(_good_row(), level="BOGUS", date="2026/10/21", startTime="9", componentCode="")
    errors = validate_rows([bad])
    assert len(errors) >= 4
