import { Dumbbell } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "./components/BottomNav";
import { DataView } from "./components/DataView";
import { HistoryView } from "./components/HistoryView";
import { RecordView } from "./components/RecordView";
import { Toast } from "./components/Toast";
import { exportWorkoutWorkbook } from "./lib/excel";
import {
  loadExercisePresets,
  loadSessions,
  saveExercisePresets,
  saveSessions,
} from "./lib/storage";
import { createWorkoutSession, getExercisePresetOptions, toDateKey, upsertExercisePreset } from "./lib/workout";
import type { AppView, BackupData, ExercisePreset, WorkoutSession, WorkoutSet } from "./types";

export default function App() {
  const [sessions, setSessions] = useState<WorkoutSession[]>(loadSessions);
  const [exercisePresets, setExercisePresets] = useState<ExercisePreset[]>(loadExercisePresets);
  const [activeView, setActiveView] = useState<AppView>("record");
  const [activeDate, setActiveDate] = useState(toDateKey());
  const [toast, setToast] = useState("");

  const activeSession = useMemo(
    () => sessions.find((session) => session.date === activeDate),
    [activeDate, sessions],
  );
  const exerciseOptions = useMemo(
    () => getExercisePresetOptions(sessions, exercisePresets),
    [exercisePresets, sessions],
  );

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    saveExercisePresets(exercisePresets);
  }, [exercisePresets]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeView]);

  const addSets = (date: string, title: string, sets: WorkoutSet[]) => {
    setSessions((current) => {
      const existing = current.find((session) => session.date === date);
      if (!existing) {
        const session = createWorkoutSession(date, title);
        session.sets = sets;
        return [session, ...current].sort((a, b) => b.date.localeCompare(a.date));
      }

      return sortSessions(
        current.map((session) =>
          session.id === existing.id
            ? {
                ...session,
                title: title.trim() || session.title,
                sets: [...session.sets, ...sets],
                updatedAt: new Date().toISOString(),
              }
            : session,
        ),
      );
    });
  };

  const saveExercisePreset = (preset: Omit<ExercisePreset, "updatedAt">) => {
    setExercisePresets((current) => upsertExercisePreset(current, preset));
  };

  const updateSessionMeta = (date: string, patch: { title?: string; notes?: string }) => {
    setSessions((current) =>
      current.map((session) =>
        session.date === date
          ? {
              ...session,
              ...patch,
              title: patch.title?.trim() || session.title,
              updatedAt: new Date().toISOString(),
            }
          : session,
      ),
    );
  };

  const updateSet = (date: string, setId: string, patch: Partial<WorkoutSet>) => {
    setSessions((current) =>
      current.map((session) =>
        session.date === date
          ? {
              ...session,
              sets: session.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)),
              updatedAt: new Date().toISOString(),
            }
          : session,
      ),
    );
  };

  const deleteSet = (date: string, setId: string) => {
    setSessions((current) =>
      current
        .map((session) =>
          session.date === date
            ? {
                ...session,
                sets: session.sets.filter((set) => set.id !== setId),
                updatedAt: new Date().toISOString(),
              }
            : session,
        )
        .filter((session) => session.sets.length > 0),
    );
  };

  const deleteGroup = (date: string, exercise: string) => {
    setSessions((current) =>
      current
        .map((session) =>
          session.date === date
            ? {
                ...session,
                sets: session.sets.filter((set) => set.exercise !== exercise),
                updatedAt: new Date().toISOString(),
              }
            : session,
        )
        .filter((session) => session.sets.length > 0),
    );
  };

  const deleteSession = (sessionId: string) => {
    setSessions((current) => current.filter((session) => session.id !== sessionId));
    setToast("已删除这次训练");
  };

  const importSessions = (incoming: WorkoutSession[], message: string, mode: "merge" | "replace") => {
    setSessions((current) => (mode === "replace" ? sortSessions(incoming) : mergeSessions(current, incoming)));
    setToast(message);
    setActiveView("history");
  };

  const restoreBackup = (backup: BackupData, message: string) => {
    setSessions(sortSessions(backup.sessions));
    setExercisePresets(backup.exercisePresets);
    setToast(message);
    setActiveView("history");
  };

  const clearSessions = () => {
    setSessions([]);
    setExercisePresets([]);
    setToast("本机训练数据和动作预设已清空");
  };

  const editHistoryDate = (date: string) => {
    setActiveDate(date);
    setActiveView("record");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark">
          <span className="brand-mark__icon">
            <Dumbbell size={20} strokeWidth={2.3} />
          </span>
          <div>
            <strong>铁记</strong>
            <span>TRAINING LOG</span>
          </div>
        </div>
        <span className="local-badge">本机存储</span>
      </header>

      {activeView === "record" && (
        <RecordView
          activeDate={activeDate}
          session={activeSession}
          exerciseOptions={exerciseOptions}
          onDateChange={setActiveDate}
          onAddSets={addSets}
          onSaveExercisePreset={saveExercisePreset}
          onUpdateMeta={updateSessionMeta}
          onUpdateSet={updateSet}
          onDeleteSet={deleteSet}
          onDeleteGroup={deleteGroup}
          onToast={setToast}
        />
      )}

      {activeView === "history" && (
        <HistoryView
          sessions={sessions}
          onEditDate={editHistoryDate}
          onDeleteSession={deleteSession}
          onExport={() => void exportWorkoutWorkbook(sessions)}
        />
      )}

      {activeView === "data" && (
        <DataView
          sessions={sessions}
          exercisePresets={exercisePresets}
          onImportSessions={importSessions}
          onRestoreBackup={restoreBackup}
          onClear={clearSessions}
          onToast={setToast}
        />
      )}

      <BottomNav activeView={activeView} onChange={setActiveView} />
      {toast && <Toast message={toast} />}
    </div>
  );
}

function sortSessions(sessions: WorkoutSession[]): WorkoutSession[] {
  return [...sessions].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
}

function mergeSessions(current: WorkoutSession[], incoming: WorkoutSession[]): WorkoutSession[] {
  const merged = current.map((session) => ({ ...session, sets: [...session.sets] }));

  for (const incomingSession of incoming) {
    const existing = merged.find(
      (session) => session.date === incomingSession.date && session.title === incomingSession.title,
    );
    if (!existing) {
      merged.push({ ...incomingSession, sets: [...incomingSession.sets] });
      continue;
    }

    existing.sets.push(...incomingSession.sets);
    existing.notes = [existing.notes, incomingSession.notes].filter(Boolean).join("\n");
    existing.updatedAt = new Date().toISOString();
  }

  return sortSessions(merged);
}
