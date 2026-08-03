# British Council 考试时间表 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 定时抓取 British Council 三个考局的报名指南 PDF,解析出标准化的考试时间表 JSON,并在现有 Astro 站点新增 `/exams` 页面:按考局/等级/科目筛选、搜索、勾选并导出个人 Excel。

**Architecture:** Python 同步脚本(`scripts/sync_exams.py`)抓取三个考局页面 → 识别"报名指南" PDF → 下载到 `.cache/exams/` → 三个考局专属解析器(`scripts/parsers/`)用 pdfplumber 解析 → 校验后写入 `src/data/exams.json` + `meta.json`。Astro 构建 `/exams` 页面读取 JSON,浏览器端用纯 TS 模块做筛选/勾选,SheetJS 生成 .xlsx。

**Tech Stack:** Python 3 + pdfplumber + requests + pytest;Astro 5 + TypeScript + Tailwind/DaisyUI;SheetJS (`xlsx` npm 包);GitHub Actions 定时同步。

---

## File Structure

| 文件 | 职责 |
|---|---|
| `scripts/requirements.txt` | Python 依赖清单 |
| `scripts/board_config.py` | 考局元数据、页面抓取、PDF 链接识别 |
| `scripts/parsers/__init__.py` | 解析器包标记(空文件) |
| `scripts/parsers/common.py` | 时长/时间/日期/费用解析共用工具 |
| `scripts/parsers/pearson.py` | 培生爱德思 IAL 时间表解析 |
| `scripts/parsers/cambridge.py` | 剑桥 AS/A Level + IGCSE 时间表解析 |
| `scripts/parsers/oxfordaqa.py` | 牛津AQA AS/A-Level + IGCSE 时间表解析 |
| `scripts/sync_exams.py` | 同步入口:抓取→下载→解析→校验→写 JSON |
| `scripts/make_fixtures.py` | 从缓存 PDF 裁剪时间表页生成测试夹具 |
| `tests/conftest.py` | pytest 路径配置 |
| `tests/fixtures/*.pdf` | 裁剪后的时间表页 PDF(入库) |
| `tests/test_board_config.py` | PDF 链接识别测试 |
| `tests/test_common.py` | 共用解析工具测试 |
| `tests/test_pearson.py` / `test_cambridge.py` / `test_oxfordaqa.py` | 三个解析器测试 |
| `tests/test_sync_exams.py` | 行校验测试 |
| `src/data/exams.json` / `meta.json` | 同步产物,构建时读取(入库) |
| `src/scripts/types.ts` | ExamRow / MetaData 类型 |
| `src/scripts/excel.ts` | SheetJS 导出模块 |
| `src/scripts/exams-app.ts` | 前端筛选/勾选/导出交互 |
| `src/components/exams/ExamTimetable.astro` | 时间表组件(静态骨架 + 数据注入) |
| `src/pages/exams.astro` | `/exams` 页面 |
| `.github/workflows/sync-exams.yml` | 每日定时同步工作流 |

## Prerequisite:Python 依赖

本机使用 Codex 桌面自带运行时 Python(已含 pdfplumber/pypdf)。先补齐 requests 和 pytest:

- [ ] **Step 1: 安装依赖**

```powershell
$py = 'C:\Users\91219\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $py -m pip install requests pytest
```

Expected: `Successfully installed requests ... pytest ...`

---

### Task 1: 脚手架与测试夹具

**Files:**
- Create: `scripts/requirements.txt`
- Create: `scripts/parsers/__init__.py`
- Create: `tests/conftest.py`
- Create: `scripts/make_fixtures.py`
- Modify: `.gitignore`

- [ ] **Step 1: 创建 `scripts/requirements.txt`**

```text
pdfplumber>=0.11.0
requests>=2.31.0
pypdf>=4.0.0
pytest>=8.0.0
```

- [ ] **Step 2: 创建 `scripts/parsers/__init__.py`(空文件)与 `tests/conftest.py`**

```python
# tests/conftest.py
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

FIXTURES = Path(__file__).resolve().parent / "fixtures"
```

- [ ] **Step 3: 修改 `.gitignore`,追加缓存目录**

```gitignore
# pdf cache for the exam timetable sync
.cache/
```

- [ ] **Step 4: 下载三份报名指南 PDF 到 `.cache/exams/`**

```powershell
$cache = 'E:\Documents\Coding\Lawrence1305.github.io\.cache\exams'
New-Item -ItemType Directory -Force -Path $cache | Out-Null
$base = 'https://cn.live.solas.britishcouncil.digital/sites/default/files/'
curl.exe -sL --max-time 120 -A "Mozilla/5.0" "$($base)b2c-pei_sheng_ai_de_si_kao_shi_bao_ming_zhi_nan_-on2026.pdf" -o "$cache\b2c-pei_sheng_ai_de_si_kao_shi_bao_ming_zhi_nan_-on2026.pdf"
curl.exe -sL --max-time 120 -A "Mozilla/5.0" "$($base)b2c_niu_jin_aqakao_shi_bao_ming_zhi_nan__0.pdf" -o "$cache\b2c_niu_jin_aqakao_shi_bao_ming_zhi_nan__0.pdf"
curl.exe -sL --max-time 120 -A "Mozilla/5.0" "$($base)b2c_jian_qiao_guo_ji_kao_shi_ge_ren_kao_sheng_bao_ming_zhi_nan_octnov_2026_0.pdf" -o "$cache\b2c_jian_qiao_guo_ji_kao_shi_ge_ren_kao_sheng_bao_ming_zhi_nan_octnov_2026_0.pdf"
Get-ChildItem $cache | Select-Object Name, Length
```

Expected: 三个文件,各 1.5–2.5 MB。

- [ ] **Step 5: 创建 `scripts/make_fixtures.py` 并运行**

