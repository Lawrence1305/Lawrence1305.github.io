import * as XLSX from "xlsx";
import { sessionLabel, subjectLabel } from "./labels";
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
    等级: r.levelGroup,
    科目: subjectLabel(r.subject),
    试卷编码: r.componentCode,
    试卷名称: r.componentTitle,
    考试日期: r.date,
    开考时间: r.startTime || sessionLabel(r.session),
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
