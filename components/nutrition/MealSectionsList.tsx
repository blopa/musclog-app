import { useTranslation } from 'react-i18next';

import { FoodItemCard } from '@/components/cards/FoodItemCard';
import { MealGroupCard } from '@/components/cards/MealGroupCard';
import { MealSection } from '@/components/MealSection';
import { MenuButton } from '@/components/theme/MenuButton';
import type { MealType } from '@/database/models/NutritionLog';
import { useTheme } from '@/hooks/useTheme';

import type { MacroTotals, MealGroup, ResolvedLogEntry } from './foodTypes';

/** Meal types in display order. `snack` uses the plural `snacks` translation key. */
const MEAL_TYPES: { type: MealType; titleKey: string }[] = [
  { type: 'breakfast', titleKey: 'food.meals.breakfast' },
  { type: 'lunch', titleKey: 'food.meals.lunch' },
  { type: 'dinner', titleKey: 'food.meals.dinner' },
  { type: 'snack', titleKey: 'food.meals.snacks' },
  { type: 'other', titleKey: 'food.meals.other' },
];

type MealSectionsListProps = {
  byMealType?: Partial<Record<MealType, Partial<MacroTotals>>>;
  ungroupedByType: Record<MealType, ResolvedLogEntry[]>;
  mealGroupsByType: Record<MealType, MealGroup[]>;
  mealGroupImageUrls: Record<string, string>;
  intuitiveMode?: boolean;
  onAddFood: (mealType: MealType) => void;
  onMealMenuPress: (mealType: MealType) => void;
  onFoodCardPress: (entry: ResolvedLogEntry) => void;
  onFoodMenuPress: (entry: ResolvedLogEntry) => void;
  onMealGroupCardPress: (group: MealGroup) => void;
  onMealGroupMenuPress: (group: MealGroup) => void;
};

export function MealSectionsList({
  byMealType,
  ungroupedByType,
  mealGroupsByType,
  mealGroupImageUrls,
  intuitiveMode,
  onAddFood,
  onMealMenuPress,
  onFoodCardPress,
  onFoodMenuPress,
  onMealGroupCardPress,
  onMealGroupMenuPress,
}: MealSectionsListProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <>
      {MEAL_TYPES.map(({ type, titleKey }) => {
        const groups = mealGroupsByType[type];
        const foods = ungroupedByType[type];
        const totals = byMealType?.[type];
        const hasItems = groups.length > 0 || foods.length > 0;

        return (
          <MealSection
            key={type}
            title={t(titleKey)}
            totalCalories={totals?.calories || 0}
            totalProtein={totals?.protein || 0}
            totalCarbs={totals?.carbs || 0}
            totalFat={totals?.fat || 0}
            onAddFood={() => onAddFood(type)}
            intuitiveMode={intuitiveMode}
            menuButton={
              hasItems ? (
                <MenuButton
                  onPress={() => onMealMenuPress(type)}
                  size="sm"
                  color={theme.colors.text.primary}
                />
              ) : undefined
            }
          >
            {groups.map((group) => (
              <MealGroupCard
                key={group.groupId}
                name={group.mealName}
                calories={group.totalNutrients.calories}
                protein={group.totalNutrients.protein}
                carbs={group.totalNutrients.carbs}
                fat={group.totalNutrients.fat}
                mealType={type}
                imageUrl={
                  mealGroupImageUrls[group.groupId] ??
                  group.entries.find((entry) => entry?.food?.imageUrl)?.food?.imageUrl ??
                  undefined
                }
                onPress={() => onMealGroupCardPress(group)}
                onMorePress={() => onMealGroupMenuPress(group)}
                intuitiveMode={intuitiveMode}
              />
            ))}
            {foods.map((entry) => (
              <FoodItemCard
                key={entry.log.id}
                name={entry.displayName}
                portion={entry.gramWeight}
                calories={entry.nutrients.calories}
                protein={entry.nutrients.protein}
                carbs={entry.nutrients.carbs}
                fat={entry.nutrients.fat}
                image={entry.food?.imageUrl ? { uri: entry.food.imageUrl } : undefined}
                mealType={type}
                onPress={() => onFoodCardPress(entry)}
                onMorePress={() => onFoodMenuPress(entry)}
                intuitiveMode={intuitiveMode}
              />
            ))}
          </MealSection>
        );
      })}
    </>
  );
}