```python
"""Clip timetable pages from cached guides into test fixtures."""
from pathlib import Path

from pypdf import PdfReader, PdfWriter

CACHE = Path(__file__).resolve().parent.parent / ".cache" / "exams"
FIXTURES = Path(__file__).resolve().parent.parent / "tests" / "fixtures"

CLIPS = {
    "pearson_timetable.pdf": (
        "b2c-pei_sheng_ai_de_si_kao_shi_bao_ming_zhi_nan_-on2026.pdf",
        [16],
    ),
    "cambridge_timetable.pdf": (
        "b2c_jian_qiao_guo_ji_kao_shi_ge_ren_kao_sheng_bao_ming_zhi_nan_octnov_2026_0.pdf",
        list(range(16, 23)),
    ),
    "oxfordaqa_timetable.pdf": (
        "b2c_niu_jin_aqakao_shi_bao_ming_zhi_nan__0.pdf",
        list(range(15, 18)),
    ),
}


def main() -> None:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    for out_name, (src_name, pages) in CLIPS.items():
        reader = PdfReader(CACHE / src_name)
        writer = PdfWriter()
        for page_no in pages:
            writer.add_page(reader.pages[page_no - 1])
        with open(FIXTURES / out_name, "wb") as fh:
            writer.write(fh)
        print(f"wrote {FIXTURES / out_name}")


if __name__ == "__main__":
    main()
```

```powershell
$py = 'C:\Users\91219\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $py scripts\make_fixtures.py
Get-ChildItem tests\fixtures | Select-Object Name, Length
```

Expected: 三个 fixture PDF 写入 `tests/fixtures/`(总大小明显小于原 PDF)。

- [ ] **Step 6: Commit**

```bash
git add .gitignore scripts/requirements.txt scripts/parsers/__init__.py scripts/make_fixtures.py tests/conftest.py tests/fixtures/
git commit -m "chore: scaffold exam timetable sync scripts and test fixtures"
```

---

### Task 2: 考局配置与 PDF 链接识别

**Files:**
- Create: `scripts/board_config.py`
- Test: `tests/test_board_config.py`

- [ ] **Step 1: 写失败测试**

```python
# tests/test_board_config.py
from board_config import BOARDS, find_guide_pdf_urls

SAMPLE_HTML = """
<html><body>
<a href="https://cn.live.solas.britishcouncil.digital/sites/default/files/b2c-guide-2026.pdf?utm=1&_gl=2" target="_blank">
  <strong><em>剑桥国际考试报名指南</em></strong>
</a>
<a href="https://cn.live.solas.britishcouncil.digital/sites/default/files/results-guide.pdf">
  《考试成绩指引》
</a>
<a href="https://www.britishcouncil.cn/sites/default/files/notice.pdf">考前须知</a>
</body></html>
"""


def test_boards_configured():
    assert set(BOARDS) == {"cambridge", "oxfordaqa", "pearson"}


def test_finds_only_guide_pdfs():
    urls = find_guide_pdf_urls(SAMPLE_HTML)
    assert urls == [
        "https://cn.live.solas.britishcouncil.digital/sites/default/files/b2c-guide-2026.pdf"
    ]
```

- [ ] **Step 2: 运行测试确认失败**

```powershell
$py = 'C:\Users\91219\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $py -m pytest tests\test_board_config.py -v
```

Expected: `FAILED ... ImportError: cannot import name 'find_guide_pdf_urls'`

- [ ] **Step 3: 实现 `scripts/board_config.py`**

```python
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
```

- [ ] **Step 4: 运行测试确认通过**

```powershell
& $py -m pytest tests\test_board_config.py -v
```

Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add scripts/board_config.py tests/test_board_config.py
git commit -m "feat: add board config and registration guide link extraction"
```

---

### Task 3: 共用解析工具

**Files:**
- Create: `scripts/parsers/common.py`
- Test: `tests/test_common.py`

- [ ] **Step 1: 写失败测试**

```python
# tests/test_common.py
import pytest

from parsers.common import parse_date, parse_duration, parse_time


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
```

- [ ] **Step 2: 运行测试确认失败**

```powershell
& $py -m pytest tests\test_common.py -v
```

Expected: `FAILED ... ModuleNotFoundError: No module named 'parsers.common'`

- [ ] **Step 3: 实现 `scripts/parsers/common.py`**

```python
"""Shared parsing helpers for exam timetable rows."""
from __future__ import annotations

import re
from datetime import datetime

DURATION_PATTERN = r"(?:(?:\d+h(?:\s*\d{1,2}m)?)|\d{1,2}m)"
DURATION_RE = re.compile(
    r"(?:(?P<h>\d+)h(?:\s*(?P<m>\d{1,2})m)?|(?P<m2>\d{1,2})m)"
)
TIME_RE = re.compile(r"(\d{1,2}):(\d{2})")


def parse_duration(text: str) -> str:
    """Normalize '3h 00m' -> '3h', '1h 30m' -> '1h30m', '45m' -> '45m'."""
    match = DURATION_RE.search(text)
    if not match:
        raise ValueError(f"Cannot parse duration: {text!r}")
    hours = int(match.group("h") or 0)
    minutes = int(match.group("m") or match.group("m2") or 0)
    if hours and minutes:
        return f"{hours}h{minutes:02d}m"
    if hours:
        return f"{hours}h"
    return f"{minutes}m"


def parse_time(text: str) -> str:
    """Normalize '8:45' -> '08:45'."""
    match = TIME_RE.search(text)
    if not match:
        raise ValueError(f"Cannot parse time: {text!r}")
    return f"{int(match.group(1)):02d}:{match.group(2)}"


def parse_date(text: str, fmt: str) -> str:
    """Parse a date string and return ISO yyyy-mm-dd."""
    return datetime.strptime(text.strip(), fmt).strftime("%Y-%m-%d")


def clean_fee(text: str) -> float | None:
    """Strip thousands separators; return None for empty input."""
    return float(text.replace(",", "")) if text else None
```

- [ ] **Step 4: 运行测试确认通过**

```powershell
& $py -m pytest tests\test_common.py -v
```

Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add scripts/parsers/common.py tests/test_common.py
git commit -m "feat: add shared duration/time/date parsing helpers"
```

---

### Task 4: 培生爱德思解析器

**Files:**
- Create: `scripts/parsers/pearson.py`
- Test: `tests/test_pearson.py`

参考真实行数据(来自 2026 Oct/Nov IAL 表):

```text
WBI11A Unit 1: Molecules, Diet, Transport and Health 1h 30m 12 October 2026 16:00 985.18 2067.30
XAC11 (Cash-in AS 合并AS成绩): WAC11 - 182.31
```

- [ ] **Step 1: 写失败测试**

```python
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
```

- [ ] **Step 2: 运行测试确认失败**

```powershell
$py = 'C:\Users\91219\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $py -m pytest tests\test_pearson.py -v
```

