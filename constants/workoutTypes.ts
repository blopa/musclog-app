/**
 * Workout type used for templates and logs (strength, cardio, flexibility, calisthenics, other).
 */

export type WorkoutType = 'strength' | 'cardio' | 'flexibility' | 'calisthenics' | 'other' | 'free';

export const WORKOUT_TYPES: WorkoutType[] = [
  'strength',
  'cardio',
  'flexibility',
  'calisthenics',
  'other',
  'free',
];

export const DEFAULT_WORKOUT_TYPE: WorkoutType = 'strength';

export function isWorkoutType(value: string | undefined): value is WorkoutType {
  return WORKOUT_TYPES.includes(value as WorkoutType);
}
