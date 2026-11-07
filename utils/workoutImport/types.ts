export type WorkoutImportSource = 'strong' | 'hevy' | 'fitnotes' | 'fitnotes2';
export type ImportWeightUnit = 'kg' | 'lbs';
export type ImportedSetType = 'normal' | 'warmup' | 'failure' | 'drop_set';

export interface ImportedSet {
  setType: ImportedSetType;
  reps: number; // 0 when the row carried no reps (timed set)
  weightKg: number; // 0 for bodyweight; full precision, never rounded
  rpe: number | null; // 1..10, null = not rated
  durationSeconds: number | null; // a timed set (plank), null otherwise
  distanceM: number | null; // a loaded carry etc.
}

export interface ImportedExerciseBlock {
  name: string; // the exact name from the file, trimmed
  category: string | null; // FitNotes Category, when present
  notes: string | null; // exercise note + distinct per-set notes, joined with newlines
  supersetKey: string | null; // Hevy superset_id
  sets: ImportedSet[];
}

export interface ImportedCardio {
  name: string;
  activity: 'walk' | 'run';
  distanceM: number;
  durationSeconds: number | null;
  notes: string | null;
}

export interface ImportedSession {
  importKey: string;
  source: WorkoutImportSource;
  name: string; // workout name, or '' when the file has none (FitNotes)
  day: string; // local calendar day 'yyyy-MM-dd'
  startMinutes: number | null; // minutes after local midnight; null = the file has only a day
  durationSeconds: number | null;
  notes: string | null;
  exercises: ImportedExerciseBlock[];
  cardio: ImportedCardio[];
}

export type SkipReason = 'badDate' | 'futureDate' | 'noExercise' | 'nothingMeasured' | 'outOfRange';

export interface SkippedRow {
  line: number;
  reason: SkipReason;
}

export type ImportFailure = 'empty' | 'unknownFormat' | 'noRows';

export type WorkoutImportResult =
  | {
      ok: true;
      source: WorkoutImportSource;
      weightUnitStated: boolean;
      sessions: ImportedSession[];
      skipped: SkippedRow[];
    }
  | { ok: false; failure: ImportFailure };
