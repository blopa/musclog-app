import { setupSteps } from '@/utils/comeback/comebackSetupSteps';

describe('setupSteps', () => {
  it('asks everything for a full start on both tracks', () => {
    expect(setupSteps({ mode: 'start', track: 'both', prefill: {} })).toEqual([
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
    ]);
  });

  it('asks only the workout questions on the workout track', () => {
    expect(setupSteps({ mode: 'start', track: 'workout', prefill: {} })).toEqual([
      'intro',
      'track',
      'where',
      'days',
      'start',
      'energy',
      'plan',
    ]);
  });

  it('asks only the food questions on the nutrition track', () => {
    expect(setupSteps({ mode: 'start', track: 'nutrition', prefill: {} })).toEqual([
      'intro',
      'track',
      'eating',
      'tracking',
      'goal',
      'energy',
      'plan',
    ]);
  });

  it('skips a question whose answer is already known', () => {
    const steps = setupSteps({
      mode: 'start',
      track: 'workout',
      prefill: { location: 'home', daysPerWeek: 2 },
    });

    expect(steps).not.toContain('where');
    expect(steps).not.toContain('days');
    expect(steps).toContain('start');
  });

  it('tailors after onboarding: only eating, tracking, goal and energy remain', () => {
    expect(setupSteps({ mode: 'tailor', track: 'both', prefill: { location: 'home' } })).toEqual([
      'eating',
      'tracking',
      'goal',
      'energy',
      'plan',
    ]);
  });

  it('editing never asks to create a plan or to pick the track again', () => {
    const steps = setupSteps({ mode: 'edit', track: 'both', prefill: {} });

    expect(steps).not.toContain('intro');
    expect(steps).not.toContain('track');
    expect(steps).not.toContain('start');
    expect(steps[steps.length - 1]).toBe('plan');
  });

  it('always ends on the plan', () => {
    for (const mode of ['start', 'tailor', 'edit'] as const) {
      for (const track of ['workout', 'nutrition', 'both'] as const) {
        const steps = setupSteps({ mode, track, prefill: {} });

        expect(steps[steps.length - 1]).toBe('plan');
        expect(new Set(steps).size).toBe(steps.length);
      }
    }
  });
});
