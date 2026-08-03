"""Board definitions and page-fetching helpers for British Council exam guides."""
from __future__ import annotations

import re

import requests

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

BOARDS = {
    "cambridge": {
        "page_url": "https://www.britishcouncil.cn/exams/school/Cambridge%20International",
        "name_zh": "剑桥国际",
    },
    "oxfordaqa": {
        "page_url": "https://www.britishcouncil.cn/exams/school/oxford-international-aqa-examinations",
        "name_zh": "牛津AQA",
    },
    "pearson": {
        "page_url": "https://www.britishcouncil.cn/exams/school/pearson",
        "name_zh": "培生爱德思",
    },
}

PDF_ANCHOR_RE = re.compile(
    r'<a[^>]+href="(?P<href>[^"]+\.pdf[^"]*)"[^>]*>(?P<text>.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
TAG_RE = re.compile(r"<[^>]+>")
GUIDE_KEYWORDS = ("报名指南", "registration", "bao_ming_zhi_nan")

PEARSON_TIMETABLES_URL = (
    "https://qualifications.pearson.com/en/support/"
    "support-topics/exams/exam-timetables.html"
)
PEARSON_ASSET_TITLE_RE = re.compile(
    r'<span class= "hiddenAssetTitle">\s*([^<]+)</span>'
)
PEARSON_ASSET_URL_RE = re.compile(
    r'<span class= "hiddenAssetUrl">\s*([^<]+)</span>'
)
PEARSON_ASSET_EXT_RE = re.compile(
    r'<span class= "hiddenAssetExtension">\s*([^<]+)</span>'
)


def fetch_html(page_url: str) -> str:
    """Fetch a board page with up to 3 attempts."""
    last_error: Exception | None = None
    for _ in range(3):
        try:
            resp = requests.get(
                page_url, headers={"User-Agent": USER_AGENT}, timeout=60
            )
            resp.raise_for_status()
            return resp.text
        except Exception as exc:  # noqa: BLE001 - retry any network failure
            last_error = exc
    raise RuntimeError(f"Failed to fetch {page_url}: {last_error}")


def _anchor_text(fragment: str) -> str:
    return TAG_RE.sub("", fragment).replace("&amp;", "&").strip()


def find_guide_pdf_urls(html: str) -> list[str]:
    """Find registration-guide PDF URLs in a board page's HTML."""
    found: list[str] = []
    for match in PDF_ANCHOR_RE.finditer(html):
        href = match.group("href")
        text = _anchor_text(match.group("text"))
        if not any(kw in f"{href} {text}" for kw in GUIDE_KEYWORDS):
            continue
        url = href.split("?")[0]
        if not url.startswith("http"):
            url = "https://www.britishcouncil.cn" + url
        if url not in found:
            found.append(url)
    return found


def find_pearson_timetable_assets(html: str) -> list[dict]:
    """Extract downloadable XLSX timetable assets from the Pearson page."""
    titles = PEARSON_ASSET_TITLE_RE.findall(html)
    urls = PEARSON_ASSET_URL_RE.findall(html)
    exts = PEARSON_ASSET_EXT_RE.findall(html)
    count = min(len(titles), len(urls), len(exts))
    assets: list[dict] = []
    for i in range(count):
        if exts[i].strip().lower() != "xlsx":
            continue
        assets.append(
            {
                "title": titles[i].strip(),
                "url": "https://qualifications.pearson.com" + urls[i].strip(),
            }
        )
    return assets
