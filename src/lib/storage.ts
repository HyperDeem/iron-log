import type { BackupData, ExercisePreset, WorkoutSession } from "../types";

const STORAGE_KEY = "iron-log:sessions:v1";
const EXERCISE_PRESETS_KEY = "iron-log:exercise-presets:v1";

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

function isExercisePreset(value: unknown): value is ExercisePreset {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ExercisePreset> & { note?: unknown };
  return (
    typeof candidate.name === "string" &&
    typeof candidate.setCount === "number" &&
    (candidate.failureType === "set" || candidate.failureType === "exercise") &&
    typeof candidate.restSeconds === "number" &&
    typeof candidate.weight === "number" &&
    typeof candidate.reps === "number" &&
    typeof candidate.updatedAt === "string" &&
    (candidate.nextNote === undefined || typeof candidate.nextNote === "string") &&
    (candidate.note === undefined || typeof candidate.note === "string") &&
    (candidate.sets === undefined ||
      (Array.isArray(candidate.sets) &&
        candidate.sets.every(
          (set) =>
            set &&
            typeof set === "object" &&
            typeof (set as { weight?: unknown }).weight === "number" &&
            typeof (set as { reps?: unknown }).reps === "number",
        )))
  );
}

export function loadExercisePresets(): ExercisePreset[] {
  try {
    const stored = localStorage.getItem(EXERCISE_PRESETS_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isExercisePreset)
      .map(normalizeExercisePreset)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function saveExercisePresets(presets: ExercisePreset[]): void {
  localStorage.setItem(EXERCISE_PRESETS_KEY, JSON.stringify(presets));
}

function normalizeExercisePreset(preset: ExercisePreset): ExercisePreset {
  const legacyPreset = preset as ExercisePreset & { note?: string };
  const setCount = Math.max(1, Math.round(preset.setCount));
  const template =
    preset.sets && preset.sets.length > 0
      ? preset.sets.slice(0, setCount)
      : Array.from({ length: setCount }, () => ({ weight: preset.weight, reps: preset.reps }));

  while (template.length < setCount) {
    template.push(template.at(-1) ?? { weight: preset.weight, reps: preset.reps });
  }

  return {
    ...preset,
    setCount,
    sets: template,
    nextNote: preset.nextNote ?? legacyPreset.note ?? "",
  };
}

export function parseBackup(value: string): BackupData {
  const parsed: unknown = JSON.parse(value);
  const sessions: unknown = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && "sessions" in parsed
      ? (parsed as { sessions: unknown }).sessions
      : null;
  const exercisePresets: unknown =
    !Array.isArray(parsed) && parsed && typeof parsed === "object" && "exercisePresets" in parsed
      ? (parsed as { exercisePresets: unknown }).exercisePresets
      : [];

  if (!Array.isArray(sessions) || !sessions.every(isWorkoutSession)) {
    throw new Error("备份文件格式不正确");
  }

  return {
    sessions,
    exercisePresets: Array.isArray(exercisePresets)
      ? exercisePresets.filter(isExercisePreset).map(normalizeExercisePreset)
      : [],
  };
}
