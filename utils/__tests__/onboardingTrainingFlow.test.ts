import fs from 'fs';
import path from 'path';

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
    expect(read('app/app/onboarding/quick-preferences.tsx')).toContain('quickTotal=6');
    expect(read('app/app/onboarding/personalized-preferences.tsx')).toContain('quickTotal=9');
  });

  it('applies the training answers, then ends on the first workout', () => {
    const results = read('app/app/onboarding/nutrition-goals-results.tsx');
    expect(results).toContain('applyTrainingSetup(training)');
    expect(results).toContain("router.replace('/app/onboarding/first-workout')");
    // Nutrition-only users keep a Health prompt rather than losing it.
    expect(results).toContain('/app/onboarding/health-connect?nextRoute=/app');
  });

  it('holds the health prompt until a workout summary consumes it', () => {
    expect(read('app/app/onboarding/first-workout.tsx')).toContain('HEALTH_CONNECT_PROMPT_PENDING');
    const summary = read('app/app/workout/workout-summary.tsx');
    expect(summary).toContain('HEALTH_CONNECT_PROMPT_PENDING');
    expect(summary).toContain('removeItem(HEALTH_CONNECT_PROMPT_PENDING)');
  });
});
