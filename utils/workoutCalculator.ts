import { EXERCISE_TYPES } from '../constants/exercises';

export async function calculateWorkoutVolume(
  exercises: any[],
  bodyWeight: number = 0
): Promise<number> {
  // TODO: implement this
  try {
    let totalVolume = 0;

    for (const { exercise, sets } of exercises) {
      let addedWeight = 0;

      if (exercise?.mechanicType === EXERCISE_TYPES.BODY_WEIGHT) {
        addedWeight = bodyWeight || 0;
      }

      for (const set of sets) {
        totalVolume += calculateAverage1RM(set.weight + addedWeight, set.reps);
      }
    }

    return Math.round(totalVolume * 100) / 100;
  } catch (error) {
    console.error('Error calculating workout volume:', error);
    throw error;
  }
}

export function calculateAverage1RM(weight: number, reps: number, rir: number = 0) {
  try {
    const formulas = ['Epley', 'Brzycki', 'Lander', 'Lombardi', 'Mayhew', 'OConner', 'Wathan'];
    let total1RM = 0;
    let validFormulas = 0;

    formulas.forEach((formula) => {
      const oneRM = calculate1RM(weight, reps, formula, rir);
      if (oneRM) {
        total1RM += oneRM;
        validFormulas++;
      }
    });

    return total1RM / validFormulas;
  } catch (error) {
    console.error('Error calculating average 1RM:', error);
    throw error;
  }
}

// TODO: validate that these formulas are correct
export function calculate1RM(weight: number, reps: number, formula: string, rir: number = 0) {
  const adjustedReps = reps + rir;
  try {
    switch (formula) {
      case 'Brzycki': {
        return weight / (1.0278 - 0.0278 * adjustedReps);
      }
      case 'Epley': {
        return weight * (1 + adjustedReps / 30);
      }
      case 'Lander': {
        return weight / (1.013 - 0.0267123 * adjustedReps);
      }
      case 'Lombardi': {
        return weight * Math.pow(adjustedReps, 0.1);
      }
      case 'Mayhew': {
        return weight / (0.522 + 0.419 * Math.exp(-0.055 * adjustedReps));
      }
      case 'OConner': {
        return weight * (1 + 0.025 * adjustedReps);
      }
      case 'Wathan': {
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
