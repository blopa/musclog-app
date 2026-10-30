import './workoutAnalyticsMocks';

import { database } from '@/database/database-instance';
import { calculateSetVolume } from '@/utils/workoutCalculator';

export const mockDatabase = database as jest.Mocked<typeof database>;

export const BODY_WEIGHT_KG = 0;

/** Volume as the service computes it: an average-1RM estimate, not weight x reps. */
export const vol = (weight: number, reps: number, repsInReserve = 0, equipmentType = 'barbell') =>
  calculateSetVolume(weight, reps, repsInReserve, equipmentType, BODY_WEIGHT_KG);

// ---------------------------------------------------------------------------
// In-memory database fixture
//
// Sets no longer carry `exercise_id` / `workout_log_id`: they hang off a
// `workout_log_exercises` row, and the service reads their values straight out of
// `_raw`. The fixture builds those three tables from a flat, readable set list.
// ---------------------------------------------------------------------------

export interface SetSpec {
  exerciseId: string;
  workoutLogId: string;
  weight: number;
  reps: number;
  repsInReserve?: number;
  difficultyLevel?: number;
  completionStatus?: 'planned' | 'performed' | 'skipped';
  setType?: string;
  deleted?: boolean;
}

export interface WorkoutSpec {
  id: string;
  startedAt: number;
  completedAt?: null | number;
}

export type Row = Record<string, any> & { _raw: Record<string, unknown> };

export const row = (fields: Record<string, any>, raw: Record<string, unknown>): Row => ({
  ...fields,
  _raw: raw,
});

export function buildFixture(options: {
  exercises?: Record<string, any>[];
  sets?: SetSpec[];
  workouts?: WorkoutSpec[];
}) {
  const { exercises = [], sets = [], workouts = [] } = options;

  const logExerciseByKey = new Map<string, Row>();
  const workoutLogSets: Row[] = [];

  sets.forEach((spec, index) => {
    const key = `${spec.workoutLogId}::${spec.exerciseId}`;
    if (!logExerciseByKey.has(key)) {
      const id = `log-ex-${logExerciseByKey.size + 1}`;
      logExerciseByKey.set(
        key,
        row(
          {
            id,
            exerciseId: spec.exerciseId,
            workoutLogId: spec.workoutLogId,
            deletedAt: null,
          },
          {
            id,
            exercise_id: spec.exerciseId,
            workout_log_id: spec.workoutLogId,
            deleted_at: null,
          }
        )
      );
    }

    const logExercise = logExerciseByKey.get(key)!;
    const setId = `set-${index + 1}`;
    const deletedAt = spec.deleted ? Date.now() : null;

    workoutLogSets.push(
      row(
        {
          id: setId,
          logExerciseId: logExercise.id,
          completionStatus: spec.completionStatus ?? 'performed',
          difficultyLevel: spec.difficultyLevel ?? 5,
        },
        {
          id: setId,
          log_exercise_id: logExercise.id,
          reps: spec.reps,
          weight: spec.weight,
          reps_in_reserve: spec.repsInReserve ?? 0,
          rest_time_after: 60,
          completion_status: spec.completionStatus ?? 'performed',
          difficulty_level: spec.difficultyLevel ?? 5,
          is_skipped: false,
          set_type: spec.setType ?? 'normal',
          set_order: index + 1,
          created_at: Date.now(),
          updated_at: Date.now(),
          deleted_at: deletedAt,
        }
      )
    );
  });

  const workoutLogExercises = [...logExerciseByKey.values()];

  const workoutLogs = workouts.map((spec) => {
    const logExercisesForWorkout = workoutLogExercises.filter(
      (le) => le.workoutLogId === spec.id && le.deletedAt == null
    );

    return row(
      {
        id: spec.id,
        startedAt: spec.startedAt,
        completedAt: spec.completedAt ?? null,
        logExercises: { fetch: jest.fn().mockResolvedValue(logExercisesForWorkout) },
      },
      {
        id: spec.id,
        started_at: spec.startedAt,
        completed_at: spec.completedAt ?? null,
      }
    );
  });

  const exerciseRows = exercises.map((exercise) =>
    row(exercise, {
      id: exercise.id,
      name: exercise.name,
      muscle_group: exercise.muscleGroup,
      equipment_type: exercise.equipmentType,
      deleted_at: null,
    })
  );

  return {
    exercises: exerciseRows,
    workout_log_exercises: workoutLogExercises,
    workout_log_sets: workoutLogSets,
    workout_logs: workoutLogs,
  };
}

export function matchesClause(raw: Record<string, unknown>, clause: any): boolean {
  const actual = raw[clause.field];
  const condition = clause.condition;

  // `Q.where('exercise_id', exerciseId)` passes a bare value rather than a Q operator.
  if (condition === null || typeof condition !== 'object') {
    return actual === condition;
  }

  switch (condition.op) {
    case 'eq':
      return condition.value === null ? actual == null : actual === condition.value;
    case 'notEq':
      return condition.value === null ? actual != null : actual !== condition.value;
    case 'gte':
      return (actual as number) >= condition.value;
    case 'lte':
      return (actual as number) <= condition.value;
    case 'lt':
      return (actual as number) < condition.value;
    case 'oneOf':
      return condition.values.includes(actual);
    default:
      return true;
  }
}

export function queryFixture(rows: Row[], clauses: any[]): Row[] {
  const whereClauses = clauses.filter((c) => c && typeof c === 'object' && 'field' in c);
  let result = rows.filter((r) => whereClauses.every((c) => matchesClause(r._raw, c)));

  const sort = clauses.find((c) => c && typeof c === 'object' && 'sortByField' in c);
  if (sort) {
    const factor = sort.direction === 'desc' ? -1 : 1;
    result = [...result].sort(
      (a, b) =>
        (((a._raw[sort.sortByField] as number) ?? 0) -
          ((b._raw[sort.sortByField] as number) ?? 0)) *
        factor
    );
  }

  const take = clauses.find((c) => c && typeof c === 'object' && 'takeCount' in c);
  if (take) {
    result = result.slice(0, take.takeCount);
  }

  return result;
}

/** Points `database.get(table)` at the fixture, dispatching by table name. */
export function installFixture(tables: Partial<Record<string, Row[]>>) {
  mockDatabase.get.mockImplementation(
    (table: string) =>
      ({
        find: jest.fn(async (id: string) => {
          const found = (tables[table] ?? []).find((r) => r.id === id);
          if (!found) {
            throw new Error(`Record ${id} not found in ${table}`);
          }
          return found;
        }),
        query: jest.fn((...clauses: any[]) => ({
          extend: jest.fn().mockReturnThis(),
          fetch: jest.fn(async () => queryFixture(tables[table] ?? [], clauses)),
        })),
      }) as any
  );
}
