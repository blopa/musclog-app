import AsyncStorage from '@react-native-async-storage/async-storage';

import { ConfettiActivity } from '@/context/ConfettiInteractionsContext';
import {
  CURRENT_ONBOARDING_VERSION,
  ONBOARDING_COMPLETED,
  ONBOARDING_CURRENT_STEP,
  ONBOARDING_VERSION,
  TEMP_NUTRITION_PLAN,
} from '@/constants/misc';

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

  await AsyncStorage.multiRemove([ONBOARDING_CURRENT_STEP, TEMP_NUTRITION_PLAN]);

  // Mark confetti activity as done, but don't show it yet (it's handled by the landing screen logic or similar)
  // Actually, we can just save it here, and the context will pick it up.
  try {
    const STORAGE_KEY = 'confetti_interactions_state';
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const state = stored ? JSON.parse(stored) : {};
    if (!state[ConfettiActivity.ONBOARDING_COMPLETED]) {
      state[ConfettiActivity.ONBOARDING_COMPLETED] = true;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch (e) {
    console.warn('Failed to mark onboarding confetti as completed', e);
  }
};

/**
 * Reset onboarding status (for testing/debugging)
 */
export const resetOnboarding = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    ONBOARDING_COMPLETED,
    ONBOARDING_VERSION,
    ONBOARDING_CURRENT_STEP,
    TEMP_NUTRITION_PLAN,
  ]);
};

/**
 * Persist the current onboarding step (route) so the app can restore it
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
