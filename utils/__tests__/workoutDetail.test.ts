import { enUS } from 'date-fns/locale';
import type { TFunction } from 'i18next';

import { WorkoutAnalytics, WorkoutService } from '@/database/services';
import { UserMetricService } from '@/database/services/UserMetricService';
import { darkTheme as theme } from '@/theme';
import { transformWorkoutToDetailData } from '@/utils/workoutDetail';

// `@/utils/workoutHistory` (imported for `getWorkoutIcon`) reaches the database instance.
jest.mock('@/database', () => ({ database: { get: jest.fn() } }));

jest.mock('@/database/services', () => ({
  WorkoutAnalytics: { detectPersonalRecords: jest.fn() },
  WorkoutService: { getWorkoutLogsByTemplate: jest.fn() },
}));

jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: { getUserBodyWeightKgForVolume: jest.fn() },
}));

// Booting the real i18next bundle is unnecessary; only the active language and the
// date-fns locale lookup are read (by `workoutHistory` and `chartUtils`).
jest.mock('@/lang/lang', () => {
  const { enUS: locale } = require('date-fns/locale');
  return {
    __esModule: true,
    default: { language: 'en-US', resolvedLanguage: 'en-US' },
    LOCALE_MAP: { 'en-US': locale },
  };
});

/** Echoes the translation key so weight strings can be asserted verbatim. */
const t = ((key: string) => key) as unknown as TFunction;

const detectPersonalRecords = WorkoutAnalytics.detectPersonalRecords as jest.Mock;
const getWorkoutLogsByTemplate = WorkoutService.getWorkoutLogsByTemplate as jest.Mock;
const getBodyWeight = UserMetricService.getUserBodyWeightKgForVolume as jest.Mock;

const STARTED_AT = new Date(2026, 0, 15, 9, 0).getTime();

type SetOverrides = {
  id?: string;
  exerciseId?: string;
  weight?: number | null;
  reps?: number | null;
  repsInReserve?: number | null;
  partials?: number | null;
  setOrder?: number | null;
  difficultyLevel?: number;
  isSkipped?: boolean;
};

function logSet(overrides: SetOverrides = {}) {
  return {
    id: 'set-1',
    exerciseId: 'ex-1',
    weight: 60,
    reps: 10,
    repsInReserve: 2,
    partials: 0,
    setOrder: 1,
    difficultyLevel: 5,
    isSkipped: false,
    ...overrides,
  } as never;
}

function exercise(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ex-1',
    name: 'Bench Press',
    muscleGroup: 'chest',
    equipmentType: 'barbell',
    ...overrides,
  } as never;
}

function workoutLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wl-1',
    workoutName: 'Push Day',
    templateId: null,
    startedAt: STARTED_AT,
    completedAt: STARTED_AT + 45 * 60_000,
    totalVolume: 0,
    caloriesBurned: 0,
    ...overrides,
  } as never;
}

/** Runs the transform with the fixed formatting context these tests share. */
function transform(
  log: unknown,
  sets: unknown[],
  exercises: unknown[],
  units: 'imperial' | 'metric' = 'metric',
  orderedExerciseIds?: string[]
) {
  return transformWorkoutToDetailData(
    log as never,
    sets as never,
    exercises as never,
    t,
    units,
    enUS,
    theme,
    'en-US',
    orderedExerciseIds
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  detectPersonalRecords.mockResolvedValue([]);
  getWorkoutLogsByTemplate.mockResolvedValue([]);
  getBodyWeight.mockResolvedValue(80);
});

describe('transformWorkoutToDetailData — header data', () => {
  it('carries the workout name, duration, volume and calories straight through', async () => {
    const result = await transform(
      workoutLog({ totalVolume: 4321.5, caloriesBurned: 380 }),
      [logSet()],
      [exercise()]
    );

    expect(result.name).toBe('Push Day');
    expect(result.totalTime).toBe(45);
    expect(result.volume).toBe(4321.5);
    expect(result.calories).toBe(380);
    expect(result.date.getTime()).toBe(STARTED_AT);
  });

  it('reports zero duration when either timestamp is missing', async () => {
    const noEnd = await transform(workoutLog({ completedAt: null }), [logSet()], [exercise()]);
    expect(noEnd.totalTime).toBe(0);

    const noStart = await transform(workoutLog({ startedAt: null }), [logSet()], [exercise()]);
    expect(noStart.totalTime).toBe(0);
  });

  it('falls back to completedAt for the displayed date when startedAt is missing', async () => {
    const completedAt = new Date(2026, 3, 2, 18, 0).getTime();
    const result = await transform(
      workoutLog({ startedAt: null, completedAt }),
      [logSet()],
      [exercise()]
    );
    expect(result.date.getTime()).toBe(completedAt);
  });

  it('coerces null volume and calories to 0 rather than leaking null into the UI', async () => {
    const result = await transform(
      workoutLog({ totalVolume: null, caloriesBurned: null, workoutName: null }),
      [logSet()],
      [exercise()]
    );
    expect(result.volume).toBe(0);
    expect(result.calories).toBe(0);
    expect(result.name).toBe('');
  });
});

