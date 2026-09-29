export type FailureType = "set" | "exercise";

export interface WorkoutSet {
  id: string;
  exercise: string;
  weight: number;
  reps: number;
  failureType: FailureType;
  restSeconds: number;
  note?: string;
}

export interface WorkoutSession {
  id: string;
  date: string;
  title: string;
  notes: string;
  sets: WorkoutSet[];
  createdAt: string;
  updatedAt: string;
}

export interface ExercisePreset {
  name: string;
  setCount: number;
  failureType: FailureType;
  restSeconds: number;
  weight: number;
  reps: number;
  sets: ExerciseSetTemplate[];
  nextNote: string;
  updatedAt: string;
}

export interface ExerciseSetTemplate {
  weight: number;
  reps: number;
}

export interface BackupData {
  sessions: WorkoutSession[];
  exercisePresets: ExercisePreset[];
}

export interface WorkoutStats {
  sessionCount: number;
  setCount: number;
  totalVolume: number;
  totalReps: number;
}

export type AppView = "record" | "history" | "data";

export interface ImportResult {
  sessions: WorkoutSession[];
  rowCount: number;
}
