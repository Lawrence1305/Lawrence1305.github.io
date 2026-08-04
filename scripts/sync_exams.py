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

from board_config import (
    BOARDS,
    PEARSON_TIMETABLES_URL,
    USER_AGENT,
    fetch_html,
    find_guide_pdf_urls,
    find_pearson_timetable_assets,
)
from parsers import cambridge, oxfordaqa, pearson, pearson_official
from parsers.common import level_group

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
VALID_LEVEL_GROUPS = {"IGCSE", "A Level"}


def validate_rows(rows: list[dict]) -> list[str]:
    errors: list[str] = []
    for i, row in enumerate(rows):
        if row["board"] not in PARSERS:
            errors.append(f"row {i}: bad board {row['board']!r}")
        if row["level"] not in VALID_LEVELS:
            errors.append(f"row {i}: bad level {row['level']!r}")
        if row["levelGroup"] not in VALID_LEVEL_GROUPS:
            errors.append(f"row {i}: bad levelGroup {row['levelGroup']!r}")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", row["date"]):
            errors.append(f"row {i}: bad date {row['date']!r}")
        time_ok = (
            re.fullmatch(r"\d{1,2}:\d{2}", row["startTime"])
            or bool(row.get("session"))
        )
        if not time_ok:
            errors.append(f"row {i}: missing time or session")
        if not row["componentCode"] or not row["componentTitle"]:
            errors.append(f"row {i}: missing code or title")
    return errors


def _download_asset(url: str, session: requests.Session, cache_dir: Path) -> str:
    name = url.rsplit("/", 1)[-1]
    path = cache_dir / name
    cache_dir.mkdir(parents=True, exist_ok=True)
    try:
        path.write_bytes(_download_with_retry(url, session))
    except Exception as exc:  # noqa: BLE001 - fall back to cached file
        if not path.exists():
            raise
        print(
            f"WARNING pearson: asset download failed ({exc}); reusing cached file",
            file=sys.stderr,
        )
    return str(path)


def _download_with_retry(
    url: str, session: requests.Session, timeout: int = 180
) -> bytes:
    last_error: Exception | None = None
    for _ in range(3):
        try:
            resp = session.get(url, timeout=timeout)
            resp.raise_for_status()
            return resp.content
        except Exception as exc:  # noqa: BLE001 - retry transient failures
            last_error = exc
    raise RuntimeError(f"Failed to download {url}: {last_error}")


def _pick_asset(assets: list[dict], qual_kw: str, token: str) -> dict | None:
    candidates = [a for a in assets if qual_kw in a["title"]]
    for asset in candidates:
        if token in asset["title"]:
            return asset
    return candidates[0] if candidates else None


def _normalize_ial_code(code: str) -> str:
    code = code.strip()
    if " " in code:
        return code.split()[0]
    return re.sub(r"^([A-Z]{3}\d{2})[A-Z]?$", r"\1", code)


def _verify_pearson_ial(guide_rows: list[dict], official_rows: list[dict]) -> None:
    official = {
        (_normalize_ial_code(r["componentCode"]), r["date"]) for r in official_rows
    }
    mismatches = [
        f"{r['componentCode']} -> {r['date']}"
        for r in guide_rows
        if (_normalize_ial_code(r["componentCode"]), r["date"]) not in official
    ]
    if mismatches:
        print(
            "WARNING pearson: IAL rows not found in official timetable: "
            + ", ".join(mismatches[:10]),
            file=sys.stderr,
        )
    else:
        print(
            f"pearson ial verified: {len(guide_rows)} rows match official timetable"
        )