Expected: `FAILED ... ModuleNotFoundError: No module named 'parsers.pearson'`

- [ ] **Step 3: 实现 `scripts/parsers/pearson.py`**

```python
"""Parse the Pearson Edexcel IAL exam information sheet."""
from __future__ import annotations

import re

import pdfplumber

from .common import DURATION_PATTERN, parse_date, parse_duration, parse_time

UNIT_LINE_RE = re.compile(
    r"^(?P<code>[A-Z]{3}\d{2}[A-Z]?)\s+"
    r"(?P<title>.+?)\s+"
    rf"(?P<duration>{DURATION_PATTERN})\s+"
    r"(?P<date>\d{1,2} [A-Z][a-z]+ \d{4})\s+"
    r"(?P<time>\d{1,2}:\d{2})\s+"
    r"[\d,]+\.\d{2}\s+"
    r"[\d,]+\.\d{2}$"
)
CODE_START_RE = re.compile(r"^[A-Z]{3}\d{2}[A-Z]?")
CASHIN_RE = re.compile(r"^[XY][A-Z]{2,3}\d{2}\b.*\(Cash-in", re.IGNORECASE)
SUBJECT_RE = re.compile(r"^[A-Za-z][A-Za-z &()'-]{2,}$")
NON_SUBJECT_HINTS = (
    "exam information", "pearson edexcel", "exam", "registration",
    "standard", "late stage", "access", "other", "rmb", "fee", "unit",
    "candidate", "information sheet", "考试", "报名", "人民币", "含税",
    "table",
)


def _is_subject_header(line: str) -> bool:
    if not SUBJECT_RE.match(line):
        return False
    low = line.lower()
    return not any(hint in low for hint in NON_SUBJECT_HINTS)


def parse_rows(pdf_path: str) -> list[dict]:
    rows: list[dict] = []
    subject = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            lines = [
                " ".join(line.split())
                for line in (page.extract_text() or "").splitlines()
            ]
            i = 0
            while i < len(lines):
                line = lines[i]
                i += 1
                if not line:
                    continue
                if CASHIN_RE.match(line) or line.startswith("*"):
                    continue
                if _is_subject_header(line):
                    subject = line
                    continue
                match = UNIT_LINE_RE.match(line)
                if not match and CODE_START_RE.match(line) and i < len(lines):
                    # 单元标题可能换行,拼下一行重试一次
                    match = UNIT_LINE_RE.match(line + " " + lines[i])
                    if match:
                        i += 1
                if not match:
                    continue
                g = match.groupdict()
                rows.append(
                    {
                        "board": "pearson",
                        "level": None,
                        "syllabusCode": "",
                        "subject": subject,
                        "optionCode": "",
                        "componentCode": g["code"],
                        "componentTitle": g["title"],
                        "duration": parse_duration(g["duration"]),
                        "date": parse_date(g["date"], "%d %B %Y"),
                        "startTime": parse_time(g["time"]),
                        "sourcePdf": "",
                    }
                )
    return rows
```

- [ ] **Step 4: 运行测试确认通过**

```powershell
& $py -m pytest tests\test_pearson.py -v
```

Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add scripts/parsers/pearson.py tests/test_pearson.py
git commit -m "feat: add pearson edexcel timetable parser"
```

---

### Task 5: 剑桥解析器

**Files:**
- Create: `scripts/parsers/cambridge.py`
- Test: `tests/test_cambridge.py`

参考真实行数据(AS & A Level 表 + IGCSE 表):

```text
Syllabus name & Code: 9618 Computer Science
A 9618AY 12, 22, 32, 42 4933.70 5992.12 9618/12 Theory Fundamentals 12 1h 30m 09 October 2026 12:45
A2 9709DC 35, 55, 82 2987.00 4045.42 9709/35 Pure Mathematics 3 (35) 1h 50m 21 October 2026 8:45
IGCSE 0625GY 12, 32, 62 (Core) 3079.70 4138.12 0625/22 Multiple Choice (Extended) 22 45m 05 November 2026 12:45
0625/42 Theory (Extended) 42 1h 15m 07 October 2026 12:45
```

- [ ] **Step 1: 写失败测试**

```python
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
```

- [ ] **Step 2: 运行测试确认失败**

```powershell
$py = 'C:\Users\91219\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $py -m pytest tests\test_cambridge.py -v
```

Expected: `FAILED ... ModuleNotFoundError: No module named 'parsers.cambridge'`

- [ ] **Step 3: 实现 `scripts/parsers/cambridge.py`**

```python
"""Parse the Cambridge International exam information sheets."""
from __future__ import annotations

import re

import pdfplumber

from .common import DURATION_PATTERN, parse_date, parse_duration, parse_time

SYLLABUS_RE = re.compile(
    r"^Syllabus name[& ]+Code:\s*(\d{4})\s+(.+)$", re.IGNORECASE
)

OPTION_RE = re.compile(
    r"^(?P<level>A2|AS|IGCSE|A|O)\s+"
    r"(?P<option>\d{4}[A-Z]{1,2})\s+"
    r"(?P<included>[\d,\s]+(?:\([^)]*\))?)\s+"
    r"(?P<fee_std>[\d,]+\.\d{2})\s+"
    r"(?P<fee_late>[\d,]+\.\d{2})"
)

COMPONENT_RE = re.compile(
    r"(?P<code>\d{4}/\d{2})\s+"
    r"(?P<title>.+?)\s+(?:\d{1,2}\s+)?"
    rf"(?P<duration>{DURATION_PATTERN})\s+"
    r"(?P<date>\d{1,2} [A-Z][a-z]+ \d{4})\s+"
    r"(?P<time>\d{1,2}:\d{2})$",
    re.IGNORECASE,
)

LEVEL_MAP = {"A": "A", "A2": "A2", "AS": "AS", "IGCSE": "IG", "O": "IG"}
CARRIED_FORWARD_RE = re.compile(
    r"^\d{2}\s+\w+ \d{4}\s+AS Mark", re.IGNORECASE
)
SKIP_STARTS = ("*", "/", "同考季", "Candidates may")