describe('transformWorkoutToDetailData — exercise grouping', () => {
  it('groups sets by exercise and renumbers them in set_order', async () => {
    const result = await transform(
      workoutLog(),
      [
        logSet({ id: 's3', setOrder: 3 }),
        logSet({ id: 's1', setOrder: 1 }),
        logSet({ id: 's2', setOrder: 2 }),
      ],
      [exercise()]
    );

    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].sets.map((s) => s.setNumber)).toEqual([1, 2, 3]);
    expect(result.exercises[0].sets.map((s) => s.reps)).toEqual([10, 10, 10]);
  });

  it('keeps first-appearance order of exercises when no explicit order is given', async () => {
    const result = await transform(
      workoutLog(),
      [logSet({ id: 's1', exerciseId: 'ex-2' }), logSet({ id: 's2', exerciseId: 'ex-1' })],
      [exercise(), exercise({ id: 'ex-2', name: 'Row' })]
    );

    expect(result.exercises.map((e) => e.id)).toEqual(['ex-2', 'ex-1']);
  });

  it('reorders exercises to match the workout_log_exercises order when supplied', async () => {
    const result = await transform(
      workoutLog(),
      [logSet({ id: 's1', exerciseId: 'ex-2' }), logSet({ id: 's2', exerciseId: 'ex-1' })],
      [exercise(), exercise({ id: 'ex-2', name: 'Row' })],
      'metric',
      ['ex-1', 'ex-2']
    );

    expect(result.exercises.map((e) => e.id)).toEqual(['ex-1', 'ex-2']);
  });

  it('pushes an exercise missing from the ordered list to the end', async () => {
    const result = await transform(
      workoutLog(),
      [logSet({ id: 's1', exerciseId: 'ex-untracked' }), logSet({ id: 's2', exerciseId: 'ex-1' })],
      [exercise(), exercise({ id: 'ex-untracked', name: 'Extra' })],
      'metric',
      ['ex-1']
    );

    expect(result.exercises.map((e) => e.id)).toEqual(['ex-1', 'ex-untracked']);
  });

  it('keeps first-appearance order among multiple exercises missing from the ordered list', async () => {
    const result = await transform(
      workoutLog(),
      [
        logSet({ id: 's1', exerciseId: 'ex-extra-2' }),
        logSet({ id: 's2', exerciseId: 'ex-1' }),
        logSet({ id: 's3', exerciseId: 'ex-extra-1' }),
      ],
      [
        exercise(),
        exercise({ id: 'ex-extra-1', name: 'Extra One' }),
        exercise({ id: 'ex-extra-2', name: 'Extra Two' }),
      ],
      'metric',
      ['ex-1']
    );

    expect(result.exercises.map((e) => e.id)).toEqual(['ex-1', 'ex-extra-2', 'ex-extra-1']);
  });

  it('carries the exercise metadata and derives timeSpent from the set count', async () => {
    const result = await transform(
      workoutLog(),
      [logSet({ id: 's1', setOrder: 1 }), logSet({ id: 's2', setOrder: 2 })],
      [exercise({ muscleGroup: 'chest' })]
    );

    expect(result.exercises[0]).toMatchObject({
      id: 'ex-1',
      name: 'Bench Press',
      muscleGroup: 'chest',
      timeSpent: 4,
    });
  });

  it('keeps skipped sets in the plan but excludes them from time spent', async () => {
    const result = await transform(
      workoutLog(),
      [
        logSet({ id: 'logged', setOrder: 1 }),
        logSet({
          id: 'skipped',
          setOrder: 2,
          difficultyLevel: 0,
          isSkipped: true,
        }),
      ],
      [exercise()]
    );

    expect(result.exercises[0]).toMatchObject({ timeSpent: 2, isSkipped: false });
    expect(result.exercises[0].sets.map((set) => set.isSkipped)).toEqual([false, true]);
  });

  it('marks an exercise skipped when none of its planned sets were logged', async () => {
    const result = await transform(
      workoutLog(),
      [logSet({ difficultyLevel: 0, isSkipped: true })],
      [exercise()]
    );

    expect(result.exercises[0]).toMatchObject({ timeSpent: 0, isSkipped: true });
    expect(result.exercises[0].sets[0].isSkipped).toBe(true);
  });

  it('normalizes a missing muscle group to null', async () => {
    const result = await transform(
      workoutLog(),
      [logSet()],
      [exercise({ muscleGroup: undefined })]
    );
    expect(result.exercises[0].muscleGroup).toBeNull();
  });

  it('throws when a set references an exercise that was not loaded', async () => {
    // Better to fail loudly than to render a detail sheet with a nameless exercise.
    await expect(
      transform(workoutLog(), [logSet({ exerciseId: 'ex-missing' })], [exercise()])
    ).rejects.toThrow('Exercise ex-missing not found');
  });

  it('returns no exercises for a workout with no sets', async () => {
    const result = await transform(workoutLog(), [], []);
    expect(result.exercises).toEqual([]);
  });
});

