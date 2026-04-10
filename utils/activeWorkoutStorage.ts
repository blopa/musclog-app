import AsyncStorage from '@react-native-async-storage/async-storage';

import { NotificationService } from '@/services/NotificationService';

const ACTIVE_WORKOUT_KEY = 'active_workout_log_id';
const WORKOUT_INSIGHTS_PREFIX = 'workout_insights_';
const REST_TIMER_END_AT_KEY = 'rest_timer_end_at';
const REST_TIMER_WORKOUT_KEY = 'rest_timer_workout_log_id';

/**
 * Get the active workout log ID from AsyncStorage
 */
export async function getActiveWorkoutLogId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_WORKOUT_KEY);
  } catch (error) {
    console.error('Error getting active workout from storage:', error);
    return null;
  }
}

/**
 * Set the active workout log ID in AsyncStorage
 */
export async function setActiveWorkoutLogId(workoutLogId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_WORKOUT_KEY, workoutLogId);
  } catch (error) {
    console.error('Error setting active workout in storage:', error);
    throw error;
  }
}

/**
 * Clear the active workout log ID from AsyncStorage and dismiss the active workout notification.
 * Uses atomic multiRemove to prevent race conditions.
 */
export async function clearActiveWorkoutLogId(): Promise<void> {
  try {
    const workoutLogId = await getActiveWorkoutLogId();
    const keysToRemove: string[] = [ACTIVE_WORKOUT_KEY];

    // Collect all keys to remove in a single atomic operation
    if (workoutLogId) {
      keysToRemove.push(`${WORKOUT_INSIGHTS_PREFIX}${workoutLogId}`);
    }

    // Atomic removal of all keys at once to prevent race conditions
    await AsyncStorage.multiRemove(keysToRemove);

    // Dismiss notification after storage is cleared
    await NotificationService.dismissActiveWorkoutNotification();
  } catch (error) {
    console.error('Error clearing active workout from storage:', error);
    throw error;
  }
}

/**
 * Check if there's an active workout
 */
export async function hasActiveWorkout(): Promise<boolean> {
  const workoutLogId = await getActiveWorkoutLogId();
  return workoutLogId !== null;
}

/**
 * Get the dismissed insights for a specific workout
 */
export async function getDismissedInsights(
  workoutLogId: string
): Promise<{ hormonal?: boolean; fueling?: boolean }> {
  try {
    const data = await AsyncStorage.getItem(`${WORKOUT_INSIGHTS_PREFIX}${workoutLogId}`);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error getting dismissed insights from storage:', error);
    return {};
  }
}

/**
 * Mark an insight as dismissed for a specific workout
 */
export async function setInsightDismissed(
  workoutLogId: string,
  insightType: 'hormonal' | 'fueling'
): Promise<void> {
  try {
    const current = await getDismissedInsights(workoutLogId);
    const updated = { ...current, [insightType]: true };
    await AsyncStorage.setItem(
      `${WORKOUT_INSIGHTS_PREFIX}${workoutLogId}`,
      JSON.stringify(updated)
    );
  } catch (error) {
    console.error('Error setting dismissed insight in storage:', error);
  }
}

/**
 * Get the wall-clock end timestamp for the current rest timer.
 * Returns null if no timer is stored or it belongs to a different workout.
 */
export async function getRestTimerEndAt(workoutLogId: string): Promise<number | null> {
  try {
    const [endAt, ownerLogId] = await Promise.all([
      AsyncStorage.getItem(REST_TIMER_END_AT_KEY),
      AsyncStorage.getItem(REST_TIMER_WORKOUT_KEY),
    ]);

    if (!endAt || ownerLogId !== workoutLogId) {
      return null;
    }

    return parseInt(endAt, 10);
  } catch (error) {
    console.error('Error getting rest timer end timestamp from storage:', error);
    return null;
  }
}

/**
 * Persist the wall-clock end timestamp for the current rest timer.
 */
export async function setRestTimerEndAt(workoutLogId: string, endAt: number): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(REST_TIMER_END_AT_KEY, String(endAt)),
      AsyncStorage.setItem(REST_TIMER_WORKOUT_KEY, workoutLogId),
    ]);
  } catch (error) {
    console.error('Error saving rest timer end timestamp to storage:', error);
  }
}

/**
 * Clear the rest timer end timestamp from AsyncStorage.
 * Call this when the rest is skipped, completed, or the workout ends.
 */
export async function clearRestTimerEndAt(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(REST_TIMER_END_AT_KEY),
      AsyncStorage.removeItem(REST_TIMER_WORKOUT_KEY),
    ]);
  } catch (error) {
    console.error('Error clearing rest timer end timestamp from storage:', error);
  }
}

/**
 * Prune any orphaned workout insight dismissal states from AsyncStorage.
 * Clears all insight keys except for the one belonging to the currently active workout.
 */
export async function pruneWorkoutInsights(): Promise<void> {
  try {
    const activeWorkoutLogId = await getActiveWorkoutLogId();
    const allKeys = await AsyncStorage.getAllKeys();
    const insightKeys = allKeys.filter((key) => key.startsWith(WORKOUT_INSIGHTS_PREFIX));

    const activeInsightKey = activeWorkoutLogId
      ? `${WORKOUT_INSIGHTS_PREFIX}${activeWorkoutLogId}`
      : null;

    const keysToRemove = insightKeys.filter((key) => key !== activeInsightKey);

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
    }
  } catch (error) {
    console.error('Error pruning workout insights from storage:', error);
  }
}