def _row(syllabus: dict, option: dict, component: re.Match) -> dict:
    g = component.groupdict()
    return {
        "board": "cambridge",
        "level": option["level"],
        "syllabusCode": syllabus["code"],
        "subject": syllabus["name"],
        "optionCode": option["optionCode"],
        "componentCode": g["code"],
        "componentTitle": g["title"],
        "duration": parse_duration(g["duration"]),
        "date": parse_date(g["date"], "%d %B %Y"),
        "startTime": parse_time(g["time"]),
        "sourcePdf": "",
    }


def parse_rows(pdf_path: str) -> list[dict]:
    rows: list[dict] = []
    syllabus: dict | None = None
    option: dict | None = None

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            for raw_line in (page.extract_text() or "").splitlines():
                line = " ".join(raw_line.split())
                if not line:
                    continue
                match = SYLLABUS_RE.match(line)
                if match:
                    name = re.sub(
                        r"\s*Detailed Component Information.*$",
                        "",
                        match.group(2),
                        flags=re.IGNORECASE,
                    ).strip()
                    syllabus = {"code": match.group(1), "name": name}
                    option = None
                    continue
                match = OPTION_RE.match(line)
                if match:
                    option = {
                        "level": LEVEL_MAP[match.group("level")],
                        "optionCode": match.group("option"),
                    }
                    remainder = line[match.end():].strip()
                    component = COMPONENT_RE.match(remainder)
                    if component and syllabus:
                        rows.append(_row(syllabus, option, component))
                    continue
                component = COMPONENT_RE.match(line)
                if not component and line.startswith(SKIP_STARTS):
                    # 部分试卷行与注释(如同考季限制)在同一行,需在行内查找
                    component = COMPONENT_RE.search(line)
                if component and syllabus and option:
                    rows.append(_row(syllabus, option, component))
    return rows
```

- [ ] **Step 4: 运行测试确认通过**

```powershell
& $py -m pytest tests\test_cambridge.py -v
```

Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add scripts/parsers/cambridge.py tests/test_cambridge.py
git commit -m "feat: add cambridge international timetable parser"
```

---

### Task 6: 牛津AQA 解析器

**Files:**
- Create: `scripts/parsers/oxfordaqa.py`
- Test: `tests/test_oxfordaqa.py`

参考真实行数据(AS/A-Level 表 + IGCSE 表):

```text
Biology
BL01 Unit 1: The Diversity of Living Organisms 1 1h 30m 6-May-2026 15:00 1,184.50 2,369.00
9201/1 Paper 1: Biology 1h 30m 14-May-2026 15:00
9201 2,060.00 3,553.50
9201/2 Paper 2: Biology 1h 30m 1-Jun-2026 15:00
9221 9221 Written Paper 1h 45m 27-Apr-2026 15:00 1,246.30 2,492.60
```

- [ ] **Step 1: 写失败测试**

```python
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
```

- [ ] **Step 2: 运行测试确认失败**

```powershell
$py = 'C:\Users\91219\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $py -m pytest tests\test_oxfordaqa.py -v
```

Expected: `FAILED ... ModuleNotFoundError: No module named 'parsers.oxfordaqa'`

- [ ] **Step 3: 实现 `scripts/parsers/oxfordaqa.py`**

