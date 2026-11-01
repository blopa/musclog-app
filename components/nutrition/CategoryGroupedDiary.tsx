import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { MealSection } from '@/components/MealSection';
import { Chip } from '@/components/theme/Chip';
import { MenuButton } from '@/components/theme/MenuButton';
import type { MealType } from '@/database/models/NutritionLog';
import { useTheme } from '@/hooks/useTheme';

import { type DiaryCardsProps,DiaryFoodCard, DiaryGroupCard } from './DiaryCards';
import { type MacroTotals, MEAL_TYPES, type MealGroup, type ResolvedLogEntry } from './foodTypes';

type CategoryGroupedDiaryProps = DiaryCardsProps & {
  byMealType?: Partial<Record<MealType, Partial<MacroTotals>>>;
  ungroupedByType: Record<MealType, ResolvedLogEntry[]>;
  mealGroupsByType: Record<MealType, MealGroup[]>;
};

/** One section per meal type. */
export function CategoryGroupedDiary({
  byMealType,
  ungroupedByType,
  mealGroupsByType,
  ...cards
}: CategoryGroupedDiaryProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { compact, intuitiveMode, callbacks, selection } = cards;

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
            onAddFood={() => callbacks.onAddFood(type)}
            intuitiveMode={intuitiveMode}
            compact={compact}
            menuButton={
              hasItems && !selection.isSelecting ? (
                <MenuButton
                  onPress={() => callbacks.onMealMenuPress(type)}
                  size="sm"
                  color={theme.colors.text.primary}
                />
              ) : undefined
            }
          >
            {groups.map((group) => (
              <DiaryGroupCard
                key={`${type}:${group.groupId}`}
                {...cards}
                group={group}
                mealType={type}
              />
            ))}
            {foods.map((entry) => (
              <DiaryFoodCard key={entry.log.id} {...cards} entry={entry} mealType={type} />
            ))}
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
                onPress={() => callbacks.onAddFood(type)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}
