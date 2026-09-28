import type { WorkoutSession } from "../types";

const STORAGE_KEY = "iron-log:sessions:v1";

function isWorkoutSession(value: unknown): value is WorkoutSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WorkoutSession>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.date === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.notes === "string" &&
    Array.isArray(candidate.sets) &&
    candidate.sets.every(
      (set) =>
        set &&
        typeof set === "object" &&
        typeof set.id === "string" &&
        typeof set.exercise === "string" &&
        typeof set.weight === "number" &&
        typeof set.reps === "number" &&
        (set.failureType === "set" || set.failureType === "exercise") &&
        typeof set.restSeconds === "number",
    )
  );
}

export function loadSessions(): WorkoutSession[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isWorkoutSession).sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export function saveSessions(sessions: WorkoutSession[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function parseBackup(value: string): WorkoutSession[] {
  const parsed: unknown = JSON.parse(value);
  const sessions = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && "sessions" in parsed
      ? (parsed as { sessions: unknown }).sessions
      : null;

  if (!Array.isArray(sessions) || !sessions.every(isWorkoutSession)) {
    throw new Error("备份文件格式不正确");
  }

  return sessions;
}
