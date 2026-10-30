/**
 * Where the onboarding chain goes next. Kept out of the route files so the AI setup, the guided
 * screens and the results screen all read the same answer, and so it can be tested without React.
 */

export const NUTRITION_RESULTS_ROUTE =
  '/app/onboarding/nutrition-goals-results?aiGenerated=true&personalizedSetup=true';
export const PROFILE_ROUTE = '/app/profile';
export const AI_SETUP_ROUTE = '/app/onboarding/ai-setup';
export const PERSONALIZED_CYCLE_ROUTE = '/app/onboarding/personalized-cycle';

/** Where the personalized setup asks which coach the user wants; it always follows the AI choice. */
export const COACH_PERSONA_ROUTE = '/app/onboarding/coach-persona';

/**
 * The step number each personalized-setup screen shows on its progress bar. The screens, the routes
 * below and the totals all read this one table, so inserting a step is an edit here and nowhere
 * else. Step 6 is unused, and the steps between the cycle question and the results are reached
 * through `personalizedCycleRoutes`. The quick setup has its own, shorter count (7).
 */
export const PERSONALIZED_STEP = {
  preferences: 1,
  training: 2,
  experience: 3,
  goals: 4,
  bodyStats: 5,
  cycleQuestion: 7,
  cycleSetup: 8,
  results: 10,
  firstWorkout: 11,
} as const;

/** Steps in the personalized setup, counting the coach step: the last screen is the first workout. */
export const PERSONALIZED_SETUP_STEPS = PERSONALIZED_STEP.firstWorkout;

/**
 * The coach step always leads to the nutrition results, so it takes no `nextRoute`: nesting that
 * query string inside the Musclog AI step's own `nextRoute` would be decoded once too often there.
 */
const coachPersonaRoute = (quickStep: number) =>
  `${COACH_PERSONA_ROUTE}?quickStep=${quickStep}&quickTotal=${PERSONALIZED_SETUP_STEPS}`;

/** The Musclog AI step, which hands on to the coach step right after it. */
const musclogApiRoute = (quickStep: number) =>
  `/app/onboarding/musclog-api?nextRoute=${encodeURIComponent(coachPersonaRoute(quickStep + 1))}&quickStep=${quickStep}&quickTotal=${PERSONALIZED_SETUP_STEPS}`;

/** The route of the cycle-setup screen the personalized cycle question opens. */
export const personalizedCycleSetupRoute = (tracking: string, nextRoute: string) =>
  `/app/onboarding/cycle-setup?tracking=${tracking}&nextRoute=${nextRoute}&quickStep=${PERSONALIZED_STEP.cycleSetup}&quickTotal=${PERSONALIZED_SETUP_STEPS}`;

/**
 * The routes after the personalized cycle question: the "Musclog AI" step, then the coach step.
 * The Musclog AI step is left out when the person already chose a provider in the AI setup: the
 * free tier outranks their own key, so offering it again would quietly replace the key they had
 * just tested. The coach step is always asked.
 */
export function personalizedCycleRoutes(skipMusclogApi: boolean): {
  /** Cycle tracking skipped: straight on. */
  direct: string;
  /** After the cycle setup screen. */
  afterCycle: string;
} {
  const afterQuestion = PERSONALIZED_STEP.cycleQuestion + 1;
  const afterSetup = PERSONALIZED_STEP.cycleSetup + 1;

  return skipMusclogApi
    ? { direct: coachPersonaRoute(afterQuestion), afterCycle: coachPersonaRoute(afterSetup) }
    : { direct: musclogApiRoute(afterQuestion), afterCycle: musclogApiRoute(afterSetup) };
}

export type ResultsContext = 'onboarding' | 'profile';

/**
 * What accepting a nutrition plan does besides saving the goal. Onboarding applies the training
 * answers, finishes onboarding and moves on to the first workout or the Health prompt. Updating
 * the profile later must do none of that: it only saves the goal and returns.
 */
export function resolveResultsCompletion({
  context,
  hasTraining,
  isWeb,
  mode,
}: {
  context: ResultsContext;
  hasTraining: boolean;
  isWeb: boolean;
  mode: 'quick' | 'personalized';
}): { applyTraining: boolean; completeOnboarding: boolean; route: string } {
  if (context === 'profile') {
    return { applyTraining: false, completeOnboarding: false, route: PROFILE_ROUTE };
  }

  if (hasTraining) {
    return {
      applyTraining: true,
      completeOnboarding: true,
      route: `/app/onboarding/first-workout?mode=${mode}`,
    };
  }

  return {
    applyTraining: false,
    completeOnboarding: true,
    route: isWeb ? '/app' : '/app/onboarding/health-connect?nextRoute=/app',
  };
}

/** The nutrition results screen when reached from the profile, where accepting must not finish onboarding. */
export const PROFILE_RESULTS_ROUTE =
  '/app/onboarding/nutrition-goals-results?aiGenerated=true&context=profile';

export type AiSetupScreen = 'setup' | 'provider' | 'chat' | 'external' | 'review';
export type AiSetupMode = 'onboarding' | 'profile';

/** Every AI-setup screen takes the mode as a query parameter; this is the one place that spells it. */
export function aiSetupRoute(screen: AiSetupScreen, mode: AiSetupMode): string {
  return `/app/onboarding/ai-${screen}?mode=${mode}`;
}

/** Reads the `mode` parameter; anything but `profile` is first-time onboarding. */
export function resolveAiSetupMode(param: string | string[] | undefined): AiSetupMode {
  return (Array.isArray(param) ? param[0] : param) === 'profile' ? 'profile' : 'onboarding';
}
