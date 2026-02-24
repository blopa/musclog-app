import AsyncStorage from '@react-native-async-storage/async-storage';

import { CURRENT_USER_SYNC_ID } from '../constants/auth';

/**
 * Get the current user's sync_id from AsyncStorage.
 * Used so we can resolve "current user" by stable ID (sync-friendly).
 */
export async function getCurrentUserSyncId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CURRENT_USER_SYNC_ID);
  } catch (error) {
    console.error('Error getting current user sync id from storage:', error);
    return null;
  }
}

/**
 * Set the current user's sync_id in AsyncStorage.
 */
export async function setCurrentUserSyncId(syncId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CURRENT_USER_SYNC_ID, syncId);
  } catch (error) {
    console.error('Error setting current user sync id in storage:', error);
    throw error;
  }
}

/**
 * Clear the current user sync_id from AsyncStorage (e.g. on logout).
 */
export async function clearCurrentUserSyncId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CURRENT_USER_SYNC_ID);
  } catch (error) {
    console.error('Error clearing current user sync id from storage:', error);
    throw error;
  }
}
