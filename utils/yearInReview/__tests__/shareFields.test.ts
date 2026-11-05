import { selectShareFields } from '@/utils/yearInReview/shareFields';
import type { YearInReview } from '@/utils/yearInReview/types';

const REVIEW: YearInReview = {
  year: 2026,
  sessions: 40,
  activeDays: 52,
  workoutDays: [],
  longestWeeklyStreak: 6,
  totalVolumeKg: 50_000,
  trainingSeconds: 90_000,
  topExercises: [
    { exerciseId: 'bench', name: 'Bench Press', sets: 60 },
    { exerciseId: 'squat', name: 'Squat', sets: 40 },
  ],
  personalRecords: 3,
  busiestMonth: { month: 4, sessions: 7 },
  favouriteTrainingTime: 'evening',
  mealsLogged: 900,
  nutritionDaysLogged: 200,
  weightChangeKg: -4.2,
  hasContent: true,
};

describe('selectShareFields', () => {
  it('carries no weight and no food figure unless the user asked for them', () => {
    const fields = selectShareFields(REVIEW, { includeWeight: false, includeNutrition: false });

    expect(fields.weightChangeKg).toBeNull();
    expect(fields.mealsLogged).toBeNull();
    expect(fields.nutritionDaysLogged).toBeNull();
  });

  it('keeps the training figures in every case', () => {
    const fields = selectShareFields(REVIEW, { includeWeight: false, includeNutrition: false });

    expect(fields).toMatchObject({
      year: 2026,
      sessions: 40,
      activeDays: 52,
      totalVolumeKg: 50_000,
      personalRecords: 3,
      topExercise: { name: 'Bench Press', sets: 60 },
    });
  });

  it('adds weight change only when included', () => {
    expect(
      selectShareFields(REVIEW, { includeWeight: true, includeNutrition: false }).weightChangeKg
    ).toBe(-4.2);
  });

  it('adds nutrition figures only when included', () => {
    const fields = selectShareFields(REVIEW, { includeWeight: false, includeNutrition: true });

    expect(fields.mealsLogged).toBe(900);
    expect(fields.nutritionDaysLogged).toBe(200);
  });

  it('shows no top exercise when the year has none', () => {
    expect(
      selectShareFields(
        { ...REVIEW, topExercises: [] },
        { includeWeight: false, includeNutrition: false }
      ).topExercise
    ).toBeNull();
  });
});
