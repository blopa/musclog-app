export const FALLBACK_EXERCISE_IMAGE = require('../assets/exercise-fallback.png');

/**
 * Prefix for the primary key of every catalogue ("app") exercise. The rest of the id is
 * the exercise's free-exercise-db slug, which is also its image directory — so an id
 * derives its own image URL and nothing has to keep a numeric index in lockstep.
 *
 * The prefix also keeps the catalogue in a namespace disjoint from the pre-2.12 catalogue,
 * whose rows used `String(exerciseIndex)` ("1".."256"). Database exports carry those ids
 * verbatim, so restoring an old backup must not be able to collide with a catalogue row.
 */
export const APP_EXERCISE_ID_PREFIX = 'fx-';

export function appExerciseId(freeExerciseDbId: string): string {
  return `${APP_EXERCISE_ID_PREFIX}${freeExerciseDbId}`;
}

/** Returns the free-exercise-db slug for a catalogue exercise id, or null for any other id. */
export function exerciseSlugFromId(id: string): null | string {
  return id.startsWith(APP_EXERCISE_ID_PREFIX)
    ? id.slice(APP_EXERCISE_ID_PREFIX.length) || null
    : null;
}

export function buildExerciseImagePath(freeExerciseDbId: string, frame: 0 | 1 = 0): string {
  return `/images/exercises/${freeExerciseDbId}/${frame}.webp`;
}

/**
 * Returns the hosted URL for a catalogue exercise photo. Frame 0 is the start position and
 * frame 1 the end position; only frame 0 is stored on the exercise row.
 *
 * Kept in step with `scripts/generate-exercise-images.js`, which writes these files, and
 * with `app/(website)/exercises.web.tsx`, which renders them.
 */
export function buildExerciseCloudUrl(freeExerciseDbId: string, frame: 0 | 1 = 0): string {
  return `https://musclog.app${buildExerciseImagePath(freeExerciseDbId, frame)}`;
}

export function buildLegacyExerciseImagePath(exerciseNumber: number): string {
  return `/images/exercises/legacy/exercise${exerciseNumber}.webp`;
}

/**
 * Returns the hosted URL for one of the retired AI illustrations. These exist only for
 * exercises cloned out of the pre-free-exercise-db catalogue by
 * `LegacyExerciseCatalogueMigration`, so that a workout a user has been running
 * for a year keeps its picture. Nothing new is ever given one of these URLs.
 */
export function buildLegacyExerciseCloudUrl(exerciseNumber: number): string {
  return `https://musclog.app${buildLegacyExerciseImagePath(exerciseNumber)}`;
}
