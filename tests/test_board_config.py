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
