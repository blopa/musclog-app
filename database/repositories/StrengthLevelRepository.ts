import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import type Exercise from '@/database/models/Exercise';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import type WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { fetchByIds } from '@/database/queryByIds';
import { UserMetricService } from '@/database/services/UserMetricService';
import { UserService } from '@/database/services/UserService';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import {
  bestEstimated1RmKg,
  gradeStrength,
  STRENGTH_LEVEL_WINDOW_DAYS,
  type StrengthGrade,
  type StrengthSetInput,
} from '@/utils/strengthLevel';
import { isWorkingSet } from '@/utils/workoutSetCompletion';

export interface ExerciseStrengthGrade {
  exerciseId: string;
  exerciseName: string;
  estimated1RmKg: number;
  grade: StrengthGrade;
}

export interface StrengthGradeState {
  grades: Map<string, ExerciseStrengthGrade>;
  /**
   * A listed lift has a working set in the window but there is no weigh-in, so no level can be
   * shown. Lets the card say what is missing instead of rendering nothing.
   */
  performedWithoutWeighIn: boolean;
}

const EMPTY_STATE: StrengthGradeState = { grades: new Map(), performedWithoutWeighIn: false };

/**
 * Strength levels for the lifts that have one. Sets are plaintext; the only decryption is the
 * latest body weight, read once per call. The user's sex comes from the plaintext user row.
 */
export class StrengthLevelRepository {
  static async fetchGrades(
    exerciseIds: readonly string[],
    now: number
  ): Promise<Map<string, ExerciseStrengthGrade>> {
    return (await this.fetchGradeState(exerciseIds, now)).grades;
  }

  static async fetchGradeState(
    exerciseIds: readonly string[],
    now: number
  ): Promise<StrengthGradeState> {
    const wanted = new Set(exerciseIds);
    if (wanted.size === 0) {
      return EMPTY_STATE;
    }

    const windowStart = now - STRENGTH_LEVEL_WINDOW_DAYS * MS_PER_SOLAR_DAY;
    const logs = await database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('completed_at', Q.notEq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.where('started_at', Q.gte(windowStart)),
        Q.where('started_at', Q.lte(now))
      )
      .fetch();
    if (logs.length === 0) {
      return EMPTY_STATE;
    }

    const logExercises = (
      await fetchByIds<WorkoutLogExercise>(
        'workout_log_exercises',
        'workout_log_id',
        logs.map((log) => log.id),
        Q.where('deleted_at', Q.eq(null))
      )
    ).filter((logExercise) => wanted.has(logExercise.exerciseId));
    if (logExercises.length === 0) {
      return EMPTY_STATE;
    }

    const exerciseByLogExercise = new Map(
      logExercises.map((logExercise) => [logExercise.id, logExercise.exerciseId])
    );
    const sets = await fetchByIds<WorkoutLogSet>(
      'workout_log_sets',
      'log_exercise_id',
      logExercises.map((logExercise) => logExercise.id),
      Q.where('deleted_at', Q.eq(null))
    );

    const setsByExercise = new Map<string, StrengthSetInput[]>();
    let hasPerformedLift = false;
    for (const set of sets) {
      const exerciseId = exerciseByLogExercise.get(set.logExerciseId);
      if (!exerciseId || !isWorkingSet(set)) {
        continue;
      }

      hasPerformedLift = true;
      const list = setsByExercise.get(exerciseId) ?? [];
      list.push({
        weightKg: set.weight,
        reps: set.reps,
        repsInReserve: set.repsInReserve,
        rirRecorded: set.rirRecorded === true,
        isWorkingSet: true,
      });
      setsByExercise.set(exerciseId, list);
    }

    if (!hasPerformedLift) {
      return EMPTY_STATE;
    }

    const bodyWeightKg = await UserMetricService.getLatestWeightKg();
    if (bodyWeightKg === null) {
      return { grades: new Map(), performedWithoutWeighIn: true };
    }

    const bestByExercise = new Map<string, number>();
    for (const [exerciseId, list] of setsByExercise) {
      const best = bestEstimated1RmKg(list);
      if (best !== null) {
        bestByExercise.set(exerciseId, best);
      }
    }

    if (bestByExercise.size === 0) {
      return EMPTY_STATE;
    }

    const [user, exercises] = await Promise.all([
      UserService.getCurrentUser(),
      fetchByIds<Exercise>(
        'exercises',
        'id',
        [...bestByExercise.keys()],
        Q.where('deleted_at', Q.eq(null))
      ),
    ]);
    const gender = user?.gender ?? 'other';

    const grades = new Map<string, ExerciseStrengthGrade>();
    for (const exercise of exercises) {
      const estimated1RmKg = bestByExercise.get(exercise.id);
      if (estimated1RmKg === undefined) {
        continue;
      }

      const grade = gradeStrength({
        estimated1RmKg,
        bodyWeightKg,
        loadMultiplier: exercise.loadMultiplier,
        gender,
        muscleGroup: exercise.muscleGroup,
      });
      if (grade) {
        grades.set(exercise.id, {
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          estimated1RmKg,
          grade,
        });
      }
    }

    return { grades, performedWithoutWeighIn: false };
  }
}
