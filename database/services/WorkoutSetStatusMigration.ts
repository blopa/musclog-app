import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import type WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { inferLegacyWorkoutSetCompletionStatus } from '@/utils/workoutSetCompletion';

const MIGRATION_BATCH_SIZE = 200;

/** LokiJS fallback for v26; native SQLite performs the same rewrite in migration-v26. */
export class WorkoutSetStatusMigration {
  static async run(): Promise<void> {
    while (true) {
      const sets = await database
        .get<WorkoutLogSet>('workout_log_sets')
        .query(
          Q.or(Q.where('completion_status', Q.eq(null)), Q.where('completion_status', Q.eq(''))),
          Q.where('deleted_at', Q.eq(null)),
          Q.take(MIGRATION_BATCH_SIZE)
        )
        .fetch();

      if (sets.length === 0) {
        return;
      }

      const logExerciseIds = [...new Set(sets.map((set) => set.logExerciseId))];
      const logExercises = await database
        .get<WorkoutLogExercise>('workout_log_exercises')
        .query(Q.where('id', Q.oneOf(logExerciseIds)))
        .fetch();
      const logExerciseById = new Map(logExercises.map((exercise) => [exercise.id, exercise]));
      const workoutIds = [...new Set(logExercises.map((exercise) => exercise.workoutLogId))];
      const workouts =
        workoutIds.length > 0
          ? await database
              .get<WorkoutLog>('workout_logs')
              .query(Q.where('id', Q.oneOf(workoutIds)))
              .fetch()
          : [];
      const workoutById = new Map(workouts.map((workout) => [workout.id, workout]));
      const affectedWorkoutIds = new Set<string>();
      const now = Date.now();

      const setUpdates = sets.map((set) => {
        const logExercise = logExerciseById.get(set.logExerciseId);
        const workout = logExercise ? workoutById.get(logExercise.workoutLogId) : undefined;
        const completionStatus = inferLegacyWorkoutSetCompletionStatus({
          difficultyLevel: set.difficultyLevel,
          isSkipped: set.legacyIsSkipped,
          workoutCompleted: workout?.completedAt != null,
          workoutHasTemplate: workout?.templateId != null,
        });

        if (completionStatus === 'skipped' && workout?.completedAt != null) {
          affectedWorkoutIds.add(workout.id);
        }

        return set.prepareUpdate((record) => {
          record.completionStatus = completionStatus;
          if (record.difficultyLevel === 0) {
            record.difficultyLevel = undefined;
          }
          record.updatedAt = now;
        });
      });
      const logUpdates = workouts
        .filter((workout) => affectedWorkoutIds.has(workout.id))
        .map((workout) =>
          workout.prepareUpdate((record) => {
            record.totalVolume = undefined;
            record.updatedAt = now;
          })
        );

      await database.write(async () => {
        await database.batch(...setUpdates, ...logUpdates);
      });
    }
  }
}
