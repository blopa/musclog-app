import type { Theme } from '@/theme';
import { digestibleCarbs } from '@/utils/carbsConvention';
import { formatAppInteger } from '@/utils/formatAppNumber';

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths -- Expo's initial-layout registry stubs project aliases.
import { DEFAULT_THEME_BY_MODE } from '../theme.registry';
// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths -- Must resolve in the isolated initial-layout registry.
import { themeColorsById } from '../theme.tokens';

export type WidgetPalette = {
  background: string;
  text: string;
  secondary: string;
  accent: string;
  protein: string;
  carbs: string;
  fat: string;
  /** The unfilled part of a progress ring or bar: `text` at low alpha, so it suits every palette. */
  track: string;
};

/** `stale` shows only `refreshMessage`: no values yet, or yesterday's after midnight. */
export type NutritionWidgetState = 'ready' | 'stale';

export type NutritionWidgetSnapshot = {
  state: NutritionWidgetState;
  dateLabel: string;
  calories: string;
  calorieTarget: string;
  calorieProgress: number;
  macros: { label: string; value: string; progress: number; color: string }[];
  palette: WidgetPalette;
  refreshMessage: string;
  url: string;
};

export type CameraWidgetSnapshot = {
  label: string;
  palette: WidgetPalette;
  /** Empty when there is no artwork; never null, which UserDefaults rejects as NSNull. */
  imageUri: string;
  url: string;
};

// Every palette color is `#rrggbb`; the widget runtimes read `#rrggbbaa` in CSS byte order.
const TRACK_ALPHA = '1f';

export function widgetTrackColor(text: string): string {
  return /^#[0-9a-f]{6}$/i.test(text) ? `${text}${TRACK_ALPHA}` : text;
}

export function widgetPalette(
  colors: Pick<Theme['colors'], 'background' | 'text' | 'accent' | 'macros'>
): WidgetPalette {
  return {
    background: colors.background.primary,
    text: colors.text.primary,
    secondary: colors.text.secondary,
    accent: colors.accent.primary,
    protein: colors.macros.protein.bg,
    carbs: colors.macros.carbs.bg,
    fat: colors.macros.fat.bg,
    track: widgetTrackColor(colors.text.primary),
  };
}

export const INITIAL_WIDGET_PALETTE = widgetPalette(themeColorsById[DEFAULT_THEME_BY_MODE.dark]);
export const NUTRITION_WIDGET_URL = 'com.werules.logger://?action=open-nutrition';
export const CAMERA_WIDGET_URL = 'com.werules.logger://?action=open-camera';
export const INITIAL_NUTRITION_SNAPSHOT: NutritionWidgetSnapshot = {
  state: 'stale',
  dateLabel: 'Musclog',
  calories: '—',
  calorieTarget: '',
  calorieProgress: 0,
  macros: [],
  palette: INITIAL_WIDGET_PALETTE,
  refreshMessage: 'Open Musclog to refresh',
  url: NUTRITION_WIDGET_URL,
};
export const INITIAL_CAMERA_SNAPSHOT: CameraWidgetSnapshot = {
  label: 'Smart Camera',
  palette: INITIAL_WIDGET_PALETTE,
  imageUri: '',
  url: CAMERA_WIDGET_URL,
};

const nonNegative = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);

export function widgetProgress(value: number, target: number): number {
  return target > 0 && Number.isFinite(target) ? Math.min(1, nonNegative(value) / target) : 0;
}

export function buildNutritionWidgetSnapshot({
  date,
  nutrients,
  goal,
  palette,
  locale,
  translate,
}: {
  date: Date;
  nutrients: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  goal: { totalCalories: number; protein: number; carbs: number; fats: number } | null;
  palette: WidgetPalette;
  locale: string;
  translate: (key: string) => string;
}): NutritionWidgetSnapshot {
  const carbs = digestibleCarbs(nutrients.carbs, nutrients.fiber);
  const macros = [
    {
      key: 'protein',
      label: 'nutrition.macros.protein',
      value: nutrients.protein,
      target: goal?.protein,
    },
    { key: 'carbs', label: 'nutrition.carbs', value: carbs, target: goal?.carbs },
    { key: 'fat', label: 'nutrition.fat', value: nutrients.fat, target: goal?.fats },
  ] as const;

  return {
    state: 'ready',
    dateLabel: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date),
    calories: formatAppInteger(locale, Math.round(nonNegative(nutrients.calories))),
    calorieTarget: goal
      ? `/ ${formatAppInteger(locale, Math.round(nonNegative(goal.totalCalories)))} ${translate('common.kcal')}`
      : translate('common.kcal'),
    calorieProgress: widgetProgress(nutrients.calories, goal?.totalCalories ?? 0),
    macros: macros.map(({ key, label, value, target }) => ({
      label: translate(label),
      value: `${formatAppInteger(locale, Math.round(nonNegative(value)))} g`,
      progress: widgetProgress(value, target ?? 0),
      color: palette[key],
    })),
    palette,
    refreshMessage: translate('widgets.refresh'),
    url: NUTRITION_WIDGET_URL,
  };
}

export function expiredWidgetSnapshot(snapshot: NutritionWidgetSnapshot): NutritionWidgetSnapshot {
  return {
    ...snapshot,
    state: 'stale',
    calories: '—',
    calorieTarget: '',
    calorieProgress: 0,
    macros: [],
  };
}
