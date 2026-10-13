import workoutTemplatesData from '@/data/workoutTemplatesData.json';
import {
  equipmentForLocation,
  parseTrainingSetup,
  pickStarterTemplateIndex,
  STARTER_PLAN_TITLES,
  TRAINING_DAYS_OPTIONS,
} from '@/utils/onboardingTraining';

const titles = (workoutTemplatesData as { __title?: string }[]).map((t) => t.__title);

describe('onboardingTraining', () => {
  it('only recommends plans that exist in the catalogue', () => {
    for (const byDays of Object.values(STARTER_PLAN_TITLES)) {
      for (const title of Object.values(byDays)) {
        expect(titles).toContain(title);
      }
    }
  });

  it('answers every experience/days combination for a gym', () => {
    for (const experience of ['beginner', 'intermediate', 'advanced'] as const) {
      for (const days of TRAINING_DAYS_OPTIONS) {
        const index = pickStarterTemplateIndex('gym', experience, days);
        expect(index).not.toBeNull();
        expect(Array.isArray(workoutTemplatesData[index as number].exercises)).toBe(true);
      }
    }
  });

  it('never recommends a gym-equipment plan for home or minimal training', () => {
    expect(pickStarterTemplateIndex('home', 'beginner', 3)).toBeNull();
    expect(pickStarterTemplateIndex('minimal', 'advanced', 5)).toBeNull();
  });

  it('keeps beginners on full-body plans and clamps odd day counts', () => {
    const fullBody = titles.indexOf('Full Body (3-Day)');
    expect(pickStarterTemplateIndex('gym', 'beginner', 5)).toBe(fullBody);
    expect(pickStarterTemplateIndex('gym', 'beginner', 99)).toBe(fullBody);
    expect(pickStarterTemplateIndex('gym', 'beginner', 0)).toBe(
      titles.indexOf('2-Day Full Body (A/B)')
    );
  });

  it('gives home and minimal profiles no barbell-style gym equipment', () => {
    expect(equipmentForLocation('gym')).toContain('barbell');
    expect(equipmentForLocation('home')).not.toContain('barbell');
    expect(equipmentForLocation('minimal')).toEqual(['resistance_band', 'bodyweight', 'other']);
  });

  it('treats malformed stored answers as no setup', () => {
    expect(parseTrainingSetup(null)).toBeNull();
    expect(parseTrainingSetup('nope')).toBeNull();
    expect(parseTrainingSetup(JSON.stringify({ location: 'moon' }))).toBeNull();
    expect(
      parseTrainingSetup(
        JSON.stringify({ location: 'gym', experience: 'x', daysPerWeek: 'abc', autonomy: 'manual' })
      )
    ).toEqual({ location: 'gym', experience: undefined, daysPerWeek: 3, autonomy: 'manual' });
  });
});
