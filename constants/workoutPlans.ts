export type WorkoutPlanCycleType = 'weekly' | 'rotating';

export const WORKOUT_PLAN_CYCLE_TYPES: WorkoutPlanCycleType[] = ['weekly', 'rotating'];

export const DEFAULT_WORKOUT_PLAN_CYCLE_TYPE: WorkoutPlanCycleType = 'weekly';

export function isWorkoutPlanCycleType(value: string | undefined): value is WorkoutPlanCycleType {
  return WORKOUT_PLAN_CYCLE_TYPES.includes(value as WorkoutPlanCycleType);
}
