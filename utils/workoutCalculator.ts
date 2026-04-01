import convert from 'convert';

import { EXERCISE_TYPES } from '../constants/exercises';
import type { EquipmentType } from '../database/models';
import WorkoutLogSet from '../database/models/WorkoutLogSet';
import { UserMetricService } from '../database/services';
import { roundToDecimalPlaces } from './roundDecimal';

/**
 * Set fields needed for volume calculation (matches WorkoutLogSet subset).
 */
export type WorkoutSetInput = Pick<WorkoutLogSet, 'weight' | 'reps' | 'repsInReserve'>;

/**
 * Exercise fields needed for volume calculation.
 */
export type ExerciseVolumeData = {
  equipmentType?: EquipmentType | string;
};

/**
 * Interface representing an exercise with its sets for volume calculation
 */
export interface ExerciseWithSets {
  exercise: ExerciseVolumeData;
  sets: WorkoutSetInput[];
}

/**
 * Latest user body weight in kg for volume (bodyweight exercises). Returns 0 if unknown.
 */
export async function getUserBodyWeightKgForVolume(): Promise<number> {
  const weightMetric = await UserMetricService.getLatest('weight');
  if (!weightMetric) {
    return 0;
  }

  const decrypted = await weightMetric.getDecrypted();
  let kg = decrypted.value;
  if (decrypted.unit === 'lbs') {
    kg = convert(decrypted.value, 'lb').to('kg') as number;
  }

  return kg;
}

/**
 * Single-set volume: average 1RM estimate (same formula stack as full workout volume).
 */
export function calculateSetVolume(
  weight: number,
  reps: number,
  repsInReserve: number | undefined,
  equipmentType: string | undefined,
  bodyWeightKg: number
): number {
  const added = equipmentType === EXERCISE_TYPES.BODY_WEIGHT ? bodyWeightKg || 0 : 0;
  return roundToDecimalPlaces(calculateAverage1RM(weight + added, reps, repsInReserve ?? 0));
}

/**
 * Total volume for one exercise block (all sets).
 */
export function calculateExerciseVolume(
  sets: WorkoutSetInput[],
  exercise: ExerciseVolumeData,
  bodyWeightKg: number
): number {
  const added = exercise.equipmentType === EXERCISE_TYPES.BODY_WEIGHT ? bodyWeightKg || 0 : 0;
  let total = 0;
  for (const set of sets) {
    const rir = set.repsInReserve ?? 0;
    total += calculateAverage1RM(set.weight + added, set.reps, rir);
  }

  return roundToDecimalPlaces(total);
}

/**
 * Calculates the total workout volume based on exercises and their sets.
 * For bodyweight exercises, adds the user's bodyweight to each set.
 * Volume is calculated using the average 1RM formula across all standard formulas.
 *
 * @param exercises - Array of exercises with their corresponding sets
 * @param bodyWeightKg - User's bodyweight in kg (used for bodyweight exercises)
 * @returns Total workout volume rounded to 2 decimal places
 */
export function calculateWorkoutVolume(
  exercises: ExerciseWithSets[],
  bodyWeightKg: number = 0
): number {
  let totalVolume = 0;

  for (const { exercise, sets } of exercises) {
    const addedWeight =
      exercise?.equipmentType === EXERCISE_TYPES.BODY_WEIGHT ? bodyWeightKg || 0 : 0;

    for (const set of sets) {
      const rir = set.repsInReserve ?? 0;
      totalVolume += calculateAverage1RM(set.weight + addedWeight, set.reps, rir);
    }
  }

  return roundToDecimalPlaces(totalVolume);
}

/**
 * Volume for an in-session or preview UI: groups sets by exerciseId and sums using {@link calculateWorkoutVolume}.
 */
export function calculateSessionVolumeFromSets(
  sets: {
    exerciseId?: string;
    weight?: number;
    reps?: number;
    repsInReserve?: number;
    difficultyLevel?: number;
  }[],
  exerciseById: Map<string, ExerciseVolumeData>,
  bodyWeightKg: number,
  options?: { onlyCompletedSets?: boolean }
): number {
  const list = options?.onlyCompletedSets ? sets.filter((s) => (s.difficultyLevel ?? 0) > 0) : sets;
  const byExercise = new Map<string, typeof list>();
  for (const s of list) {
    const id = s.exerciseId ?? '';
    if (!byExercise.has(id)) {
      byExercise.set(id, []);
    }
    byExercise.get(id)!.push(s);
  }

  const parts: ExerciseWithSets[] = [];
  for (const [exerciseId, exerciseSets] of byExercise) {
    const ex = exerciseById.get(exerciseId);
    parts.push({
      exercise: { equipmentType: ex?.equipmentType },
      sets: exerciseSets.map((s) => ({
        weight: s.weight ?? 0,
        reps: s.reps ?? 0,
        repsInReserve: s.repsInReserve ?? 0,
      })),
    });
  }

  return calculateWorkoutVolume(parts, bodyWeightKg);
}

/**
 * Planned volume from template target sets (preview mode).
 */
