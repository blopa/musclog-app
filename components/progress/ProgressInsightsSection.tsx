import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { ProgressInsights } from '@/database/services/ProgressService';
import { useEnergyUnit } from '@/hooks/useEnergyUnit';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';

interface ProgressInsightsSectionProps {
  insights: ProgressInsights;
}

export function ProgressInsightsSection({ insights }: ProgressInsightsSectionProps) {
  const { t } = useTranslation();
  const { formatDecimal } = useFormatAppNumber();
  const { formatEnergy, unitLabel } = useEnergyUnit();

  // The unit is its own text in a centered, wrapping row: in a quarter-width cell at large text
  // "126.6 g" no longer fits, and as one string it split at the space and left a bare "g" on the
  // left of the next line. As two items the unit drops under the figure, centered.
  const renderStat = (label: string, value: string, colorClass: string, unit?: string) => (
    <View className="flex-1 items-center justify-center p-2">
      <Text className="text-center text-xs text-text-tertiary">{label}</Text>
      <View className="flex-row flex-wrap items-baseline justify-center">
        <Text className={`text-lg font-semibold tabular-nums ${colorClass}`}>{value}</Text>
        {unit ? <Text className="ml-1 text-xs font-medium text-text-tertiary">{unit}</Text> : null}
      </View>
    </View>
  );

  const hasEmpiricalTdee = insights.empiricalTdee != null && insights.empiricalTdee !== 0;
  const hasWeightChange = insights.weightChangeWeekly != null && insights.weightChangeWeekly !== 0;
  const hasFatMassChange = insights.fatMassChange != null && insights.fatMassChange !== 0;
  const hasLeanMassChange =
    insights.leanBodyMassChange != null && insights.leanBodyMassChange !== 0;
  const hasAnyWeeklyChange = hasWeightChange || hasFatMassChange || hasLeanMassChange;

  const avg = insights.averageIntake;

  return (
    <View>
      {avg ? (
        <GenericCard variant="flat" containerStyle={{ marginBottom: 16 }}>
          <View className="p-2">
            <Text className="mb-1 ml-2 mt-2 text-sm font-semibold text-text-primary">
              {t('progress.averageIntakeTitle')}
            </Text>
            <Text className="mb-2 ml-2 text-xs text-text-tertiary">
              {t('progress.averageIntakeSubtitle', { count: avg.dayCount })}
            </Text>
            <View className="border-b border-border-light py-3">
              <Text className="text-center text-xs text-text-tertiary">
                {t('progress.nutritionView.calories')}
              </Text>
              <Text className="text-center text-xl font-semibold tabular-nums text-accent-primary">
                {formatEnergy(avg.calories)} {unitLabel}
              </Text>
            </View>
            <View className="flex-row flex-wrap">
              {renderStat(
                t('progress.averageIntakeProtein'),
                formatDecimal(avg.protein, 1),
                'text-text-primary',
                t('common.units.g')
              )}
              {renderStat(
                t('progress.averageIntakeCarbs'),
                formatDecimal(avg.carbs, 1),
                'text-text-primary',
                t('common.units.g')
              )}
              {renderStat(
                t('progress.averageIntakeFat'),
                formatDecimal(avg.fat, 1),
                'text-text-primary',
                t('common.units.g')
              )}
              {renderStat(
                t('progress.averageIntakeFiber'),
                formatDecimal(avg.fiber, 1),
                'text-text-primary',
                t('common.units.g')
              )}
            </View>
          </View>
        </GenericCard>
      ) : null}

      <GenericCard variant="flat" containerStyle={{ marginBottom: 16 }}>
        <View className="p-2">
          <Text className="mb-2 ml-2 mt-2 text-sm font-semibold text-text-primary">
            {t('progress.metabolicSummary')}
          </Text>
          <View className="flex-row flex-wrap">
            {hasEmpiricalTdee ? (
              <View className="flex-1 items-center justify-center border-r border-border-light p-2">
                <Text className="text-center text-xs text-text-tertiary">
                  {t('progress.empiricalTdee')}
                </Text>
                <Text className="text-lg font-semibold tabular-nums text-accent-primary">
                  {formatEnergy(insights.empiricalTdee)}
                </Text>
                <Text className="text-center text-[10px] text-text-tertiary">
                  {t('progress.basedOnRecentActivity')}
                </Text>
              </View>
            ) : null}
            <View className="flex-1 items-center justify-center p-2">
              <Text className="text-center text-xs text-text-tertiary">
                {t('progress.statisticalTdee')}
              </Text>
              <Text className="text-lg font-semibold tabular-nums text-accent-secondary">
                {formatEnergy(insights.statisticalTdee)}
              </Text>
              <Text className="text-center text-[10px] text-text-tertiary">
                {t('progress.basedOnActivityLevel')}
              </Text>
            </View>
          </View>
        </View>
      </GenericCard>

      {hasAnyWeeklyChange ? (
        <GenericCard variant="flat" containerStyle={{ marginBottom: 16 }}>
          <View className="flex-row flex-wrap p-2">
            {hasWeightChange
              ? renderStat(
                  t('progress.weeklyWeightChange'),
                  `${insights.weightChangeWeekly > 0 ? '+' : ''}${formatDecimal(insights.weightChangeWeekly, 2)}`,
                  insights.weightChangeWeekly > 0 ? 'text-status-error' : 'text-status-success'
                )
              : null}
            {hasFatMassChange
              ? renderStat(
                  t('progress.fatMassChange'),
                  `${insights.fatMassChange > 0 ? '+' : ''}${formatDecimal(insights.fatMassChange, 2)}`,
                  insights.fatMassChange > 0 ? 'text-status-error' : 'text-status-success'
                )
              : null}
            {hasLeanMassChange
              ? renderStat(
                  t('progress.leanMassChange'),
                  `${insights.leanBodyMassChange > 0 ? '+' : ''}${formatDecimal(insights.leanBodyMassChange, 2)}`,
                  insights.leanBodyMassChange > 0 ? 'text-status-success' : 'text-status-error'
                )
              : null}
          </View>
        </GenericCard>
      ) : null}

      {insights.targetWeights.bf5 !== 0 ? (
        <GenericCard variant="flat" containerStyle={{ marginBottom: 16 }}>
          <View className="p-2">
            <Text className="mb-2 ml-2 mt-2 text-sm font-semibold text-text-primary">
              {t('progress.bodyFatGoalWeights')}
            </Text>
            <View className="flex-row flex-wrap">
              {[5, 10, 15, 20].map((bf) => (
                <View key={bf} className="flex-1 items-center justify-center p-2">
                  <Text className="text-[10px] text-text-tertiary">{bf}%</Text>
                  <Text className="text-lg font-semibold tabular-nums text-text-primary">
                    {formatDecimal((insights.targetWeights as any)[`bf${bf}`], 1)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </GenericCard>
      ) : null}
    </View>
  );
}