def _merge_pearson_official(
    guide_rows: list[dict],
    meta: dict,
    season: str,
    session: requests.Session,
    cache_dir: Path,
    offline: bool,
) -> list[dict]:
    """Add Pearson IGCSE from the official timetable and verify IAL dates."""
    html = fetch_html(PEARSON_TIMETABLES_URL)
    assets = find_pearson_timetable_assets(html)
    year_match = re.search(r"20\d{2}", season)
    year = year_match.group(0) if year_match else "2026"
    ial_asset = _pick_asset(assets, "International A Level", f"October {year}")
    igcse_asset = _pick_asset(assets, "International GCSE", f"November {year}")

    merged = list(guide_rows)
    if igcse_asset:
        xlsx = _cached_or_download(igcse_asset["url"], session, cache_dir, offline)
        ig_rows = pearson_official.parse_rows(xlsx, level="IG")
        for row in ig_rows:
            row["sourcePdf"] = igcse_asset["url"]
        merged.extend(ig_rows)
        meta["sources"]["pearson"]["igcseTimetable"] = igcse_asset["url"]
        print(f"pearson igcse: {len(ig_rows)} rows ({igcse_asset['title']})")
    else:
        print(
            "WARNING pearson: no International GCSE timetable asset found",
            file=sys.stderr,
        )

    if ial_asset:
        xlsx = _cached_or_download(ial_asset["url"], session, cache_dir, offline)
        ial_rows = pearson_official.parse_rows(xlsx, level=None)
        meta["sources"]["pearson"]["ialTimetable"] = ial_asset["url"]
        _verify_pearson_ial(guide_rows, ial_rows)
    return merged


def _cached_or_download(
    url: str, session: requests.Session, cache_dir: Path, offline: bool
) -> str:
    name = url.rsplit("/", 1)[-1]
    path = cache_dir / name
    if offline and path.exists():
        return str(path)
    return _download_asset(url, session, cache_dir)


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
        "stale": {},
    }
    existing_by_board: dict[str, list[dict]] = {}
    existing_meta: dict = {}
    existing_path = DATA_DIR / "exams.json"
    meta_path = DATA_DIR / "meta.json"
    if existing_path.exists():
        try:
            for row in json.loads(existing_path.read_text(encoding="utf-8")):
                existing_by_board.setdefault(row["board"], []).append(row)
        except Exception as exc:  # noqa: BLE001 - corrupted cache is not fatal
            print(
                f"WARNING: could not read existing exams.json ({exc})",
                file=sys.stderr,
            )
    if meta_path.exists():
        try:
            existing_meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            print(
                f"WARNING: could not read existing meta.json ({exc})",
                file=sys.stderr,
            )

    no_data: list[str] = []

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
                try:
                    pdf_path.write_bytes(_download_with_retry(guide_url, session))
                except Exception as exc:  # noqa: BLE001 - reuse cache if possible
                    if not pdf_path.exists():
                        raise
                    print(
                        f"WARNING {board}: download failed ({exc}); reusing cached PDF",
                        file=sys.stderr,
                    )
            season = extract_season(board, pdf_path)
            meta["season"][board] = season
            rows = PARSERS[board](str(pdf_path))
            if board == "pearson":
                rows = _merge_pearson_official(
                    rows,
                    meta,
                    season,
                    session,
                    CACHE_DIR.parent / "pearson",
                    args.offline,
                )
            for row in rows:
                row["levelGroup"] = level_group(row["board"], row["level"])
            for row in rows:
                if not row.get("sourcePdf"):
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
        except Exception as exc:  # noqa: BLE001 - fall back to previous data
            if board in existing_by_board:
                all_rows.extend(existing_by_board[board])
                meta["stale"][board] = True
                meta["season"][board] = existing_meta.get("season", {}).get(board, "")
                meta["sources"][board] = existing_meta.get("sources", {}).get(
                    board, {"page": config["page_url"]}
                )
                print(
                    f"WARNING {board}: {exc}; reusing previously synced data",
                    file=sys.stderr,
                )
            else:
                no_data.append(f"{board}: {exc}")
                print(f"ERROR {board}: {exc}", file=sys.stderr)

    if no_data:
        print(
            f"Sync failed for {len(no_data)} board(s) with no data at all.",
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
    stale = [b for b, is_stale in meta["stale"].items() if is_stale]
    suffix = f" (stale: {', '.join(stale)})" if stale else ""
    print(f"Wrote {len(all_rows)} rows to {DATA_DIR / 'exams.json'}{suffix}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
