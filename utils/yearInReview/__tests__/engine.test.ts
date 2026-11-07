import {
  YEAR_REVIEW_MIN_TIMED_SESSIONS,
  buildYearInReview,
  localPartsOf,
  parseOffsetMinutes,
  trainingTimeBucketForHour,
} from '@/utils/yearInReview/engine';
import type { YearInReviewInput, YearSetInput, YearWorkoutInput } from '@/utils/yearInReview/types';

/** An instant written with its own offset, so the expectations do not depend on the test machine. */
const at = (iso: string): number => Date.parse(iso);

/** Device-local instant, for the cases that exercise a null timezone. */
const localAt = (year: number, month: number, day: number, hour: number, minute = 0): number =>
  new Date(year, month - 1, day, hour, minute).getTime();

const set = (overrides: Partial<YearSetInput> = {}): YearSetInput => ({
  exerciseId: 'bench',
  exerciseName: 'Bench Press',
  weightKg: 100,
  reps: 5,
  isWorkingSet: true,
  ...overrides,
});

const workout = (
  overrides: Partial<YearWorkoutInput> & { startedAt: number }
): YearWorkoutInput => {
  const { startedAt } = overrides;

  return {
    id: `w-${startedAt}`,
    name: 'Session',
    completedAt: startedAt + 60 * 60_000,
    timezone: null,
    isCardio: false,
    timeKnown: true,
    durationKnown: true,
    sets: [],
    ...overrides,
  };
};

const emptyInput = (year: number): YearInReviewInput => ({
  year,
  workouts: [],
  personalRecords: [],
  nutritionDays: [],
  mealEntries: [],
  nutritionTotals: null,
  firstWeighIn: null,
  lastWeighIn: null,
});

describe('parseOffsetMinutes', () => {
  it('reads colon and compact offsets, and rejects malformed ones', () => {
    expect(parseOffsetMinutes('+02:00')).toBe(120);
    expect(parseOffsetMinutes('-05:00')).toBe(-300);
    expect(parseOffsetMinutes('+0530')).toBe(330);
    expect(parseOffsetMinutes('+05:30')).toBe(330);
    expect(parseOffsetMinutes('+25:00')).toBeNull();
    expect(parseOffsetMinutes('+05:75')).toBeNull();
    expect(parseOffsetMinutes('UTC')).toBeNull();
    expect(parseOffsetMinutes('+5')).toBeNull();
    expect(parseOffsetMinutes('')).toBeNull();
    expect(parseOffsetMinutes(null)).toBeNull();
  });
});

describe('localPartsOf', () => {
  it('reads the wall clock in the stored offset, not in UTC', () => {
    const parts = localPartsOf(at('2026-12-31T23:30:00-05:00'), '-05:00');

    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(11);
    expect(parts.day).toBe(31);
    expect(parts.hour).toBe(23);
  });
});

describe('trainingTimeBucketForHour', () => {
  it('uses the declared hour edges, with night wrapping past midnight', () => {
    expect(trainingTimeBucketForHour(4)).toBe('night');
    expect(trainingTimeBucketForHour(5)).toBe('morning');
    expect(trainingTimeBucketForHour(11)).toBe('morning');
    expect(trainingTimeBucketForHour(12)).toBe('afternoon');
    expect(trainingTimeBucketForHour(16)).toBe('afternoon');
    expect(trainingTimeBucketForHour(17)).toBe('evening');
    expect(trainingTimeBucketForHour(21)).toBe('evening');
    expect(trainingTimeBucketForHour(22)).toBe('night');
    expect(trainingTimeBucketForHour(23)).toBe('night');
  });
});

