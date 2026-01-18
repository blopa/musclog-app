import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ONBOARDING_COMPLETED,
  ONBOARDING_VERSION,
  CURRENT_ONBOARDING_VERSION,
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
};

/**
 * Reset onboarding status (for testing/debugging)
 */
export const resetOnboarding = async (): Promise<void> => {
  await AsyncStorage.multiRemove([ONBOARDING_COMPLETED, ONBOARDING_VERSION]);
};
