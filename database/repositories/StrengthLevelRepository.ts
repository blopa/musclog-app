import { Q } from '@nozbe/watermelondb';

import type Exercise from '@/database/models/Exercise';
import { fetchByIds } from '@/database/queryByIds';
import { UserMetricService } from '@/database/services/UserMetricService';
import { UserService } from '@/database/services/UserService';
import { fetchCompletedSetHistory } from '@/database/workoutSetHistory';
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

export const EMPTY_STRENGTH_STATE: StrengthGradeState = {
  grades: new Map(),
  performedWithoutWeighIn: false,
};

/**
 * Strength levels for the lifts that have one. Sets are plaintext; the only decryption is the
 * latest body weight, read once per call. The user's sex comes from the plaintext user row.
 */
export class StrengthLevelRepository {
  static async fetchGradeState(
    exerciseIds: readonly string[],
    now: number
  ): Promise<StrengthGradeState> {
    const wanted = new Set(exerciseIds);
    if (wanted.size === 0) {
      return EMPTY_STRENGTH_STATE;
    }

    const { logExercises, sets } = await fetchCompletedSetHistory({
      startedFrom: now - STRENGTH_LEVEL_WINDOW_DAYS * MS_PER_SOLAR_DAY,
      startedTo: now,
      exerciseIds: wanted,
    });
    const exerciseByLogExercise = new Map(
      logExercises.map((logExercise) => [logExercise.id, logExercise.exerciseId])
    );

    const setsByExercise = new Map<string, StrengthSetInput[]>();
    for (const set of sets) {
      const exerciseId = exerciseByLogExercise.get(set.logExerciseId);
      if (!exerciseId || !isWorkingSet(set)) {
        continue;
      }

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

    if (setsByExercise.size === 0) {
      return EMPTY_STRENGTH_STATE;
    }

    const [bodyWeightKg, user, exercises] = await Promise.all([
      UserMetricService.getLatestWeightKg(),
      UserService.getCurrentUser(),
      fetchByIds<Exercise>(
        'exercises',
        'id',
        [...setsByExercise.keys()],
        Q.where('deleted_at', Q.eq(null))
      ),
    ]);
    if (bodyWeightKg === null) {
      return { grades: new Map(), performedWithoutWeighIn: true };
    }

    const gender = user?.gender ?? 'other';
    const grades = new Map<string, ExerciseStrengthGrade>();
    for (const exercise of exercises) {
      const estimated1RmKg = bestEstimated1RmKg(setsByExercise.get(exercise.id) ?? []);
      if (estimated1RmKg === null) {
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