describe('buildYearInReview: year boundaries by local start day', () => {
  it.each([
    ['-11:00', '2026-12-31T23:30:00-11:00', '2027-01-01T00:30:00-11:00'],
    ['-05:00', '2026-12-31T23:30:00-05:00', '2027-01-01T00:30:00-05:00'],
    ['+02:00', '2026-12-31T23:30:00+02:00', '2027-01-01T00:30:00+02:00'],
    ['+05:30', '2026-12-31T23:30:00+05:30', '2027-01-01T00:30:00+05:30'],
    ['+13:00', '2026-12-31T23:30:00+13:00', '2027-01-01T00:30:00+13:00'],
  ])('counts each session in its own local year (%s)', (offset, lateNewYearEve, earlyNewYear) => {
    const oldYear = buildYearInReview({
      ...emptyInput(2026),
      workouts: [workout({ startedAt: at(lateNewYearEve), timezone: offset })],
    });
    const newYear = buildYearInReview({
      ...emptyInput(2027),
      workouts: [workout({ startedAt: at(earlyNewYear), timezone: offset })],
    });

    expect(oldYear.sessions).toBe(1);
    expect(oldYear.workoutDays).toEqual([{ day: '2026-12-31', value: 1 }]);
    expect(newYear.sessions).toBe(1);
    expect(newYear.workoutDays).toEqual([{ day: '2027-01-01', value: 1 }]);
  });

  it('keeps a session whose UTC instant is already next year in the year it started locally', () => {
    // 23:30 on 31 Dec at -05:00 is 04:30 UTC on 1 Jan, but it is still the old year locally.
    const result = buildYearInReview({
      ...emptyInput(2027),
      workouts: [workout({ startedAt: at('2026-12-31T23:30:00-05:00'), timezone: '-05:00' })],
    });

    expect(result.sessions).toBeNull();
    expect(result.hasContent).toBe(false);
  });

  it('excludes unfinished sessions', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      workouts: [
        workout({
          startedAt: at('2026-05-01T09:00:00+02:00'),
          timezone: '+02:00',
          completedAt: null,
        }),
      ],
    });

    expect(result.sessions).toBeNull();
    expect(result.workoutDays).toEqual([]);
  });
});

describe('buildYearInReview: DST transition days', () => {
  it('keeps the local day for sessions on the spring and autumn changeover dates', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      workouts: [
        workout({ startedAt: at('2026-03-29T01:30:00+01:00'), timezone: '+01:00' }),
        workout({ startedAt: at('2026-03-29T10:00:00+02:00'), timezone: '+02:00' }),
        workout({ startedAt: at('2026-10-25T23:50:00-04:00'), timezone: '-04:00' }),
        workout({ startedAt: at('2026-10-26T00:10:00-04:00'), timezone: '-04:00' }),
      ],
    });

    expect(result.sessions).toBe(4);
    expect(result.workoutDays).toEqual([
      { day: '2026-03-29', value: 2 },
      { day: '2026-10-25', value: 1 },
      { day: '2026-10-26', value: 1 },
    ]);
    expect(result.activeDays).toBe(3);
  });

  it('treats device-local times around the changeover as one day when both fall on it', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      workouts: [
        workout({ startedAt: localAt(2026, 3, 29, 1, 30) }),
        workout({ startedAt: localAt(2026, 3, 29, 3, 30) }),
      ],
    });

    expect(result.workoutDays).toEqual([{ day: '2026-03-29', value: 2 }]);
  });
});

describe('buildYearInReview: empty year', () => {
  it('reports no content and null or empty for every stat', () => {
    const result = buildYearInReview(emptyInput(2026));

    expect(result).toEqual({
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
    });
  });
});

describe('buildYearInReview: imported sessions', () => {
  it('counts a session with no duration as a session but leaves it out of training time', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      workouts: [
        workout({
          startedAt: at('2026-02-01T09:00:00Z'),
          timezone: '+00:00',
          durationKnown: false,
        }),
        workout({
          startedAt: at('2026-02-02T09:00:00Z'),
          timezone: '+00:00',
          completedAt: at('2026-02-02T09:45:00Z'),
        }),
      ],
    });

    expect(result.sessions).toBe(2);
    expect(result.trainingSeconds).toBe(45 * 60);
  });

  it('gives no training time when no session has a known duration', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      workouts: [
        workout({
          startedAt: at('2026-02-01T09:00:00Z'),
          timezone: '+00:00',
          durationKnown: false,
        }),
      ],
    });

    expect(result.trainingSeconds).toBeNull();
  });

  it('leaves sessions with no time of day out of the favourite training time', () => {
    const timed = [0, 1, 2, 3, 4].map((offset) =>
      workout({ startedAt: at(`2026-03-0${offset + 1}T07:00:00+00:00`), timezone: '+00:00' })
    );
    const untimed = [0, 1, 2].map((offset) =>
      workout({
        startedAt: at(`2026-04-0${offset + 1}T19:00:00+00:00`),
        timezone: '+00:00',
        timeKnown: false,
      })
    );

    const result = buildYearInReview({ ...emptyInput(2026), workouts: [...timed, ...untimed] });

    expect(result.sessions).toBe(8);
    expect(result.favouriteTrainingTime).toBe('morning');
    expect(result.trainingTimeCounts?.morning).toBeGreaterThan(0);
  });

  it('needs the minimum number of timed sessions before naming a favourite time', () => {
    const fewer = Array.from({ length: YEAR_REVIEW_MIN_TIMED_SESSIONS - 1 }, (_, index) =>
      workout({ startedAt: at(`2026-03-0${index + 1}T07:00:00+00:00`), timezone: '+00:00' })
    );

    expect(
      buildYearInReview({ ...emptyInput(2026), workouts: fewer }).favouriteTrainingTime
    ).toBeNull();
  });
});

