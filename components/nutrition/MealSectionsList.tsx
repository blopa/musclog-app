import { useTranslation } from 'react-i18next';

import { FoodItemCard } from '@/components/cards/FoodItemCard';
import { MealGroupCard } from '@/components/cards/MealGroupCard';
import { MealSection } from '@/components/MealSection';
import { MenuButton } from '@/components/theme/MenuButton';
import type { MealType } from '@/database/models/NutritionLog';
import { useTheme } from '@/hooks/useTheme';

import { diaryGroupKey, diaryLogKey, type DiarySelectionKey } from './foodDiarySelection';
import { type MacroTotals, MEAL_TYPES, type MealGroup, type ResolvedLogEntry } from './foodTypes';

type MealSectionsCallbacks = {
  onAddFood: (mealType: MealType) => void;
  onMealMenuPress: (mealType: MealType) => void;
  onFoodCardPress: (entry: ResolvedLogEntry) => void;
  onFoodMenuPress: (entry: ResolvedLogEntry) => void;
  onMealGroupCardPress: (group: MealGroup) => void;
  onMealGroupMenuPress: (group: MealGroup) => void;
};

/**
 * Long-press selection. While it runs, a tap on a card toggles it instead of opening it, and
 * the per-card and per-section menus give way: the selection's own actions apply instead.
 */
type MealSectionsSelection = {
  isSelecting: boolean;
  selectedKeys: ReadonlySet<DiarySelectionKey>;
  onLongPress: (key: DiarySelectionKey) => void;
  onToggle: (key: DiarySelectionKey) => void;
};

type MealSectionsListProps = {
  byMealType?: Partial<Record<MealType, Partial<MacroTotals>>>;
  ungroupedByType: Record<MealType, ResolvedLogEntry[]>;
  mealGroupsByType: Record<MealType, MealGroup[]>;
  mealGroupImageUrls: Record<string, string>;
  intuitiveMode?: boolean;
  callbacks: MealSectionsCallbacks;
  selection: MealSectionsSelection;
};

export function MealSectionsList({
  byMealType,
  ungroupedByType,
  mealGroupsByType,
  mealGroupImageUrls,
  intuitiveMode,
  callbacks,
  selection,
}: MealSectionsListProps) {
  const {
    onAddFood,
    onMealMenuPress,
    onFoodCardPress,
    onFoodMenuPress,
    onMealGroupCardPress,
    onMealGroupMenuPress,
  } = callbacks;
  const { isSelecting, selectedKeys, onLongPress, onToggle } = selection;
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
              hasItems && !isSelecting ? (
                <MenuButton
                  onPress={() => onMealMenuPress(type)}
                  size="sm"
                  color={theme.colors.text.primary}
                />
              ) : undefined
            }
          >
            {groups.map((group) => {
              const key = diaryGroupKey(type, group.groupId);

              return (
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
                  onPress={() => (isSelecting ? onToggle(key) : onMealGroupCardPress(group))}
                  onMorePress={() => onMealGroupMenuPress(group)}
                  onLongPress={() => onLongPress(key)}
                  selectionMode={isSelecting}
                  selected={selectedKeys.has(key)}
                  intuitiveMode={intuitiveMode}
                />
              );
            })}
            {foods.map((entry) => {
              const key = diaryLogKey(entry.log.id);

              return (
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
                  onPress={() => (isSelecting ? onToggle(key) : onFoodCardPress(entry))}
                  onMorePress={() => onFoodMenuPress(entry)}
                  onLongPress={() => onLongPress(key)}
                  selectionMode={isSelecting}
                  selected={selectedKeys.has(key)}
                  intuitiveMode={intuitiveMode}
                />
              );
            })}
          </MealSection>
        );
      })}
    </>
  );
}
