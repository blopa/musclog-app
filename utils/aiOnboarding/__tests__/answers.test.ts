import {
  fromGuidedDrafts,
  toPersonalizedSetup,
  toPlanInput,
  toProfileWrite,
  toTrainingSetup,
} from '@/utils/aiOnboarding/answers';
import { pickBodyStats } from '@/utils/onboardingDraft';
import type {
  CompleteOnboardingAnswers,
  OnboardingAnswersDraft,
} from '@/utils/aiOnboarding/contract';
import { localDayStartMsFromIsoDateOnly } from '@/utils/calendarDate';

const today = new Date(2026, 9, 30);

const complete: CompleteOnboardingAnswers = {
  fullName: 'Ana',
  units: 'metric',
  gender: 'female',
  birthDate: '1996-05-01',
  heightCm: 168,
  weightKg: 62,
  bodyFatPercent: 22,
  liftingExperience: 'beginner',
  activityLevel: 3,
  fitnessGoal: 'weight_loss',
  weightGoal: 'lose',
};

describe('toProfileWrite', () => {
  it('maps the answers to storage terms', () => {
    expect(toProfileWrite(complete)).toEqual({
      fullName: 'Ana',
      dateOfBirthMs: localDayStartMsFromIsoDateOnly('1996-05-01'),
      gender: 'female',
      fitnessGoal: 'weight_loss',
      weightGoal: 'lose',
      activityLevel: 3,
      liftingExperience: 'beginner',
      weightKg: 62,
      heightCm: 168,
      bodyFatPercent: 22,
      units: 'metric',
    });
  });

  it('leaves a missing birthday undefined so a partial update cannot erase it', () => {
    expect(toProfileWrite({ weightKg: 70 }).dateOfBirthMs).toBeUndefined();
  });
});

describe('toTrainingSetup', () => {
  it('needs a location', () => {
    expect(toTrainingSetup({ trainingDaysPerWeek: 4 })).toBeNull();
  });

  it('fills the same defaults the guided screen uses and keeps the break', () => {
    expect(toTrainingSetup({ trainingLocation: 'home' })).toEqual({
      location: 'home',
      daysPerWeek: 3,
      autonomy: 'suggest',
    });
    expect(
      toTrainingSetup({
        trainingLocation: 'gym',
        trainingDaysPerWeek: 5,
        trainingAutonomy: 'manual',
        breakLength: '3to6m',
      })
    ).toEqual({
      location: 'gym',
      daysPerWeek: 5,
      autonomy: 'manual',
      comingBack: { breakLength: '3to6m' },
    });
  });
});

describe('toPersonalizedSetup', () => {
  it('maps the screen answers and the skip flag', () => {
    expect(toPersonalizedSetup(complete, { skipMusclogApi: true })).toEqual({
      fullName: 'Ana',
      units: 'metric',
      gender: 'female',
      liftingExperience: 'beginner',
      activityLevel: 3,
      fitnessGoal: 'weight_loss',
      weightGoal: 'lose',
      skipMusclogApi: true,
    });
  });

  it('omits what is missing and does not write a false skip flag', () => {
    expect(toPersonalizedSetup({}, { skipMusclogApi: false })).toEqual({});
  });
});

describe('pickBodyStats', () => {
  it('keeps body answers and the estimated flag', () => {
    expect(pickBodyStats({ ...complete, dobEstimated: true })).toEqual({
      birthDate: '1996-05-01',
      dobEstimated: true,
      heightCm: 168,
      weightKg: 62,
      bodyFatPercent: 22,
    });
    expect(pickBodyStats({})).toEqual({});
  });
});

describe('toPlanInput', () => {
  it('builds the calculator input and leaves body fat out when the setting is off', () => {
    const input = toPlanInput(complete, { useBodyFat: false, training: null, today });

    expect(input).toMatchObject({
      gender: 'female',
      weightKg: 62,
      heightCm: 168,
      age: 30,
      activityLevel: 3,
      weightGoal: 'lose',
      fitnessGoal: 'weight_loss',
      liftingExperience: 'beginner',
    });
    expect(input.bodyFatPercent).toBeUndefined();
    expect(toPlanInput(complete, { useBodyFat: true, training: null, today }).bodyFatPercent).toBe(
      22
    );
  });

  it('starts someone coming back after a break at maintenance', () => {
    expect(
      toPlanInput(complete, {
        useBodyFat: false,
        training: { comingBack: { breakLength: '1to3m' } },
        today,
      }).weightGoal
    ).toBe('maintain');
  });

  it('never gives the calculator an age below one', () => {
    expect(
      toPlanInput(
        { ...complete, birthDate: '2026-10-30' },
        { useBodyFat: false, training: null, today }
      ).age
    ).toBe(1);
  });
});

describe('fromGuidedDrafts', () => {
  it('round-trips the AI answers through the guided drafts', () => {
    const draft: OnboardingAnswersDraft = {
      ...complete,
      dobEstimated: true,
      trainingLocation: 'gym',
      trainingDaysPerWeek: 4,
      trainingAutonomy: 'manual',
      breakLength: 'under1m',
    };

    const rebuilt = fromGuidedDrafts(
      toPersonalizedSetup(draft, { skipMusclogApi: false }),
      pickBodyStats(draft),
      toTrainingSetup(draft)
    );

    expect(rebuilt).toEqual(draft);
  });

  it('works with nothing saved yet', () => {
    expect(fromGuidedDrafts({}, {}, null)).toEqual({});
  });

  it('does not invent an autonomy the training setup lacks', () => {
    const rebuilt = fromGuidedDrafts(
      {},
      {},
      {
        location: 'home',
        daysPerWeek: 3,
        autonomy: undefined as never,
      }
    );

    expect(rebuilt).toEqual({ trainingLocation: 'home', trainingDaysPerWeek: 3 });
  });
});
