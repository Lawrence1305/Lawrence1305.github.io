export type Board = "cambridge" | "oxfordaqa" | "pearson";

export interface ExamRow {
  board: Board;
  level: "IG" | "AS" | "A2" | "A" | null;
  levelGroup: "IGCSE" | "A Level";
  syllabusCode: string;
  subject: string;
  optionCode: string;
  componentCode: string;
  componentTitle: string;
  duration: string;
  date: string; // yyyy-mm-dd
  startTime: string; // HH:mm
  session?: string; // Morning | Afternoon | Evening | Window (官方时间表)
  sourcePdf: string;
}

export interface MetaData {
  generatedAt: string;
  season: Partial<Record<Board, string>>;
  sources: Partial<Record<Board, { page: string; pdf: string }>>;
}