```python
"""Parse the OxfordAQA exam information sheets (AS/A-Level + IGCSE)."""
from __future__ import annotations

import re

import pdfplumber

from .common import DURATION_PATTERN, parse_date, parse_duration, parse_time

ALEVEL_ROW_RE = re.compile(
    r"^(?P<option>[A-Z]{2}\d{2})\s+"
    r"(?P<title>.+?)\s+"
    r"(?P<level>[12])\s+"
    rf"(?P<duration>{DURATION_PATTERN})\s+"
    r"(?P<date>\d{1,2}-[A-Z][a-z]{2}-\d{4})\s+"
    r"(?P<time>\d{1,2}:\d{2})\s+"
    r"[\d,]+\.\d{2}\s+"
    r"[\d,]+\.\d{2}$"
)

# IGCSE: 组合编码 + 试卷编码 + 名称 在同一行(如 9204C 9204/CC Paper 2: ...)
IG_INLINE_RE = re.compile(
    r"^(?P<option>\d{4}[A-Z]?)\s+"
    r"(?P<code>\d{4}/[A-Z0-9]+)\s+"
    r"(?P<title>.+?)\s+"
    rf"(?P<duration>{DURATION_PATTERN})\s+"
    r"(?P<date>\d{1,2}-[A-Z][a-z]{2}-\d{4})\s+"
    r"(?P<time>\d{1,2}:\d{2})(?:\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2})?$"
)

# IGCSE CORE: 组合编码 + 单元编码 + 名称 + 内联费用(如 9221 9221 Written Paper ...)
CORE_ROW_RE = re.compile(
    r"^(?P<option>\d{4})\s+"
    r"(?P<unit>\d{4})\s+"
    r"(?P<title>.+?)\s+"
    rf"(?P<duration>{DURATION_PATTERN})\s+"
    r"(?P<date>\d{1,2}-[A-Z][a-z]{2}-\d{4})\s+"
    r"(?P<time>\d{1,2}:\d{2})\s+"
    r"[\d,]+\.\d{2}\s+"
    r"[\d,]+\.\d{2}$"
)

# IGCSE 标准行: 试卷编码 + 名称(如 9201/1 Paper 1: Biology ...)
IG_COMPONENT_RE = re.compile(
    r"^(?P<code>\d{4}/[A-Z0-9]+)\s+"
    r"(?P<title>.+?)\s+"
    rf"(?P<duration>{DURATION_PATTERN})\s+"
    r"(?P<date>\d{1,2}-[A-Z][a-z]{2}-\d{4})\s+"
    r"(?P<time>\d{1,2}:\d{2})(?:\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2})?$"
)

# IGCSE 标题拆分行: 试卷编码 + 时长/日期/时间,名称在相邻行(如 9225/1 2h ...)
IG_NO_TITLE_RE = re.compile(
    r"^(?P<code>\d{4}/[A-Z0-9]+)\s+"
    rf"(?P<duration>{DURATION_PATTERN})\s+"
    r"(?P<date>\d{1,2}-[A-Z][a-z]{2}-\d{4})\s+"
    r"(?P<time>\d{1,2}:\d{2})$"
)

# IGCSE 费用行: 组合编码 + 两个价格(组合编码可带字母后缀,如 9260C)
IG_FEE_RE = re.compile(
    r"^(?P<option>\d{4}[A-Z]?)\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}$"
)

TITLE_FRAGMENT_RE = re.compile(r"^Paper \d:")
LEVEL_MAP = {"1": "AS", "2": "A2"}
SKIP_RE = re.compile(
    r"^\d{4}\s*\(合并|The following combinations|同考季内不能|Candidates may"
)

SUBJECT_RE = re.compile(r"^[A-Za-z][A-Za-z &()'-]{2,}$")
NON_SUBJECT_HINTS = (
    "exam timetable", "pricing", "registration", "standard", "late stage",
    "access", "other access", "rmb", "fee", "unit", "option", "duration",
    "test date", "starting", "series:", "candidates", "考试", "报名",
    "人民币", "含税",
)


def _is_subject_header(line: str) -> bool:
    if not SUBJECT_RE.match(line):
        return False
    low = line.lower()
    return not any(hint in low for hint in NON_SUBJECT_HINTS)


def _is_title_fragment(line: str) -> bool:
    return _is_subject_header(line)


def _append_row(rows: list[dict], subject: str, option: str, level: str,
                code: str, title: str, duration: str, date: str, time: str) -> None:
    rows.append(
        {
            "board": "oxfordaqa",
            "level": level,
            "syllabusCode": "",
            "subject": subject,
            "optionCode": option,
            "componentCode": code,
            "componentTitle": title,
            "duration": duration,
            "date": date,
            "startTime": time,
            "sourcePdf": "",
        }
    )


def parse_rows(pdf_path: str) -> list[dict]:
    rows: list[dict] = []
    subject = ""
    option: dict | None = None
    pending_title = ""

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            lines = [
                " ".join(line.split())
                for line in (page.extract_text() or "").splitlines()
            ]
            i = 0
            while i < len(lines):
                line = lines[i]
                i += 1
                if not line or SKIP_RE.match(line):
                    continue

                match = ALEVEL_ROW_RE.match(line)
                if match:
                    g = match.groupdict()
                    _append_row(
                        rows, subject, g["option"], LEVEL_MAP[g["level"]],
                        g["option"], g["title"], parse_duration(g["duration"]),
                        parse_date(g["date"], "%d-%b-%Y"), parse_time(g["time"]),
                    )
                    continue

                match = IG_INLINE_RE.match(line)
                if match:
                    g = match.groupdict()
                    _append_row(
                        rows, subject, g["option"], "IG", g["code"], g["title"],
                        parse_duration(g["duration"]),
                        parse_date(g["date"], "%d-%b-%Y"), parse_time(g["time"]),
                    )
                    continue

                match = CORE_ROW_RE.match(line)
                if match:
                    g = match.groupdict()
                    _append_row(
                        rows, subject, g["option"], "IG", g["unit"], g["title"],
                        parse_duration(g["duration"]),
                        parse_date(g["date"], "%d-%b-%Y"), parse_time(g["time"]),
                    )
                    continue

                match = IG_COMPONENT_RE.match(line)
                if match:
                    g = match.groupdict()
                    _append_row(
                        rows, subject, (option or {}).get("optionCode", ""),
                        "IG", g["code"], g["title"], parse_duration(g["duration"]),
                        parse_date(g["date"], "%d-%b-%Y"), parse_time(g["time"]),
                    )
                    continue

                match = IG_NO_TITLE_RE.match(line)
                if match:
                    g = match.groupdict()
                    title = pending_title
                    if i < len(lines) and _is_title_fragment(lines[i]):
                        title = f"{title} {lines[i]}".strip()
                        i += 1
                    _append_row(
                        rows, subject, (option or {}).get("optionCode", ""),
                        "IG", g["code"], title or g["code"],
                        parse_duration(g["duration"]),
                        parse_date(g["date"], "%d-%b-%Y"), parse_time(g["time"]),
                    )
                    pending_title = ""
                    continue

                match = IG_FEE_RE.match(line)
                if match:
                    option = {"optionCode": match.group("option")}
                    pending_title = ""
                    continue

                if TITLE_FRAGMENT_RE.match(line):
                    pending_title = line
                    continue

                if _is_subject_header(line):
                    subject = line
                    option = None
                    pending_title = ""
                    continue
    return rows
```

- [ ] **Step 4: 运行测试确认通过**

```powershell
& $py -m pytest tests\test_oxfordaqa.py -v
```

Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add scripts/parsers/oxfordaqa.py tests/test_oxfordaqa.py
git commit -m "feat: add oxfordaqa timetable parser"
```

---

### Task 7: 同步入口与数据校验

**Files:**
- Create: `scripts/sync_exams.py`
- Test: `tests/test_sync_exams.py`

- [ ] **Step 1: 写失败测试**

```python
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
```

- [ ] **Step 2: 运行测试确认失败**

```powershell
$py = 'C:\Users\91219\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $py -m pytest tests\test_sync_exams.py -v
```

Expected: `FAILED ... ModuleNotFoundError: No module named 'sync_exams'`

- [ ] **Step 3: 实现 `scripts/sync_exams.py`**

```python
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
        for page in pdf.pages[:5]:
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
```

- [ ] **Step 4: 运行测试确认通过**

```powershell
& $py -m pytest tests\test_sync_exams.py -v
```

Expected: `2 passed`

- [ ] **Step 5: 端到端运行同步,生成数据**

```powershell
& $py scripts\sync_exams.py
```

Expected: 三行 `cambridge: N rows (...)`、`oxfordaqa: N rows (...)`、`pearson: N rows (...)`,最后 `Wrote N rows to ...\src\data\exams.json`。

- [ ] **Step 6: 抽查产物**

```powershell
Get-Content src\data\meta.json
@'
import json
rows = json.load(open("src/data/exams.json", encoding="utf-8"))
print("total:", len(rows))
for b in ("cambridge", "oxfordaqa", "pearson"):
    sub = [r for r in rows if r["board"] == b]
    print(b, len(sub), "| levels:", sorted({r["level"] for r in sub}))