describe('buildYearInReview: volume and top exercises', () => {
  it('sums weight times reps over working sets only', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      workouts: [
        workout({
          startedAt: at('2026-06-01T09:00:00+00:00'),
          timezone: '+00:00',
          sets: [
            set({ weightKg: 60, reps: 10, isWorkingSet: false }),
            set({ weightKg: 100, reps: 5 }),
            set({ weightKg: 80, reps: 8 }),
          ],
        }),
      ],
    });

    expect(result.totalVolumeKg).toBe(100 * 5 + 80 * 8);
  });

  it('gives null volume when only warm-ups were done', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      workouts: [
        workout({
          startedAt: at('2026-06-01T09:00:00+00:00'),
          timezone: '+00:00',
          sets: [set({ isWorkingSet: false })],
        }),
      ],
    });

    expect(result.totalVolumeKg).toBeNull();
    expect(result.topExercises).toEqual([]);
  });

  it('ranks top exercises by working sets, excluding warm-ups, and breaks ties by name', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      workouts: [
        workout({
          startedAt: at('2026-06-01T09:00:00+00:00'),
          timezone: '+00:00',
          sets: [
            set({ exerciseId: 'squat', exerciseName: 'Squat', isWorkingSet: false }),
            set({ exerciseId: 'squat', exerciseName: 'Squat' }),
            set({ exerciseId: 'row', exerciseName: 'Row' }),
            set({ exerciseId: 'row', exerciseName: 'Row' }),
            set({ exerciseId: 'press', exerciseName: 'Press' }),
            set({ exerciseId: 'press', exerciseName: 'Press' }),
            set({ exerciseId: 'curl', exerciseName: 'Curl' }),
          ],
        }),
      ],
    });

    expect(result.topExercises).toEqual([
      { exerciseId: 'press', name: 'Press', sets: 2 },
      { exerciseId: 'row', name: 'Row', sets: 2 },
      { exerciseId: 'curl', name: 'Curl', sets: 1 },
    ]);
  });
});

describe('buildYearInReview: streaks across ISO weeks', () => {
  it('counts a week that starts in one year and holds sessions of the next', () => {
    // Week of Mon 28 Dec 2026 to Sun 3 Jan 2027: its Monday is in 2026, but 1 Jan is in 2027.
    const sessions = ['2027-01-01', '2027-01-05', '2027-01-12'].map((day) =>
      workout({ startedAt: at(`${day}T09:00:00+00:00`), timezone: '+00:00' })
    );

    expect(buildYearInReview({ ...emptyInput(2027), workouts: sessions }).longestWeeklyStreak).toBe(
      3
    );
  });

  it('counts only weeks with sessions in the year being reviewed', () => {
    const sessions = ['2026-12-28', '2026-12-30'].map((day) =>
      workout({ startedAt: at(`${day}T09:00:00+00:00`), timezone: '+00:00' })
    );
    const result = buildYearInReview({ ...emptyInput(2026), workouts: sessions });

    expect(result.longestWeeklyStreak).toBe(1);
  });

  it('keeps a week straddling New Year as one week', () => {
    // Tue 29 Dec 2026 and Sat 2 Jan 2027 share one ISO week; the next week is not contiguous.
    const toYear2026 = buildYearInReview({
      ...emptyInput(2026),
      workouts: [workout({ startedAt: at('2026-12-29T09:00:00+00:00'), timezone: '+00:00' })],
    });
    const toYear2027 = buildYearInReview({
      ...emptyInput(2027),
      workouts: [workout({ startedAt: at('2027-01-02T09:00:00+00:00'), timezone: '+00:00' })],
    });

    expect(toYear2026.longestWeeklyStreak).toBe(1);
    expect(toYear2027.longestWeeklyStreak).toBe(1);
  });

  it('reports the longest run, not the total, across a gap', () => {
    const days = ['2026-03-02', '2026-03-09', '2026-03-16', '2026-04-06', '2026-04-13'];
    const result = buildYearInReview({
      ...emptyInput(2026),
      workouts: days.map((day) =>
        workout({ startedAt: at(`${day}T09:00:00+00:00`), timezone: '+00:00' })
      ),
    });

    expect(result.longestWeeklyStreak).toBe(3);
  });
});

