import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CURRENT_ONBOARDING_VERSION,
  ONBOARDING_COMPLETED,
  ONBOARDING_CURRENT_STEP,
  ONBOARDING_VERSION,
  TEMP_GOOGLE_USER_NAME,
} from '../constants/auth';

export interface OnboardingStatus {
  completed: boolean;
  version: string | null;
}

/**
 * Get onboarding completion status and version
 */
export const getOnboardingStatus = async (): Promise<OnboardingStatus> => {
  const [completed, version] = await AsyncStorage.multiGet([
    ONBOARDING_COMPLETED,
    ONBOARDING_VERSION,
  ]);

  return {
    completed: completed[1] === 'true',
    version: version[1] ?? null,
  };
};

/**
 * Check if onboarding is completed
 */
export const isOnboardingCompleted = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(ONBOARDING_COMPLETED);
  return value === 'true';
};

/**
 * Get the onboarding version the user saw
 */
export const getOnboardingVersion = async (): Promise<string | null> => {
  return await AsyncStorage.getItem(ONBOARDING_VERSION);
};

/**
 * Mark onboarding as completed with the specified version
 */
export const setOnboardingCompleted = async (
  version: string = CURRENT_ONBOARDING_VERSION
): Promise<void> => {
  await AsyncStorage.multiSet([
    [ONBOARDING_COMPLETED, 'true'],
    [ONBOARDING_VERSION, version],
  ]);

  await AsyncStorage.multiRemove([ONBOARDING_CURRENT_STEP, TEMP_GOOGLE_USER_NAME]);
};

/**
 * Reset onboarding status (for testing/debugging)
 */
export const resetOnboarding = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    ONBOARDING_COMPLETED,
    ONBOARDING_VERSION,
    TEMP_GOOGLE_USER_NAME,
    ONBOARDING_CURRENT_STEP,
  ]);
};

/**
 * Persist the current onboarding step (route) so the app can restore it after external auth
 */
export const setCurrentOnboardingStep = async (route: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(ONBOARDING_CURRENT_STEP, route);
  } catch (e) {
    console.warn('Failed to persist onboarding step', e);
  }
};

/**
 * Retrieve the persisted onboarding step route, or null if none
 */
export const getCurrentOnboardingStep = async (): Promise<string | null> => {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_CURRENT_STEP);
    return value;
  } catch (e) {
    console.warn('Failed to read onboarding step', e);
    return null;
  }
};
