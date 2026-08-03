import { exportToExcel } from "./excel";
import { sessionLabel, subjectLabel, subjectZh } from "./labels";
import type { Board, ExamRow, MetaData } from "./types";

const BOARD_ORDER: Board[] = ["cambridge", "oxfordaqa", "pearson"];
const BOARD_NAMES: Record<Board, string> = {
  cambridge: "剑桥国际",
  oxfordaqa: "牛津AQA",
  pearson: "培生爱德思",
};
const LEVELS = ["IGCSE", "A Level"] as const;
const LEVEL_NAMES: Record<string, string> = {
  IGCSE: "IGCSE",
  "A Level": "A Level",
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
      if (state.level !== "ALL" && r.levelGroup !== state.level) return false;
      if (state.subject && r.subject !== state.subject) return false;
      if (q) {
        const hay = `${r.subject} ${subjectZh(r.subject)} ${r.syllabusCode} ${r.componentCode} ${r.componentTitle}`.toLowerCase();
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
        .map(
          (s) =>
            `<option value="${escapeHtml(s)}">${escapeHtml(subjectLabel(s))}</option>`
        )
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
          <td class="whitespace-nowrap">${r.startTime || sessionLabel(r.session)}</td>
          <td>${escapeHtml(subjectLabel(r.subject))}</td>
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
          `<li class="badge badge-outline gap-1 whitespace-nowrap py-3">${escapeHtml(r.subject)} ${escapeHtml(r.componentCode)} · ${r.date} ${r.startTime || sessionLabel(r.session)}</li>`
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
