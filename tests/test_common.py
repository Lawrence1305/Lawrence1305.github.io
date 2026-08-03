# tests/test_common.py
import pytest

from parsers.common import level_group, parse_date, parse_duration, parse_time


def test_parse_duration():
    assert parse_duration("3h 00m") == "3h"
    assert parse_duration("1h 30m") == "1h30m"
    assert parse_duration("45m") == "45m"
    assert parse_duration("2h") == "2h"


def test_parse_duration_rejects_garbage():
    with pytest.raises(ValueError):
        parse_duration("twenty minutes")


def test_parse_time_pads_hour():
    assert parse_time("8:45") == "08:45"
    assert parse_time("12:45") == "12:45"


def test_parse_date_iso():
    assert parse_date("08 October 2026", "%d %B %Y") == "2026-10-08"
    assert parse_date("6-May-2026", "%d-%b-%Y") == "2026-05-06"


def test_level_group():
    assert level_group("cambridge", "IG") == "IGCSE"
    assert level_group("cambridge", "A") == "A Level"
    assert level_group("cambridge", "AS") == "A Level"
    assert level_group("oxfordaqa", "IG") == "IGCSE"
    assert level_group("oxfordaqa", "A2") == "A Level"
    assert level_group("pearson", None) == "A Level"
    assert level_group("pearson", "IG") == "IGCSE"