describe('transformWorkoutToDetailData — set formatting', () => {
  it('formats a loaded set as a whole number plus the unit key', async () => {
    const result = await transform(workoutLog(), [logSet({ weight: 60 })], [exercise()]);
    expect(result.exercises[0].sets[0].weight).toBe('60 workoutSession.kg');
  });

  it('keeps one decimal for fractional plate loads', async () => {
    const result = await transform(workoutLog(), [logSet({ weight: 62.5 })], [exercise()]);
    expect(result.exercises[0].sets[0].weight).toBe('62.5 workoutSession.kg');
  });

  it('converts to pounds in imperial mode', async () => {
    // Storage is always kg; only the display layer converts.
    const result = await transform(
      workoutLog(),
      [logSet({ weight: 100 })],
      [exercise()],
      'imperial'
    );
    expect(result.exercises[0].sets[0].weight).toBe('220.5 workoutSession.lb');
  });

  it('labels an unweighted bodyweight set as bodyweight instead of "0"', async () => {
    const result = await transform(
      workoutLog(),
      [logSet({ weight: 0 })],
      [exercise({ equipmentType: 'Bodyweight' })]
    );
    expect(result.exercises[0].sets[0].weight).toBe('workoutSession.bodyweight');
  });

  it('prefixes added load on a bodyweight exercise with +', async () => {
    const result = await transform(
      workoutLog(),
      [logSet({ weight: 10 })],
      [exercise({ equipmentType: 'bodyweight' })]
    );
    expect(result.exercises[0].sets[0].weight).toBe('+10 workoutSession.kg');
  });

  it('shows a dash for partials instead of a zero', async () => {
    const result = await transform(
      workoutLog(),
      [
        logSet({ id: 's1', setOrder: 1, partials: 0 }),
        logSet({ id: 's2', setOrder: 2, partials: null }),
        logSet({ id: 's3', setOrder: 3, partials: 4 }),
      ],
      [exercise()]
    );

    expect(result.exercises[0].sets.map((s) => s.partial)).toEqual(['-', '-', '4']);
  });

  it('defaults missing reps and RIR to 0', async () => {
    const result = await transform(
      workoutLog(),
      [logSet({ reps: null, repsInReserve: null, weight: null })],
      [exercise()]
    );

    expect(result.exercises[0].sets[0]).toMatchObject({
      reps: 0,
      repsInReserve: 0,
      weight: '0 workoutSession.kg',
    });
  });
});

