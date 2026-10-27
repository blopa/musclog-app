import workoutTemplatesData from '@/data/workoutTemplatesData.json';
import {
  equipmentForLocation,
  inferTrainingLocation,
  parseTrainingSetup,
  planWeightGoal,
  pickStarterTemplateIndex,
  SHORT_PLAN_TITLES,
  shortPlanTemplateIndex,
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

  it('never recommends a gym-equipment plan for home or minimal training: the short plan for their equipment', () => {
    const home = pickStarterTemplateIndex('home', 'beginner', 3);
    const minimal = pickStarterTemplateIndex('minimal', 'advanced', 5);

    expect(titles[home as number]).toBe(SHORT_PLAN_TITLES.home);
    expect(titles[minimal as number]).toBe(SHORT_PLAN_TITLES.minimal);
  });

  it('finds the short plan for every place to train', () => {
    for (const location of ['gym', 'home', 'minimal'] as const) {
      expect(titles[shortPlanTemplateIndex(location) as number]).toBe(SHORT_PLAN_TITLES[location]);
    }
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

describe('inferTrainingLocation', () => {
  it('reads each place back from the equipment it creates', () => {
    for (const location of ['gym', 'home', 'minimal'] as const) {
      expect(inferTrainingLocation(equipmentForLocation(location))).toBe(location);
    }
  });

  it('treats a profile with nothing recognisable as minimal', () => {
    expect(inferTrainingLocation([])).toBe('minimal');
    expect(inferTrainingLocation(['bodyweight'])).toBe('minimal');
  });
});

describe('coming back after a break', () => {
  const base = { location: 'home', daysPerWeek: 3, autonomy: 'suggest' };

  it('reads a valid break length back and drops an unknown one', () => {
    expect(
      parseTrainingSetup(JSON.stringify({ ...base, comingBack: { breakLength: '3to6m' } }))
        ?.comingBack
    ).toEqual({ breakLength: '3to6m' });
    expect(
      parseTrainingSetup(JSON.stringify({ ...base, comingBack: { breakLength: 'forever' } }))
        ?.comingBack
    ).toBeUndefined();
  });

  it('still reads answers saved before the field existed', () => {
    const parsed = parseTrainingSetup(JSON.stringify(base));
    expect(parsed).toMatchObject({ location: 'home', daysPerWeek: 3 });
    expect(parsed?.comingBack).toBeUndefined();
  });

  it('calculates the first plan at maintenance, whatever goal was picked', () => {
    expect(planWeightGoal({ comingBack: { breakLength: '1to3m' } }, 'lose')).toBe('maintain');
    expect(planWeightGoal({ comingBack: { breakLength: '1to3m' } }, 'gain')).toBe('maintain');
    expect(planWeightGoal({}, 'lose')).toBe('lose');
    expect(planWeightGoal(null, 'gain')).toBe('gain');
  });
});
