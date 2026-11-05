/**
 * The lifts that get a strength level. Each is the plain standard variant of a movement the
 * catalogue benchmarks with a loadMultiplier above 0, so its grade reads against the same anchor
 * as goal projection.
 *
 * Ids are catalogue primary keys, `fx-<free-exercise-db id>`. The prefix is repeated here rather
 * than imported from `utils/exerciseImage.ts` because that module loads an image asset at import
 * time, which a pure module must not do. `utils/__tests__/strengthGradedLifts.test.ts` pins every
 * id against the bundled catalogue.
 *
 * Dumbbell lifts are graded per hand, because both the catalogue multiplier and the logged weight
 * are per hand.
 */
const CATALOGUE_ID_PREFIX = 'fx-';

const GRADED_SLUGS = [
  'Barbell_Squat',
  'Barbell_Bench_Press_-_Medium_Grip',
  'Barbell_Deadlift',
  'Barbell_Shoulder_Press',
  'Standing_Military_Press',
  'Bent_Over_Barbell_Row',
  'Front_Barbell_Squat',
  'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'Romanian_Deadlift',
  'Barbell_Hip_Thrust',
  'Barbell_Curl',
  'Dumbbell_Bench_Press',
  'Dumbbell_Shoulder_Press',
  'Bent_Over_Two-Dumbbell_Row',
  'Dumbbell_Bicep_Curl',
] as const;

export const STRENGTH_GRADED_EXERCISE_IDS: ReadonlySet<string> = new Set(
  GRADED_SLUGS.map((slug) => `${CATALOGUE_ID_PREFIX}${slug}`)
);

export function isStrengthGraded(exerciseId: string | null | undefined): boolean {
  return exerciseId != null && STRENGTH_GRADED_EXERCISE_IDS.has(exerciseId);
}
