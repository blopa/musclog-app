import {
  type ComebackAnswers,
  type ComebackTrack,
  tracksNutrition,
  tracksWorkouts,
} from '@/utils/comeback/comebackState';

/**
 * Which questions the comeback questionnaire asks, in order. One question per screen, every one
 * skippable, and a question whose answer is already known (from onboarding) is not asked again.
 */

export const SETUP_STEP_KEYS = [
  'intro',
  'track',
  'where',
  'days',
  'start',
  'eating',
  'tracking',
  'goal',
  'energy',
  'plan',
] as const;
export type SetupStepKey = (typeof SETUP_STEP_KEYS)[number];

/**
 * - `start`: opened from Home's offer or Settings; the full questionnaire.
 * - `tailor`: the person already answered the training questions in onboarding, so only eating,
 *   tracking, goal and energy remain.
 * - `edit`: changing the answers of a comeback that is already running.
 */
export type SetupMode = 'start' | 'tailor' | 'edit';

export function setupSteps({
  mode,
  track,
  prefill,
}: {
  mode: SetupMode;
  track: ComebackTrack;
  prefill: ComebackAnswers;
}): SetupStepKey[] {
  const steps: SetupStepKey[] = [];
  if (mode === 'start') {
    steps.push('intro', 'track');
  }

  if (tracksWorkouts(track) && mode !== 'tailor') {
    if (!prefill.location) {
      steps.push('where');
    }

    if (!prefill.daysPerWeek) {
      steps.push('days');
    }

    // A running comeback already has its plan; editing never recreates one.
    if (mode === 'start') {
      steps.push('start');
    }
  }

  if (tracksNutrition(track)) {
    steps.push('eating', 'tracking', 'goal');
  }

  steps.push('energy', 'plan');

  return steps;
}

/** The earliest step that is not an optional preview, i.e. the one to land on. */
export function firstStep(steps: readonly SetupStepKey[]): SetupStepKey {
  return steps[0] ?? 'plan';
}