describe('buildYearInReview: ties', () => {
  it('gives the busiest month to the earlier month on a tie', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      workouts: [
        workout({ startedAt: at('2026-07-01T09:00:00+00:00'), timezone: '+00:00' }),
        workout({ startedAt: at('2026-07-02T09:00:00+00:00'), timezone: '+00:00' }),
        workout({ startedAt: at('2026-02-03T09:00:00+00:00'), timezone: '+00:00' }),
        workout({ startedAt: at('2026-02-04T09:00:00+00:00'), timezone: '+00:00' }),
      ],
    });

    expect(result.busiestMonth).toEqual({ month: 1, sessions: 2 });
  });

  it('gives the favourite time to morning over afternoon on a tie', () => {
    const at2 = (day: string, time: string) =>
      workout({ startedAt: at(`2026-05-${day}T${time}+00:00`), timezone: '+00:00' });
    const result = buildYearInReview({
      ...emptyInput(2026),
      workouts: [
        at2('01', '07:00:00'),
        at2('02', '07:00:00'),
        at2('03', '13:00:00'),
        at2('04', '13:00:00'),
        at2('05', '23:00:00'),
      ],
    });

    expect(result.favouriteTrainingTime).toBe('morning');
  });
});

describe('buildYearInReview: malformed timezone', () => {
  it('falls back to device-local time for an unparseable offset', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      workouts: [workout({ startedAt: localAt(2026, 1, 15, 23, 30), timezone: 'Mars/Olympus' })],
    });

    expect(result.workoutDays).toEqual([{ day: '2026-01-15', value: 1 }]);
    expect(localPartsOf(localAt(2026, 1, 15, 23, 30), 'Mars/Olympus').hour).toBe(23);
  });
});

describe('buildYearInReview: food logging', () => {
  const days = (...keys: string[]) => keys.map((day) => ({ day, meals: 1 }));

  it('finds the longest run of consecutive logged days, across a month end', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      nutritionDays: days('2026-03-01', '2026-03-30', '2026-03-31', '2026-04-01', '2026-04-03'),
    });

    expect(result.longestFoodStreakDays).toBe(3);
  });

  it('counts a run across a daylight-saving change as consecutive', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      nutritionDays: days('2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'),
    });

    expect(result.longestFoodStreakDays).toBe(4);
  });

  it('has no run for single days or an empty year', () => {
    expect(
      buildYearInReview({ ...emptyInput(2026), nutritionDays: days('2026-05-01', '2026-05-03') })
        .longestFoodStreakDays
    ).toBeNull();
    expect(buildYearInReview(emptyInput(2026)).longestFoodStreakDays).toBeNull();
  });

  it('lists the logged days in ascending order with their meal counts', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      nutritionDays: [
        { day: '2026-06-02', meals: 2 },
        { day: '2026-06-01', meals: 3 },
      ],
    });

    expect(result.nutritionDays).toEqual([
      { day: '2026-06-01', value: 3 },
      { day: '2026-06-02', value: 2 },
    ]);
  });

  it('counts the days each meal type was logged, once per day however many rows it had', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      mealEntries: [
        { day: '2026-06-01', type: 'snack' },
        { day: '2026-06-01', type: 'snack' },
        { day: '2026-06-02', type: 'snack' },
        { day: '2026-06-02', type: 'lunch' },
        { day: '2026-06-03', type: 'mystery' },
        { day: '2025-12-31', type: 'dinner' },
      ],
    });

    expect(result.mealTypeDays).toEqual({
      breakfast: 0,
      lunch: 1,
      dinner: 0,
      snack: 2,
      other: 1,
    });
    expect(result.favouriteMealType).toBe('snack');
  });

  it('gives a tie to the earlier meal type', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      mealEntries: [
        { day: '2026-06-01', type: 'dinner' },
        { day: '2026-06-02', type: 'breakfast' },
      ],
    });

    expect(result.favouriteMealType).toBe('breakfast');
  });

  it('has no favourite meal without any entries', () => {
    const result = buildYearInReview(emptyInput(2026));

    expect(result.mealTypeDays).toBeNull();
    expect(result.favouriteMealType).toBeNull();
  });

  it('passes macro grams through, dropping negatives and non-numbers', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      nutritionTotals: { proteinG: 45_000, carbsG: Number.NaN, fatG: -5 },
    });

    expect(result.macroGrams).toEqual({ protein: 45_000, carbs: 0, fat: 0 });
  });

  it('has no macros when the totals are missing or all zero', () => {
    expect(buildYearInReview(emptyInput(2026)).macroGrams).toBeNull();
    expect(
      buildYearInReview({
        ...emptyInput(2026),
        nutritionTotals: { proteinG: 0, carbsG: 0, fatG: 0 },
      }).macroGrams
    ).toBeNull();
  });
});

