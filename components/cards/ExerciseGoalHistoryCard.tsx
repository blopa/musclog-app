import { History } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type ExerciseGoal from '@/database/models/ExerciseGoal';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { getWeightUnitI18nKey } from '@/utils/units';

import { GenericCard } from './GenericCard';

interface ExerciseGoalHistoryCardProps {
  goal: ExerciseGoal;
  isLast?: boolean;
}

export function ExerciseGoalHistoryCard({ goal, isLast = false }: ExerciseGoalHistoryCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { locale } = useFormatAppNumber();
  const { units } = useSettings();

  const weightUnitKey = getWeightUnitI18nKey(units);
  const targetWeightDisplay = formatDisplayWeightKg(locale, units, goal.targetWeight ?? 0);

  const dateRange = `${goal.createdAt.toLocaleDateString(locale, {
    month: 'short',
    year: 'numeric',
  })} - ${
    goal.effectiveUntil
      ? new Date(goal.effectiveUntil).toLocaleDateString(locale, {
          month: 'short',
          year: 'numeric',
        })
      : ''
  }`;

  return (
    <View className="relative mb-6 flex-row gap-4">
      {!isLast ? (
        <View
          className="absolute top-10 left-[19px]"
          style={{
            bottom: -24,
            width: 0.5,
            backgroundColor: theme.colors.accent.secondary,
          }}
        />
      ) : null}

      <View
        className="bg-bg-card relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
        style={{ borderColor: theme.colors.accent.secondary }}
      >
        <History size={theme.iconSize.lg} color={theme.colors.text.secondary} />
      </View>

      <View className="flex-1 pb-2">
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="text-text-secondary text-xs font-semibold">{dateRange}</Text>
          <View className="bg-surface-variant rounded-full px-2 py-0.5">
            <Text className="text-text-secondary text-[10px] font-bold tracking-wider uppercase">
              {t(`exerciseGoals.goalTypes.${goal.goalType}`)}
            </Text>
          </View>
        </View>

        <GenericCard variant="card">
          <View className="p-3">
            <Text className="text-text-primary text-base font-bold">
              {goal.exerciseNameSnapshot || t('exerciseGoals.goalTypes.consistency')}
            </Text>
            {goal.goalType === '1rm' ? (
              <Text className="text-text-secondary text-sm">
                {t('exerciseGoals.card.target')}: {targetWeightDisplay} {t(weightUnitKey)}
              </Text>
            ) : (
              <Text className="text-text-secondary text-sm">
                {goal.targetSessionsPerWeek} sessions per week
              </Text>
            )}
          </View>
        </GenericCard>
      </View>
    </View>
  );
}
