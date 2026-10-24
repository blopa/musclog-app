import {
  buildNutritionWidgetSnapshot,
  expiredWidgetSnapshot,
  INITIAL_CAMERA_SNAPSHOT,
  INITIAL_NUTRITION_SNAPSHOT,
  INITIAL_WIDGET_PALETTE,
  widgetProgress,
  widgetTrackColor,
} from '../widgetSnapshot';

const date = new Date(2026, 9, 17, 12);
const input = {
  date,
  nutrients: { calories: 900, protein: 40, carbs: 110, fat: 20, fiber: 10 },
  goal: { totalCalories: 1800, protein: 80, carbs: 200, fats: 40 },
  palette: INITIAL_WIDGET_PALETTE,
  locale: 'en-US',
  translate: (key: string) => key,
};

const containsNull = (value: unknown): boolean =>
  value === null ||
  (typeof value === 'object' && Object.values(value as object).some((item) => containsNull(item)));

describe('nutrition widget snapshots', () => {
  it('never carries a null, which iOS UserDefaults rejects as NSNull', () => {
    expect(containsNull(INITIAL_NUTRITION_SNAPSHOT)).toBe(false);
    expect(containsNull(INITIAL_CAMERA_SNAPSHOT)).toBe(false);
    expect(containsNull(buildNutritionWidgetSnapshot(input))).toBe(false);
    expect(containsNull(buildNutritionWidgetSnapshot({ ...input, goal: null }))).toBe(false);
  });

  it('uses digestible carbs and the resolved goals for finite, bounded progress', () => {
    const snapshot = buildNutritionWidgetSnapshot(input);
    expect(snapshot.state).toBe('ready');
    expect(snapshot.calorieProgress).toBe(0.5);
    expect(snapshot.macros.map((macro) => macro.progress)).toEqual([0.5, 0.5, 0.5]);
    expect(snapshot.macros[1].value).toBe('100 g');
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(widgetProgress(200, 100)).toBe(1);
    expect(widgetProgress(-1, 100)).toBe(0);
    expect(widgetProgress(NaN, 100)).toBe(0);
    expect(widgetProgress(100, 0)).toBe(0);
    expect(widgetProgress(100, Infinity)).toBe(0);
  });

  it('keeps actual totals when there is no goal without fabricating a zero target', () => {
    const snapshot = buildNutritionWidgetSnapshot({ ...input, goal: null });
    expect(snapshot.calories).toBe('900');
    expect(snapshot.calorieTarget).toBe('common.kcal');
    expect(snapshot.macros.every((macro) => macro.progress === 0)).toBe(true);
  });

  it('derives a translucent track from the text color', () => {
    expect(widgetTrackColor('#0f1a16')).toBe('#0f1a161f');
    // Anything that is not plain #rrggbb is passed through rather than corrupted.
    expect(widgetTrackColor('rgba(1, 2, 3, 0.5)')).toBe('rgba(1, 2, 3, 0.5)');
    expect(INITIAL_WIDGET_PALETTE.track).toBe(`${INITIAL_WIDGET_PALETTE.text}1f`);
  });

  it('publishes translated copy, the selected palette, and a localized date', () => {
    const snapshot = buildNutritionWidgetSnapshot({
      ...input,
      locale: 'nl-NL',
      palette: { ...input.palette, accent: '#123456' },
      translate: (key) => `nl:${key}`,
    });
    expect(snapshot.dateLabel).toBe(
      new Intl.DateTimeFormat('nl-NL', { month: 'short', day: 'numeric' }).format(date)
    );
    expect(snapshot.palette.accent).toBe('#123456');
    expect(snapshot.macros[0].label).toBe('nl:nutrition.macros.protein');
  });

  it('expires to a refresh prompt instead of relabeling yesterday’s values as current', () => {
    const snapshot = buildNutritionWidgetSnapshot(input);
    const expired = expiredWidgetSnapshot(snapshot);
    expect(expired.state).toBe('stale');
    expect(expired.refreshMessage).toBe('widgets.refresh');
    expect(expired.calories).toBe('—');
    expect(expired.macros).toEqual([]);
    expect(expired.dateLabel).toBe(snapshot.dateLabel);
  });
});