export function calculatePreviewVolumeFromTemplateSets(
  templateSets: {
    exerciseId?: string;
    targetReps?: number;
    targetWeight?: number;
  }[],
  exerciseById: Map<string, ExerciseVolumeData>,
  bodyWeightKg: number
): number {
  const byExercise = new Map<string, typeof templateSets>();
  for (const s of templateSets) {
    const id = s.exerciseId ?? '';
    if (!byExercise.has(id)) {
      byExercise.set(id, []);
    }
    byExercise.get(id)!.push(s);
  }

  const parts: ExerciseWithSets[] = [];
  for (const [exerciseId, exerciseSets] of byExercise) {
    const ex = exerciseById.get(exerciseId);
    parts.push({
      exercise: { equipmentType: ex?.equipmentType },
      sets: exerciseSets.map((s) => ({
        weight: s.targetWeight ?? 0,
        reps: s.targetReps ?? 0,
        repsInReserve: 0,
      })),
    });
  }

  return calculateWorkoutVolume(parts, bodyWeightKg);
}

/**
 * Type representing the supported 1RM calculation formulas
 */
export type FormulaType =
  | 'Epley'
  | 'Brzycki'
  | 'Lander'
  | 'Lombardi'
  | 'Mayhew'
  | 'OConner'
  | 'Wathan';

/**
 * Calculates the average one-rep max (1RM) across multiple validated formulas.
 * This provides a more accurate estimate than using a single formula.
 *
 * @param weight - The weight lifted in the set
 * @param reps - Number of repetitions performed
 * @param rir - Reps in Reserve (RIR) - how many more reps could have been done
 * @returns Average 1RM across all valid formulas
 */
export function calculateAverage1RM(weight: number, reps: number, rir: number = 0): number {
  const formulas: FormulaType[] = [
    'Epley',
    'Brzycki',
    'Lander',
    'Lombardi',
    'Mayhew',
    'OConner',
    'Wathan',
  ];

  let total1RM = 0;
  let validFormulas = 0;

  formulas.forEach((formula) => {
    const oneRM = calculate1RM(weight, reps, formula, rir);
    if (oneRM !== null) {
      total1RM += oneRM;
      validFormulas++;
    }
  });

  return validFormulas > 0 ? total1RM / validFormulas : 0;
}

/**
 * Calculates the estimated one-rep max (1RM) using a specific formula.
 *
 * All formulas have been validated against their published sources:
 * - Brzycki (1993): Most commonly used, accurate for 2-10 reps
 * - Epley (1985): Good for general use, slightly more conservative
 * - Lander (1985): Similar to Brzycki, reliable for moderate rep ranges
 * - Lombardi (1989): Uses power function, works well for low reps
 * - Mayhew et al. (1992): Exponential model, accurate across wide rep range
 * - O'Connor et al. (1989): Linear model, conservative estimates
 * - Wathan (1994): Exponential model, good for higher rep ranges
 *
 * @param weight - The weight lifted in the set
 * @param reps - Number of repetitions performed
 * @param formula - The formula to use for calculation
 * @param rir - Reps in Reserve (RIR) - adjusts for submaximal effort
 * @returns Estimated 1RM, or null if formula is not recognized
 */
export function calculate1RM(
  weight: number,
  reps: number,
  formula: FormulaType,
  rir: number = 0
): number | null {
  const adjustedReps = reps + rir;

  try {
    switch (formula) {
      case 'Brzycki': {
        // Brzycki formula: 1RM = weight / (1.0278 - 0.0278 × reps)
        return weight / (1.0278 - 0.0278 * adjustedReps);
      }
      case 'Epley': {
        // Epley formula: 1RM = weight × (1 + reps/30)
        return weight * (1 + adjustedReps / 30);
      }
      case 'Lander': {
        // Lander formula: 1RM = weight / (1.013 - 0.0267123 × reps)
        return weight / (1.013 - 0.0267123 * adjustedReps);
      }
      case 'Lombardi': {
        // Lombardi formula: 1RM = weight × reps^0.1
        return weight * Math.pow(adjustedReps, 0.1);
      }
      case 'Mayhew': {
        // Mayhew formula: 1RM = weight / (0.522 + 0.419 × e^(-0.055 × reps))
        return weight / (0.522 + 0.419 * Math.exp(-0.055 * adjustedReps));
      }
      case 'OConner': {
        // O'Connor formula: 1RM = weight × (1 + 0.025 × reps)
        return weight * (1 + 0.025 * adjustedReps);
      }
      case 'Wathan': {
        // Wathan formula: 1RM = weight / (0.488 + 0.539 × e^(-0.035 × reps))
        return weight / (0.488 + 0.539 * Math.exp(-0.035 * adjustedReps));
      }
      default: {
        return null;
      }
    }
  } catch {
    return null;
  }
}

/**
 * Estimated 1RM for progressive overload / charts (average formula, same load rules as volume).
 */
export function calculateEstimated1RMForSet(
  weight: number,
  reps: number,
  repsInReserve: number | undefined,
  equipmentType: string | undefined,
  bodyWeightKg: number
): number {
  const added = equipmentType === EXERCISE_TYPES.BODY_WEIGHT ? bodyWeightKg || 0 : 0;
  return calculateAverage1RM(weight + added, reps, repsInReserve ?? 0);
}
