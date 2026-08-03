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
