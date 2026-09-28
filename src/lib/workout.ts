import type { FailureType, WorkoutSession, WorkoutSet, WorkoutStats } from "../types";

export const FAILURE_LABELS: Record<FailureType, string> = {
  set: "每组力竭",
  exercise: "动作完成力竭",
};

export const DEFAULT_EXERCISES = [
  "深蹲",
  "卧推",
  "硬拉",
  "引体向上",
  "肩推",
  "杠铃划船",
  "腿举",
  "二头弯举",
];

export const REST_OPTIONS = [60, 90, 120, 180];

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function toDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateLabel(dateKey: string, options?: Intl.DateTimeFormatOptions): string {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;

  return new Intl.DateTimeFormat("zh-CN", options ?? { month: "long", day: "numeric", weekday: "short" }).format(date);
}

export function formatCompactDate(dateKey: string): string {
  return formatDateLabel(dateKey, { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(1, maximumFractionDigits),
  }).format(value);
}

export function formatCompactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${formatNumber(value / 1_000_000, 1)}m`;
  if (Math.abs(value) >= 1_000) return `${formatNumber(value / 1_000, 1)}k`;
  return formatNumber(value, 0);
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function createWorkoutSet(
  exercise: string,
  weight: number,
  reps: number,
  failureType: FailureType,
  restSeconds: number,
): WorkoutSet {
  return {
    id: createId(),
    exercise: exercise.trim(),
    weight,
    reps,
    failureType,
    restSeconds,
  };
}

export function buildWorkoutSets(
  exercise: string,
  weight: number,
  reps: number,
  setCount: number,
  failureType: FailureType,
  restSeconds: number,
): WorkoutSet[] {
  return Array.from({ length: setCount }, () =>
    createWorkoutSet(exercise, weight, reps, failureType, restSeconds),
  );
}

export function createWorkoutSession(date: string, title = "训练"): WorkoutSession {
  const now = new Date().toISOString();
  return {
    id: createId(),
    date,
    title: title.trim() || "训练",
    notes: "",
    sets: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function getSessionStats(session: WorkoutSession): WorkoutStats {
  return session.sets.reduce<WorkoutStats>(
    (stats, set) => ({
      sessionCount: 1,
      setCount: stats.setCount + 1,
      totalVolume: stats.totalVolume + set.weight * set.reps,
      totalReps: stats.totalReps + set.reps,
    }),
    { sessionCount: 1, setCount: 0, totalVolume: 0, totalReps: 0 },
  );
}

export function getOverallStats(sessions: WorkoutSession[]): WorkoutStats {
  return sessions.reduce<WorkoutStats>(
    (stats, session) => {
      const sessionStats = getSessionStats(session);
      return {
        sessionCount: stats.sessionCount + 1,
        setCount: stats.setCount + sessionStats.setCount,
        totalVolume: stats.totalVolume + sessionStats.totalVolume,
        totalReps: stats.totalReps + sessionStats.totalReps,
      };
    },
    { sessionCount: 0, setCount: 0, totalVolume: 0, totalReps: 0 },
  );
}

export function getRecentExerciseNames(sessions: WorkoutSession[], fallback = DEFAULT_EXERCISES): string[] {
  const recent = [...sessions]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .flatMap((session) => [...session.sets].reverse().map((set) => set.exercise));
  return [...new Set([...recent, ...fallback])].filter(Boolean).slice(0, 12);
}

export function groupSets(sets: WorkoutSet[]): Array<{ exercise: string; sets: WorkoutSet[] }> {
  const groups = new Map<string, WorkoutSet[]>();
  for (const set of sets) {
    const exercise = set.exercise.trim() || "未命名动作";
    groups.set(exercise, [...(groups.get(exercise) ?? []), set]);
  }
  return [...groups.entries()].map(([exercise, groupedSets]) => ({ exercise, sets: groupedSets }));
}

export function safeNumber(value: string | number, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