print("sample:", json.dumps(rows[0], ensure_ascii=False))
'@ | & $py -
```

Expected: 每个考局行数 > 0;剑桥含 `IG/AS/A2/A`,培生含 `None`;sample 字段完整。

- [ ] **Step 7: Commit**

```bash
git add scripts/sync_exams.py tests/test_sync_exams.py src/data/
git commit -m "feat: add exam timetable sync pipeline and generated data"
```

---

### Task 8: 前端依赖、类型与 Excel 导出模块

**Files:**
- Modify: `package.json`(npm install 自动更新)
- Create: `src/scripts/types.ts`
- Create: `src/scripts/excel.ts`

- [ ] **Step 1: 安装 SheetJS 并新增 sync 脚本**

```powershell
npm install xlsx@^0.18.5
```

然后手工把 `"sync": "python scripts/sync_exams.py"` 加进 `package.json` 的 `scripts`:

```json
"scripts": {
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "astro": "astro",
  "sync": "python scripts/sync_exams.py"
}
```

- [ ] **Step 2: 创建 `src/scripts/types.ts`**

```ts
export type Board = "cambridge" | "oxfordaqa" | "pearson";

export interface ExamRow {
  board: Board;
  level: "IG" | "AS" | "A2" | "A" | null;
  syllabusCode: string;
  subject: string;
  optionCode: string;
  componentCode: string;
  componentTitle: string;
  duration: string;
  date: string; // yyyy-mm-dd
  startTime: string; // HH:mm
  sourcePdf: string;
}

export interface MetaData {
  generatedAt: string;
  season: Partial<Record<Board, string>>;
  sources: Partial<Record<Board, { page: string; pdf: string }>>;
}
```

- [ ] **Step 3: 创建 `src/scripts/excel.ts`**

```ts
import * as XLSX from "xlsx";
import type { Board, ExamRow, MetaData } from "./types";

const BOARD_NAMES: Record<Board, string> = {
  cambridge: "剑桥国际",
  oxfordaqa: "牛津AQA",
  pearson: "培生爱德思",
};

