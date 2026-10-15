/**
 * How far an unloaded bodyweight exercise climbs in reps before the app stops adding them.
 *
 * Sets taken close to failure build muscle across a wide range of reps, but past this point they are
 * long, fatigue-limited and better progressed another way (a weighted vest or dip belt, a harder
 * variation, a slower tempo). The app cannot know which of those the lifter has, so at the ceiling
 * it holds the reps and says so instead of inventing an external load.
 */
export const DEFAULT_BODYWEIGHT_REP_CEILING = 25;

/**
 * The ceiling for a movement that shifts (nearly) the whole body — pull-ups, chin-ups, dips,
 * muscle-ups, glute-ham raises, jumps. Sets of 20+ there are endurance work; adding a belt or a
 * harder variation around 12–15 reps is the usual way on.
 */
export const WHOLE_BODY_REP_CEILING = 15;

/**
 * `loadMultiplier` at or above which a bodyweight movement counts as whole-body. For bodyweight
 * work the multiplier is the fraction of body mass moved (see AGENTS.md), so this needs no list of
 * names: pull-ups and dips are 0.99, glute-ham raises 0.85, push-ups 0.70, leg raises 0.41.
 */
const WHOLE_BODY_LOAD_MULTIPLIER = 0.85;

/** The ceilings a user may pick per exercise; a picker, never a free number. */
export const BODYWEIGHT_REP_CEILING_OPTIONS = [10, 12, 15, 20, 25, 30, 35, 40, 45, 50] as const;

export type BodyweightRepCeiling = (typeof BODYWEIGHT_REP_CEILING_OPTIONS)[number];

export const isBodyweightRepCeiling = (value: unknown): value is BodyweightRepCeiling =>
  BODYWEIGHT_REP_CEILING_OPTIONS.includes(value as BodyweightRepCeiling);

/** The ceiling an exercise climbs to when the user has not picked one. */
export const defaultRepCeilingFor = (
  loadMultiplier: number | null | undefined
): BodyweightRepCeiling =>
  (loadMultiplier ?? 0) >= WHOLE_BODY_LOAD_MULTIPLIER
    ? WHOLE_BODY_REP_CEILING
    : DEFAULT_BODYWEIGHT_REP_CEILING;

/**
 * The value stored in `exercise_user_settings.rep_ceiling`: the user's own pick, kept even when it
 * equals today's default for the movement, because the default depends on the movement and may
 * change — a lifter who chose 25 for pull-ups must not be moved to 15. Anything this build does not
 * offer (a newer build's value, a hand-edited backup) is no statement at all.
 */
export const storedRepCeiling = (value: unknown): BodyweightRepCeiling | undefined =>
  isBodyweightRepCeiling(value) ? value : undefined;

/** The ceiling an exercise progresses up to: the user's pick, else the movement's default. */
export const resolveRepCeiling = (
  stored: unknown,
  defaultCeiling: BodyweightRepCeiling
): BodyweightRepCeiling => storedRepCeiling(stored) ?? defaultCeiling;
