import AsyncStorage from '@react-native-async-storage/async-storage';

import { NotificationService } from '../services/NotificationService';

const ACTIVE_WORKOUT_KEY = 'active_workout_log_id';

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
