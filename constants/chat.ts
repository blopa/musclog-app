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
