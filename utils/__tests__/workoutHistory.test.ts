import { Activity, Dumbbell, Square } from 'lucide-react-native';

import { database } from '@/database';
import { WorkoutAnalytics } from '@/database/services';
import { darkTheme as theme } from '@/theme';
import { localDayKeyPlusCalendarDaysFromNow } from '@/utils/calendarDate';
import type {
  TranslationFunction,
  WorkoutFilters,
  WorkoutHistoryItem,
  WorkoutHistorySection,
} from '@/utils/workoutHistory';
import {
  calculateDateRange,
  filterWorkoutsBySearch,
  formatDuration,
  formatVolume,
  getMuscleGroupsFromWorkout,
  getWorkoutIcon,
  getWorkoutTypeFromName,
  groupWorkoutsByMonth,
  mergeWorkoutSections,
  normalizeMuscleGroup,
  processWorkouts,
} from '@/utils/workoutHistory';

// The real `Q` builders are pure query descriptions and are never asserted on here, so only
// the collection they are handed to needs stubbing. (Mocking the whole module would also
// strip `tableSchema`, which `@/theme` pulls in transitively.)
jest.mock('@/database', () => ({ database: { get: jest.fn() } }));

jest.mock('@/database/services', () => ({
  WorkoutAnalytics: { detectPersonalRecords: jest.fn() },
}));

// The real module boots i18next and every locale bundle; only the active language and the
// date-fns locale lookup matter here, and pinning them keeps the formatting assertions stable.
jest.mock('@/lang/lang', () => {
  const { enUS } = require('date-fns/locale');
  return {
    __esModule: true,
    default: { language: 'en-US', resolvedLanguage: 'en-US' },
    LOCALE_MAP: { 'en-US': enUS },
  };
});

/** Echoes the key, appending interpolation values so both halves can be asserted. */
const t: TranslationFunction = (key, options) =>
  options
    ? `${key}(${Object.entries(options)
        .map(([name, value]) => `${name}=${String(value)}`)
        .join(',')})`
    : key;

type LogOverrides = {
  id?: string;
  workoutName?: string | null;
  startedAt?: number | null;
  completedAt?: number | null;
  totalVolume?: number | null;
  caloriesBurned?: number | null;
};

/** Local-time instants keep the `MMM d • hh:mm a` assertions timezone-independent. */
const STARTED_AT = new Date(2026, 0, 15, 14, 30).getTime();

function workoutLog(overrides: LogOverrides = {}) {
  return {
    id: 'wl-1',
    workoutName: 'Push Day',
    startedAt: STARTED_AT,
    completedAt: STARTED_AT + 45 * 60_000,
    totalVolume: 0,
    caloriesBurned: 0,
    ...overrides,
  } as never;
}

const ALL_WORKOUTS: WorkoutFilters = { workoutType: 'all', muscleGroups: [], minDuration: 0 };

function historyItem(overrides: Partial<WorkoutHistoryItem> = {}): WorkoutHistoryItem {
  return {
    id: 'w-1',
    name: 'Push Day',
    date: 'Jan 15',
    dateTimestamp: STARTED_AT,
    iconBgColor: '#000',
    iconBgOpacity: '#0001',
    icon: Dumbbell,
    prCount: null,
    stats: [],
    ...overrides,
  };
}

