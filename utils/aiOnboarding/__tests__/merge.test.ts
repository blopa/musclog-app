import type { OnboardingAnswersDraft } from '@/utils/aiOnboarding/contract';
import { buildProfileDiff, mergeAnswers, selectKeptFields } from '@/utils/aiOnboarding/merge';

const today = new Date(2026, 9, 30);

describe('mergeAnswers', () => {
  it('lets later answers win and reports what changed', () => {
    const { draft, changed } = mergeAnswers(
      { gender: 'male', heightCm: 170 },
      { heightCm: 172, weightKg: 70 }
    );

    expect(draft).toEqual({ gender: 'male', heightCm: 172, weightKg: 70 });
    expect(changed).toEqual(['heightCm', 'weightKg']);
  });

  it('leaves fields the newcomer does not mention alone and ignores identical values', () => {
    const base: OnboardingAnswersDraft = { gender: 'female', activityLevel: 3 };
    const { draft, changed } = mergeAnswers(base, { gender: 'female' });

    expect(draft).toEqual(base);
    expect(changed).toEqual([]);
    expect(draft).not.toBe(base);
  });

  it('clears the estimated flag when a real birthday arrives, and sets it for an estimate', () => {
    const estimated = mergeAnswers({}, { birthDate: '1990-01-01', dobEstimated: true }).draft;
    expect(estimated.dobEstimated).toBe(true);

    const real = mergeAnswers(estimated, { birthDate: '1991-02-02' }).draft;
    expect(real.birthDate).toBe('1991-02-02');
    expect(real).not.toHaveProperty('dobEstimated');
  });
});

describe('buildProfileDiff', () => {
  const current: OnboardingAnswersDraft = {
    gender: 'male',
    birthDate: '1990-05-05',
    heightCm: 180,
    weightKg: 80,
    fitnessGoal: 'general',
  };

  it('has one row per answered field and marks only real changes', () => {
    const rows = buildProfileDiff(
      current,
      { gender: 'male', weightKg: 78, fitnessGoal: 'strength', liftingExperience: 'beginner' },
      today
    );

    expect(rows.map((row) => [row.field, row.changed, row.keepByDefault])).toEqual([
      ['gender', false, false],
      ['weightKg', true, true],
      ['liftingExperience', true, true],
      ['fitnessGoal', true, true],
    ]);
    expect(rows.find((row) => row.field === 'weightKg')).toMatchObject({
      current: 80,
      incoming: 78,
    });
  });

  it('treats rounding noise in measurements as the same answer', () => {
    const rows = buildProfileDiff(current, { weightKg: 80.04, heightCm: 180.02 }, today);

    expect(rows.every((row) => !row.changed)).toBe(true);
  });

  it('does not overwrite a known birthday with an age-only estimate of the same age', () => {
    const same = buildProfileDiff(current, { birthDate: '1990-06-01', dobEstimated: true }, today);
    const different = buildProfileDiff(
      current,
      { birthDate: '1980-01-01', dobEstimated: true },
      today
    );
    const exact = buildProfileDiff(current, { birthDate: '1990-05-06' }, today);

    expect(same[0].changed).toBe(false);
    expect(different[0].changed).toBe(true);
    expect(exact[0].changed).toBe(true);
  });

  it('treats a field the profile has no value for as a change', () => {
    const rows = buildProfileDiff({}, { bodyFatPercent: 18 }, today);

    expect(rows[0]).toMatchObject({ current: undefined, changed: true });
  });
});

describe('selectKeptFields', () => {
  const draft: OnboardingAnswersDraft = {
    gender: 'female',
    birthDate: '1990-01-01',
    dobEstimated: true,
    weightKg: 60,
  };

  it('keeps only the ticked fields', () => {
    expect(selectKeptFields(draft, new Set(['weightKg']))).toEqual({ weightKg: 60 });
  });

  it('carries the estimated flag with a kept birthday only', () => {
    expect(selectKeptFields(draft, new Set(['birthDate']))).toEqual({
      birthDate: '1990-01-01',
      dobEstimated: true,
    });
    expect(selectKeptFields({ ...draft, dobEstimated: undefined }, new Set(['birthDate']))).toEqual(
      {
        birthDate: '1990-01-01',
      }
    );
  });

  it('ignores ticked fields the draft has no answer for', () => {
    expect(selectKeptFields({}, new Set(['gender']))).toEqual({});
  });
});
