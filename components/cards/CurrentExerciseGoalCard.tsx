import { Dumbbell, Eye, Pencil, RefreshCw, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUpMenu, BottomPopUpMenuItem } from '@/components/BottomPopUpMenu';
import { MenuButton } from '@/components/theme/MenuButton';
import type ExerciseGoal from '@/database/models/ExerciseGoal';
import { useExerciseGoalProgress } from '@/hooks/useExerciseGoalProgress';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { getWeightUnitI18nKey } from '@/utils/units';

import { GenericCard } from './GenericCard';

interface CurrentExerciseGoalCardProps {
  goal: ExerciseGoal;
  onEdit?: () => void;
  onDelete?: () => void;
  onViewDetails?: () => void;
}

export function CurrentExerciseGoalCard({
  goal,
  onEdit,
  onDelete,
  onViewDetails,
}: CurrentExerciseGoalCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units } = useSettings();
  const { locale, formatRoundedDecimal } = useFormatAppNumber();
  const { projection, sessionsThisWeek, recalculateBaseline, isLoading } = useExerciseGoalProgress(goal);
  const [menuVisible, setMenuVisible] = useState(false);

  const weightUnitKey = getWeightUnitI18nKey(units);

  const handleRecalculate = async () => {
    if (isLoading) {
      return;
    }
    setMenuVisible(false);
    await recalculateBaseline();
  };

  const menuItems: BottomPopUpMenuItem[] = [
    ...(goal.goalType === '1rm'
      ? [
          {
            icon: RefreshCw,
            iconColor: theme.colors.text.primary,
            iconBgColor: theme.colors.text.primary20,
            title: t('exerciseGoals.detail.recalculateBaseline'),
            description: '',
            onPress: handleRecalculate,
          },
        ]
      : []),
    ...(onViewDetails
      ? [
          {
            icon: Eye,
            iconColor: theme.colors.text.primary,
            iconBgColor: theme.colors.text.primary20,
            title: t('exerciseGoals.detail.viewDetails'),
            description: '',
            onPress: onViewDetails,
          },
        ]
      : []),
    ...(onEdit
      ? [
          {
            icon: Pencil,
            iconColor: theme.colors.text.primary,
            iconBgColor: theme.colors.text.primary20,
            title: t('common.edit'),
            description: '',
            onPress: onEdit,
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            icon: Trash2,
            iconColor: theme.colors.status.error,
            iconBgColor: theme.colors.status.error10,
            title: t('exerciseGoals.deleteGoal'),
            description: t('exerciseGoals.deleteGoalMessage'),
            titleColor: theme.colors.status.error,
            onPress: onDelete,
          },
        ]
      : []),
  ];

  const render1RMGoal = () => {
    const targetWeightDisplay = formatDisplayWeightKg(locale, units, goal.targetWeight ?? 0);

    return (
      <View className="p-4">
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View
              className="rounded-lg p-2"
              style={{ backgroundColor: theme.colors.accent.secondary10 }}
            >
              <Dumbbell size={theme.iconSize.md} color={theme.colors.accent.secondary} />
            </View>
            <View>
              <Text className="text-lg font-bold text-text-primary">
                {goal.exerciseNameSnapshot}
              </Text>
              <Text className="text-xs text-text-secondary">
                {t('exerciseGoals.goalTypes.1rm')}
              </Text>
            </View>
          </View>
          <MenuButton onPress={() => setMenuVisible(true)} />
        </View>

        {!projection ? (
          <>
            <View className="mb-4">
              <Text className="text-sm text-text-secondary">
                {t('exerciseGoals.card.target')}: {targetWeightDisplay} {t(weightUnitKey)}
              </Text>
            </View>
            <Text className="text-center text-sm italic text-text-tertiary">
              {t('exerciseGoals.card.noHistory')}
            </Text>
          </>
        ) : (
          <>
            <View className="mb-4">
              <View className="mb-1 flex-row justify-between">
                <Text className="text-sm text-text-secondary">
                  {t('exerciseGoals.card.target')}: {targetWeightDisplay} {t(weightUnitKey)}
                </Text>
                <Text className="text-sm font-bold text-text-primary">
                  {formatRoundedDecimal(projection.progressPercent, 2)}%
                </Text>
              </View>
              <View className="bg-surface-variant h-2 w-full overflow-hidden rounded-full">
                <View
                  className="h-full bg-accent-primary"
                  style={{ width: `${projection.progressPercent}%` }}
                />
              </View>
            </View>

            <View className="mb-4 flex-row justify-between">
              <View>
                <Text className="text-xs text-text-secondary">
                  {t('exerciseGoals.card.currentEstimate')}
                </Text>
                <Text className="text-base font-bold text-text-primary">
                  {formatDisplayWeightKg(locale, units, projection.currentEstimated1RM)}{' '}
                  {t(weightUnitKey)}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-xs text-text-secondary">
                  {t('exerciseGoals.card.deltaSinceStart', {
                    value: formatDisplayWeightKg(
                      locale,
                      units,
                      Math.abs(projection.deltaFromBaseline)
                    ),
                    unit: t(weightUnitKey),
                  })}
                </Text>
              </View>
            </View>

            {projection.status === 'achieved' ? (
              <View className="bg-status-success10 rounded-lg p-3">
                <Text
                  className="text-center font-bold"
                  style={{ color: theme.colors.status.success }}
                >
                  {projection.achievedDate
                    ? t('exerciseGoals.card.achieved', {
                        date: new Date(projection.achievedDate).toLocaleDateString(locale, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        }),
                      })
                    : t('exerciseGoals.card.achieved')}
                </Text>
              </View>
            ) : projection.status === 'ready_to_achieve' ? (
              <View className="bg-accent-primary10 rounded-lg p-3">
                <Text
                  className="text-center text-sm font-medium"
                  style={{ color: theme.colors.accent.primary }}
                >
                  {t('exerciseGoals.card.readyToAchieve')}
                </Text>
              </View>
            ) : projection.status === 'stalling' ? (
              <View className="bg-status-warning10 rounded-lg p-3">
                <Text
                  className="text-center text-sm font-medium"
                  style={{ color: theme.colors.status.warning }}
                >
                  {t('exerciseGoals.card.stalling')}
                </Text>
              </View>
            ) : projection.status === 'declining' ? (
              <View className="bg-status-error10 rounded-lg p-3">
                <Text
                  className="text-center text-sm font-medium"
                  style={{ color: theme.colors.status.error }}
                >
                  {t('exerciseGoals.card.declining')}
                </Text>
              </View>
            ) : projection.status === 'insufficient_data' ? (
              <Text className="text-center text-sm italic text-text-tertiary">
                {t('exerciseGoals.card.insufficientData')}
              </Text>
            ) : projection.status === 'no_history' ? (
              <Text className="text-center text-sm italic text-text-tertiary">
                {t('exerciseGoals.card.noHistory')}
              </Text>
            ) : projection.projectedWeeks && projection.projectedDate ? (
              <Text className="text-sm text-text-secondary">
                {t('exerciseGoals.card.projectedDate', {
                  weeks: Math.ceil(projection.projectedWeeks),
                  date: projection.projectedDate.toLocaleDateString(locale, {
                    month: 'short',
                    year: 'numeric',
                  }),
                })}
              </Text>
            ) : null}
          </>
        )}
      </View>
    );
  };

  const renderConsistencyGoal = () => {
    // Basic implementation for consistency goal
    return (
      <View className="p-4">
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View
              className="rounded-lg p-2"
              style={{ backgroundColor: theme.colors.accent.primary10 }}
            >
              <Dumbbell size={theme.iconSize.md} color={theme.colors.accent.primary} />
            </View>
            <View>
              <Text className="text-lg font-bold text-text-primary">
                {t('exerciseGoals.goalTypes.consistency')}
              </Text>
              <Text className="text-xs text-text-secondary">
                {t('exerciseGoals.card.sessionsThisWeek', {
                  count: sessionsThisWeek,
                  target: goal.targetSessionsPerWeek,
                })}
              </Text>
            </View>
          </View>
          <MenuButton onPress={() => setMenuVisible(true)} />
        </View>

        <Text className="text-sm text-text-secondary">
          Target: {goal.targetSessionsPerWeek} sessions per week
        </Text>
      </View>
    );
  };

  return (
    <View className="mb-4">
      <GenericCard variant="card">
        {goal.goalType === '1rm' ? render1RMGoal() : renderConsistencyGoal()}

        <BottomPopUpMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          title={t('exerciseGoals.title')}
          items={menuItems}
        />
      </GenericCard>
    </View>
  );
}
