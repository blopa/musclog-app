import { Plus } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { FoodItemCard } from '@/components/cards/FoodItemCard';
import { MealGroupCard } from '@/components/cards/MealGroupCard';
import { MealSection, MealSectionHeader } from '@/components/MealSection';
import { Chip } from '@/components/theme/Chip';
import DashedButton from '@/components/theme/DashedButton';
import { MenuButton } from '@/components/theme/MenuButton';
import type { FoodDiaryGrouping } from '@/constants/settings';
import type { MealType } from '@/database/models/NutritionLog';
import { useTheme } from '@/hooks/useTheme';

import {
  buildTimeSections,
  type DiaryItem,
  formatHourLabel,
  formatItemTime,
  inferMealTypeFromHour,
} from './foodDiaryLayout';
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
  /** Dense layout: empty meals are hidden and entries are smaller. Default off. */
  compact?: boolean;
  /** `categories` = one section per meal type (default); `time` = hourly sections. */
  grouping?: FoodDiaryGrouping;
  /** BCP-47 tag used to format hours and times. */
  localeTag?: string;
};

export function MealSectionsList({
  byMealType,
  ungroupedByType,
  mealGroupsByType,
  mealGroupImageUrls,
  intuitiveMode,
  callbacks,
  selection,
  compact = false,
  grouping = 'categories',
  localeTag = 'en-US',
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

  const timeSections = useMemo(
    () => (grouping === 'time' ? buildTimeSections(ungroupedByType, mealGroupsByType) : []),
    [grouping, ungroupedByType, mealGroupsByType]
  );

  const renderGroupCard = (group: MealGroup, type: MealType, timeLabel?: string) => {
    const key = diaryGroupKey(type, group.groupId);

    return (
      <MealGroupCard
        key={key}
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
        variant={compact ? 'compact' : 'default'}
        timeLabel={timeLabel}
      />
    );
  };

  const renderFoodCard = (entry: ResolvedLogEntry, type: MealType, timeLabel?: string) => {
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
        variant={compact ? 'compact' : 'default'}
        timeLabel={timeLabel}
      />
    );
  };

  const renderItem = (item: DiaryItem) => {
    const timeLabel = formatItemTime(item, localeTag);

    return item.kind === 'group'
      ? renderGroupCard(item.group, item.mealType, timeLabel)
      : renderFoodCard(item.entry, item.mealType, timeLabel);
  };

  if (grouping === 'time') {
    const addFood = () => onAddFood(inferMealTypeFromHour(new Date().getHours()));

    return (
      <>
        {timeSections.map((section) => (
          <View key={section.key}>
            <MealSectionHeader
              title={
                section.hour === null
                  ? t('food.diary.noTime')
                  : formatHourLabel(section.hour, localeTag)
              }
              totalCalories={section.totals.calories}
              totalProtein={section.totals.protein}
              totalCarbs={section.totals.carbs}
              totalFat={section.totals.fat}
              intuitiveMode={intuitiveMode}
              compact={compact}
            />
            <View className={compact ? 'gap-2' : 'gap-3'}>{section.items.map(renderItem)}</View>
          </View>
        ))}
        <View className={compact ? 'mt-3 flex-row' : 'mt-5'}>
          {compact ? (
            <Chip
              label={t('food.meals.addFood')}
              icon={Plus}
              variant="solid"
              role="button"
              onPress={addFood}
            />
          ) : (
            <DashedButton
              label={t('food.meals.addFood')}
              onPress={addFood}
              size="sm"
              icon={<Plus size={theme.iconSize.md} color={theme.colors.text.secondary} />}
            />
          )}
        </View>
      </>
    );
  }

  return (
    <>
      {MEAL_TYPES.map(({ type, titleKey }) => {
        const groups = mealGroupsByType[type];
        const foods = ungroupedByType[type];
        const totals = byMealType?.[type];
        const hasItems = groups.length > 0 || foods.length > 0;

        // Compact hides empty meals; the add row below keeps every category reachable.
        if (compact && !hasItems) {
          return null;
        }

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
            compact={compact}
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
            {groups.map((group) => renderGroupCard(group, type))}
            {foods.map((entry) => renderFoodCard(entry, type))}
          </MealSection>
        );
      })}
      {compact ? (
        <View className="mt-4 gap-2">
          <Text className="px-1 text-sm text-text-secondary">{t('food.diary.addFoodTo')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {MEAL_TYPES.map(({ type, titleKey }) => (
              <Chip
                key={type}
                label={t(titleKey)}
                icon={Plus}
                variant="solid"
                role="button"
                onPress={() => onAddFood(type)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}
