import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import type WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { fetchByIds } from '@/database/queryByIds';

export type CompletedSetHistoryRange = {
  /** Sessions that started at or after this instant. Left out, no lower bound. */
  startedFrom?: number;
  /** Sessions that started at or before this instant. Left out, no upper bound. */
  startedTo?: number;
  /** Only the log exercises of these catalogue exercises. Left out, every exercise. */
  exerciseIds?: ReadonlySet<string>;
  /** Oldest session first. */
  oldestFirst?: boolean;
};

export type CompletedSetHistory = {
  logs: WorkoutLog[];
  logExercises: WorkoutLogExercise[];
  sets: WorkoutLogSet[];
};

/**
 * The completed, live sessions in a range with their exercises and sets: the walk
 * session → log exercise → set that the strength levels, the muscle load and the year in review
 * each need. Everything is read from plaintext columns, deleted rows are filtered in the query, and
 * ids are batched under SQLite's bound-parameter cap (`fetchByIds`). A level with nothing in it
 * leaves the levels below empty without querying them.
 */
export async function fetchCompletedSetHistory({
  startedFrom,
  startedTo,
  exerciseIds,
  oldestFirst = false,
}: CompletedSetHistoryRange = {}): Promise<CompletedSetHistory> {
  const logs = await database
    .get<WorkoutLog>('workout_logs')
    .query(
      Q.where('completed_at', Q.notEq(null)),
      Q.where('deleted_at', Q.eq(null)),
      ...(startedFrom === undefined ? [] : [Q.where('started_at', Q.gte(startedFrom))]),
      ...(startedTo === undefined ? [] : [Q.where('started_at', Q.lte(startedTo))]),
      ...(oldestFirst ? [Q.sortBy('started_at', Q.asc)] : [])
    )
    .fetch();

  const allLogExercises = await fetchByIds<WorkoutLogExercise>(
    'workout_log_exercises',
    'workout_log_id',
    logs.map((log) => log.id),
    Q.where('deleted_at', Q.eq(null))
  );
  const logExercises = exerciseIds
    ? allLogExercises.filter((logExercise) => exerciseIds.has(logExercise.exerciseId))
    : allLogExercises;

  const sets = await fetchByIds<WorkoutLogSet>(
    'workout_log_sets',
    'log_exercise_id',
    logExercises.map((logExercise) => logExercise.id),
    Q.where('deleted_at', Q.eq(null))
  );

  return { logs, logExercises, sets };
}
