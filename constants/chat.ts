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
 * action on the next send. Narrower than the raw constants above (`CANCEL_GENERATE_MY_WORKOUTS`
 * and `GET_WORKOUT_FEEDBACK` are one-shot signals, never armed state).
 */
export type ChatIntention =
  | typeof ANALYZE_PROGRESS
  | typeof GENERATE_MEAL_PLAN
  | typeof GENERATE_MY_WORKOUTS
  | typeof NUTRITION_CHECK
  | typeof TRACK_MEAL;