describe('buildYearInReview: activity days, meals and PRs', () => {
  it('counts a day once when it has both a session and a meal', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      workouts: [workout({ startedAt: at('2026-08-10T09:00:00+00:00'), timezone: '+00:00' })],
      nutritionDays: [
        { day: '2026-08-10', meals: 3 },
        { day: '2026-08-11', meals: 2 },
      ],
    });

    expect(result.activeDays).toBe(2);
    expect(result.mealsLogged).toBe(5);
    expect(result.nutritionDaysLogged).toBe(2);
  });

  it('ignores malformed days, other years and empty days', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      nutritionDays: [
        { day: '2025-12-31', meals: 3 },
        { day: '2026-6-1', meals: 3 },
        { day: '2026-06-02', meals: 0 },
        { day: '2026-06-03', meals: Number.NaN },
      ],
    });

    expect(result.activeDays).toBeNull();
    expect(result.nutritionDaysLogged).toBeNull();
    expect(result.mealsLogged).toBeNull();
  });

  it('counts personal records achieved in the year only', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      personalRecords: [
        { exerciseId: 'bench', achievedAt: localAt(2026, 3, 1, 9) },
        { exerciseId: 'squat', achievedAt: localAt(2026, 9, 1, 9) },
        { exerciseId: 'row', achievedAt: localAt(2025, 9, 1, 9) },
      ],
    });

    expect(result.personalRecords).toBe(2);
    expect(result.hasContent).toBe(true);
  });
});

describe('buildYearInReview: weight change', () => {
  const weigh = (day: number, weightKg: number) => ({ date: localAt(2026, 1, day, 8), weightKg });

  it('is last minus first in kilograms', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      firstWeighIn: weigh(1, 80),
      lastWeighIn: weigh(20, 77.5),
    });

    expect(result.weightChangeKg).toBe(-2.5);
  });

  it('is null with a single weigh-in', () => {
    const result = buildYearInReview({ ...emptyInput(2026), lastWeighIn: weigh(20, 77.5) });

    expect(result.weightChangeKg).toBeNull();
  });

  it('is null when the first and last weigh-ins fall on the same day', () => {
    const result = buildYearInReview({
      ...emptyInput(2026),
      firstWeighIn: { date: localAt(2026, 6, 1, 7), weightKg: 80 },
      lastWeighIn: { date: localAt(2026, 6, 1, 20), weightKg: 79 },
    });

    expect(result.weightChangeKg).toBeNull();
  });

  it('a single weigh-in alone does not make the year content', () => {
    const result = buildYearInReview({ ...emptyInput(2026), firstWeighIn: weigh(1, 80) });

    expect(result.hasContent).toBe(false);
    expect(result.weightChangeKg).toBeNull();
  });
});
