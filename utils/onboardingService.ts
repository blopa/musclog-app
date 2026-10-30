import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  AI_ONBOARDING_DRAFT,
  CURRENT_ONBOARDING_VERSION,
  ONBOARDING_COMPLETED,
  ONBOARDING_CURRENT_STEP,
  ONBOARDING_VERSION,
  PERSONALIZED_BODY_DRAFT,
  TEMP_NUTRITION_PLAN,
} from '@/constants/misc';
import {
  CONFETTI_ALL_DONE_SENTINEL,
  CONFETTI_INTERACTIONS_KEY,
  ConfettiActivity,
} from '@/context/ConfettiInteractionsContext';
import { getAppVersion } from '@/utils/appVersion';
import { getWhatsNewSeenThrough, whatsNewSeenEntry } from '@/utils/whatsNew/storage';
import { nextSeenThrough } from '@/utils/whatsNew/version';

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
  version: string = CURRENT_ONBOARDING_VERSION,
  { markAnnouncementsSeen = true }: { markAnnouncementsSeen?: boolean } = {}
): Promise<void> => {
  await AsyncStorage.multiSet([
    [ONBOARDING_COMPLETED, 'true'],
    [ONBOARDING_VERSION, version],
    ...(markAnnouncementsSeen
      ? [whatsNewSeenEntry(nextSeenThrough(await getWhatsNewSeenThrough(), getAppVersion()))]
      : []),
  ]);

  // `PERSONALIZED_SETUP_DATA` stays: the first-workout screen still reads the experience from it.
  await AsyncStorage.multiRemove([
    ONBOARDING_CURRENT_STEP,
    TEMP_NUTRITION_PLAN,
    AI_ONBOARDING_DRAFT,
    PERSONALIZED_BODY_DRAFT,
  ]);

  // Remove ONBOARDING_COMPLETED from pending confetti activities (new subtractive model).
  try {
    const stored = await AsyncStorage.getItem(CONFETTI_INTERACTIONS_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const pending = parsed.filter((a: string) => a !== ConfettiActivity.ONBOARDING_COMPLETED);
        if (pending.length === 0) {
          await AsyncStorage.setItem(CONFETTI_INTERACTIONS_KEY, CONFETTI_ALL_DONE_SENTINEL);
        } else {
          await AsyncStorage.setItem(CONFETTI_INTERACTIONS_KEY, JSON.stringify(pending));
        }
      }
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
    AI_ONBOARDING_DRAFT,
    PERSONALIZED_BODY_DRAFT,
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
