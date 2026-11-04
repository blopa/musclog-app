import { FoodItemCard } from '@/components/cards/FoodItemCard';
import { MealGroupCard } from '@/components/cards/MealGroupCard';
import type { MealType } from '@/database/models/NutritionLog';

import { diaryGroupKey, diaryLogKey, type DiarySelectionKey } from './foodDiarySelection';
import type { MealGroup, ResolvedLogEntry } from './foodTypes';

export type MealSectionsCallbacks = {
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
export type MealSectionsSelection = {
  isSelecting: boolean;
  selectedKeys: ReadonlySet<DiarySelectionKey>;
  onLongPress: (key: DiarySelectionKey) => void;
  onToggle: (key: DiarySelectionKey) => void;
};

/** What every diary layout needs to draw a card, whichever way it groups them. */
export type DiaryCardsProps = {
  mealGroupImageUrls: Record<string, string>;
  intuitiveMode?: boolean;
  callbacks: MealSectionsCallbacks;
  selection: MealSectionsSelection;
  /** Dense layout: smaller cards. */
  compact: boolean;
};

export function DiaryGroupCard({
  group,
  mealType,
  timeLabel,
  mealGroupImageUrls,
  intuitiveMode,
  callbacks,
  selection,
  compact,
}: DiaryCardsProps & { group: MealGroup; mealType: MealType; timeLabel?: string }) {
  const key = diaryGroupKey(mealType, group.groupId);

  return (
    <MealGroupCard
      name={group.mealName}
      calories={group.totalNutrients.calories}
      protein={group.totalNutrients.protein}
      carbs={group.totalNutrients.carbs}
      fat={group.totalNutrients.fat}
      mealType={mealType}
      imageUrl={
        mealGroupImageUrls[group.groupId] ??
        group.entries.find((entry) => entry?.food?.imageUrl)?.food?.imageUrl ??
        undefined
      }
      onPress={() =>
        selection.isSelecting ? selection.onToggle(key) : callbacks.onMealGroupCardPress(group)
      }
      onMorePress={() => callbacks.onMealGroupMenuPress(group)}
      onLongPress={() => selection.onLongPress(key)}
      selectionMode={selection.isSelecting}
      selected={selection.selectedKeys.has(key)}
      intuitiveMode={intuitiveMode}
      variant={compact ? 'compact' : 'default'}
      timeLabel={timeLabel}
    />
  );
}

export function DiaryFoodCard({
  entry,
  mealType,
  timeLabel,
  intuitiveMode,
  callbacks,
  selection,
  compact,
}: Omit<DiaryCardsProps, 'mealGroupImageUrls'> & {
  entry: ResolvedLogEntry;
  mealType: MealType;
  timeLabel?: string;
}) {
  const key = diaryLogKey(entry.log.id);

  return (
    <FoodItemCard
      name={entry.displayName}
      portion={entry.gramWeight}
      calories={entry.nutrients.calories}
      protein={entry.nutrients.protein}
      carbs={entry.nutrients.carbs}
      fat={entry.nutrients.fat}
      image={entry.food?.imageUrl ? { uri: entry.food.imageUrl } : undefined}
      mealType={mealType}
      onPress={() =>
        selection.isSelecting ? selection.onToggle(key) : callbacks.onFoodCardPress(entry)
      }
      onMorePress={() => callbacks.onFoodMenuPress(entry)}
      onLongPress={() => selection.onLongPress(key)}
      selectionMode={selection.isSelecting}
      selected={selection.selectedKeys.has(key)}
      intuitiveMode={intuitiveMode}
      variant={compact ? 'compact' : 'default'}
      timeLabel={timeLabel}
    />
  );
}
