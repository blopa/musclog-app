import {
  AI_SETUP_ROUTE,
  aiSetupRoute,
  personalizedCycleRoutes,
  PROFILE_RESULTS_ROUTE,
  PROFILE_ROUTE,
  PERSONALIZED_SETUP_STEPS,
  PERSONALIZED_STEP,
  personalizedCycleSetupRoute,
  resolveAiSetupMode,
  resolveResultsCompletion,
} from '@/utils/onboardingRoutes';

describe('personalizedCycleRoutes', () => {
  it('goes through the Musclog AI step by default, with the step numbers the screens show', () => {
    const { direct, afterCycle } = personalizedCycleRoutes(false);

    expect(direct).toContain('/app/onboarding/musclog-api?');
    expect(direct).toContain('quickStep=8&quickTotal=11');
    expect(afterCycle).toContain('quickStep=9&quickTotal=11');
  });

  it('hands the Musclog AI step on to the coach step, one step later', () => {
    const { direct, afterCycle } = personalizedCycleRoutes(false);
    const nextOf = (route: string) =>
      decodeURIComponent(new URL(route, 'https://x').searchParams.get('nextRoute') ?? '');

    expect(nextOf(direct)).toBe('/app/onboarding/coach-persona?quickStep=9&quickTotal=11');
    expect(nextOf(afterCycle)).toBe('/app/onboarding/coach-persona?quickStep=10&quickTotal=11');
  });

  it('skips the Musclog AI step when the person already chose a provider, but still asks for a coach', () => {
    expect(personalizedCycleRoutes(true)).toEqual({
      direct: '/app/onboarding/coach-persona?quickStep=8&quickTotal=11',
      afterCycle: '/app/onboarding/coach-persona?quickStep=9&quickTotal=11',
    });
  });

  it('keeps the coach step free of nested query strings, so no screen decodes it twice', () => {
    const { direct } = personalizedCycleRoutes(true);

    expect(direct).not.toContain('nextRoute');
    expect(decodeURIComponent(direct)).toBe(direct);
  });

  it('counts the coach step in the personalized total', () => {
    expect(PERSONALIZED_SETUP_STEPS).toBe(11);
  });

  it('numbers the screens in order, ending on the first workout', () => {
    const steps = Object.values(PERSONALIZED_STEP);

    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(new Set(steps).size).toBe(steps.length);
    expect(PERSONALIZED_SETUP_STEPS).toBe(PERSONALIZED_STEP.firstWorkout);
  });

  it('opens the cycle setup on its own step of the same total', () => {
    expect(personalizedCycleSetupRoute('regular', 'next')).toBe(
      `/app/onboarding/cycle-setup?tracking=regular&nextRoute=next&quickStep=${PERSONALIZED_STEP.cycleSetup}&quickTotal=${PERSONALIZED_SETUP_STEPS}`
    );
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
