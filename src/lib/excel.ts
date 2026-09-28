import { readSheet } from "read-excel-file/browser";
import writeXlsxFile from "write-excel-file/browser";
import type { Cell, SheetData } from "write-excel-file/browser";
import type { FailureType, ImportResult, WorkoutSession } from "../types";
import { createId, groupSets, toDateKey } from "./workout";

type SpreadsheetRow = Record<string, unknown>;

interface DetailRow {
  日期: string;
  训练名称: string;
  训练项目: string;
  组号: number;
  "使用重量(kg)": number;
  每组次数: number;
  力竭类型: string;
  "组间休息(秒)": number;
  备注: string;
}

interface SummaryRow {
  日期: string;
  训练项目: string;
  组数: number;
  总次数: number;
  总容量: number;
}

const HEADER_ALIASES = {
  date: ["日期", "训练日期", "date"],
  title: ["训练名称", "训练日", "课程名称", "标题", "title"],
  exercise: ["训练项目", "动作", "动作名称", "项目", "exercise"],
  setNumber: ["组号", "组次", "第几组", "set", "setnumber"],
  totalSets: ["一共做几组", "总组数", "组数", "sets"],
  weight: ["使用重量", "重量(kg)", "重量（kg）", "重量", "kg", "weight"],
  reps: ["每组做几个", "每组次数", "次数", "reps"],
  failure: ["力竭类型", "是否力竭", "力竭方式", "力竭", "failure"],
  rest: ["组间休息多久", "组间休息(秒)", "组间休息（秒）", "休息时间", "休息", "rest"],
  notes: ["备注", "notes"],
};

const DETAIL_HEADERS: Record<keyof DetailRow, string> = {
  日期: "日期",
  训练名称: "训练名称",
  训练项目: "训练项目",
  组号: "组号",
  "使用重量(kg)": "使用重量(kg)",
  每组次数: "每组次数",
  力竭类型: "力竭类型",
  "组间休息(秒)": "组间休息(秒)",
  备注: "备注",
};

export async function exportWorkoutWorkbook(sessions: WorkoutSession[]): Promise<void> {
  const detailRows = buildDetailRows(sessions);
  const summaryRows = buildSummaryRows(sessions);
  const detailHeader = Object.keys(DETAIL_HEADERS) as Array<keyof DetailRow>;
  const summaryHeader: Array<keyof SummaryRow> = ["日期", "训练项目", "组数", "总次数", "总容量"];

  const detailSheet: SheetData = [
    detailHeader.map((key) => headerCell(DETAIL_HEADERS[key])),
    ...detailRows.map((row) => detailHeader.map((key) => rowCell(row[key]))),
  ];
  const summarySheet: SheetData = [
    summaryHeader.map((key) => headerCell(key)),
    ...summaryRows.map((row) => summaryHeader.map((key) => rowCell(row[key]))),
  ];

  const workbook = writeXlsxFile(
    [
      {
        data: detailSheet,
        sheet: "训练明细",
        columns: [
          { width: 13 },
          { width: 18 },
          { width: 17 },
          { width: 8 },
          { width: 15 },
          { width: 12 },
          { width: 17 },
          { width: 15 },
          { width: 28 },
        ],
      },
      {
        data: summarySheet,
        sheet: "动作汇总",
        columns: [{ width: 13 }, { width: 18 }, { width: 9 }, { width: 11 }, { width: 14 }],
      },
    ],
    { fontFamily: "Microsoft YaHei" },
  );
  await workbook.toFile(`训练日志_${toDateKey()}.xlsx`);
}

export function exportWorkoutCsv(sessions: WorkoutSession[]): void {
  const rows = buildDetailRows(sessions);
  const headers = Object.keys(DETAIL_HEADERS) as Array<keyof DetailRow>;
  const values = [headers, ...rows.map((row) => headers.map((header) => row[header]))];
  const csv = values.map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadBlob(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }), `训练日志_${toDateKey()}.csv`);
}

export function exportBackup(sessions: WorkoutSession[]): void {
  downloadBlob(
    new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), sessions }, null, 2)], {
      type: "application/json",
    }),
    `铁记备份_${toDateKey()}.json`,
  );
}

export async function importWorkoutFile(file: File): Promise<ImportResult> {
  if (file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv")) {
    return rowsToSessions(parseCsv((await file.text()).replace(/^\uFEFF/, "")));
  }

  const sheetRows = await readSheet(file);
  return rowsToSessions(sheetRowsToObjects(sheetRows));
}

