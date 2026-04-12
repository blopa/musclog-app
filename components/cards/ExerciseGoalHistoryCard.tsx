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
          className="absolute left-[19px] top-10"
          style={{
            bottom: -24,
            width: 0.5,
            backgroundColor: theme.colors.accent.secondary,
          }}
        />
      ) : null}

      <View
        className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-bg-card"
        style={{ borderColor: theme.colors.accent.secondary }}
      >
        <History size={theme.iconSize.lg} color={theme.colors.text.secondary} />
      </View>

      <View className="flex-1 pb-2">
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-text-secondary">{dateRange}</Text>
          <View className="rounded-full bg-surface-variant px-2 py-0.5">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              {t(`exerciseGoals.goalTypes.${goal.goalType}`)}
            </Text>
          </View>
        </View>

        <GenericCard variant="card">
          <View className="p-3">
            <Text className="text-base font-bold text-text-primary">
              {goal.exerciseNameSnapshot || t('exerciseGoals.goalTypes.consistency')}
            </Text>
            {goal.goalType === '1rm' ? (
              <Text className="text-sm text-text-secondary">
                {t('exerciseGoals.card.target')}: {targetWeightDisplay} {t(weightUnitKey)}
              </Text>
            ) : (
              <Text className="text-sm text-text-secondary">
                {goal.targetSessionsPerWeek} sessions per week
              </Text>
            )}
          </View>
        </GenericCard>
      </View>
    </View>
  );
}
