/**
 * Chat intention constants
 * Used to persist user intent across chat interactions
 */

export const CHAT_INTENTION_KEY = 'chatIntention';

/**
 * User wants to generate a workout plan
 */
export const GENERATE_MY_WORKOUTS = 'GENERATE_MY_WORKOUTS';

/**
 * Cancel pending workout generation
 */
export const CANCEL_GENERATE_MY_WORKOUTS = 'CANCEL_GENERATE_MY_WORKOUTS';

/**
 * User wants feedback on recent workout
 */
export const GET_WORKOUT_FEEDBACK = 'GET_WORKOUT_FEEDBACK';

/**
 * User wants to analyze workout progress (intention set; analysis runs on next send)
 */
export const ANALYZE_PROGRESS = 'ANALYZE_PROGRESS';

/**
 * User wants a nutrition check (intention set; check runs on next send)
 */
export const NUTRITION_CHECK = 'NUTRITION_CHECK';

/**
 * User wants to track a meal (intention set; tracking runs on next send)
 */
export const TRACK_MEAL = 'TRACK_MEAL';

/**
 * User wants to generate a custom meal plan
 */
export const GENERATE_MEAL_PLAN = 'GENERATE_MEAL_PLAN';

/**
 * The intentions the coach can *arm* — each one parks a pending prompt in the chat and runs its
 * action on the next send — in the order the quick-action chip row lists them. Narrower than the
 * raw constants above (`CANCEL_GENERATE_MY_WORKOUTS` and `GET_WORKOUT_FEEDBACK` are one-shot
 * signals, never armed state).
 *
 * `ChatIntention` is **derived** from this array, so the type and the enumeration cannot drift:
 * `COACH_INTENTIONS` is a `Record<ChatIntention, …>` the compiler forces you to fill in, and the
 * chip row maps this array directly rather than keeping a second order list that could go stale.
 */
export const CHAT_INTENTIONS = [
  GENERATE_MY_WORKOUTS,
  GENERATE_MEAL_PLAN,
  ANALYZE_PROGRESS,
  TRACK_MEAL,
  NUTRITION_CHECK,
] as const;

export type ChatIntention = (typeof CHAT_INTENTIONS)[number];

/**
 * Narrows a persisted `CHAT_INTENTION_KEY` value. An unknown string (a stale key written by an
 * older build, or a hand-edited store) reads as "nothing armed" rather than propagating a value
 * no `Record<ChatIntention, …>` can resolve.
 */
export const parseChatIntention = (value: null | string): ChatIntention | null =>
  CHAT_INTENTIONS.includes(value as ChatIntention) ? (value as ChatIntention) : null;
