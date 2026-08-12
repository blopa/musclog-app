import type WorkoutLogSet from '@/database/models/WorkoutLogSet';
import {
  isPerformedWorkoutSet,
  isWorkoutSetCompletionStatus,
  type WorkoutSetCompletionStatus,
} from '@/utils/workoutSetCompletion';

export type WorkoutLogSetSnapshot = {
  id: string;
  logExerciseId: string;
  reps: number;
  weight: number;
  partials?: number;
  restTimeAfter: number;
  repsInReserve: number;
  completionStatus?: WorkoutSetCompletionStatus;
  difficultyLevel?: number;
  setType: string;
  setOrder: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

function rawRecord(set: WorkoutLogSet): Record<string, unknown> {
  return (set as unknown as { _raw?: Record<string, unknown> })._raw ?? {};
}

function numberValue(raw: unknown, model: unknown, fallback: number): number {
  if (typeof raw === 'number') {
    return raw;
  }

  return typeof model === 'number' ? model : fallback;
}

function optionalNumberValue(
  raw: Record<string, unknown>,
  key: string,
  model: unknown
): number | undefined {
  if (Object.prototype.hasOwnProperty.call(raw, key)) {
    return typeof raw[key] === 'number' ? raw[key] : undefined;
  }

  return typeof model === 'number' ? model : undefined;
}

/** Canonical plain-data projection for workout-log set reads. */
export function toWorkoutLogSetSnapshot(set: WorkoutLogSet): WorkoutLogSetSnapshot {
  const raw = rawRecord(set);
  const rawStatus = Object.prototype.hasOwnProperty.call(raw, 'completion_status')
    ? raw.completion_status
    : set.completionStatus;

  return {
    id: set.id,
    logExerciseId:
      typeof raw.log_exercise_id === 'string' ? raw.log_exercise_id : set.logExerciseId,
    reps: numberValue(raw.reps, set.reps, 0),
    weight: numberValue(raw.weight, set.weight, 0),
    partials: optionalNumberValue(raw, 'partials', set.partials),
    restTimeAfter: numberValue(raw.rest_time_after, set.restTimeAfter, 0),
    repsInReserve: numberValue(raw.reps_in_reserve, set.repsInReserve, 0),
    completionStatus: isWorkoutSetCompletionStatus(rawStatus) ? rawStatus : undefined,
    difficultyLevel: optionalNumberValue(raw, 'difficulty_level', set.difficultyLevel),
    setType: typeof raw.set_type === 'string' ? raw.set_type : (set.setType ?? 'normal'),
    setOrder: numberValue(raw.set_order, set.setOrder, 0),
    createdAt: numberValue(raw.created_at, set.createdAt, 0),
    updatedAt: numberValue(raw.updated_at, set.updatedAt, 0),
    deletedAt: optionalNumberValue(raw, 'deleted_at', set.deletedAt),
  };
}

export function toPerformedWorkoutLogSetSnapshots(
  sets: readonly WorkoutLogSet[]
): WorkoutLogSetSnapshot[] {
  return sets.map(toWorkoutLogSetSnapshot).filter(isPerformedWorkoutSet);
}
