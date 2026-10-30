import {
  ACTIVITY_WIDGET_DAYS,
  activityLevelColors,
  buildActivityWidgetSnapshot,
  expiredActivityWidgetSnapshot,
  INITIAL_ACTIVITY_SNAPSHOT,
} from '../activityWidgetSnapshot';
import { INITIAL_WIDGET_PALETTE } from '../widgetSnapshot';

const today = new Date(2026, 9, 17, 12);
const palette = { ...INITIAL_WIDGET_PALETTE, accent: '#112233', track: '#ffffff1f' };
const translate = (key: string, options?: { count: number }) =>
  options ? `${key}:${options.count}` : key;

const build = (workoutDays = [] as { date: string; value: number }[], mealDays = workoutDays) =>
  buildActivityWidgetSnapshot({
    date: today,
    days: { workouts: workoutDays, nutrition: mealDays },
    palette,
    translate,
  });

const containsNull = (value: unknown): boolean =>
  value === null ||
  (typeof value === 'object' && Object.values(value as object).some((item) => containsNull(item)));

const rowLevels = (snapshot: ReturnType<typeof build>, key: string) =>
  snapshot.rows.find((row) => row.key === key)?.levels ?? [];

describe('activity widget snapshot', () => {
  it('draws the last 30 days of each source, oldest first, ending today', () => {
    const snapshot = build([
      { date: '2026-10-17', value: 1 },
      { date: '2026-09-18', value: 2 },
    ]);

    expect(snapshot.state).toBe('ready');
    expect(snapshot.title).toBe(`home.heatmaps.lastDays:${ACTIVITY_WIDGET_DAYS}`);
    expect(snapshot.rows.map((row) => row.key)).toEqual(['workouts', 'nutrition']);
    expect(snapshot.rows.map((row) => row.label)).toEqual([
      'home.heatmaps.workouts.title',
      'home.heatmaps.nutrition.title',
    ]);
    const workouts = rowLevels(snapshot, 'workouts');
    expect(workouts).toHaveLength(30);
    expect(workouts[29]).toBeGreaterThan(0);
    // 29 days before today is the first square; the day before that is out of the window.
    expect(workouts[0]).toBeGreaterThan(0);
    expect(workouts.slice(1, 29).every((level) => level === 0)).toBe(true);
  });

  it('shades a day with the same fixed scales as the Home heatmap', () => {
    const snapshot = build(
      [{ date: '2026-10-17', value: 1 }],
      [
        { date: '2026-10-17', value: 4 },
        { date: '2026-10-16', value: 1 },
      ]
    );

    // One workout is the third of four steps; all four meals is the darkest, one meal the lightest.
    expect(rowLevels(snapshot, 'workouts')[29]).toBe(3);
    expect(rowLevels(snapshot, 'nutrition').slice(28)).toEqual([1, 4]);
  });

  it('composes the five square colors from the palette, translucent accent over the track', () => {
    expect(activityLevelColors(palette)).toEqual([
      '#ffffff1f',
      '#11223352',
      '#11223385',
      '#112233c2',
      '#112233ff',
    ]);
    expect(build().levelColors).toEqual(activityLevelColors(palette));
  });

  it('is plain JSON with no null, which iOS UserDefaults rejects as NSNull', () => {
    for (const snapshot of [
      INITIAL_ACTIVITY_SNAPSHOT,
      build(),
      build([{ date: '2026-10-17', value: 2 }]),
    ]) {
      expect(containsNull(snapshot)).toBe(false);
      expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    }
  });

  it('starts as a quiet refresh prompt that opens Home', () => {
    expect(INITIAL_ACTIVITY_SNAPSHOT).toMatchObject({
      state: 'stale',
      rows: [],
      url: 'com.werules.logger://?action=open-home',
    });
  });
});

describe('expiredActivityWidgetSnapshot', () => {
  it('moves every row one day along and leaves the new day empty', () => {
    const snapshot = build([{ date: '2026-10-17', value: 1 }]);
    const expired = expiredActivityWidgetSnapshot(snapshot);
    const before = rowLevels(snapshot, 'workouts');
    const after = rowLevels(expired, 'workouts');

    expect(after).toHaveLength(30);
    expect(after.slice(0, 28)).toEqual(before.slice(1, 29));
    expect(after[28]).toBe(before[29]);
    expect(after[29]).toBe(0);
    expect(expired.state).toBe('ready');
    // The input is not mutated.
    expect(rowLevels(snapshot, 'workouts')).toBe(before);
  });

  it('leaves the refresh prompt alone', () => {
    expect(expiredActivityWidgetSnapshot(INITIAL_ACTIVITY_SNAPSHOT)).toBe(
      INITIAL_ACTIVITY_SNAPSHOT
    );
  });
});
