import { Q } from '@nozbe/watermelondb';

import type Exercise from '@/database/models/Exercise';
import type ExerciseMuscle from '@/database/models/ExerciseMuscle';
import type Muscle from '@/database/models/Muscle';
import { fetchByIds, fetchMapByIds } from '@/database/queryByIds';
import { fetchCompletedSetHistory } from '@/database/workoutSetHistory';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import { MUSCLE_LOAD_WINDOW_DAYS, type MuscleLoadSet } from '@/utils/muscleLoad';
import { isWorkingSet } from '@/utils/workoutSetCompletion';

/** A counted set, with what the UI needs to name it. */
export type MuscleLoadSetDetail = MuscleLoadSet & {
  exerciseId: string;
  exerciseName: string;
  reps: number;
  weightKg: number;
  workoutName: string;
};

/**
 * Sets from the muscle-load window, read from plaintext columns only.
 *
 * A set has no timestamp of its own, so each set takes its session's `completed_at`. That is the
 * moment the work was finished, and every set of one session shares it, so a session's sets age
 * together. Only completed, live sessions count. Warm-ups and sets that were not performed are
 * returned flagged, and `computeMuscleLoad` decides what they add (nothing).
 */
export class MuscleLoadRepository {
  static async fetchRecentSets(now: number): Promise<MuscleLoadSetDetail[]> {
    const since = now - MUSCLE_LOAD_WINDOW_DAYS * MS_PER_SOLAR_DAY;

    const { logs, logExercises, sets } = await fetchCompletedSetHistory({ startedFrom: since });
    if (logExercises.length === 0) {
      return [];
    }

    const logById = new Map(logs.map((log) => [log.id, log]));

    const exerciseIds = [...new Set(logExercises.map((logExercise) => logExercise.exerciseId))];
    const [exercises, links] = await Promise.all([
      fetchMapByIds<Exercise>('exercises', 'id', exerciseIds),
      fetchByIds<ExerciseMuscle>(
        'exercise_muscles',
        'exercise_id',
        exerciseIds,
        Q.where('deleted_at', Q.eq(null))
      ),
    ]);

    const muscles = await fetchMapByIds<Muscle>(
      'muscles',
      'id',
      [...new Set(links.map((link) => link.muscleId))],
      Q.where('deleted_at', Q.eq(null))
    );

    const musclesByExerciseId = new Map<
      string,
      { name: string; role: 'primary' | 'secondary' }[]
    >();
    for (const link of links) {
      const muscle = muscles.get(link.muscleId);
      if (!muscle) {
        continue;
      }

      const list = musclesByExerciseId.get(link.exerciseId) ?? [];
      list.push({ name: muscle.name, role: link.role === 'secondary' ? 'secondary' : 'primary' });
      musclesByExerciseId.set(link.exerciseId, list);
    }

    const logExerciseById = new Map(
      logExercises.map((logExercise) => [logExercise.id, logExercise])
    );
    const details: MuscleLoadSetDetail[] = [];

    for (const set of sets) {
      const logExercise = logExerciseById.get(set.logExerciseId);
      const log = logExercise ? logById.get(logExercise.workoutLogId) : undefined;
      if (!logExercise || !log || log.completedAt == null) {
        continue;
      }

      const exercise = exercises.get(logExercise.exerciseId);
      details.push({
        performedAt: log.completedAt,
        sessionId: log.id,
        muscles: musclesByExerciseId.get(logExercise.exerciseId) ?? [],
        isWorkingSet: isWorkingSet(set),
        mechanicType: exercise?.mechanicType ?? null,
        exerciseId: logExercise.exerciseId,
        exerciseName: exercise?.name ?? logExercise.exerciseId,
        reps: set.reps,
        weightKg: set.weight,
        workoutName: log.workoutName,
      });
    }

    return details;
  }
}
