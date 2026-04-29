import { format } from 'date-fns';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { CurrentGoalsCard } from '@/components/cards/CurrentGoalsCard';
import { GoalHistoryCard } from '@/components/cards/GoalHistoryCard';
import NutritionGoal from '@/database/models/NutritionGoal';
import { useCurrentNutritionGoal } from '@/hooks/useCurrentNutritionGoal';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useTheme } from '@/hooks/useTheme';
import { convertEatingPhaseToUI, type EatingPhaseUI } from '@/types/EatingPhaseUI';
import { normalizeNutritionGoalTargetWeight } from '@/utils/nutritionGoalHelpers';

interface GoalHistoryItem {
  id: string;
  dateRange: string;
  phase: EatingPhaseUI;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  weight: number | null;
  bodyFat?: number | null;
  isDynamic?: boolean;
}

interface CurrentGoal {
  phase: EatingPhaseUI;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  targetWeight?: number;
  bodyFat?: number | null;
  ffmi?: number | null;
  bmi?: number | null;
  goalDate?: string;
  isDynamic?: boolean;
}

interface NutritionGoalsTabContentProps {
  visible: boolean;
  onEditGoal: (goal: NutritionGoal) => void;
  onDeleteGoal: (goal: NutritionGoal) => void;
  onRegenerateCheckins: (goal: NutritionGoal) => void;
  isRegenerating: boolean;
  refreshRef?: React.MutableRefObject<(() => Promise<void>) | undefined>;
}

export function NutritionGoalsTabContent({
  visible,
  onEditGoal,
  onDeleteGoal,
  onRegenerateCheckins,
  isRegenerating,
  refreshRef,
}: NutritionGoalsTabContentProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const dateFnsLocale = useDateFnsLocale();

  const { goals, current, resolvedMacros, isLoading, refresh } = useCurrentNutritionGoal({
    mode: 'history',
    visible,
  });

  if (refreshRef) {
    refreshRef.current = refresh;
  }

  const currentGoal = useMemo<CurrentGoal | null>(() => {
    if (!current) {
      return null;
    }

    return {
      phase: convertEatingPhaseToUI(current.eatingPhase),
      calories: resolvedMacros?.totalCalories ?? current.totalCalories,
      protein: resolvedMacros?.protein ?? current.protein,
      carbs: resolvedMacros?.carbs ?? current.carbs,
      fat: resolvedMacros?.fats ?? current.fats,
      targetWeight: normalizeNutritionGoalTargetWeight(current.targetWeight) ?? undefined,
      bodyFat: current.targetBodyFat,
      bmi: current.targetBmi,
      ffmi: current.targetFfmi,
      goalDate: current.targetDate
        ? format(new Date(current.targetDate), 'MMM d, yyyy', { locale: dateFnsLocale })
        : undefined,
      isDynamic: current.isDynamic,
    };
  }, [current, resolvedMacros, dateFnsLocale]);

  const historyWithRaw = useMemo(
    () =>
      goals
        .filter((goal) => goal.effectiveUntil !== null)
        .map((goal) => {
          const startDate = new Date(goal.createdAt);
          const endDate = goal.effectiveUntil ? new Date(goal.effectiveUntil) : new Date();
          const dateRange =
            format(startDate, 'MMM d', { locale: dateFnsLocale }) ===
            format(endDate, 'MMM d', { locale: dateFnsLocale })
              ? format(startDate, 'MMM d, yyyy', { locale: dateFnsLocale })
              : `${format(startDate, 'MMM d', { locale: dateFnsLocale })} - ${format(endDate, 'MMM d, yyyy', { locale: dateFnsLocale })}`;

          const display: GoalHistoryItem = {
            id: goal.id,
            dateRange,
            phase: convertEatingPhaseToUI(goal.eatingPhase),
            calories: goal.totalCalories,
            protein: goal.protein,
            carbs: goal.carbs,
            fat: goal.fats,
            weight: normalizeNutritionGoalTargetWeight(goal.targetWeight),
            bodyFat: goal.targetBodyFat,
            isDynamic: goal.isDynamic,
          };

          return { display, raw: goal };
        }),
    [goals, dateFnsLocale]
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <ActivityIndicator size="large" color={theme.colors.accent.primary} />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="flex-1 px-4 pb-32 pt-6">
        {/* Current Goals Section */}
        {currentGoal ? (
          <View className="mb-8">
            <View className="mb-3 flex-row items-center justify-between">
              <Text
                className="font-bold uppercase tracking-widest text-text-secondary"
                style={{ fontSize: theme.typography.fontSize.xs }}
              >
                {t('goalsManagement.currentGoals')}
              </Text>
              <View
                className="rounded-full border px-2"
                style={{
                  backgroundColor: theme.colors.accent.primary10,
                  borderColor: theme.colors.accent.primary20,
                  paddingVertical: theme.spacing.padding.xsHalf,
                }}
              >
                <Text
                  className="font-bold text-accent-primary"
                  style={{ fontSize: theme.typography.fontSize.xs }}
                >
                  {t('goalsManagement.active')}
                </Text>
              </View>
            </View>

            <CurrentGoalsCard
              goal={currentGoal}
              onEdit={current ? () => onEditGoal(current) : undefined}
              onRegenerateCheckins={current ? () => onRegenerateCheckins(current) : undefined}
              onDelete={current ? () => onDeleteGoal(current) : undefined}
              isRegenerating={isRegenerating}
            />
          </View>
        ) : null}

        {/* Goals History Section */}
        {historyWithRaw.length > 0 ? (
          <View className="mb-6">
            <Text
              className="mb-6 font-bold uppercase tracking-widest text-text-secondary"
              style={{ fontSize: theme.typography.fontSize.xs }}
            >
              {t('goalsManagement.history')}
            </Text>

            <View>
              {historyWithRaw.map(({ display, raw }, index) => {
                const isLast = index === historyWithRaw.length - 1;
                return (
                  <GoalHistoryCard
                    key={display.id}
                    goal={display}
                    isLast={isLast}
                    onEdit={() => onEditGoal(raw)}
                    onRegenerateCheckins={() => onRegenerateCheckins(raw)}
                    onDelete={() => onDeleteGoal(raw)}
                    isRegenerating={isRegenerating}
                  />
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Empty state */}
        {!currentGoal && historyWithRaw.length === 0 ? (
          <View className="flex-1 items-center justify-center py-16">
            <Text className="text-center text-text-secondary">{t('goalsManagement.subtitle')}</Text>
            <Text className="mt-2 text-center text-xs text-text-tertiary">
              {t('goalsManagement.emptyStateMessage')}
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
