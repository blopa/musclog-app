/**
 * Where the onboarding chain goes next. Kept out of the route files so the AI setup, the guided
 * screens and the results screen all read the same answer, and so it can be tested without React.
 */

export const NUTRITION_RESULTS_ROUTE =
  '/app/onboarding/nutrition-goals-results?aiGenerated=true&personalizedSetup=true';
export const PROFILE_ROUTE = '/app/profile';
export const AI_SETUP_ROUTE = '/app/onboarding/ai-setup';
export const PERSONALIZED_CYCLE_ROUTE = '/app/onboarding/personalized-cycle';

const musclogApiRoute = (quickStep: number) =>
  `/app/onboarding/musclog-api?nextRoute=${encodeURIComponent(NUTRITION_RESULTS_ROUTE)}&quickStep=${quickStep}&quickTotal=10`;

/**
 * The routes after the personalized cycle question. The "Musclog AI" step is left out when the
 * person already chose a provider in the AI setup: the free tier outranks their own key, so
 * offering it again would quietly replace the key they had just tested.
 */
export function personalizedCycleRoutes(skipMusclogApi: boolean): {
  /** Cycle tracking skipped: straight on. */
  direct: string;
  /** After the cycle setup screen. */
  afterCycle: string;
} {
  return skipMusclogApi
    ? { direct: NUTRITION_RESULTS_ROUTE, afterCycle: NUTRITION_RESULTS_ROUTE }
    : { direct: musclogApiRoute(8), afterCycle: musclogApiRoute(9) };
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
