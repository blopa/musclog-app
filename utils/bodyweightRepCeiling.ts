/**
 * How far an unloaded bodyweight exercise climbs in reps before the app stops adding them.
 *
 * Sets taken close to failure build muscle across a wide range of reps, but past this point they are
 * long, fatigue-limited and better progressed another way (a weighted vest or dip belt, a harder
 * variation, a slower tempo). The app cannot know which of those the lifter has, so at the ceiling
 * it holds the reps and says so instead of inventing an external load.
 */
export const DEFAULT_BODYWEIGHT_REP_CEILING = 25;

/** The ceilings a user may pick per exercise; a picker, never a free number. */
export const BODYWEIGHT_REP_CEILING_OPTIONS = [25, 30, 35, 40, 45, 50] as const;

export type BodyweightRepCeiling = (typeof BODYWEIGHT_REP_CEILING_OPTIONS)[number];

export const isBodyweightRepCeiling = (value: unknown): value is BodyweightRepCeiling =>
  BODYWEIGHT_REP_CEILING_OPTIONS.includes(value as BodyweightRepCeiling);

/**
 * The value stored in `exercise_user_settings.rep_ceiling`: only a ceiling that differs from the
 * default is stored, so "no row" and "the default" stay the same thing, and anything this build
 * does not offer (a newer build's value, a hand-edited backup) is no statement at all.
 */
export const storedRepCeiling = (value: unknown): BodyweightRepCeiling | undefined =>
  isBodyweightRepCeiling(value) && value !== DEFAULT_BODYWEIGHT_REP_CEILING ? value : undefined;

/** The ceiling an exercise progresses up to, from its stored value. */
export const resolveRepCeiling = (stored: unknown): BodyweightRepCeiling =>
  storedRepCeiling(stored) ?? DEFAULT_BODYWEIGHT_REP_CEILING;
