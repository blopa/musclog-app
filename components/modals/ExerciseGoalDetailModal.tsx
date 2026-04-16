import { Trash2 } from 'lucide-react-native';
import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { LineChart, type LineChartDataPoint } from '@/components/charts/LineChart';
import { Button } from '@/components/theme/Button';
import type ExerciseGoal from '@/database/models/ExerciseGoal';
import { useExerciseGoalProgress } from '@/hooks/useExerciseGoalProgress';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { getXAxisLabels, type XAxisLabel } from '@/utils/chartUtils';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { getWeightUnitI18nKey } from '@/utils/units';

import { FullScreenModal } from './FullScreenModal';

interface ExerciseGoalDetailModalProps {
  visible: boolean;
  goal: ExerciseGoal | null;
  onClose: () => void;
  onDelete?: () => void;
  children?: ReactNode;
}

export function ExerciseGoalDetailModal({
  visible,
  goal,
  onClose,
  onDelete,
  children,
}: ExerciseGoalDetailModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { units } = useSettings();
  const { locale, formatRoundedDecimal } = useFormatAppNumber();
  const weightUnitKey = getWeightUnitI18nKey(units);
  const { projection, dataPoints, sessionsThisWeek } = useExerciseGoalProgress(
    goal ?? ({} as ExerciseGoal)
  );

  const chartData = useMemo<LineChartDataPoint[]>(() => {
    if (!dataPoints || dataPoints.length === 0) {
      return [];
    }
    return dataPoints.map((dp) => ({
      x: dp.date,
      y: dp.estimated1RM,
    }));
  }, [dataPoints]);

  const xAxisLabels = useMemo<XAxisLabel[]>(() => {
    return getXAxisLabels(chartData, (x) =>
      new Date(x).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
    );
  }, [chartData, locale]);

  const yDomain = useMemo<[number, number]>(() => {
    if (chartData.length === 0) {
      return [0, 100];
    }
    const values = chartData.map((d) => d.y);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.15 || max * 0.1 || 10;
    return [Math.max(0, min - padding), max + padding];
  }, [chartData]);

  const xDomain = useMemo<[number, number]>(() => {
    if (chartData.length === 0) {
      return [0, 1];
    }
    const first = chartData[0].x;
    const last = chartData[chartData.length - 1].x;
    if (first === last) {
      return [first - 86400000, last + 86400000];
    }
    return [first, last];
  }, [chartData]);

  const targetWeightDisplay =
    goal?.targetWeight != null ? formatDisplayWeightKg(locale, units, goal.targetWeight) : '-';

  const baselineDisplay =
    projection?.currentEstimated1RM != null && projection?.deltaFromBaseline != null
      ? formatDisplayWeightKg(
          locale,
          units,
          projection.currentEstimated1RM - projection.deltaFromBaseline
        )
      : '-';

  if (!goal) {
    return null;
  }

  const render1RMContent = () => {
    return (
      <View className="gap-5">
        {/* Stats Grid */}
        <GenericCard variant="card">
          <View className="p-4">
            <View className="mb-4 flex-row flex-wrap gap-3">
              <View
                className="min-w-[45%] flex-1 rounded-xl p-3"
                style={{ backgroundColor: theme.colors.background.white5 }}
              >
                <Text className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                  {t('exerciseGoals.card.target')}
                </Text>
                <Text className="mt-1 text-lg font-bold text-text-primary">
                  {targetWeightDisplay} {t(weightUnitKey)}
                </Text>
              </View>

              <View
                className="min-w-[45%] flex-1 rounded-xl p-3"
                style={{ backgroundColor: theme.colors.background.white5 }}
              >
                <Text className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                  {t('exerciseGoals.card.currentEstimate')}
                </Text>
                <Text className="mt-1 text-lg font-bold text-text-primary">
                  {projection
                    ? `${formatDisplayWeightKg(locale, units, projection.currentEstimated1RM)} ${t(weightUnitKey)}`
                    : `— ${t(weightUnitKey)}`}
                </Text>
              </View>

              <View
                className="min-w-[45%] flex-1 rounded-xl p-3"
                style={{ backgroundColor: theme.colors.background.white5 }}
              >
                <Text className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                  {t('exerciseGoals.detail.progress')}
                </Text>
                <Text className="mt-1 text-lg font-bold text-accent-primary">
                  {projection ? `${formatRoundedDecimal(projection.progressPercent, 2)}%` : '—'}
                </Text>
              </View>

              <View
                className="min-w-[45%] flex-1 rounded-xl p-3"
                style={{ backgroundColor: theme.colors.background.white5 }}
              >
                <Text className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                  {t('exerciseGoals.detail.baseline')}
                </Text>
                <Text className="mt-1 text-lg font-bold text-text-primary">
                  {baselineDisplay} {t(weightUnitKey)}
                </Text>
              </View>
            </View>

            {/* Progress bar */}
            <View className="mb-1 flex-row justify-between">
              <Text className="text-xs text-text-secondary">
                {t('exerciseGoals.detail.achievement')}
              </Text>
              <Text className="text-xs font-bold text-text-primary">
                {projection ? `${formatRoundedDecimal(projection.progressPercent, 2)}%` : '—'}
              </Text>
            </View>
            <View className="bg-surface-variant h-2.5 w-full overflow-hidden rounded-full">
              <View
                className="h-full bg-accent-primary"
                style={{
                  width: `${projection ? Math.min(100, Math.max(0, projection.progressPercent)) : 0}%`,
                }}
              />
            </View>
          </View>
        </GenericCard>

        {/* Chart */}
        {chartData.length > 0 ? (
          <GenericCard variant="card">
            <View className="p-4">
              <Text className="mb-4 text-sm font-bold text-text-primary">
                {t('exerciseGoals.detail.progressChart')}
              </Text>
              <LineChart
                data={chartData}
                height={200}
                chartWidth={xDomain[1] - xDomain[0]}
                chartHeight={150}
                xDomain={xDomain}
                yDomain={yDomain}
                xAxisLabels={xAxisLabels}
                lineColor={theme.colors.accent.primary}
                areaColor={theme.colors.accent.primary30}
                marginTop={8}
                marginBottom={8}
                tooltipFormatter={(point) =>
                  `${formatDisplayWeightKg(locale, units, point.y)} ${t(weightUnitKey)}`
                }
                yAxisLabels={
                  goal.targetWeight != null
                    ? [
                        {
                          label: `${t('exerciseGoals.card.target')} ${formatDisplayWeightKg(locale, units, goal.targetWeight)}`,
                          yDomainValue: goal.targetWeight,
                        },
                      ]
                    : undefined
                }
              />
            </View>
          </GenericCard>
        ) : null}

        {/* Status message */}
        {projection?.status === 'achieved' ? (
          <View className="bg-status-success10 rounded-xl p-4">
            <Text className="text-center font-bold" style={{ color: theme.colors.status.success }}>
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
        ) : projection?.status === 'ready_to_achieve' ? (
          <View className="bg-accent-primary10 rounded-xl p-4">
            <Text
              className="text-center text-sm font-medium"
              style={{ color: theme.colors.accent.primary }}
            >
              {t('exerciseGoals.card.readyToAchieve')}
            </Text>
          </View>
        ) : projection?.status === 'stalling' ? (
          <View className="bg-status-warning10 rounded-xl p-4">
            <Text
              className="text-center text-sm font-medium"
              style={{ color: theme.colors.status.warning }}
            >
              {t('exerciseGoals.card.stalling')}
            </Text>
          </View>
        ) : projection?.status === 'declining' ? (
          <View className="bg-status-error10 rounded-xl p-4">
            <Text
              className="text-center text-sm font-medium"
              style={{ color: theme.colors.status.error }}
            >
              {t('exerciseGoals.card.declining')}
            </Text>
          </View>
        ) : projection?.status === 'insufficient_data' ? (
          <Text className="text-center text-sm italic text-text-tertiary">
            {t('exerciseGoals.card.insufficientData')}
          </Text>
        ) : projection?.status === 'no_history' ? (
          <Text className="text-center text-sm italic text-text-tertiary">
            {t('exerciseGoals.card.noHistory')}
          </Text>
        ) : projection?.projectedWeeks && projection?.projectedDate ? (
          <View className="bg-accent-primary10 rounded-xl p-4">
            <Text className="text-sm font-bold text-accent-primary">
              {t('exerciseGoals.card.projectedDate', {
                weeks: Math.ceil(projection.projectedWeeks),
                date: projection.projectedDate.toLocaleDateString(locale, {
                  month: 'short',
                  year: 'numeric',
                }),
              })}
            </Text>
          </View>
        ) : null}

        {/* Meta info */}
        {goal.targetDate || goal.notes ? (
          <GenericCard variant="card">
            <View className="gap-3 p-4">
              {goal.targetDate ? (
                <View className="flex-row justify-between">
                  <Text className="text-xs text-text-tertiary">
                    {t('exerciseGoals.creation.targetDateShort')}
                  </Text>
                  <Text className="text-sm font-medium text-text-primary">
                    {new Date(goal.targetDate).toLocaleDateString(locale, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
              ) : null}
              {goal.notes ? (
                <View>
                  <Text className="mb-1 text-xs text-text-tertiary">
                    {t('exerciseGoals.creation.notes')}
                  </Text>
                  <Text className="text-sm text-text-primary">{goal.notes}</Text>
                </View>
              ) : null}
            </View>
          </GenericCard>
        ) : null}
      </View>
    );
  };

  const renderConsistencyContent = () => {
    return (
      <View className="gap-5">
        <GenericCard variant="card">
          <View className="p-4">
            <View className="mb-4 flex-row flex-wrap gap-3">
              <View
                className="min-w-[45%] flex-1 rounded-xl p-3"
                style={{ backgroundColor: theme.colors.background.white5 }}
              >
                <Text className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                  {t('exerciseGoals.creation.sessionsPerWeek')}
                </Text>
                <Text className="mt-1 text-lg font-bold text-text-primary">
                  {goal.targetSessionsPerWeek ?? '—'}
                </Text>
              </View>

              <View
                className="min-w-[45%] flex-1 rounded-xl p-3"
                style={{ backgroundColor: theme.colors.background.white5 }}
              >
                <Text className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                  {t('exerciseGoals.card.sessionsThisWeek', {
                    count: sessionsThisWeek,
                    target: goal.targetSessionsPerWeek ?? 0,
                  })}
                </Text>
                <Text className="mt-1 text-lg font-bold text-text-primary">{sessionsThisWeek}</Text>
              </View>
            </View>
          </View>
        </GenericCard>

        {goal.targetDate || goal.notes ? (
          <GenericCard variant="card">
            <View className="gap-3 p-4">
              {goal.targetDate ? (
                <View className="flex-row justify-between">
                  <Text className="text-xs text-text-tertiary">
                    {t('exerciseGoals.creation.targetDateShort')}
                  </Text>
                  <Text className="text-sm font-medium text-text-primary">
                    {new Date(goal.targetDate).toLocaleDateString(locale, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
              ) : null}
              {goal.notes ? (
                <View>
                  <Text className="mb-1 text-xs text-text-tertiary">
                    {t('exerciseGoals.creation.notes')}
                  </Text>
                  <Text className="text-sm text-text-primary">{goal.notes}</Text>
                </View>
              ) : null}
            </View>
          </GenericCard>
        ) : null}
      </View>
    );
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={goal.exerciseNameSnapshot ?? t('exerciseGoals.title')}
      subtitle={t(`exerciseGoals.goalTypes.${goal.goalType}`)}
      headerRight={
        onDelete ? (
          <Button
            label={t('common.delete')}
            icon={Trash2}
            iconPosition="left"
            variant="discard"
            size="sm"
            onPress={onDelete}
          />
        ) : undefined
      }
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4 pb-32">
          {goal.goalType === '1rm' ? render1RMContent() : renderConsistencyContent()}
        </View>
      </ScrollView>
      {children}
    </FullScreenModal>
  );
}
