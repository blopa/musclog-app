import type Exercise from '@/database/models/Exercise';

import { calculateWorkoutKcal, type MWEMInput } from './workoutEnergyCalculator';
import { isPerformedWorkoutSet, type WorkoutSetCompletionState } from './workoutSetCompletion';

export type WorkoutEnergyProfile = MWEMInput['user'];

type EstimatedSet = WorkoutSetCompletionState & {
  exerciseId: string;
  weight?: number | null;
  reps?: number | null;
};

/**
 * Estimated energy for a finished workout (MWEM, performed sets only), rounded to whole kcal.
 * A set whose exercise is not in `exercises` contributes nothing.
 */
export function estimateWorkoutKcalFromSets(
  profile: WorkoutEnergyProfile,
  sets: readonly EstimatedSet[],
  exercises: readonly Pick<
    Exercise,
    'id' | 'mechanicType' | 'muscleGroup' | 'equipmentType' | 'loadMultiplier'
  >[]
): number {
  const setsByExercise = new Map<string, EstimatedSet[]>();
  for (const set of sets.filter(isPerformedWorkoutSet)) {
    const exerciseSets = setsByExercise.get(set.exerciseId) ?? [];
    exerciseSets.push(set);
    setsByExercise.set(set.exerciseId, exerciseSets);
  }

  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  const inputs = [...setsByExercise].flatMap(([exerciseId, exerciseSets]): MWEMInput[] => {
    const exercise = exerciseById.get(exerciseId);
    if (!exercise) {
      return [];
    }

    return [
      {
        user: profile,
        exercise: {
          mechanicType: exercise.mechanicType,
          muscleGroup: exercise.muscleGroup,
          equipmentType: exercise.equipmentType,
          loadMultiplier: exercise.loadMultiplier ?? 1,
        },
        sets: exerciseSets.map((set) => ({ weight: set.weight ?? 0, reps: set.reps ?? 0 })),
      },
    ];
  });

  return Math.round(calculateWorkoutKcal(inputs));
}
