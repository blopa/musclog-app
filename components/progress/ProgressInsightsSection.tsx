import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { ProgressInsights } from '@/database/services/ProgressService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';

interface ProgressInsightsSectionProps {
  insights: ProgressInsights;
}

export function ProgressInsightsSection({ insights }: ProgressInsightsSectionProps) {
  const { t } = useTranslation();
  const { formatDecimal, formatInteger } = useFormatAppNumber();

  const renderStat = (label: string, value: string, colorClass: string) => (
    <View className="flex-1 items-center justify-center p-2">
      <Text className="text-text-tertiary text-[10px] tracking-wider uppercase">{label}</Text>
      <Text className={`text-lg font-bold ${colorClass}`}>{value}</Text>
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
    <View className="mb-4">
      {avg ? (
        <GenericCard variant="card" containerStyle={{ marginBottom: 16 }}>
          <View className="p-2">
            <Text className="text-text-primary mt-2 mb-1 ml-2 text-sm font-bold">
              {t('progress.averageIntakeTitle')}
            </Text>
            <Text className="text-text-tertiary mb-2 ml-2 text-[10px] tracking-wider uppercase">
              {t('progress.averageIntakeSubtitle', { count: avg.dayCount })}
            </Text>
            <View className="border-border-light border-b py-3">
              <Text className="text-text-tertiary text-center text-[10px] tracking-wider uppercase">
                {t('progress.nutritionView.calories')}
              </Text>
              <Text className="text-accent-primary text-center text-xl font-bold">
                {formatInteger(Math.round(avg.calories))} {t('progress.kcal')}
              </Text>
            </View>
            <View className="flex-row flex-wrap">
              {renderStat(
                t('progress.averageIntakeProtein'),
                `${formatDecimal(avg.protein, 1)} g`,
                'text-text-primary'
              )}
              {renderStat(
                t('progress.averageIntakeCarbs'),
                `${formatDecimal(avg.carbs, 1)} g`,
                'text-text-primary'
              )}
              {renderStat(
                t('progress.averageIntakeFat'),
                `${formatDecimal(avg.fat, 1)} g`,
                'text-text-primary'
              )}
              {renderStat(
                t('progress.averageIntakeFiber'),
                `${formatDecimal(avg.fiber, 1)} g`,
                'text-text-primary'
              )}
            </View>
          </View>
        </GenericCard>
      ) : null}

      <GenericCard variant="card" containerStyle={{ marginBottom: 16 }}>
        <View className="p-2">
          <Text className="text-text-primary mt-2 mb-2 ml-2 text-sm font-bold">
            {t('progress.metabolicSummary')}
          </Text>
          <View className="flex-row flex-wrap">
            {hasEmpiricalTdee ? (
              <View className="border-border-light flex-1 items-center justify-center border-r p-2">
                <Text className="text-text-tertiary text-center text-[10px] tracking-wider uppercase">
                  {t('progress.empiricalTdee')}
                </Text>
                <Text className="text-accent-primary text-lg font-bold">
                  {formatInteger(Math.round(insights.empiricalTdee))}
                </Text>
                <Text className="text-text-tertiary text-center text-[8px] uppercase">
                  {t('progress.basedOnRecentActivity')}
                </Text>
              </View>
            ) : null}
            <View className="flex-1 items-center justify-center p-2">
              <Text className="text-text-tertiary text-center text-[10px] tracking-wider uppercase">
                {t('progress.statisticalTdee')}
              </Text>
              <Text className="text-accent-secondary text-lg font-bold">
                {formatInteger(Math.round(insights.statisticalTdee))}
              </Text>
              <Text className="text-text-tertiary text-center text-[8px] uppercase">
                {t('progress.basedOnActivityLevel')}
              </Text>
            </View>
          </View>
        </View>
      </GenericCard>

      {hasAnyWeeklyChange ? (
        <GenericCard variant="card" containerStyle={{ marginBottom: 16 }}>
          <View className="flex-row flex-wrap p-2">
            {hasWeightChange
              ? renderStat(
                  t('progress.weeklyWeightChange'),
                  `${insights.weightChangeWeekly > 0 ? '+' : ''}${formatDecimal(insights.weightChangeWeekly, 2)}`,
                  insights.weightChangeWeekly > 0 ? 'text-red-500' : 'text-green-500'
                )
              : null}
            {hasFatMassChange
              ? renderStat(
                  t('progress.fatMassChange'),
                  `${insights.fatMassChange > 0 ? '+' : ''}${formatDecimal(insights.fatMassChange, 2)}`,
                  insights.fatMassChange > 0 ? 'text-red-500' : 'text-green-500'
                )
              : null}
            {hasLeanMassChange
              ? renderStat(
                  t('progress.leanMassChange'),
                  `${insights.leanBodyMassChange > 0 ? '+' : ''}${formatDecimal(insights.leanBodyMassChange, 2)}`,
                  insights.leanBodyMassChange > 0 ? 'text-green-500' : 'text-red-500'
                )
              : null}
          </View>
        </GenericCard>
      ) : null}

      <GenericCard variant="card" containerStyle={{ marginBottom: 16 }}>
        <View className="p-2">
          <Text className="text-text-primary mt-2 mb-2 ml-2 text-sm font-bold">
            {t('progress.bodyFatGoalWeights')}
          </Text>
          <View className="flex-row flex-wrap">
            {[5, 10, 15, 20].map((bf) => (
              <View key={bf} className="flex-1 items-center justify-center p-2">
                <Text className="text-text-tertiary text-[10px]">{bf}%</Text>
                <Text className="text-text-primary text-lg font-bold">
                  {formatDecimal((insights.targetWeights as any)[`bf${bf}`], 1)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </GenericCard>
    </View>
  );
}
