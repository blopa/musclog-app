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
};

export type NutritionWidgetSnapshot = {
  dateKey: string;
  dateLabel: string;
  totals: { calories: number; protein: number; carbs: number; fat: number };
  /** Whether a goal exists. Never a nullable object: a JS null reaches UserDefaults as NSNull, which it rejects. */
  hasGoal: boolean;
  calories: string;
  calorieTarget: string;
  calorieProgress: number;
  macros: { label: string; value: string; progress: number; color: string }[];
  palette: WidgetPalette;
  message: string;
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
  };
}

export const INITIAL_WIDGET_PALETTE = widgetPalette(themeColorsById[DEFAULT_THEME_BY_MODE.dark]);
export const NUTRITION_WIDGET_URL = 'com.werules.logger://?action=open-nutrition';
export const CAMERA_WIDGET_URL = 'com.werules.logger://?action=open-camera';
export const INITIAL_NUTRITION_SNAPSHOT: NutritionWidgetSnapshot = {
  dateKey: '',
  dateLabel: 'Musclog',
  totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  hasGoal: false,
  calories: '—',
  calorieTarget: '',
  calorieProgress: 0,
  macros: [],
  palette: INITIAL_WIDGET_PALETTE,
  message: 'Open Musclog to refresh',
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
    dateKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    dateLabel: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date),
    totals: {
      calories: nonNegative(nutrients.calories),
      protein: nonNegative(nutrients.protein),
      carbs: nonNegative(carbs),
      fat: nonNegative(nutrients.fat),
    },
    hasGoal: goal != null,
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
    message: '',
    refreshMessage: translate('widgets.refresh'),
    url: NUTRITION_WIDGET_URL,
  };
}

export function expiredWidgetSnapshot(snapshot: NutritionWidgetSnapshot): NutritionWidgetSnapshot {
  return {
    ...snapshot,
    calories: '—',
    calorieTarget: '',
    calorieProgress: 0,
    macros: [],
    message: snapshot.refreshMessage,
  };
}
