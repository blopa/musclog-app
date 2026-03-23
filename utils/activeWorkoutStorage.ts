import AsyncStorage from '@react-native-async-storage/async-storage';

import { NotificationService } from '../services/NotificationService';

const ACTIVE_WORKOUT_KEY = 'active_workout_log_id';
const WORKOUT_INSIGHTS_PREFIX = 'workout_insights_';

/**
 * Get the active workout log ID from AsyncStorage
 */
export async function getActiveWorkoutLogId(): Promise<string | null> {
  try {
    const workoutLogId = await AsyncStorage.getItem(ACTIVE_WORKOUT_KEY);
    return workoutLogId;
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
 */
export async function clearActiveWorkoutLogId(): Promise<void> {
  try {
    const workoutLogId = await getActiveWorkoutLogId();
    if (workoutLogId) {
      await AsyncStorage.removeItem(`${WORKOUT_INSIGHTS_PREFIX}${workoutLogId}`);
    }

    await AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY);
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
    await AsyncStorage.setItem(`${WORKOUT_INSIGHTS_PREFIX}${workoutLogId}`, JSON.stringify(updated));
  } catch (error) {
    console.error('Error setting dismissed insight in storage:', error);
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