describe('transformWorkoutToDetailData — personal record highlighting', () => {
  it('highlights the set that matches a weight PR and leaves the others alone', async () => {
    detectPersonalRecords.mockResolvedValue([
      {
        exerciseId: 'ex-1',
        type: 'weight',
        newRecord: { weight: 100, reps: 0, volume: 0 },
      },
    ]);

    const result = await transform(
      workoutLog(),
      [
        logSet({ id: 'heavy', setOrder: 1, weight: 100 }),
        logSet({ id: 'light', setOrder: 2, weight: 60 }),
      ],
      [exercise()]
    );

    expect(result.exercises[0].sets.map((s) => s.isHighlighted)).toEqual([true, false]);
  });

  it('highlights a reps PR by rep count', async () => {
    detectPersonalRecords.mockResolvedValue([
      { exerciseId: 'ex-1', type: 'reps', newRecord: { weight: 0, reps: 12, volume: 0 } },
    ]);

    const result = await transform(
      workoutLog(),
      [logSet({ id: 's1', setOrder: 1, reps: 8 }), logSet({ id: 's2', setOrder: 2, reps: 12 })],
      [exercise()]
    );

    expect(result.exercises[0].sets.map((s) => s.isHighlighted)).toEqual([false, true]);
  });

  it('does not highlight sets belonging to a different exercise', async () => {
    detectPersonalRecords.mockResolvedValue([
      { exerciseId: 'ex-2', type: 'weight', newRecord: { weight: 60, reps: 0, volume: 0 } },
    ]);

    const result = await transform(workoutLog(), [logSet({ id: 's1', weight: 60 })], [exercise()]);

    expect(result.exercises[0].sets[0].isHighlighted).toBe(false);
  });

  it('never highlights a skipped set as a personal record', async () => {
    detectPersonalRecords.mockResolvedValue([
      {
        exerciseId: 'ex-1',
        type: 'weight',
        newRecord: { weight: 100, reps: 0, volume: 0 },
      },
    ]);

    const result = await transform(
      workoutLog(),
      [logSet({ weight: 100, difficultyLevel: 0, isSkipped: true })],
      [exercise()]
    );

    expect(result.exercises[0].sets[0].isHighlighted).toBe(false);
  });

  it('resolves bodyweight PRs against the same body weight the detector was given', async () => {
    // A single body weight read is shared by `detectPersonalRecords` and the volume match,
    // so a bodyweight set's computed volume lines up with the reported record.
    getBodyWeight.mockResolvedValue(75);
    detectPersonalRecords.mockResolvedValue([]);

    await transform(workoutLog(), [logSet()], [exercise()]);

    expect(getBodyWeight).toHaveBeenCalledTimes(1);
    expect(detectPersonalRecords).toHaveBeenCalledWith(expect.objectContaining({ id: 'wl-1' }), 75);
  });
});

