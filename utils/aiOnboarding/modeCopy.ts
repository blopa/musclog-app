import type { AiSetupMode } from '@/utils/onboardingRoutes';

/**
 * The wording that differs between setting up the app for the first time and updating a saved
 * profile. Whole translation keys in a table rather than an `isProfile ? a : b` at each use, so
 * `check-translations` can see them and a screen never decides the mode's copy for itself.
 */
export const AI_SETUP_COPY = {
  onboarding: {
    hubTitleKey: 'aiOnboarding.hub.title',
    hubIntroKey: 'aiOnboarding.hub.intro',
    reviewIntroKey: 'aiOnboarding.review.intro',
    applyKey: 'aiOnboarding.review.applyOnboarding',
    exitKey: 'aiOnboarding.common.backToGuided',
  },
  profile: {
    hubTitleKey: 'aiOnboarding.hub.profileTitle',
    hubIntroKey: 'aiOnboarding.hub.profileIntro',
    reviewIntroKey: 'aiOnboarding.review.profileIntro',
    applyKey: 'aiOnboarding.review.applyProfile',
    exitKey: 'aiOnboarding.common.editManually',
  },
} as const satisfies Record<
  AiSetupMode,
  {
    hubTitleKey: string;
    hubIntroKey: string;
    reviewIntroKey: string;
    applyKey: string;
    exitKey: string;
  }
>;