/** Backs `database.get(table).query(...).fetch()` with fixed rows per table. */
function stubTables(rows: Record<string, unknown[]>) {
  (database.get as jest.Mock).mockImplementation((table: string) => ({
    query: jest.fn(() => ({ fetch: jest.fn(async () => rows[table] ?? []) })),
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  (WorkoutAnalytics.detectPersonalRecords as jest.Mock).mockResolvedValue([]);
  stubTables({});
});

describe('formatDuration', () => {
  it('renders sub-hour durations as plain minutes', () => {
    expect(formatDuration(45, t, 'en-US')).toBe('45 common.min');
    expect(formatDuration(0, t, 'en-US')).toBe('0 common.min');
    expect(formatDuration(59, t, 'en-US')).toBe('59 common.min');
  });

  it('switches to the hours-only key on the exact hour', () => {
    expect(formatDuration(60, t, 'en-US')).toBe('common.duration.hoursOnly(hours=1)');
    expect(formatDuration(120, t, 'en-US')).toBe('common.duration.hoursOnly(hours=2)');
  });

  it('splits hours and remaining minutes for mixed durations', () => {
    expect(formatDuration(90, t, 'en-US')).toBe('common.duration.hoursMinutes(hours=1,minutes=30)');
    expect(formatDuration(135, t, 'en-US')).toBe(
      'common.duration.hoursMinutes(hours=2,minutes=15)'
    );
  });
});

describe('formatVolume', () => {
  it('rounds sub-1000 volumes to a whole number with the unit key', () => {
    expect(formatVolume(842.6, t, 'metric', 'en-US')).toBe('843 workoutSession.kg');
    expect(formatVolume(0, t, 'metric', 'en-US')).toBe('0 workoutSession.kg');
  });

  it('abbreviates from 1000 upwards with one decimal', () => {
    expect(formatVolume(1000, t, 'metric', 'en-US')).toBe('1k workoutSession.kg');
    expect(formatVolume(1234, t, 'metric', 'en-US')).toBe('1.2k workoutSession.kg');
    expect(formatVolume(12_500, t, 'metric', 'en-US')).toBe('12.5k workoutSession.kg');
  });

  it('rounds to 1000 just below the abbreviation threshold without abbreviating', () => {
    // 999.6 rounds to 1000 but stays on the non-abbreviated branch.
    expect(formatVolume(999.6, t, 'metric', 'en-US')).toBe('1000 workoutSession.kg');
  });

  it('uses the imperial weight unit key without converting the number', () => {
    // The value is already display-ready; only the unit label switches.
    expect(formatVolume(1234, t, 'imperial', 'en-US')).toBe('1.2k workoutSession.lb');
  });

  it('honours the app locale separator, not a hardcoded dot', () => {
    expect(formatVolume(1234, t, 'metric', 'de-DE')).toBe('1,2k workoutSession.kg');
    expect(formatVolume(842.6, t, 'metric', 'de-DE')).toBe('843 workoutSession.kg');
  });
});

describe('getWorkoutIcon', () => {
  it('picks the cardio icon for run/cardio names', () => {
    expect(getWorkoutIcon(theme, 'Morning Run').icon).toBe(Activity);
    expect(getWorkoutIcon(theme, 'CARDIO blast').icon).toBe(Activity);
    expect(getWorkoutIcon(theme, 'Morning Run').iconBgColor).toBe(theme.colors.status.emerald);
  });

  it('picks the leg icon for leg/squat names', () => {
    expect(getWorkoutIcon(theme, 'Leg Day').icon).toBe(Square);
    expect(getWorkoutIcon(theme, 'Back Squat Session').icon).toBe(Square);
    expect(getWorkoutIcon(theme, 'Leg Day').iconBgColor).toBe(theme.colors.accent.primary);
  });

  it('falls back to the dumbbell icon for anything else, including an empty name', () => {
    expect(getWorkoutIcon(theme, 'Push Day').icon).toBe(Dumbbell);
    expect(getWorkoutIcon(theme, '').icon).toBe(Dumbbell);
    expect(getWorkoutIcon(theme, '').iconBgColor).toBe(theme.colors.status.indigo600);
  });

  it('checks cardio before legs, so a name matching both is cardio', () => {
    expect(getWorkoutIcon(theme, 'Leg Cardio Circuit').icon).toBe(Activity);
  });
});

describe('getWorkoutTypeFromName', () => {
  it('classifies by keyword', () => {
    expect(getWorkoutTypeFromName('Morning Run')).toBe('cardio');
    expect(getWorkoutTypeFromName('HIIT Blast')).toBe('hiit');
    expect(getWorkoutTypeFromName('Interval Training')).toBe('hiit');
    expect(getWorkoutTypeFromName('Yoga Flow')).toBe('yoga');
    expect(getWorkoutTypeFromName('Evening Stretch')).toBe('yoga');
  });

  it('defaults to strength for unclassified and empty names', () => {
    // The signature allows null but the implementation never returns it; the filter in
    // `processWorkouts` compares against this default.
    expect(getWorkoutTypeFromName('Push Day')).toBe('strength');
    expect(getWorkoutTypeFromName('')).toBe('strength');
  });

  it('resolves keyword collisions in declaration order (cardio wins over hiit)', () => {
    expect(getWorkoutTypeFromName('Cardio HIIT')).toBe('cardio');
    expect(getWorkoutTypeFromName('HIIT Yoga')).toBe('hiit');
  });
});

describe('normalizeMuscleGroup', () => {
  it('lowercases and hyphenates whitespace to match the filter menu ids', () => {
    expect(normalizeMuscleGroup('Upper Back')).toBe('upper-back');
    expect(normalizeMuscleGroup('LOWER   BACK')).toBe('lower-back');
    expect(normalizeMuscleGroup('chest')).toBe('chest');
  });

  it('collapses anything containing "full" or "body" into full-body', () => {
    expect(normalizeMuscleGroup('Full Body')).toBe('full-body');
    expect(normalizeMuscleGroup('full_body')).toBe('full-body');
    // Documents the loose match: "body" alone is enough, so 'bodyweight' collapses too.
    expect(normalizeMuscleGroup('bodyweight')).toBe('full-body');
  });
});

describe('calculateDateRange', () => {
  it('anchors the 30/90 day windows on local calendar day starts', () => {
    const before = Date.now();
    const range30 = calculateDateRange('30');
    const after = Date.now();

    expect(range30?.startDate).toBe(localDayKeyPlusCalendarDaysFromNow(-30));
    expect(range30!.endDate).toBeGreaterThanOrEqual(before);
    expect(range30!.endDate).toBeLessThanOrEqual(after);
  });

  it('reaches further back for 90 days than for 30', () => {
    expect(calculateDateRange('90')!.startDate).toBeLessThan(calculateDateRange('30')!.startDate);
  });

  it('returns undefined for the custom range, which has no picker yet', () => {
    expect(calculateDateRange('custom')).toBeUndefined();
  });
});

describe('getMuscleGroupsFromWorkout', () => {
  it('returns the lowercased, de-duplicated muscle groups of the logged exercises', () => {
    stubTables({
      workout_log_exercises: [{ exerciseId: 'ex-1' }, { exerciseId: 'ex-2' }],
      exercises: [{ muscleGroup: 'Chest' }, { muscleGroup: 'CHEST' }, { muscleGroup: 'Back' }],
    });

    return expect(getMuscleGroupsFromWorkout('wl-1')).resolves.toEqual(['chest', 'back']);
  });

  it('short-circuits without querying exercises when the workout has no log exercises', () => {
    stubTables({ workout_log_exercises: [] });

    return getMuscleGroupsFromWorkout('wl-1').then((groups) => {
      expect(groups).toEqual([]);
      expect(database.get).toHaveBeenCalledTimes(1);
      expect(database.get).toHaveBeenCalledWith('workout_log_exercises');
    });
  });

  it('maps a missing muscle group to an empty string rather than dropping the exercise', () => {
    stubTables({
      workout_log_exercises: [{ exerciseId: 'ex-1' }],
      exercises: [{ muscleGroup: null }],
    });

    return expect(getMuscleGroupsFromWorkout('wl-1')).resolves.toEqual(['']);
  });

  it('swallows query errors and returns no groups so the history list still renders', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (database.get as jest.Mock).mockImplementation(() => {
      throw new Error('boom');
    });

    return getMuscleGroupsFromWorkout('wl-1').then((groups) => {
      expect(groups).toEqual([]);
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });
});

describe('processWorkouts', () => {
  it('builds a history item with the duration stat always present', async () => {
    const [item] = await processWorkouts([workoutLog()], ALL_WORKOUTS, t, 'metric', theme);

    expect(item).toMatchObject({
      id: 'wl-1',
      name: 'Push Day',
      date: 'Jan 15 • 02:30 PM',
      dateTimestamp: STARTED_AT,
      icon: Dumbbell,
      prCount: null,
    });
    expect(item.stats).toEqual([
      { label: 'pastWorkoutHistory.stats.duration', value: '45 common.min' },
    ]);
  });

  it('appends volume and calorie stats only when they are non-zero', async () => {
    const [withExtras] = await processWorkouts(
      [workoutLog({ totalVolume: 1234, caloriesBurned: 320 })],
      ALL_WORKOUTS,
      t,
      'metric',
      theme
    );
    expect(withExtras.stats).toEqual([
      { label: 'pastWorkoutHistory.stats.duration', value: '45 common.min' },
      { label: 'pastWorkoutHistory.stats.volume', value: '1.2k workoutSession.kg' },
      { label: 'pastWorkoutHistory.stats.calories', value: '320 common.kcal' },
    ]);

    const [withZeroes] = await processWorkouts(
      [workoutLog({ totalVolume: 0, caloriesBurned: 0 })],
      ALL_WORKOUTS,
      t,
      'metric',
      theme
    );
    expect(withZeroes.stats).toHaveLength(1);
  });

  it('reports the PR count, collapsing "no PRs" to null so the badge can hide', async () => {
    (WorkoutAnalytics.detectPersonalRecords as jest.Mock).mockResolvedValue([{}, {}, {}]);
    const [item] = await processWorkouts([workoutLog()], ALL_WORKOUTS, t, 'metric', theme);
    expect(item.prCount).toBe(3);

    (WorkoutAnalytics.detectPersonalRecords as jest.Mock).mockResolvedValue([]);
    const [none] = await processWorkouts([workoutLog()], ALL_WORKOUTS, t, 'metric', theme);
    expect(none.prCount).toBeNull();
  });

  it('treats a workout with no timestamps as zero duration', async () => {
    const [item] = await processWorkouts(
      [workoutLog({ startedAt: null, completedAt: null })],
      ALL_WORKOUTS,
      t,
      'metric',
      theme
    );
    expect(item.stats[0].value).toBe('0 common.min');
  });

  it('falls back to completedAt for the timestamp when startedAt is missing', async () => {
    const completedAt = new Date(2026, 2, 3, 9, 5).getTime();
    const [item] = await processWorkouts(
      [workoutLog({ startedAt: null, completedAt })],
      ALL_WORKOUTS,
      t,
      'metric',
      theme
    );

    expect(item.dateTimestamp).toBe(completedAt);
    expect(item.date).toBe('Mar 3 • 09:05 AM');
  });

  it('drops workouts shorter than the minimum duration filter', async () => {
    const filters: WorkoutFilters = { ...ALL_WORKOUTS, minDuration: 60 };
    await expect(processWorkouts([workoutLog()], filters, t, 'metric', theme)).resolves.toEqual([]);

    const long = workoutLog({ id: 'wl-2', completedAt: STARTED_AT + 61 * 60_000 });
    const kept = await processWorkouts([long], filters, t, 'metric', theme);
    expect(kept.map((w) => w.id)).toEqual(['wl-2']);
  });

  it('drops workouts whose name-derived type does not match the type filter', async () => {
    const filters: WorkoutFilters = { ...ALL_WORKOUTS, workoutType: 'cardio' };
    const result = await processWorkouts(
      [workoutLog({ id: 'strength' }), workoutLog({ id: 'cardio', workoutName: 'Morning Run' })],
      filters,
      t,
      'metric',
      theme
    );

    expect(result.map((w) => w.id)).toEqual(['cardio']);
  });

  it('keeps a workout when any of its muscle groups matches the filter', async () => {
    stubTables({
      workout_log_exercises: [{ exerciseId: 'ex-1' }],
      exercises: [{ muscleGroup: 'Chest' }],
    });

    const result = await processWorkouts(
      [workoutLog()],
      { ...ALL_WORKOUTS, muscleGroups: ['Chest', 'Legs'] },
      t,
      'metric',
      theme
    );

    expect(result).toHaveLength(1);
  });

  it('normalizes both sides of the muscle group comparison before matching', async () => {
    // Stored 'Upper Back' vs filter id 'upper-back' must still match.
    stubTables({
      workout_log_exercises: [{ exerciseId: 'ex-1' }],
      exercises: [{ muscleGroup: 'Upper Back' }],
    });

    const result = await processWorkouts(
      [workoutLog()],
      { ...ALL_WORKOUTS, muscleGroups: ['upper-back'] },
      t,
      'metric',
      theme
    );

    expect(result).toHaveLength(1);
  });

  it('drops workouts with no matching muscle group, including ones with none recorded', async () => {
    stubTables({
      workout_log_exercises: [{ exerciseId: 'ex-1' }],
      exercises: [{ muscleGroup: 'Legs' }],
    });
    await expect(
      processWorkouts(
        [workoutLog()],
        { ...ALL_WORKOUTS, muscleGroups: ['chest'] },
        t,
        'metric',
        theme
      )
    ).resolves.toEqual([]);

    stubTables({ workout_log_exercises: [] });
    await expect(
      processWorkouts(
        [workoutLog()],
        { ...ALL_WORKOUTS, muscleGroups: ['chest'] },
        t,
        'metric',
        theme
      )
    ).resolves.toEqual([]);
  });

  it('skips the muscle group query entirely when no muscle filter is active', async () => {
    await processWorkouts([workoutLog()], ALL_WORKOUTS, t, 'metric', theme);
    expect(database.get).not.toHaveBeenCalled();
  });

  it('returns an empty array for no workouts', async () => {
    await expect(processWorkouts([], ALL_WORKOUTS, t, 'metric', theme)).resolves.toEqual([]);
  });
});

describe('groupWorkoutsByMonth', () => {
  it('returns no sections for no workouts', () => {
    expect(groupWorkoutsByMonth([])).toEqual([]);
  });

  it('groups by local yyyy-MM and sorts sections newest month first', () => {
    const sections = groupWorkoutsByMonth([
      historyItem({ id: 'a', dateTimestamp: new Date(2026, 0, 5).getTime() }),
      historyItem({ id: 'b', dateTimestamp: new Date(2026, 1, 20).getTime() }),
      historyItem({ id: 'c', dateTimestamp: new Date(2026, 0, 28).getTime() }),
    ]);

    expect(sections.map((s) => s.monthKey)).toEqual(['2026-02', '2026-01']);
    expect(sections[0].workouts.map((w) => w.id)).toEqual(['b']);
    expect(sections[1].workouts.map((w) => w.id)).toEqual(['a', 'c']);
  });

  it('exposes a stable monthKey alongside the localized heading', () => {
    // The key is what merging and React keys rely on; the heading is display-only.
    const [section] = groupWorkoutsByMonth([
      historyItem({ dateTimestamp: new Date(2026, 0, 15).getTime() }),
    ]);
    expect(section.monthKey).toBe('2026-01');
    expect(section.month).toBe('January 2026');
  });

  it('sorts across year boundaries by key, not by month number', () => {
    const sections = groupWorkoutsByMonth([
      historyItem({ id: 'old', dateTimestamp: new Date(2025, 11, 31).getTime() }),
      historyItem({ id: 'new', dateTimestamp: new Date(2026, 0, 1).getTime() }),
    ]);
    expect(sections.map((s) => s.monthKey)).toEqual(['2026-01', '2025-12']);
  });

  it('preserves the incoming order of workouts inside a month', () => {
    const sections = groupWorkoutsByMonth([
      historyItem({ id: 'first', dateTimestamp: new Date(2026, 0, 2).getTime() }),
      historyItem({ id: 'second', dateTimestamp: new Date(2026, 0, 20).getTime() }),
    ]);
    expect(sections[0].workouts.map((w) => w.id)).toEqual(['first', 'second']);
  });
});

describe('mergeWorkoutSections', () => {
  const january: WorkoutHistorySection = {
    monthKey: '2026-01',
    month: 'January 2026',
    workouts: [historyItem({ id: 'jan-20', dateTimestamp: new Date(2026, 0, 20).getTime() })],
  };

  it('merges pages into one section per month and sorts each newest first', () => {
    const merged = mergeWorkoutSections(
      [january],
      [
        historyItem({ id: 'jan-05', dateTimestamp: new Date(2026, 0, 5).getTime() }),
        historyItem({ id: 'jan-25', dateTimestamp: new Date(2026, 0, 25).getTime() }),
      ]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].workouts.map((w) => w.id)).toEqual(['jan-25', 'jan-20', 'jan-05']);
  });

  it('skips workouts whose id is already present, so re-fetched pages do not duplicate', () => {
    const merged = mergeWorkoutSections(
      [january],
      [historyItem({ id: 'jan-20', dateTimestamp: new Date(2026, 0, 20).getTime() })]
    );

    expect(merged[0].workouts.map((w) => w.id)).toEqual(['jan-20']);
  });

  it('de-duplicates repeated ids within the incoming page itself', () => {
    const merged = mergeWorkoutSections(
      [],
      [
        historyItem({ id: 'dup', dateTimestamp: new Date(2026, 0, 10).getTime() }),
        historyItem({ id: 'dup', dateTimestamp: new Date(2026, 0, 11).getTime() }),
      ]
    );

    expect(merged[0].workouts.map((w) => w.id)).toEqual(['dup']);
  });

  it('creates missing month sections and keeps sections newest month first', () => {
    const merged = mergeWorkoutSections(
      [january],
      [
        historyItem({ id: 'feb', dateTimestamp: new Date(2026, 1, 3).getTime() }),
        historyItem({ id: 'dec', dateTimestamp: new Date(2025, 11, 3).getTime() }),
      ]
    );

    expect(merged.map((s) => s.monthKey)).toEqual(['2026-02', '2026-01', '2025-12']);
    expect(merged.map((s) => s.month)).toEqual(['February 2026', 'January 2026', 'December 2025']);
  });

  it('keeps the existing sections when the incoming page is empty', () => {
    const merged = mergeWorkoutSections([january], []);
    expect(merged).toHaveLength(1);
    expect(merged[0].workouts.map((w) => w.id)).toEqual(['jan-20']);
  });

  it('returns no sections when both sides are empty', () => {
    expect(mergeWorkoutSections([], [])).toEqual([]);
  });
});

describe('filterWorkoutsBySearch', () => {
  const sections: WorkoutHistorySection[] = [
    {
      monthKey: '2026-01',
      month: 'January 2026',
      workouts: [
        historyItem({ id: 'a', name: 'Push Day' }),
        historyItem({ id: 'b', name: 'Leg Day' }),
      ],
    },
    {
      monthKey: '2025-12',
      month: 'December 2025',
      workouts: [historyItem({ id: 'c', name: 'Morning Run' })],
    },
  ];

  it('returns the original array untouched for an empty query', () => {
    // Identity matters: the list re-renders on every keystroke and this is the no-op path.
    expect(filterWorkoutsBySearch(sections, '')).toBe(sections);
  });

  it('matches case-insensitively on a substring of the workout name', () => {
    const result = filterWorkoutsBySearch(sections, 'day');
    expect(result).toHaveLength(1);
    expect(result[0].workouts.map((w) => w.id)).toEqual(['a', 'b']);

    expect(filterWorkoutsBySearch(sections, 'RUN')[0].workouts.map((w) => w.id)).toEqual(['c']);
  });

  it('drops sections that end up with no matching workouts', () => {
    const result = filterWorkoutsBySearch(sections, 'push');
    expect(result.map((s) => s.monthKey)).toEqual(['2026-01']);
  });

  it('returns no sections when nothing matches', () => {
    expect(filterWorkoutsBySearch(sections, 'zzz')).toEqual([]);
  });

  it('does not mutate the input sections', () => {
    filterWorkoutsBySearch(sections, 'push');
    expect(sections[0].workouts).toHaveLength(2);
    expect(sections).toHaveLength(2);
  });
});
