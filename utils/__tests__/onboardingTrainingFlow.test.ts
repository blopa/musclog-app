import fs from 'fs';
import path from 'path';

import { PERSONALIZED_SETUP_STEPS, PERSONALIZED_STEP } from '@/utils/onboardingRoutes';

const read = (file: string) => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');

describe('onboarding training flow wiring', () => {
  it('sends both setups through the training screen instead of Health Connect', () => {
    expect(read('app/app/onboarding/quick-preferences.tsx')).toContain(
      '/app/onboarding/training-setup?mode=quick'
    );
    expect(read('app/app/onboarding/personalized-preferences.tsx')).toContain(
      '/app/onboarding/training-setup?mode=personalized'
    );
    expect(read('app/app/onboarding/quick-preferences.tsx')).not.toContain('health-connect');
    expect(read('app/app/onboarding/personalized-preferences.tsx')).not.toContain('health-connect');
  });

  it('keeps the step counts of both setups intact', () => {
    expect(read('app/app/onboarding/quick-preferences.tsx')).toContain('quickTotal=7');
    expect(read('app/app/onboarding/personalized-preferences.tsx')).toContain(
      'quickTotal=${PERSONALIZED_SETUP_STEPS}'
    );
    expect(PERSONALIZED_SETUP_STEPS).toBe(11);
  });

  it('keeps every personalized screen on the shared step table, with no step literals left', () => {
    for (const screen of [
      'personalized-preferences',
      'personalized-experience',
      'personalized-goals',
      'personalized-body-stats',
      'personalized-cycle',
    ]) {
      const source = read(`app/app/onboarding/${screen}.tsx`);

      expect(source).toContain('total={PERSONALIZED_SETUP_STEPS}');
      expect(source).not.toMatch(/total=\{\d+\}/);
    }
  });

  it('advertises the flow totals on the landing page in every locale', () => {
    const localesDir = path.join(__dirname, '../../lang/locales');
    const quickTotal = read('app/app/onboarding/quick-preferences.tsx').match(
      /quickTotal=(\d+)/
    )![1];
    const personalizedTotal = String(PERSONALIZED_SETUP_STEPS);

    for (const locale of fs.readdirSync(localesDir, { withFileTypes: true })) {
      if (!locale.isDirectory()) {
        continue;
      }

      const { onboarding } = JSON.parse(read(`lang/locales/${locale.name}/onboarding.json`));
      expect(onboarding.landing.quickSetupSteps).toMatch(new RegExp(`^${quickTotal}\\s`));
      expect(onboarding.landing.personalizedSetupSteps).toMatch(
        new RegExp(`^${personalizedTotal}\\s`)
      );
    }
  });

  it('counts the first workout as the final step of each setup', () => {
    const results = read('app/app/onboarding/nutrition-goals-results.tsx');
    expect(results).toContain('current={6} total={7}');
    expect(results).toMatch(
      /current=\{PERSONALIZED_STEP\.results\}\s+total=\{PERSONALIZED_SETUP_STEPS\}/
    );
    // The first workout is the step after the results.
    expect(PERSONALIZED_STEP.results).toBe(PERSONALIZED_STEP.firstWorkout - 1);
    expect(results).toContain("isPersonalizedSetup ? 'personalized' : 'quick'");
    const firstWorkout = read('app/app/onboarding/first-workout.tsx');
    expect(firstWorkout).toMatch(
      /mode === 'personalized' \? PERSONALIZED_SETUP_STEPS : mode === 'quick' \? 7 : null/
    );
    expect(firstWorkout).toContain(
      '<QuickSetupProgressBar current={totalSteps} total={totalSteps}'
    );
  });

  it('applies the training answers, then ends on the first workout', () => {
    const results = read('app/app/onboarding/nutrition-goals-results.tsx');
    expect(results).toContain('applyTrainingSetup(training)');
    // Where it ends is decided once, in onboardingRoutes, which is also what a profile update
    // reads to skip all of this.
    expect(results).toContain('resolveResultsCompletion');
    const routes = read('utils/onboardingRoutes.ts');
    expect(routes).toContain('/app/onboarding/first-workout?mode=');
    // Nutrition-only users keep a Health prompt rather than losing it.
    expect(routes).toContain('/app/onboarding/health-connect?nextRoute=/app');
  });

  it('keeps a profile update from finishing onboarding or applying training', () => {
    const results = read('app/app/onboarding/nutrition-goals-results.tsx');
    expect(results).toContain("params.context === 'profile'");
    expect(results).toContain('nutritionGoals.keepCurrentTargets');
  });

  it('holds the health prompt until a workout summary consumes it', () => {
    expect(read('app/app/onboarding/first-workout.tsx')).toContain('HEALTH_CONNECT_PROMPT_PENDING');
    const summary = read('app/app/workout/workout-summary.tsx');
    expect(summary).toContain('HEALTH_CONNECT_PROMPT_PENDING');
    expect(summary).toContain('removeItem(HEALTH_CONNECT_PROMPT_PENDING)');
  });
});
