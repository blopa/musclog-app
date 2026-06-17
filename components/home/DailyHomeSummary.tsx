import { useMemo } from 'react';

import { DailySummaryCard } from '@/components/cards/DailySummaryCard/DailySummaryCard';
import { DailySummaryEmptyState } from '@/components/cards/DailySummaryCard/DailySummaryEmptyState';
import { AnimatedContent } from '@/components/theme/AnimatedContent';
import { MenuButton } from '@/components/theme/MenuButton';
import { SkeletonLoader } from '@/components/theme/SkeletonLoader';
import { useDailyNutritionSummary } from '@/hooks/useDailyNutritionSummary';
import { useNutritionLogs } from '@/hooks/useNutritionLogs';
import { useTheme } from '@/hooks/useTheme';

type DailyHomeSummaryProps = {
  date: Date;
  intuitiveEatingMode: boolean;
  nutritionDisplay: string;
  onOpenMenu: () => void;
  onSetGoals: () => void;
};

export function DailyHomeSummary({
  date,
  intuitiveEatingMode,
  nutritionDisplay,
  onOpenMenu,
  onSetGoals,
}: DailyHomeSummaryProps) {
  const theme = useTheme();
  const {
    calories: dailyCalories,
    macros: dailyMacros,
    secondaryNutrients: dailySecondaryNutrients,
    nutritionGoal,
    isLoading: isLoadingNutritionSummary,
  } = useDailyNutritionSummary({ date });

  const weeklyRange = useMemo(() => {
    const end = new Date(date);
    end.setDate(end.getDate() - 1);
    const start = new Date(date);
    start.setDate(start.getDate() - 7);
    return { start, end };
  }, [date]);

  const { rangeNutrients: weeklyNutrients } = useNutritionLogs({
    mode: 'range',
    startDate: weeklyRange.start,
    endDate: weeklyRange.end,
    visible: nutritionGoal != null,
  });

  if (isLoadingNutritionSummary) {
    return <SkeletonLoader width="100%" height={180} borderRadius={16} />;
  }

  if (!nutritionGoal) {
    return (
      <AnimatedContent>
        <DailySummaryEmptyState onSetGoals={onSetGoals} />
      </AnimatedContent>
    );
  }

  return (
    <AnimatedContent>
      <DailySummaryCard
        calories={{
          consumed: dailyCalories.consumed,
          remaining: dailyCalories.remaining,
          goal: dailyCalories.goal,
        }}
        macros={{
          protein: {
            value: dailyMacros.protein.value,
            goal: dailyMacros.protein.goal,
          },
          carbs: {
            value: dailyMacros.carbs.value,
            goal: dailyMacros.carbs.goal,
          },
          fats: {
            value: dailyMacros.fat.value,
            goal: dailyMacros.fat.goal,
          },
          fiber: {
            value: dailyMacros.fiber.value,
            goal: dailyMacros.fiber.goal,
          },
        }}
        secondaryNutrients={dailySecondaryNutrients}
        intuitiveMode={intuitiveEatingMode}
        nutritionDisplay={nutritionDisplay}
        weeklyAverages={
          weeklyNutrients?.dailyAverages
            ? {
                calories: weeklyNutrients.dailyAverages.calories,
                protein: weeklyNutrients.dailyAverages.protein,
                carbs: weeklyNutrients.dailyAverages.carbs,
                fats: weeklyNutrients.dailyAverages.fat,
                fiber: weeklyNutrients.dailyAverages.fiber,
              }
            : undefined
        }
        menuButton={<MenuButton onPress={onOpenMenu} size="sm" color={theme.colors.text.primary} />}
      />
    </AnimatedContent>
  );
}
