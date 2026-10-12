import { type Model, Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import type Exercise from '@/database/models/Exercise';
import type WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import type WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { fetchByIds, fetchMapByIds, MAX_BATCH_OPERATIONS } from '@/database/queryByIds';
import { loadStepFor } from '@/utils/loadIncrement';
import {
  parseStartAdjustment,
  revertTargetFor,
  serializeStartAdjustment,
} from '@/utils/setAdjustment';
import {
  computeStartTarget,
  type LastWorkingSession,
  planStartChanges,
} from '@/utils/setProgression';
import { isPlannedWorkoutSet, isWarmupSet, WARMUP_SET_TYPE } from '@/utils/workoutSetCompletion';

import { ExerciseUserSettingsService } from './ExerciseUserSettingsService';
import { GymService } from './GymService';
import { SettingsService } from './SettingsService';

/** Exercises whose targets are not a load and reps to progress. */
const NON_PROGRESSING_MECHANICS: readonly string[] = ['cardio', 'mobility', 'stretching'];

/**
 * Start-of-workout progression: the numbers a freshly started workout begins at, and undoing them.
 * The arithmetic is pure (`computeStartTarget`, `planStartChanges`); this owns the reads and the
 * one writer around it.
 */
export class WorkoutProgressionService {
  /**
   * Starts each exercise of a freshly created workout from how its last session went, when the
   * user's autonomy setting is `suggest`: more load, more reps, a deload, or a repeat — each
   * recorded on the set (`adjustment_json`) so the session can say what it did and offer to undo it.
   *
   * The sets it rewrites are read and written in ONE writer. History (the previous sessions) is
   * read before it, in parallel: this write cannot change another workout's sets, so there is no
   * check to repeat, and holding the write lock across one query per exercise would block every
   * other write in the app for the length of them. A workout that has already begun (any set
   * performed or skipped) or that was already progressed is left alone, so this is safe to call
   * twice. Returns how many sets were rewritten.
   */
  static async applyStartProgression(workoutLogId: string): Promise<number> {
    if ((await SettingsService.getWorkoutAutonomy()) !== 'suggest') {
      return 0;
    }

    const gymRead = GymService.getActiveGym().catch(() => null);
    const [progressionMode, gym, unitsFor, lastByExercise] = await Promise.all([
      SettingsService.getProgressionMode(),
      gymRead,
      gymRead.then((activeGym) => ExerciseUserSettingsService.getWeightUnitsResolver(activeGym)),
      WorkoutProgressionService.getLastWorkingSessions(workoutLogId),
    ]);
    if (lastByExercise.size === 0) {
      return 0;
    }

    return await database.write(async () => {
      const logExercises = await WorkoutProgressionService.liveLogExercises(workoutLogId);
      if (logExercises.length === 0) {
        return 0;
      }

      const sets = await fetchByIds<WorkoutLogSet>(
        'workout_log_sets',
        'log_exercise_id',
        logExercises.map((exercise) => exercise.id),
        Q.where('deleted_at', Q.eq(null))
      );
      if (sets.some((set) => !isPlannedWorkoutSet(set) || set.adjustmentJson)) {
        return 0;
      }

      const exercises = await fetchMapByIds<Exercise>(
        'exercises',
        'id',
        logExercises.map((exercise) => exercise.exerciseId)
      );

      const now = Date.now();
      const operations: Model[] = [];
      for (const logExercise of logExercises) {
        const exercise = exercises.get(logExercise.exerciseId);
        const last = lastByExercise.get(logExercise.exerciseId);
        if (!exercise || !last || NON_PROGRESSING_MECHANICS.includes(exercise.mechanicType)) {
          continue;
        }

        const planned = sets
          .filter((set) => set.logExerciseId === logExercise.id && !isWarmupSet(set))
          .sort((a, b) => a.setOrder - b.setOrder);
        if (planned.length === 0) {
          continue;
        }

        const target = computeStartTarget({
          last,
          // Added load on a bodyweight move is not where its progression lives: reps are.
          progressionMode:
            exercise.equipmentType === 'bodyweight' && last.weightKg === 0
              ? 'reps_first'
              : progressionMode,
          isCompound: exercise.mechanicType === 'compound',
          ...loadStepFor(exercise.equipmentType, gym, unitsFor(exercise.id)),
        });

        const byId = new Map(planned.map((set) => [set.id, set]));
        for (const change of planStartChanges(
          planned.map((set) => ({ id: set.id, weight: set.weight, reps: set.reps })),
          target,
          last
        )) {
          operations.push(
            byId.get(change.setId)!.prepareUpdate((record) => {
              record.weight = change.weightKg;
              record.reps = change.reps;
              record.adjustmentJson = serializeStartAdjustment(change.adjustment);
              record.updatedAt = now;
            })
          );
        }
      }

      for (let start = 0; start < operations.length; start += MAX_BATCH_OPERATIONS) {
        await database.batch(...operations.slice(start, start + MAX_BATCH_OPERATIONS));
      }
      return operations.length;
    });
  }

  /**
   * Undoes a start adjustment for an exercise: each planned set that carries one goes back to the
   * other number the user could have started with (`revertTargetFor` — what they did last time, or,
   * for a "repeat", the plan's own), and the explanation is cleared. Returns how many sets changed.
   */
  static async revertStartAdjustment(logExerciseId: string): Promise<number> {
    return await database.write(async () => {
      const sets = await database
        .get<WorkoutLogSet>('workout_log_sets')
        .query(Q.where('log_exercise_id', logExerciseId), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      const now = Date.now();
      const operations: Model[] = [];
      for (const set of sets) {
        const adjustment = isPlannedWorkoutSet(set)
          ? parseStartAdjustment(set.adjustmentJson)
          : null;
        if (!adjustment) {
          continue;
        }
        const { weightKg, reps } = revertTargetFor(adjustment);
        operations.push(
          set.prepareUpdate((record) => {
            record.weight = weightKg;
            record.reps = reps;
            record.adjustmentJson = undefined;
            record.updatedAt = now;
          })
        );
      }

      if (operations.length > 0) {
        await database.batch(...operations);
      }
      return operations.length;
    });
  }

  private static liveLogExercises(workoutLogId: string): Promise<WorkoutLogExercise[]> {
    return database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .query(Q.where('workout_log_id', workoutLogId), Q.where('deleted_at', Q.eq(null)))
      .fetch();
  }

  /** The last working session of every exercise in this workout, read in parallel. */
  private static async getLastWorkingSessions(
    workoutLogId: string
  ): Promise<Map<string, LastWorkingSession>> {
    const exerciseIds = [
      ...new Set(
        (await WorkoutProgressionService.liveLogExercises(workoutLogId)).map(
          (logExercise) => logExercise.exerciseId
        )
      ),
    ];
    const sessions = await Promise.all(
      exerciseIds.map(async (exerciseId) => {
        const last = await WorkoutProgressionService.getLastWorkingSession(
          exerciseId,
          workoutLogId
        );
        return [exerciseId, last] as const;
      })
    );

    const byExercise = new Map<string, LastWorkingSession>();
    for (const [exerciseId, last] of sessions) {
      if (last) {
        byExercise.set(exerciseId, last);
      }
    }
    return byExercise;
  }

  /**
   * The first working set and the average reps in reserve of an exercise's most recent session,
   * leaving out the workout being started. A session that only warmed up has no working sets and is
   * passed over for the one before it.
   */
  private static async getLastWorkingSession(
    exerciseId: string,
    excludeWorkoutLogId: string
  ): Promise<LastWorkingSession | null> {
    const recent = await database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .query(
        Q.where('exercise_id', exerciseId),
        Q.where('deleted_at', Q.eq(null)),
        Q.where('workout_log_id', Q.notEq(excludeWorkoutLogId)),
        Q.sortBy('created_at', Q.desc),
        Q.take(5)
      )
      .fetch();

    for (const logExercise of recent) {
      const working = await database
        .get<WorkoutLogSet>('workout_log_sets')
        .query(
          Q.where('log_exercise_id', logExercise.id),
          Q.where('deleted_at', Q.eq(null)),
          Q.where('completion_status', 'performed'),
          Q.where('set_type', Q.notEq(WARMUP_SET_TYPE)),
          Q.sortBy('set_order', Q.asc)
        )
        .fetch();
      if (working.length === 0) {
        continue;
      }

      return {
        weightKg: working[0].weight,
        reps: working[0].reps,
        averageRepsInReserve:
          working.reduce((sum, set) => sum + (set.repsInReserve ?? 0), 0) / working.length,
      };
    }

    return null;
  }
}
