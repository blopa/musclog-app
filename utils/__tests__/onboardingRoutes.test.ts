import {
  AI_SETUP_ROUTE,
  aiSetupRoute,
  NUTRITION_RESULTS_ROUTE,
  personalizedCycleRoutes,
  PROFILE_RESULTS_ROUTE,
  PROFILE_ROUTE,
  resolveAiSetupMode,
  resolveResultsCompletion,
} from '@/utils/onboardingRoutes';

describe('personalizedCycleRoutes', () => {
  it('goes through the Musclog AI step by default, with the step numbers the screens show', () => {
    const { direct, afterCycle } = personalizedCycleRoutes(false);

    expect(direct).toContain('/app/onboarding/musclog-api?');
    expect(direct).toContain('quickStep=8&quickTotal=10');
    expect(afterCycle).toContain('quickStep=9&quickTotal=10');
    expect(decodeURIComponent(direct)).toContain(NUTRITION_RESULTS_ROUTE);
  });

  it('skips that step when the person already chose a provider', () => {
    expect(personalizedCycleRoutes(true)).toEqual({
      direct: NUTRITION_RESULTS_ROUTE,
      afterCycle: NUTRITION_RESULTS_ROUTE,
    });
  });
});

describe('resolveResultsCompletion', () => {
  const base = { hasTraining: true, isWeb: false, mode: 'personalized' as const };

  it('finishes onboarding and goes to the first workout when training was answered', () => {
    expect(resolveResultsCompletion({ ...base, context: 'onboarding' })).toEqual({
      applyTraining: true,
      completeOnboarding: true,
      route: '/app/onboarding/first-workout?mode=personalized',
    });
    expect(resolveResultsCompletion({ ...base, context: 'onboarding', mode: 'quick' }).route).toBe(
      '/app/onboarding/first-workout?mode=quick'
    );
  });

  it('without training answers, ends on the Health prompt (native) or home (web)', () => {
    expect(
      resolveResultsCompletion({ ...base, context: 'onboarding', hasTraining: false })
    ).toEqual({
      applyTraining: false,
      completeOnboarding: true,
      route: '/app/onboarding/health-connect?nextRoute=/app',
    });
    expect(
      resolveResultsCompletion({ ...base, context: 'onboarding', hasTraining: false, isWeb: true })
        .route
    ).toBe('/app');
  });

  it('a profile update applies no training, never completes onboarding and returns to the profile', () => {
    for (const hasTraining of [true, false]) {
      expect(
        resolveResultsCompletion({ ...base, context: 'profile', hasTraining, isWeb: true })
      ).toEqual({ applyTraining: false, completeOnboarding: false, route: PROFILE_ROUTE });
    }
  });
});

describe('route constants', () => {
  it('points the profile results at the profile context', () => {
    expect(PROFILE_RESULTS_ROUTE).toContain('context=profile');
    expect(AI_SETUP_ROUTE).toBe('/app/onboarding/ai-setup');
  });
});

describe('AI setup routes', () => {
  it('carries the mode on every screen', () => {
    expect(aiSetupRoute('setup', 'onboarding')).toBe('/app/onboarding/ai-setup?mode=onboarding');
    expect(aiSetupRoute('review', 'profile')).toBe('/app/onboarding/ai-review?mode=profile');
    expect(
      aiSetupRoute('chat', 'onboarding').startsWith(AI_SETUP_ROUTE.replace('setup', 'chat'))
    ).toBe(true);
  });

  it('reads the mode, treating anything but profile as onboarding', () => {
    expect(resolveAiSetupMode('profile')).toBe('profile');
    expect(resolveAiSetupMode(['profile', 'onboarding'])).toBe('profile');
    expect(resolveAiSetupMode('onboarding')).toBe('onboarding');
    expect(resolveAiSetupMode('nonsense')).toBe('onboarding');
    expect(resolveAiSetupMode(undefined)).toBe('onboarding');
  });
});
