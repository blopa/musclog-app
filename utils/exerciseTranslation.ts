/**
 * Utility functions for translating exercise-related data (muscle groups, equipment types, mechanic types)
 * These functions return translation keys that can be used with i18next's t() function
 */

/**
 * Get translation key for muscle group
 * @param muscleGroup - Raw muscle group value from database
 * @returns Translation key for the muscle group
 */
export function getMuscleGroupTranslationKey(muscleGroup: string): string {
  const normalized = muscleGroup?.toLowerCase() || '';

  // Map normalized values to translation keys
  if (normalized.includes('chest')) {
    return 'workout.muscleGroups.chest';
  }
  if (normalized.includes('back') || normalized.includes('lat')) {
    return 'workout.muscleGroups.back';
  }
  if (
    normalized.includes('leg') ||
    normalized.includes('quad') ||
    normalized.includes('hamstring') ||
    normalized.includes('calf') ||
    normalized.includes('glute')
  ) {
    return 'workout.muscleGroups.legs';
  }
  if (
    normalized.includes('arm') ||
    normalized.includes('bicep') ||
    normalized.includes('tricep') ||
    normalized.includes('shoulder') ||
    normalized.includes('deltoid')
  ) {
    return 'workout.muscleGroups.arms';
  }

  return 'workout.muscleGroups.other';
}

/**
 * Get translation key for exercise type/equipment
 * @param exerciseType - Raw exercise type or equipment value from database
 * @returns Translation key for the exercise type
 */
export function getExerciseTypeTranslationKey(exerciseType: string): string {
  return `workout.exerciseTypes.${exerciseType.toLowerCase()}`;
}

/**
 * Get translation key for mechanic type
 * @param mechanicType - Raw mechanic type value from database
 * @returns Translation key for the mechanic type
 */
export function getMechanicTypeTranslationKey(mechanicType: string): string {
  return `workout.exerciseTypes.${mechanicType.toLowerCase()}`;
}