describe('transformWorkoutToDetailData — volume trend', () => {
  const HISTORY_START = new Date(2026, 0, 1, 9, 0).getTime();

  function historicalLog(id: string, totalVolume: number, dayOffset: number) {
    return {
      id,
      totalVolume,
      startedAt: HISTORY_START + dayOffset * 86_400_000,
      completedAt: HISTORY_START + dayOffset * 86_400_000 + 3_600_000,
    };
  }

  const EMPTY_TREND = { percentage: 0, data: [], labels: [] };

  it('is empty for a workout that was not started from a template', async () => {
    const result = await transform(workoutLog({ templateId: null }), [logSet()], [exercise()]);

    expect(result.volumeTrend).toEqual(EMPTY_TREND);
    expect(getWorkoutLogsByTemplate).not.toHaveBeenCalled();
  });

  it('is empty when the current workout has no recorded volume', async () => {
    const result = await transform(
      workoutLog({ templateId: 'tpl-1', totalVolume: 0 }),
      [logSet()],
      [exercise()]
    );

    expect(result.volumeTrend).toEqual(EMPTY_TREND);
    expect(getWorkoutLogsByTemplate).not.toHaveBeenCalled();
  });

  it('is empty when the template has fewer than two logs to compare', async () => {
    getWorkoutLogsByTemplate.mockResolvedValue([historicalLog('wl-1', 1000, 0)]);

    const result = await transform(
      workoutLog({ templateId: 'tpl-1', totalVolume: 1000 }),
      [logSet()],
      [exercise()]
    );

    expect(result.volumeTrend).toEqual(EMPTY_TREND);
    expect(getWorkoutLogsByTemplate).toHaveBeenCalledWith('tpl-1', 10);
  });

  it('is empty when the historical logs are all incomplete', async () => {
    // Logs without a completedAt or a volume are dropped, which can take the series below two.
    getWorkoutLogsByTemplate.mockResolvedValue([
      { id: 'wl-1', totalVolume: 1000, startedAt: HISTORY_START, completedAt: null },
      { id: 'wl-0', totalVolume: null, startedAt: HISTORY_START, completedAt: HISTORY_START },
    ]);

    const result = await transform(
      workoutLog({ templateId: 'tpl-1', totalVolume: 1000, completedAt: null }),
      [logSet()],
      [exercise()]
    );

    expect(result.volumeTrend).toEqual(EMPTY_TREND);
  });

  it('computes the percentage change against the previous session', async () => {
    getWorkoutLogsByTemplate.mockResolvedValue([
      historicalLog('wl-1', 1000, 7),
      historicalLog('wl-0', 800, 0),
    ]);

    const result = await transform(
      workoutLog({
        templateId: 'tpl-1',
        totalVolume: 1000,
        startedAt: HISTORY_START + 7 * 86_400_000,
      }),
      [logSet()],
      [exercise()]
    );

    expect(result.volumeTrend.percentage).toBe(25);
  });

  it('reports a negative percentage for a lighter session', async () => {
    getWorkoutLogsByTemplate.mockResolvedValue([
      historicalLog('wl-1', 800, 7),
      historicalLog('wl-0', 1000, 0),
    ]);

    const result = await transform(
      workoutLog({
        templateId: 'tpl-1',
        totalVolume: 800,
        startedAt: HISTORY_START + 7 * 86_400_000,
      }),
      [logSet()],
      [exercise()]
    );

    expect(result.volumeTrend.percentage).toBe(-20);
  });

  it('reports 0% when the current workout is the oldest in the series', async () => {
    // With no earlier session there is nothing to compare against, so the chart still
    // renders but the delta badge stays neutral.
    getWorkoutLogsByTemplate.mockResolvedValue([
      historicalLog('wl-1', 800, 0),
      historicalLog('wl-2', 1000, 7),
    ]);

    const result = await transform(
      workoutLog({ templateId: 'tpl-1', totalVolume: 800, startedAt: HISTORY_START }),
      [logSet()],
      [exercise()]
    );

    expect(result.volumeTrend.percentage).toBe(0);
    expect(result.volumeTrend.data).toHaveLength(2);
  });

  it('normalizes the series to an inverted 0–100 chart range, oldest first', async () => {
    getWorkoutLogsByTemplate.mockResolvedValue([
      historicalLog('wl-1', 1000, 14),
      historicalLog('wl-a', 900, 7),
      historicalLog('wl-0', 800, 0),
    ]);

    const result = await transform(
      workoutLog({
        templateId: 'tpl-1',
        totalVolume: 1000,
        startedAt: HISTORY_START + 14 * 86_400_000,
      }),
      [logSet()],
      [exercise()]
    );

    // y is inverted for screen coordinates: the largest volume sits at y = 0.
    expect(result.volumeTrend.data).toEqual([
      { x: 0, y: 100 },
      { x: 1, y: 50 },
      { x: 2, y: 0 },
    ]);
  });

  it('survives a flat series without dividing by a zero volume range', async () => {
    getWorkoutLogsByTemplate.mockResolvedValue([
      historicalLog('wl-1', 900, 7),
      historicalLog('wl-0', 900, 0),
    ]);

    const result = await transform(
      workoutLog({
        templateId: 'tpl-1',
        totalVolume: 900,
        startedAt: HISTORY_START + 7 * 86_400_000,
      }),
      [logSet()],
      [exercise()]
    );

    expect(result.volumeTrend.percentage).toBe(0);
    expect(result.volumeTrend.data.every((point) => Number.isFinite(point.y))).toBe(true);
  });

  it('labels each point with its session date, spanning the full axis', async () => {
    getWorkoutLogsByTemplate.mockResolvedValue([
      historicalLog('wl-1', 1000, 7),
      historicalLog('wl-0', 800, 0),
    ]);

    const result = await transform(
      workoutLog({
        templateId: 'tpl-1',
        totalVolume: 1000,
        startedAt: HISTORY_START + 7 * 86_400_000,
      }),
      [logSet()],
      [exercise()]
    );

    expect(result.volumeTrend.labels).toEqual([
      { label: 'Jan 1', positionPercent: 0 },
      { label: 'Jan 8', positionPercent: 100 },
    ]);
  });

  it('prepends the current workout when the template query has not caught up with it', async () => {
    // The current log is only added if it has both a volume and a completedAt.
    getWorkoutLogsByTemplate.mockResolvedValue([
      historicalLog('wl-0', 800, 0),
      historicalLog('wl-old', 700, -7),
    ]);

    const result = await transform(
      workoutLog({
        id: 'wl-new',
        templateId: 'tpl-1',
        totalVolume: 1000,
        startedAt: HISTORY_START + 7 * 86_400_000,
        completedAt: HISTORY_START + 7 * 86_400_000 + 3_600_000,
      }),
      [logSet()],
      [exercise()]
    );

    expect(result.volumeTrend.data).toHaveLength(3);
    expect(result.volumeTrend.percentage).toBe(25);
  });

  it('keeps a neutral percentage when an incomplete current workout is absent from history', async () => {
    getWorkoutLogsByTemplate.mockResolvedValue([
      historicalLog('wl-latest', 1000, 7),
      historicalLog('wl-old', 800, 0),
    ]);

    const result = await transform(
      workoutLog({
        id: 'wl-current',
        templateId: 'tpl-1',
        totalVolume: 900,
        completedAt: null,
      }),
      [logSet()],
      [exercise()]
    );

    expect(result.volumeTrend.percentage).toBe(0);
    expect(result.volumeTrend.data).toHaveLength(2);
  });
});
