import { buildYearStoryCards, volumeInUnits } from '@/utils/yearInReview/storyCards';
import type { YearInReview } from '@/utils/yearInReview/types';

const EMPTY: YearInReview = {
  year: 2026,
  sessions: null,
  activeDays: null,
  workoutDays: [],
  longestWeeklyStreak: null,
  totalVolumeKg: null,
  trainingSeconds: null,
  topExercises: [],
  personalRecords: null,
  busiestMonth: null,
  favouriteTrainingTime: null,
  trainingTimeCounts: null,
  mealsLogged: null,
  nutritionDaysLogged: null,
  nutritionDays: [],
  longestFoodStreakDays: null,
  mealTypeDays: null,
  favouriteMealType: null,
  macroGrams: null,
  weightChangeKg: null,
  hasContent: false,
};

const FULL: YearInReview = {
  year: 2026,
  sessions: 40,
  activeDays: 52,
  workoutDays: [{ day: '2026-01-05', value: 1 }],
  longestWeeklyStreak: 6,
  totalVolumeKg: 50_000,
  trainingSeconds: 90_000,
  topExercises: [{ exerciseId: 'bench', name: 'Bench Press', sets: 60 }],
  personalRecords: 3,
  busiestMonth: { month: 4, sessions: 7 },
  favouriteTrainingTime: 'evening',
  trainingTimeCounts: { morning: 1, afternoon: 2, evening: 5, night: 0 },
  mealsLogged: 900,
  nutritionDaysLogged: 200,
  nutritionDays: [{ day: '2026-03-01', value: 3 }],
  longestFoodStreakDays: 12,
  mealTypeDays: { breakfast: 100, lunch: 120, dinner: 110, snack: 150, other: 0 },
  favouriteMealType: 'snack',
  macroGrams: { protein: 45_000, carbs: 130_000, fat: 40_000 },
  weightChangeKg: -4.2,
  hasContent: true,
};

const kinds = (cards: { kind: string }[]) => cards.map((card) => card.kind);

describe('buildYearStoryCards', () => {
  it('returns no story for an empty year', () => {
    expect(buildYearStoryCards(EMPTY, { showWeight: true })).toEqual([]);
  });

  it('lists the full story in order when every statistic is present', () => {
    expect(kinds(buildYearStoryCards(FULL, { showWeight: true }))).toEqual([
      'intro',
      'sessions',
      'heatmap',
      'streak',
      'volume',
      'topExercises',
      'records',
      'busiestMonth',
      'trainingTime',
      'nutrition',
      'foodStreak',
      'favouriteMeal',
      'protein',
      'macros',
      'weight',
      'outro',
    ]);
  });

  it('skips a card whose statistic is null and keeps the rest', () => {
    const cards = buildYearStoryCards(
      { ...FULL, longestWeeklyStreak: null, personalRecords: null, mealsLogged: null },
      { showWeight: true }
    );

    expect(kinds(cards)).not.toContain('streak');
    expect(kinds(cards)).not.toContain('records');
    expect(kinds(cards)).not.toContain('nutrition');
    expect(kinds(cards)).toContain('volume');
  });

  it('skips the nutrition card when the meal count or the day count is missing', () => {
    expect(
      kinds(buildYearStoryCards({ ...FULL, nutritionDaysLogged: null }, { showWeight: true }))
    ).not.toContain('nutrition');
  });

  it('leaves the protein and macro cards out when no food macros were found', () => {
    const kindList = kinds(
      buildYearStoryCards({ ...FULL, macroGrams: null }, { showWeight: true })
    );

    expect(kindList).not.toContain('protein');
    expect(kindList).not.toContain('macros');
    expect(kindList).toContain('favouriteMeal');
  });

  it('keeps the macro card but not the protein card when only carbs and fat were logged', () => {
    const kindList = kinds(
      buildYearStoryCards(
        { ...FULL, macroGrams: { protein: 0, carbs: 5_000, fat: 1_000 } },
        { showWeight: true }
      )
    );

    expect(kindList).not.toContain('protein');
    expect(kindList).toContain('macros');
  });

  it('carries grams, not display units, on the food cards', () => {
    const cards = buildYearStoryCards(FULL, { showWeight: true });

    expect(cards.find((card) => card.kind === 'protein')).toEqual({
      kind: 'protein',
      proteinG: 45_000,
    });
    expect(cards.find((card) => card.kind === 'macros')).toEqual({
      kind: 'macros',
      proteinG: 45_000,
      carbsG: 130_000,
      fatG: 40_000,
    });
    expect(cards.find((card) => card.kind === 'foodStreak')).toEqual({
      kind: 'foodStreak',
      days: 12,
    });
  });

  it('skips the logging run card when there is no run of two days', () => {
    expect(
      kinds(buildYearStoryCards({ ...FULL, longestFoodStreakDays: null }, { showWeight: true }))
    ).not.toContain('foodStreak');
  });

  it('never shows the weight card while the progress lock is held', () => {
    expect(kinds(buildYearStoryCards(FULL, { showWeight: false }))).not.toContain('weight');
  });

  it('skips the weight card when there is no weight change to state', () => {
    expect(
      kinds(buildYearStoryCards({ ...FULL, weightChangeKg: null }, { showWeight: true }))
    ).not.toContain('weight');
  });

  it('keeps the training time card for a known duration alone', () => {
    const cards = buildYearStoryCards(
      { ...FULL, favouriteTrainingTime: null },
      { showWeight: true }
    );

    expect(cards.find((card) => card.kind === 'trainingTime')).toEqual({
      kind: 'trainingTime',
      bucket: null,
      seconds: 90_000,
    });
  });
});

describe('volumeInUnits', () => {
  it('leaves metric volume in kilograms', () => {
    expect(volumeInUnits(100, 'metric')).toBe(100);
  });

  it('converts to pounds for an imperial account', () => {
    expect(volumeInUnits(100, 'imperial')).toBeCloseTo(220.46, 1);
  });
});
