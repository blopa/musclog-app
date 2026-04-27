import { version as APP_VERSION } from '@/package.json';

export const FALLBACK_EXERCISE_IMAGE = require('../assets/exercise-fallback.png');

const GITHUB_BASE_URL = `https://raw.githubusercontent.com/blopa/musclog-app/refs/tags/${APP_VERSION}/assets/exercises`;

/**
 * Returns the GitHub raw-content URL for the exercise image that corresponds to
 * the given exercisesEnUS.json array index (0-based).
 * The URL always points to the version tag matching the current package.json version.
 */
export function buildExerciseCloudUrl(exerciseNumber: number): string {
  return `${GITHUB_BASE_URL}/exercise${exerciseNumber}.png`;
}
