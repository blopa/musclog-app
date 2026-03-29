import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { ProgressInsights } from '../../database/services/ProgressService';
import { useFormatAppNumber } from '../../hooks/useFormatAppNumber';
import { GenericCard } from '../cards/GenericCard';

interface ProgressInsightsSectionProps {
  insights: ProgressInsights;
}

export function ProgressInsightsSection({ insights }: ProgressInsightsSectionProps) {
  const { t } = useTranslation();
  const { formatDecimal, formatInteger } = useFormatAppNumber();

  const renderStat = (label: string, value: string, colorClass: string) => (
    <View className="flex-1 items-center justify-center p-2">
      <Text className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</Text>
      <Text className={`text-lg font-bold ${colorClass}`}>{value}</Text>
    </View>
  );

  const hasEmpiricalTdee = insights.empiricalTdee != null && insights.empiricalTdee !== 0;
  const hasWeightChange = insights.weightChangeWeekly != null && insights.weightChangeWeekly !== 0;
  const hasFatMassChange = insights.fatMassChange != null && insights.fatMassChange !== 0;
  const hasLeanMassChange =
    insights.leanBodyMassChange != null && insights.leanBodyMassChange !== 0;
  const hasAnyWeeklyChange = hasWeightChange || hasFatMassChange || hasLeanMassChange;

  return (
    <View className="mb-4">
      <GenericCard variant="card" containerStyle={{ marginBottom: 16 }}>
        <View className="p-2">
          <Text className="mb-2 ml-2 mt-2 text-sm font-bold text-text-primary">
            {t('progress.metabolicSummary')}
          </Text>
          <View className="flex-row flex-wrap">
            {hasEmpiricalTdee ? (
              <View className="flex-1 items-center justify-center border-r border-border-light p-2">
                <Text className="text-center text-[10px] uppercase tracking-wider text-text-tertiary">
                  {t('progress.empiricalTdee')}
                </Text>
                <Text className="text-lg font-bold text-accent-primary">
                  {formatInteger(Math.round(insights.empiricalTdee))}
                </Text>
                <Text className="text-center text-[8px] uppercase text-text-tertiary">
                  {t('progress.basedOnRecentActivity')}
                </Text>
              </View>
            ) : null}
            <View className="flex-1 items-center justify-center p-2">
              <Text className="text-center text-[10px] uppercase tracking-wider text-text-tertiary">
                {t('progress.statisticalTdee')}
              </Text>
              <Text className="text-lg font-bold text-accent-secondary">
                {formatInteger(Math.round(insights.statisticalTdee))}
              </Text>
              <Text className="text-center text-[8px] uppercase text-text-tertiary">
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
          <Text className="mb-2 ml-2 mt-2 text-sm font-bold text-text-primary">
            {t('progress.bodyFatGoalWeights')}
          </Text>
          <View className="flex-row flex-wrap">
            {[5, 10, 15, 20].map((bf) => (
              <View key={bf} className="flex-1 items-center justify-center p-2">
                <Text className="text-[10px] text-text-tertiary">{bf}%</Text>
                <Text className="text-lg font-bold text-text-primary">
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
