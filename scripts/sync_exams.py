"""Fetch British Council exam guides and write normalized timetable JSON."""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber
import requests

from board_config import BOARDS, USER_AGENT, fetch_html, find_guide_pdf_urls
from parsers import cambridge, oxfordaqa, pearson

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "src" / "data"
CACHE_DIR = REPO_ROOT / ".cache" / "exams"

PARSERS = {
    "cambridge": cambridge.parse_rows,
    "oxfordaqa": oxfordaqa.parse_rows,
    "pearson": pearson.parse_rows,
}

SEASON_RES = {
    "cambridge": re.compile(
        r"Cambridge International AS & A Level Exams Information Sheet - ([^\n]+)"
    ),
    "oxfordaqa": re.compile(
        r"OxfordAQA International (?:AS/A-Level|GCSE) Exam Information Sheet - ([^\n]+)"
    ),
    "pearson": re.compile(
        r"Pearson Edexcel Exam Information Form - ([^\n]+)"
    ),
}

VALID_LEVELS = {None, "IG", "AS", "A2", "A"}


def validate_rows(rows: list[dict]) -> list[str]:
    errors: list[str] = []
    for i, row in enumerate(rows):
        if row["board"] not in PARSERS:
            errors.append(f"row {i}: bad board {row['board']!r}")
        if row["level"] not in VALID_LEVELS:
            errors.append(f"row {i}: bad level {row['level']!r}")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", row["date"]):
            errors.append(f"row {i}: bad date {row['date']!r}")
        if not re.fullmatch(r"\d{1,2}:\d{2}", row["startTime"]):
            errors.append(f"row {i}: bad time {row['startTime']!r}")
        if not row["componentCode"] or not row["componentTitle"]:
            errors.append(f"row {i}: missing code or title")
    return errors


def extract_season(board: str, pdf_path: Path) -> str:
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            match = SEASON_RES[board].search(text)
            if match:
                return match.group(1).strip()
    return ""


def _atomic_write(path: Path, content: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    tmp.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync BC exam timetable data")
    parser.add_argument(
        "--offline",
        action="store_true",
        help="reuse cached PDFs instead of downloading",
    )
    args = parser.parse_args()

    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    all_rows: list[dict] = []
    meta: dict = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "season": {},
        "sources": {},
    }
    failed: list[str] = []

    for board, config in BOARDS.items():
        try:
            html = fetch_html(config["page_url"])
            urls = find_guide_pdf_urls(html)
            if not urls:
                raise RuntimeError("no registration-guide PDF links found")
            guide_url = urls[0]
            meta["sources"][board] = {"page": config["page_url"], "pdf": guide_url}
            pdf_path = CACHE_DIR / guide_url.rsplit("/", 1)[-1]
            if not (args.offline and pdf_path.exists()):
                resp = session.get(guide_url, timeout=120)
                resp.raise_for_status()
                pdf_path.write_bytes(resp.content)
            season = extract_season(board, pdf_path)
            meta["season"][board] = season
            rows = PARSERS[board](str(pdf_path))
            for row in rows:
                row["sourcePdf"] = guide_url
            errors = validate_rows(rows)
            if errors:
                raise RuntimeError(
                    f"{len(errors)} invalid rows, first: {errors[0]}"
                )
            if not rows:
                raise RuntimeError("parsed 0 rows")
            all_rows.extend(rows)
            print(f"{board}: {len(rows)} rows ({season})")
        except Exception as exc:  # noqa: BLE001 - keep old data on any failure
            failed.append(f"{board}: {exc}")
            print(f"ERROR {board}: {exc}", file=sys.stderr)

    if failed:
        print(
            f"Sync failed for {len(failed)} board(s); keeping existing data.",
            file=sys.stderr,
        )
        return 1

    all_rows.sort(
        key=lambda r: (r["date"], r["startTime"], r["board"], r["componentCode"])
    )
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    _atomic_write(
        DATA_DIR / "exams.json",
        json.dumps(all_rows, ensure_ascii=False, indent=2) + "\n",
    )
    _atomic_write(
        DATA_DIR / "meta.json",
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n",
    )
    print(f"Wrote {len(all_rows)} rows to {DATA_DIR / 'exams.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
