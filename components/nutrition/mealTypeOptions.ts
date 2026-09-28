import type { TFunction } from 'i18next';
import { Apple, Coffee, Moon, MoreHorizontal, Utensils } from 'lucide-react-native';

import type { SelectorOption } from '@/components/OptionsSelector';
import type { MealType } from '@/database/models';
import type { Theme } from '@/theme';

/**
 * The meal-type choices offered by every screen that asks "which meal is this?".
 *
 * Single definition on purpose: this list previously existed twice (`CreateMealModal` and
 * `MealEstimationScreen`) and the copies had already drifted on icons, palette tokens and
 * even the snack translation key.
 */
export const getMealTypeOptions = (theme: Theme, t: TFunction): SelectorOption<MealType>[] => [
  {
    id: 'breakfast',
    label: t('food.meals.breakfast'),
    description: t('food.meals.descriptions.breakfast'),
    icon: Coffee,
    iconBgColor: theme.colors.status.warning10,
    iconColor: theme.colors.status.warning,
  },
  {
    id: 'lunch',
    label: t('food.meals.lunch'),
    description: t('food.meals.descriptions.lunch'),
    icon: Utensils,
    iconBgColor: theme.colors.status.info10,
    iconColor: theme.colors.status.info,
  },
  {
    id: 'dinner',
    label: t('food.meals.dinner'),
    description: t('food.meals.descriptions.dinner'),
    icon: Moon,
    iconBgColor: theme.colors.status.purple10,
    iconColor: theme.colors.status.purple,
  },
  {
    id: 'snack',
    label: t('food.meals.snacks'),
    description: t('food.meals.descriptions.snack'),
    icon: Apple,
    iconBgColor: theme.colors.status.success20,
    iconColor: theme.colors.status.success,
  },
  {
    id: 'other',
    label: t('food.meals.other'),
    description: t('food.meals.descriptions.other'),
    icon: MoreHorizontal,
    iconBgColor: theme.colors.status.neutralWash,
    iconColor: theme.colors.text.secondary,
  },
];