export function exportToExcel(rows: ExamRow[], meta: MetaData): void {
  const season = seasonLabel(meta);
  const data = rows.map((r) => ({
    考局: BOARD_NAMES[r.board],
    等级: r.level ?? "",
    科目: r.subject,
    试卷编码: r.componentCode,
    试卷名称: r.componentTitle,
    考试日期: r.date,
    开考时间: r.startTime,
    时长: r.duration,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 },
    { wch: 8 },
    { wch: 24 },
    { wch: 14 },
    { wch: 40 },
    { wch: 12 },
    { wch: 10 },
    { wch: 8 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "考试时间表");
  XLSX.writeFile(wb, `my-exam-timetable-${season}.xlsx`);
}

function seasonLabel(meta: MetaData): string {
  const raw =
    meta.season?.cambridge || meta.season?.oxfordaqa || meta.season?.pearson || "";
  const safe = raw.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return safe || "current";
}
```

- [ ] **Step 4: 验证安装与类型文件存在**

```powershell
npm ls xlsx
Get-ChildItem src\scripts | Select-Object Name
```

Expected: `xlsx@0.18.x`;两个新文件存在。

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/scripts/types.ts src/scripts/excel.ts
git commit -m "feat: add exam timetable types and excel export module"
```

---

### Task 9: `/exams` 页面与前端交互

**Files:**
- Create: `src/scripts/exams-app.ts`
- Create: `src/components/exams/ExamTimetable.astro`
- Create: `src/pages/exams.astro`
- Modify: `src/components/Header.astro`

- [ ] **Step 1: 创建 `src/scripts/exams-app.ts`**

```ts
import { exportToExcel } from "./excel";
import type { Board, ExamRow, MetaData } from "./types";

const BOARD_ORDER: Board[] = ["cambridge", "oxfordaqa", "pearson"];
const BOARD_NAMES: Record<Board, string> = {
  cambridge: "剑桥国际",
  oxfordaqa: "牛津AQA",
  pearson: "培生爱德思",
};
const LEVELS = ["IG", "AS", "A2", "A"] as const;
const LEVEL_NAMES: Record<string, string> = {
  IG: "IG",
  AS: "AS",
  A2: "A2",
  A: "完整A Level",
};

interface AppState {
  board: Board;
  level: string; // "ALL" 或具体等级
  subject: string; // "" = 全部
  search: string;
  selected: Set<string>;
}

function rowId(r: ExamRow): string {
  return `${r.board}|${r.componentCode}|${r.date}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function initExamsApp(): void {
  const root = document.getElementById("exams-app");
  const dataEl = document.getElementById("exams-data");
  if (!root || !dataEl) return;
  const exams = JSON.parse(dataEl.textContent || "[]") as ExamRow[];
  const metaEl = document.getElementById("exams-meta");
  const meta = (metaEl ? JSON.parse(metaEl.textContent || "{}") : {}) as MetaData;

  const state: AppState = {
    board: "cambridge",
    level: "ALL",
    subject: "",
    search: "",
    selected: new Set(),
  };

  const boardTabs = root.querySelector<HTMLElement>("#board-tabs")!;
  const levelChips = root.querySelector<HTMLElement>("#level-chips")!;
  const subjectSelect = root.querySelector<HTMLSelectElement>("#subject-select")!;
  const searchInput = root.querySelector<HTMLInputElement>("#search-input")!;
  const selectVisibleBtn = root.querySelector<HTMLButtonElement>("#select-visible")!;
  const clearBtn = root.querySelector<HTMLButtonElement>("#clear-selection")!;
  const tbody = root.querySelector<HTMLElement>("#exam-table tbody")!;
  const resultCount = root.querySelector<HTMLElement>("#result-count")!;
  const selectedCount = root.querySelector<HTMLElement>("#selected-count")!;
  const selectedList = root.querySelector<HTMLElement>("#selected-list")!;
  const exportBtn = root.querySelector<HTMLButtonElement>("#export-excel")!;

  const filtered = (): ExamRow[] => {
    const q = state.search.trim().toLowerCase();
    return exams.filter((r) => {
      if (r.board !== state.board) return false;
      if (state.level !== "ALL" && (r.level ?? "") !== state.level) return false;
      if (state.subject && r.subject !== state.subject) return false;
      if (q) {
        const hay = `${r.subject} ${r.syllabusCode} ${r.componentCode} ${r.componentTitle}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  };

  const renderTabs = (): void => {
    boardTabs.innerHTML = BOARD_ORDER.map(
      (b) =>
        `<button type="button" class="tab ${b === state.board ? "tab-active" : ""}" data-board="${b}">${BOARD_NAMES[b]}</button>`
    ).join("");
    boardTabs.querySelectorAll<HTMLButtonElement>("[data-board]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.board = btn.dataset.board as Board;
        state.level = "ALL";
        state.subject = "";
        renderTabs();
        renderChips();
        renderSubjects();
        renderTable();
      });
    });
  };

  const renderChips = (): void => {
    levelChips.innerHTML =
      `<button type="button" class="btn btn-xs ${state.level === "ALL" ? "btn-primary" : "btn-ghost"}" data-level="ALL">全部</button>` +
      LEVELS.map(
        (l) =>
          `<button type="button" class="btn btn-xs ${state.level === l ? "btn-primary" : "btn-ghost"}" data-level="${l}">${LEVEL_NAMES[l]}</button>`
      ).join("");
    levelChips.querySelectorAll<HTMLButtonElement>("[data-level]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.level = btn.dataset.level!;
        renderChips();
        renderTable();
      });
    });
  };

  const renderSubjects = (): void => {
    const subjects = [
      ...new Set(exams.filter((r) => r.board === state.board).map((r) => r.subject)),
    ].sort();
    subjectSelect.innerHTML =
      `<option value="">全部科目</option>` +
      subjects
        .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
        .join("");
  };

  const renderTable = (): void => {
    const rows = filtered();
    resultCount.textContent = `共 ${rows.length} 场考试`;
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-base-content/50 py-8">无匹配的考试</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map((r) => {
        const checked = state.selected.has(rowId(r)) ? "checked" : "";
        return `<tr>
          <td class="whitespace-nowrap">${r.date}</td>
          <td class="whitespace-nowrap">${r.startTime}</td>
          <td>${escapeHtml(r.subject)}</td>
          <td class="whitespace-nowrap">${escapeHtml(r.componentCode)}</td>
          <td>${escapeHtml(r.componentTitle)}</td>
          <td class="whitespace-nowrap">${r.duration}</td>
          <td><input type="checkbox" class="checkbox checkbox-sm" data-id="${rowId(r)}" ${checked} /></td>
        </tr>`;
      })
      .join("");
  };

  const renderSelection = (): void => {
    selectedCount.textContent = String(state.selected.size);
    const selectedRows = exams.filter((r) => state.selected.has(rowId(r)));
    selectedList.innerHTML = selectedRows
      .slice()
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
      .map(
        (r) =>
          `<li class="flex justify-between gap-2"><span>${escapeHtml(r.subject)} ${escapeHtml(r.componentCode)}</span><span class="text-base-content/50 whitespace-nowrap">${r.date} ${r.startTime}</span></li>`
      )
      .join("");
    exportBtn.disabled = state.selected.size === 0;
  };

  tbody.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    if (input.type !== "checkbox") return;
    const id = input.dataset.id!;
    if (input.checked) state.selected.add(id);
    else state.selected.delete(id);
    renderSelection();
  });

  selectVisibleBtn.addEventListener("click", () => {
    filtered().forEach((r) => state.selected.add(rowId(r)));
    renderTable();
    renderSelection();
  });

  clearBtn.addEventListener("click", () => {
    state.selected.clear();
    renderTable();
    renderSelection();
  });

  subjectSelect.addEventListener("change", () => {
    state.subject = subjectSelect.value;
    renderTable();
  });

  searchInput.addEventListener("input", () => {
    state.search = searchInput.value;
    renderTable();
  });

  exportBtn.addEventListener("click", () => {
    const rows = exams
      .filter((r) => state.selected.has(rowId(r)))
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
    exportToExcel(rows, meta);
  });

  renderTabs();
  renderChips();
  renderSubjects();
  renderTable();
  renderSelection();
}
```

- [ ] **Step 2: 创建 `src/components/exams/ExamTimetable.astro`**

```astro
---
import type { ExamRow, MetaData } from "../../scripts/types";

interface Props {
  exams: ExamRow[];
  meta: MetaData;
}

const { exams, meta } = Astro.props;
const jsonExams = JSON.stringify(exams).replace(/</g, "\\u003c");
const jsonMeta = JSON.stringify(meta).replace(/</g, "\\u003c");
---

<div id="exams-app" class="flex flex-col gap-4">
  <script type="application/json" id="exams-data" set:html={jsonExams}></script>
  <script type="application/json" id="exams-meta" set:html={jsonMeta}></script>

  <div class="tabs tabs-boxed justify-start w-fit" id="board-tabs"></div>
  <div class="flex flex-wrap items-center gap-2" id="level-chips"></div>

  <div class="flex flex-wrap items-center gap-3">
    <select id="subject-select" class="select select-bordered select-sm">
      <option value="">全部科目</option>
    </select>
    <input
      id="search-input"
      class="input input-bordered input-sm"
      placeholder="搜索科目 / 试卷编码"
    />
    <button id="select-visible" type="button" class="btn btn-sm btn-outline">
      全选当前结果
    </button>
    <button id="clear-selection" type="button" class="btn btn-sm btn-ghost">
      清空勾选
    </button>
    <span id="result-count" class="text-sm text-base-content/60"></span>
  </div>

  <div class="flex flex-col lg:flex-row gap-6 items-start">
    <div class="flex-1 overflow-x-auto w-full">
      <table id="exam-table" class="table table-sm table-zebra w-full">
        <thead>
          <tr>
            <th>日期</th>
            <th>开考时间</th>
            <th>科目</th>
            <th>试卷编码</th>
            <th>试卷名称</th>
            <th>时长</th>
            <th>勾选</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>

    <aside class="lg:w-80 w-full shrink-0">
      <div class="card bg-base-200 lg:sticky lg:top-20">
        <div class="card-body p-4 gap-2">
          <h3 class="font-bold">
            我的考试(<span id="selected-count">0</span>)
          </h3>
          <ul
            id="selected-list"
            class="max-h-80 overflow-y-auto text-sm space-y-1 list-none pl-0"
          ></ul>
          <button id="export-excel" type="button" class="btn btn-primary btn-sm" disabled>
            生成 Excel
          </button>
          <p class="text-xs text-base-content/50">按考试日期排序导出 .xlsx</p>
        </div>
      </div>
    </aside>
  </div>
</div>

<script>
  import { initExamsApp } from "../../scripts/exams-app";
  initExamsApp();
</script>
```

- [ ] **Step 3: 创建 `src/pages/exams.astro`**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
import ExamTimetable from "../components/exams/ExamTimetable.astro";
import examsRaw from "../data/exams.json";
import metaRaw from "../data/meta.json";
import type { ExamRow, MetaData } from "../scripts/types";

const exams = examsRaw as ExamRow[];
const meta = metaRaw as MetaData;
const boardName: Record<string, string> = {
  cambridge: "剑桥国际",
  oxfordaqa: "牛津AQA",
  pearson: "培生爱德思",
};
const updatedAt = meta.generatedAt
  ? new Date(meta.generatedAt).toLocaleString("zh-CN", { hour12: false })
  : "";
---

<BaseLayout
  title="考试时间表 - Lawrence"
  description="British Council 三大考局考试时间表查询与个人 Excel 导出"
>
  <h1 class="text-3xl font-bold mb-2">考试时间表</h1>
  <p class="mb-1 text-base-content/70">
    数据来源:英国文化教育协会各考局《报名指南》PDF,自动解析。
  </p>
  <p class="mb-6 text-sm text-base-content/50">
    数据更新于 {updatedAt} · 共 {exams.length} 场考试
  </p>
  <ul class="mb-6 text-sm text-base-content/50 space-y-1 list-none pl-0">
    {Object.entries(meta.sources ?? {}).map(([board, src]) => (
      <li>
        {boardName[board]}报名指南:
        <a class="link link-primary" href={src.pdf} target="_blank" rel="noopener">
          查看 PDF
        </a>
      </li>
    ))}
  </ul>
  <ExamTimetable exams={exams} meta={meta} />
</BaseLayout>
```

- [ ] **Step 4: 在 `src/components/Header.astro` 的 `navItems` 中加导航项**

在 `{ href: "/projects", label: "项目" }` 行后新增:

```ts
  { href: "/exams", label: "考试时间表" },
```

- [ ] **Step 5: 构建验证**

```powershell
npm run build
```

Expected: Astro 构建成功,`dist/exams/index.html` 存在。

- [ ] **Step 6: Commit**

```bash
git add src/scripts/exams-app.ts src/components/exams/ExamTimetable.astro src/pages/exams.astro src/components/Header.astro
git commit -m "feat: add exam timetable page with filtering and excel export"
```

---

### Task 10: GitHub Actions 每日同步

**Files:**
- Create: `.github/workflows/sync-exams.yml`

- [ ] **Step 1: 创建工作流文件**

```yaml
name: Sync exam timetable data

on:
  schedule:
    - cron: "0 0 * * *" # 每天 08:00 Asia/Shanghai
  workflow_dispatch:

permissions:
  contents: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r scripts/requirements.txt
      - run: python scripts/sync_exams.py
      - name: Commit updated data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add src/data/exams.json src/data/meta.json
          git diff --cached --quiet || git commit -m "chore: update exam timetable data [skip ci]"
          git push
```

- [ ] **Step 2: 本地校验 YAML 缩进(无 lint 时目检即可),然后 Commit**

```bash
git add .github/workflows/sync-exams.yml
git commit -m "ci: add daily exam timetable sync workflow"
```

---

### Task 11: 端到端验收

- [ ] **Step 1: 运行全部 Python 测试**

```powershell
$py = 'C:\Users\91219\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $py -m pytest tests -v
```

Expected: 全部通过(约 12 个测试)。

- [ ] **Step 2: 重新构建并确认产物**

```powershell
npm run build
Test-Path dist\exams\index.html
```

Expected: `True`。

- [ ] **Step 3: 本地人工验收清单**

```powershell
npm run dev
```

打开 `http://localhost:4321/exams`,逐项确认:

1. 导航栏出现"考试时间表",页面可访问。
2. 三个考局标签可切换;剑桥标签下默认显示剑桥全部考试,按日期升序。
3. 等级 chips(全部/IG/AS/A2/完整A Level)过滤正确;培生标签下选任意等级只显示"全部"。
4. 科目下拉按考局列出科目;选中科目后表格只剩该科目试卷。
5. 搜索框输入 `9709` 或 `WBI` 能过滤出对应试卷。
6. 勾选若干场考试,右侧计数与列表同步;`清空勾选` 生效。
7. 点"生成 Excel",下载的 `.xlsx` 可用 Excel/WPS 打开,行按日期排序,列含 考局/等级/科目/试卷编码/试卷名称/考试日期/开考时间/时长。
8. 不勾选时导出按钮禁用;无匹配结果时显示"无匹配的考试"。

- [ ] **Step 4: 推送并验证线上**

```bash
git push
```

推送后访问 `https://lawrence1305.github.io/exams` 确认页面与本地一致。

> 注意:若该仓库的 GitHub Pages 不是"构建后部署"(仓库当前没有 Astro Pages workflow),需要另行添加官方 Astro GitHub Pages 工作流,否则 `dist/` 不会被部署。若线上 `/exams` 404,先在仓库 Settings → Pages 确认构建方式。

- [ ] **Step 5: 最终提交(如有遗留改动)**

```bash
git status
```

如有未提交变更,单独提交并说明原因。

---

## 执行期修订(2026-08-03)

1. **等级分组**:数据模型新增 `levelGroup`(`IGCSE` | `A Level`),由同步脚本统一计算。剑桥/牛津AQA 的 `IG` → `IGCSE`,`A`/`AS`/`A2` → `A Level`;培生报名指南行(IAL,`level` 为空)→ `A Level`,官方 IGCSE 行(`level="IG"`)→ `IGCSE`。前端等级筛选改为「全部 / IGCSE / A Level」。

2. **中文科目搜索**:新增 `src/scripts/labels.ts` 科目中英文映射;搜索同时匹配英文与中文,科目列表和 Excel 显示「English · 中文」。

3. **培生 IGCSE 数据**:同步脚本新增 Pearson 官方时间表来源(`qualifications.pearson.com`),抓取 International GCSE 与 International A Level 的 xlsx「All papers」表。IGCSE 行(82 条)并入数据;IAL 行用于与报名指南逐条核对日期(36/36 一致)。官方时间表仅提供 Morning/Afternoon/Evening/Window 时段,`startTime` 留空、`session` 字段存时段,前端显示为上午/下午/晚上/时间段。

4. **下载容错**:PDF/xlsx 下载失败自动重试 3 次;仍失败且存在缓存时复用缓存并告警(不使同步失败);`--offline` 跳过下载。
