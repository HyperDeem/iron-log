import {
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  HardDrive,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import type { BackupData, ExercisePreset, WorkoutSession } from "../types";
import { exportBackup, exportWorkoutCsv, exportWorkoutWorkbook, importWorkoutFile } from "../lib/excel";
import { parseBackup } from "../lib/storage";

interface DataViewProps {
  sessions: WorkoutSession[];
  exercisePresets: ExercisePreset[];
  onImportSessions: (sessions: WorkoutSession[], message: string, mode: "merge" | "replace") => void;
  onRestoreBackup: (backup: BackupData, message: string) => void;
  onClear: () => void;
  onToast: (message: string) => void;
}

export function DataView({
  sessions,
  exercisePresets,
  onImportSessions,
  onRestoreBackup,
  onClear,
  onToast,
}: DataViewProps) {
  const tableInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleSpreadsheetImport = async (file?: File) => {
    if (!file) return;
    setIsImporting(true);
    try {
      const result = await importWorkoutFile(file);
      onImportSessions(result.sessions, `已导入 ${result.rowCount} 组训练记录`, "merge");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "导入失败，请检查表格格式");
    } finally {
      setIsImporting(false);
      if (tableInputRef.current) tableInputRef.current.value = "";
    }
  };

  const handleBackupImport = async (file?: File) => {
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      if (!window.confirm(`用备份替换本机现有 ${sessions.length} 次训练？`)) return;
      onRestoreBackup(backup, `已恢复 ${backup.sessions.length} 次训练`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "备份文件无法读取");
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  };

  return (
    <main className="view data-view">
      <section className="page-intro">
        <div>
          <span className="eyebrow">LOCAL DATA</span>
          <h1>数据管理</h1>
        </div>
      </section>

      <section className="storage-status">
        <div className="storage-status__icon">
          <HardDrive size={22} />
        </div>
        <div>
          <strong>记录保存在此设备</strong>
          <span>已保存 {sessions.length} 次训练，共 {sessions.reduce((total, session) => total + session.sets.length, 0)} 组</span>
        </div>
        <ShieldCheck size={21} />
      </section>

      <section className="data-section">
        <div className="data-section__heading">
          <FileSpreadsheet size={20} />
          <div>
            <h2>导出表格</h2>
            <span>训练明细和动作汇总会分成两个工作表</span>
          </div>
        </div>
        <div className="button-stack">
          <button
            type="button"
            className="primary-button"
            disabled={sessions.length === 0}
            onClick={() => void exportWorkoutWorkbook(sessions)}
          >
            <Download size={18} />
            导出 Excel
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={sessions.length === 0}
            onClick={() => exportWorkoutCsv(sessions)}
          >
            <Download size={18} />
            导出 CSV
          </button>
        </div>
      </section>

      <section className="data-section">
        <div className="data-section__heading">
          <Upload size={20} />
          <div>
            <h2>导入历史表格</h2>
            <span>支持 Excel、CSV，以及逐组或按总组数记录的表头</span>
          </div>
        </div>
        <button
          type="button"
          className="secondary-button"
          disabled={isImporting}
          onClick={() => tableInputRef.current?.click()}
        >
          <Upload size={18} />
          {isImporting ? "正在读取..." : "选择表格文件"}
        </button>
        <input
          ref={tableInputRef}
          className="visually-hidden"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(event) => void handleSpreadsheetImport(event.target.files?.[0])}
        />
      </section>

      <section className="data-section">
        <div className="data-section__heading">
          <FileJson size={20} />
          <div>
            <h2>完整备份</h2>
            <span>JSON 备份可以在换手机或清空浏览器后完整恢复</span>
          </div>
        </div>
        <div className="button-stack">
          <button
            type="button"
            className="secondary-button"
            disabled={sessions.length === 0}
            onClick={() => exportBackup(sessions, exercisePresets)}
          >
            <Download size={18} />
            备份为 JSON
          </button>
          <button type="button" className="secondary-button" onClick={() => backupInputRef.current?.click()}>
            <RefreshCcw size={18} />
            恢复 JSON 备份
          </button>
        </div>
        <input
          ref={backupInputRef}
          className="visually-hidden"
          type="file"
          accept=".json,application/json"
          onChange={(event) => void handleBackupImport(event.target.files?.[0])}
        />
      </section>

      <section className="data-section data-section--danger">
        <div className="data-section__heading">
          <Database size={20} />
          <div>
            <h2>清空本机数据</h2>
            <span>先导出备份，再清空此设备上的全部训练记录</span>
          </div>
        </div>
        <button
          type="button"
          className="danger-button"
          disabled={sessions.length === 0}
          onClick={() => {
            if (window.confirm("确定清空此设备上的全部训练记录？此操作无法撤销。")) onClear();
          }}
        >
          <Trash2 size={18} />
          清空全部数据
        </button>
      </section>
    </main>
  );
}