export function rowsToSessions(rows: SpreadsheetRow[]): ImportResult {
  const sessionMap = new Map<string, WorkoutSession>();
  let importedSetCount = 0;

  rows.forEach((row) => {
    const exercise = stringValue(findCell(row, HEADER_ALIASES.exercise));
    if (!exercise) return;

    const date = dateKey(findCell(row, HEADER_ALIASES.date)) || toDateKey();
    const title = stringValue(findCell(row, HEADER_ALIASES.title)) || "导入训练";
    const notes = stringValue(findCell(row, HEADER_ALIASES.notes));
    const sessionKey = `${date}::${title}`;
    const now = new Date().toISOString();
    let session = sessionMap.get(sessionKey);

    if (!session) {
      session = {
        id: createId(),
        date,
        title,
        notes,
        sets: [],
        createdAt: now,
        updatedAt: now,
      };
      sessionMap.set(sessionKey, session);
    }

    const weightSeries = numberSeries(findCell(row, HEADER_ALIASES.weight), 0);
    const repsSeries = numberSeries(findCell(row, HEADER_ALIASES.reps), 0);
    const setCount = Math.max(
      1,
      Math.floor(numberValue(findCell(row, HEADER_ALIASES.totalSets)) || setCountFromAnyCell(row) || 1),
    );
    const failureType = failureTypeValue(findCell(row, HEADER_ALIASES.failure));
    const restSeconds = restSecondsValue(findCell(row, HEADER_ALIASES.rest));
    const explicitSetNumber = Math.floor(numberValue(findCell(row, HEADER_ALIASES.setNumber)));
    const repetitions = explicitSetNumber > 0 ? 1 : setCount;

    for (let index = 0; index < repetitions; index += 1) {
      session.sets.push({
        id: createId(),
        exercise,
        weight: valueAt(weightSeries, index),
        reps: valueAt(repsSeries, index),
        failureType,
        restSeconds,
      });
      importedSetCount += 1;
    }
  });

  const sessions = [...sessionMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (sessions.length === 0) {
    throw new Error("没有识别到训练项目，请检查表头是否包含“日期、训练项目、使用重量、每组做几个”等字段");
  }

  return { sessions, rowCount: importedSetCount };
}

function buildDetailRows(sessions: WorkoutSession[]): DetailRow[] {
  return sessions.flatMap((session) =>
    groupSets(session.sets).flatMap((group) =>
      group.sets.map((set, index) => ({
        日期: session.date,
        训练名称: session.title,
        训练项目: group.exercise,
        组号: index + 1,
        "使用重量(kg)": set.weight,
        每组次数: set.reps,
        力竭类型: set.failureType === "set" ? "每组力竭" : "动作完成力竭",
        "组间休息(秒)": set.restSeconds,
        备注: session.notes,
      })),
    ),
  );
}

function buildSummaryRows(sessions: WorkoutSession[]): SummaryRow[] {
  return sessions.flatMap((session) =>
    groupSets(session.sets).map((group) => ({
      日期: session.date,
      训练项目: group.exercise,
      组数: group.sets.length,
      总次数: group.sets.reduce((total, set) => total + set.reps, 0),
      总容量: group.sets.reduce((total, set) => total + set.weight * set.reps, 0),
    })),
  );
}

function headerCell(value: string): Cell {
  return {
    value,
    fontWeight: "bold",
    textColor: "#FFFFFF",
    backgroundColor: "#17201B",
    align: "center",
    alignVertical: "center",
    borderColor: "#17201B",
    borderStyle: "thin",
  };
}

function rowCell(value: string | number): Cell {
  return {
    value,
    type: typeof value === "number" ? Number : String,
    alignVertical: "center",
    borderColor: "#D9DED8",
    borderStyle: "thin",
  };
}

function sheetRowsToObjects(rows: unknown[][]): SpreadsheetRow[] {
  const [headerRow = [], ...dataRows] = rows;
  const headers = headerRow.map((cell) => stringValue(cell));
  return dataRows
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]).filter(([header]) => header)),
    )
    .filter((row) => Object.values(row).some((value) => stringValue(value)));
}

function parseCsv(text: string): SpreadsheetRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const [headerRow = [], ...dataRows] = rows.filter((line) => line.some((value) => value.trim()));
  const headers = headerRow.map((header) => header.trim());
  return dataRows.map((line) => Object.fromEntries(headers.map((header, index) => [header, line[index] ?? ""])));
}

function csvCell(value: unknown): string {
  const raw = stringValue(value);
  return /[",\r\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}

function findCell(row: SpreadsheetRow, aliases: string[]): unknown {
  const normalizedAliases = aliases.map(normalizeHeader);
  const entry = Object.entries(row).find(([header]) => normalizedAliases.includes(normalizeHeader(header)));
  return entry?.[1];
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[\s_\-()[\]（）]/g, "");
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const match = stringValue(value).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : 0;
}

function numberSeries(value: unknown, fallback: number): number[] {
  if (typeof value === "number") return [value];
  const parts = stringValue(value)
    .split(/[,，、/]+/)
    .map((part) => numberValue(part))
    .filter((part, index) => part > 0 || index === 0);
  return parts.length > 0 ? parts : [fallback];
}

function valueAt(values: number[], index: number): number {
  return values[index] ?? values.at(-1) ?? 0;
}

function setCountFromAnyCell(row: SpreadsheetRow): number {
  const matchingEntry = Object.entries(row).find(([header]) => normalizeHeader(header).includes("组"));
  return numberValue(matchingEntry?.[1]);
}

function dateKey(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toDateKey(value);
  }

  const raw = stringValue(value);
  if (!raw) return "";
  const match = raw.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : toDateKey(parsed);
}

function failureTypeValue(value: unknown): FailureType {
  const raw = stringValue(value);
  if (raw.includes("动作") || raw.includes("完成") || raw.includes("结束")) return "exercise";
  return "set";
}

function restSecondsValue(value: unknown): number {
  const raw = stringValue(value);
  if (!raw) return 90;

  const clockMatch = raw.match(/^(\d+):(\d{1,2})$/);
  if (clockMatch) return Number(clockMatch[1]) * 60 + Number(clockMatch[2]);

  const halfMinute = raw.match(/(-?\d+(?:\.\d+)?)\s*分(?:钟)?半/);
  if (halfMinute) return Math.max(0, Math.round(Number(halfMinute[1]) * 60 + 30));

  const minutes = raw.match(/(-?\d+(?:\.\d+)?)\s*(?:分|min|m)/i);
  const seconds = raw.match(/(-?\d+(?:\.\d+)?)\s*(?:秒|s)/i);
  if (minutes || seconds) {
    return Math.max(0, Math.round((Number(minutes?.[1] ?? 0) + Number(seconds?.[1] ?? 0) / 60) * 60));
  }

  return Math.max(0, Math.round(numberValue(raw) || 90));
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
