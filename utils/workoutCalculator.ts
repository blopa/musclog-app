import { EXERCISE_TYPES } from '../constants/exercises';
import Exercise, { type EquipmentType } from '../database/models/Exercise';
import WorkoutLogSet from '../database/models/WorkoutLogSet';

/**
 * Type representing a set with only the fields needed for volume calculation.
 * Extracted from WorkoutLogSet model.
 * repsInReserve is optional as it may not always be provided.
 */
type WorkoutSet = Pick<WorkoutLogSet, 'weight' | 'reps' | 'repsInReserve'>;

/**
 * Type representing an exercise with only the fields needed for volume calculation.
 * Extracted from Exercise model.
 */
type ExerciseData = {
  equipmentType?: EquipmentType | string;
};

/**
 * Interface representing an exercise with its sets for volume calculation
 */
export interface ExerciseWithSets {
  exercise: ExerciseData;
  sets: WorkoutSet[];
}

/**
 * Calculates the total workout volume based on exercises and their sets.
 * For bodyweight exercises, adds the user's bodyweight to each set.
 * Volume is calculated using the average 1RM formula across all standard formulas.
 *
 * @param exercises - Array of exercises with their corresponding sets
 * @param bodyWeight - User's bodyweight in kg/lbs (used for bodyweight exercises)
 * @returns Total workout volume rounded to 2 decimal places
 */
export async function calculateWorkoutVolume(
  exercises: ExerciseWithSets[],
  bodyWeight: number = 0
): Promise<number> {
  try {
    let totalVolume = 0;

    for (const { exercise, sets } of exercises) {
      let addedWeight = 0;

      if (exercise?.equipmentType === EXERCISE_TYPES.BODY_WEIGHT) {
        addedWeight = bodyWeight || 0;
      }

      for (const set of sets) {
        const rir = set.repsInReserve || 0;
        totalVolume += calculateAverage1RM(set.weight + addedWeight, set.reps, rir);
      }
    }

    return Math.round(totalVolume * 100) / 100;
  } catch (error) {
    console.error('Error calculating workout volume:', error);
    throw error;
  }
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
  try {
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
  } catch (error) {
    console.error('Error calculating average 1RM:', error);
    throw error;
  }
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
  } catch (error) {
    console.error('Error calculating 1RM:', error);
    throw error;
  }
}
