import { Plus } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { MealSectionHeader } from '@/components/MealSection';
import { Chip } from '@/components/theme/Chip';
import DashedButton from '@/components/theme/DashedButton';
import type { MealType } from '@/database/models/NutritionLog';
import { useTheme } from '@/hooks/useTheme';

import { type DiaryCardsProps,DiaryFoodCard, DiaryGroupCard } from './DiaryCards';
import {
  buildTimeSections,
  formatHourLabel,
  formatItemTime,
  inferMealTypeFromHour,
} from './foodDiaryLayout';
import type { MealGroup, ResolvedLogEntry } from './foodTypes';

type TimeGroupedDiaryProps = DiaryCardsProps & {
  ungroupedByType: Record<MealType, ResolvedLogEntry[]>;
  mealGroupsByType: Record<MealType, MealGroup[]>;
  /** BCP-47 tag used to format hours and times. */
  localeTag: string;
};

/** Hourly sections in the order food was eaten; entries keep their meal category. */
export function TimeGroupedDiary({
  ungroupedByType,
  mealGroupsByType,
  localeTag,
  ...cards
}: TimeGroupedDiaryProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { compact, intuitiveMode, callbacks } = cards;

  const sections = useMemo(
    () => buildTimeSections(ungroupedByType, mealGroupsByType),
    [ungroupedByType, mealGroupsByType]
  );
  const addFood = () => callbacks.onAddFood(inferMealTypeFromHour(new Date().getHours()));

  return (
    <>
      {sections.map((section) => (
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
          <View className={compact ? 'gap-2' : 'gap-3'}>
            {section.items.map((item) => {
              const timeLabel = formatItemTime(item, localeTag);

              return item.kind === 'group' ? (
                <DiaryGroupCard
                  key={`${item.mealType}:${item.group.groupId}`}
                  {...cards}
                  group={item.group}
                  mealType={item.mealType}
                  timeLabel={timeLabel}
                />
              ) : (
                <DiaryFoodCard
                  key={item.entry.log.id}
                  {...cards}
                  entry={item.entry}
                  mealType={item.mealType}
                  timeLabel={timeLabel}
                />
              );
            })}
          </View>
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
