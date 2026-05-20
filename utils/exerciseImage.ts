export const FALLBACK_EXERCISE_IMAGE = require('../assets/exercise-fallback.png');

/**
 * Returns the GitHub raw-content URL for the exercise image that corresponds to
 * the given exercisesEnUS.json array index (0-based).
 * The URL always points to the version tag matching the current package.json version.
 */
export function buildExerciseCloudUrl(exerciseNumber: number): string {
  return `https://musclog.app/images/exercises/exercise${exerciseNumber}.png`;
}
