import type { TFunction } from 'i18next';
import { CalendarRange, Dumbbell } from 'lucide-react-native';

import type { BottomPopUpMenuItem } from '@/components/BottomPopUpMenu';
import type { NutritionLogHistoryDays, WorkoutHistoryDays } from '@/constants/settings';

type MenuStyle = {
  iconColor: string;
  iconBgColor: string;
};

type HistoryMenuParams<TValue extends NutritionLogHistoryDays | WorkoutHistoryDays> = MenuStyle & {
  t: TFunction;
  onSelect: (value: TValue) => void;
};

const HISTORY_DAY_OPTIONS = ['none', '7', '30', '60', '90'] as const;

export function getNutritionLogHistoryLabels(
  t: TFunction
): Record<NutritionLogHistoryDays, string> {
  return {
    none: t('settings.aiSettings.nutritionLogHistoryDaysNone'),
    '7': t('settings.aiSettings.nutritionLogHistoryDays7'),
    '30': t('settings.aiSettings.nutritionLogHistoryDays30'),
    '60': t('settings.aiSettings.nutritionLogHistoryDays60'),
    '90': t('settings.aiSettings.nutritionLogHistoryDays90'),
  };
}

export function getWorkoutHistoryLabels(t: TFunction): Record<WorkoutHistoryDays, string> {
  return {
    none: t('settings.aiSettings.workoutHistoryDaysNone'),
    '7': t('settings.aiSettings.workoutHistoryDays7'),
    '30': t('settings.aiSettings.workoutHistoryDays30'),
    '60': t('settings.aiSettings.workoutHistoryDays60'),
    '90': t('settings.aiSettings.workoutHistoryDays90'),
  };
}

export function buildNutritionLogHistoryMenuItems({
  t,
  iconColor,
  iconBgColor,
  onSelect,
}: HistoryMenuParams<NutritionLogHistoryDays>): BottomPopUpMenuItem[] {
  const labels = getNutritionLogHistoryLabels(t);

  return HISTORY_DAY_OPTIONS.map((option) => ({
    icon: CalendarRange,
    iconColor,
    iconBgColor,
    title: labels[option],
    description:
      option === 'none'
        ? t('settings.aiSettings.nutritionLogHistoryDaysNoneDescription')
        : t('settings.aiSettings.nutritionLogHistoryDaysOptionDescription', { days: option }),
    onPress: () => onSelect(option),
  }));
}

export function buildWorkoutHistoryMenuItems({
  t,
  iconColor,
  iconBgColor,
  onSelect,
}: HistoryMenuParams<WorkoutHistoryDays>): BottomPopUpMenuItem[] {
  const labels = getWorkoutHistoryLabels(t);

  return HISTORY_DAY_OPTIONS.map((option) => ({
    icon: Dumbbell,
    iconColor,
    iconBgColor,
    title: labels[option],
    description:
      option === 'none'
        ? t('settings.aiSettings.workoutHistoryDaysNoneDescription')
        : t('settings.aiSettings.workoutHistoryDaysOptionDescription', { days: option }),
    onPress: () => onSelect(option),
  }));
}
